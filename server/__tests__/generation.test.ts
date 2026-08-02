import { EventEmitter } from "events";
import { describe, expect, it } from "bun:test";

import {
  AX_CONTINUATION_PROGRAM,
  RAW_CONTINUATION_PROGRAM,
} from "../../shared/generation";
import type { ModelConfig } from "../../shared/models";
import {
  createOpenRouterAI,
  withReasoningPolicy,
} from "../apis/axProvider";
import {
  type GenerationBackends,
  rawContinuationParams,
  streamAxContinuationWithAI,
} from "../apis/generation.backends";
import { generateTextWithBackends } from "../apis/generation";
import {
  findBoundaryCutoff,
  findWordCutoff,
  getBoundaryRegex,
} from "../apis/generation.helpers";

function createRequest(body: Record<string, unknown>) {
  const req = new EventEmitter() as EventEmitter & {
    body: Record<string, unknown>;
  };
  req.body = body;
  return req;
}

function createResponse() {
  const writes: string[] = [];
  const headers = new Map<string, string>();
  let ended = false;
  let headersSent = false;
  const res = new EventEmitter() as EventEmitter & {
    headersSent: boolean;
    writableEnded: boolean;
    setHeader: (name: string, value: string) => void;
    flushHeaders: () => void;
    write: (chunk: string) => void;
    end: () => void;
    status: (code: number) => typeof res;
    json: (body: unknown) => void;
  };
  Object.defineProperty(res, "headersSent", { get: () => headersSent });
  Object.defineProperty(res, "writableEnded", { get: () => ended });
  res.setHeader = (name, value) => void headers.set(name, value);
  res.flushHeaders = () => {
    headersSent = true;
  };
  res.write = (chunk) => {
    if (!ended) writes.push(chunk);
  };
  res.end = () => {
    ended = true;
  };
  res.status = () => res;
  res.json = (body) => {
    writes.push(JSON.stringify(body));
    ended = true;
  };
  return { res, writes, headers, get ended() { return ended; } };
}

function readContent(writes: string[]): string {
  return writes
    .flatMap((write) => write.split("\n"))
    .filter((line) => line.startsWith("data: {") && line.includes("content"))
    .map((line) => (JSON.parse(line.slice(6)) as { content: string }).content)
    .join("");
}

function readReceipt(writes: string[]) {
  return writes
    .flatMap((write) => write.split("\n"))
    .filter((line) => line.startsWith("data: {") && line.includes("receipt"))
    .map(
      (line) =>
        (JSON.parse(line.slice(6)) as {
          receipt: import("../../shared/generation").GenerationReceipt;
        }).receipt,
    )
    .at(-1);
}

const model = (generationMode: ModelConfig["generationMode"]): ModelConfig => ({
  name: "Test Model",
  maxTokens: 1024,
  defaultTemp: 0.7,
  generationMode,
});

describe("semantic length boundaries", () => {
  it("preserves the sentence delimiter", () => {
    const rx = getBoundaryRegex("sentence")!;
    expect(findBoundaryCutoff(`She said "Go." Then left.`, 0, rx)).toBe(14);
  });

  it("waits for a word boundary and preserves leading whitespace", () => {
    expect(findWordCutoff("  Morning")).toBeNull();
    expect(findWordCutoff("  Morning came")).toBe(9);
  });
});

describe("generation fidelity and routing", () => {
  it("writes the selected reasoning policy into the actual Ax request body", async () => {
    let requestBody: Record<string, unknown> = {};
    const wrapped = withReasoningPolicy("low", async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    });

    await wrapped("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "test/judge" }),
    });

    expect(requestBody).toEqual({
      model: "test/judge",
      reasoning: { effort: "low" },
    });
  });

  it("explicitly disables reasoning for raw continuation requests", () => {
    const params = rawContinuationParams({
      model: "anthropic/claude-opus-5",
      storySoFar: "The lantern died.",
      temperature: 0.7,
      maxTokens: 160,
      signal: new AbortController().signal,
    });

    expect(params.prompt).toBe("The lantern died.");
    expect(params.reasoning).toEqual({ effort: "none" });
  });

  it("sends exact loom text to raw completion and streams exact returned bytes", async () => {
    const prompt = "The day ended.";
    let receivedPrompt = "";
    let completionCalls = 0;
    let instructionCalls = 0;
    const backends: GenerationBackends = {
      completion: async function* (request) {
        completionCalls += 1;
        receivedPrompt = request.storySoFar;
        yield { type: "text" as const, text: "  **Morning**" };
        yield { type: "text" as const, text: "\n\nOf course: _rain_" };
        yield {
          type: "usage" as const,
          usage: {
            promptTokens: 4,
            completionTokens: 9,
            totalTokens: 13,
            reasoningTokens: 0,
            cost: 0.001,
          },
        };
      },
      instruction: async function* () {
        instructionCalls += 1;
        yield { type: "text" as const, text: "unexpected" };
      },
    };
    const req = createRequest({
      prompt,
      model: "test/raw",
      lengthMode: "page",
    });
    const response = createResponse();

    await generateTextWithBackends(
      req as never,
      response.res as never,
      backends,
      () => model("completion"),
    );

    expect(completionCalls).toBe(1);
    expect(instructionCalls).toBe(0);
    expect(receivedPrompt).toBe(prompt);
    expect(readContent(response.writes)).toBe(
      "  **Morning**\n\nOf course: _rain_",
    );
    expect(response.headers.get("X-Textile-Generation-Mode")).toBe(
      "completion",
    );
    expect(response.headers.get("X-Textile-Generation-Program")).toBe(
      RAW_CONTINUATION_PROGRAM,
    );
    expect(response.headers.get("X-Textile-Reasoning-Policy")).toBe("none");
    expect(readReceipt(response.writes)).toEqual({
      mode: "completion",
      program: RAW_CONTINUATION_PROGRAM,
      reasoningPolicy: "none",
      usage: {
        promptTokens: 4,
        completionTokens: 9,
        totalTokens: 13,
        reasoningTokens: 0,
        cost: 0.001,
      },
    });
  });

  it("routes instructed models through one Ax program without output cleanup", async () => {
    let completionCalls = 0;
    let instructionCalls = 0;
    const backends: GenerationBackends = {
      completion: async function* () {
        completionCalls += 1;
        yield { type: "text" as const, text: "unexpected" };
      },
      instruction: async function* (request) {
        instructionCalls += 1;
        expect(request.storySoFar).toBe("Once upon a time");
        yield {
          type: "text" as const,
          text: "Of course. **Here is the story continued:**",
        };
      },
    };
    const req = createRequest({
      prompt: "Once upon a time",
      model: "test/instruction",
      lengthMode: "page",
    });
    const response = createResponse();

    await generateTextWithBackends(
      req as never,
      response.res as never,
      backends,
      () => model("instruction"),
    );

    expect(instructionCalls).toBe(1);
    expect(completionCalls).toBe(0);
    expect(readContent(response.writes)).toBe(
      "Of course. **Here is the story continued:**",
    );
    expect(response.headers.get("X-Textile-Generation-Program")).toBe(
      AX_CONTINUATION_PROGRAM,
    );
  });

  it("closes a semantic-boundary iterator without aborting Ax", async () => {
    let requestSignal: AbortSignal | undefined;
    let iteratorClosed = false;
    const backends: GenerationBackends = {
      completion: async function* () {
        yield { type: "text" as const, text: "unexpected" };
      },
      instruction: async function* (request) {
        requestSignal = request.signal;
        try {
          yield { type: "text" as const, text: "A complete sentence. More" };
        } finally {
          iteratorClosed = true;
        }
      },
    };
    const req = createRequest({
      prompt: "Once upon a time",
      model: "test/instruction",
      lengthMode: "sentence",
    });
    const response = createResponse();

    await generateTextWithBackends(
      req as never,
      response.res as never,
      backends,
      () => model("instruction"),
    );

    expect(readContent(response.writes)).toBe("A complete sentence.");
    expect(iteratorClosed).toBe(true);
    expect(requestSignal?.aborted).toBe(false);
  });

  it("makes one real Ax attempt with the explicitly configured OpenRouter model", async () => {
    let calls = 0;
    let requestBody: Record<string, unknown> = {};
    const mockFetch: typeof fetch = async (input, init) => {
      calls += 1;
      expect(String(input)).toBe(
        "https://openrouter.ai/api/v1/chat/completions",
      );
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const sse = [
        'data: {"id":"probe","object":"chat.completion.chunk","created":1,"model":"test/instruction","choices":[{"index":0,"delta":{"role":"assistant","content":"Continuation: A real passage."},"finish_reason":null}]}',
        'data: {"id":"probe","object":"chat.completion.chunk","created":1,"model":"test/instruction","choices":[{"index":0,"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"completion_tokens_details":{"reasoning_tokens":0}}}',
        "data: [DONE]",
        "",
      ].join("\n\n");
      return new Response(sse, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    };
    let providerUsage: unknown;
    const llm = createOpenRouterAI(
      "test/instruction",
      "none",
      mockFetch,
      (usage) => {
        providerUsage = usage;
      },
    );
    const events: import("../apis/generation.backends").GenerationStreamEvent[] = [];

    for await (const chunk of streamAxContinuationWithAI(
      {
        model: "test/instruction",
        storySoFar: "The lantern died.",
        temperature: 0.7,
        maxTokens: 80,
        signal: new AbortController().signal,
      },
      llm,
    )) {
      events.push(chunk);
    }

    expect(calls).toBe(1);
    expect(requestBody.model).toBe("test/instruction");
    expect(requestBody.stream).toBe(true);
    expect(requestBody.reasoning).toEqual({ effort: "none" });
    expect(
      events
        .filter((event) => event.type === "text")
        .map((event) => event.text)
        .join(""),
    ).toBe("A real passage.");
    expect(events.find((event) => event.type === "usage")).toBeUndefined();
    expect(providerUsage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      completion_tokens_details: { reasoning_tokens: 0 },
    });
  });

  it("sends a visible SSE error when the client close races upstream failure", async () => {
    const originalConsoleError = console.error;
    const req = createRequest({
      prompt: "Once upon a time",
      model: "test/raw",
      lengthMode: "sentence",
    });
    const response = createResponse();
    const backends: GenerationBackends = {
      completion: async function* () {
        req.emit("close");
        yield { type: "text" as const, text: "" };
        throw new Error("Request was aborted.");
      },
      instruction: async function* () {
        yield { type: "text" as const, text: "unexpected" };
      },
    };
    console.error = () => {};

    try {
      await generateTextWithBackends(
        req as never,
        response.res as never,
        backends,
        () => model("completion"),
      );
    } finally {
      console.error = originalConsoleError;
    }

    expect(response.writes).toEqual([
      `data: ${JSON.stringify({ error: "Request was aborted." })}\n\n`,
    ]);
    expect(response.writes.join("")).not.toContain("[DONE]");
    expect(response.ended).toBe(true);
  });
});
