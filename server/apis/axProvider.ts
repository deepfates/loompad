import { ai } from "@ax-llm/ax";

import type { ReasoningPolicy } from "../../shared/generation";
import { config } from "../config";

type UsageObserver = (usage: unknown) => void;

function observeUsageLine(line: string, observer?: UsageObserver): void {
  if (!observer || !line.startsWith("data:")) return;
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return;
  try {
    const payload = JSON.parse(data) as { usage?: unknown };
    if (payload.usage !== undefined) observer(payload.usage);
  } catch {
    // A partial line remains buffered; a complete non-JSON SSE event is not a
    // provider usage receipt and is intentionally ignored.
  }
}

function observeStreamingUsage(
  response: Response,
  observer?: UsageObserver,
): Response {
  if (!observer || !response.body) return response;

  const decoder = new TextDecoder();
  let buffered = "";
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        let newline = buffered.indexOf("\n");
        while (newline >= 0) {
          observeUsageLine(buffered.slice(0, newline).replace(/\r$/, ""), observer);
          buffered = buffered.slice(newline + 1);
          newline = buffered.indexOf("\n");
        }
        controller.enqueue(chunk);
      },
      flush() {
        buffered += decoder.decode();
        if (buffered) observeUsageLine(buffered.replace(/\r$/, ""), observer);
      },
    }),
  );

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function withReasoningPolicy(
  policy: ReasoningPolicy,
  fetchImplementation: typeof fetch,
  observeUsage?: UsageObserver,
): typeof fetch {
  return async (input, init) => {
    if (!init?.body || !String(input).includes("/chat/completions")) {
      return fetchImplementation(input, init);
    }

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const response = await fetchImplementation(input, {
      ...init,
      body: JSON.stringify({
        ...body,
        reasoning: { effort: policy },
      }),
    });

    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      return observeStreamingUsage(response, observeUsage);
    }
    if (observeUsage) {
      try {
        const payload = (await response.clone().json()) as { usage?: unknown };
        if (payload.usage !== undefined) observeUsage(payload.usage);
      } catch {
        // Error and empty responses are interpreted by Ax; provenance remains
        // absent when the provider did not return a readable usage object.
      }
    }
    return response;
  };
}

export function createOpenRouterAI(
  model: string,
  reasoningPolicy: ReasoningPolicy,
  fetchOverride?: typeof fetch,
  observeUsage?: UsageObserver,
) {
  if (!config.openRouterApiKey) {
    throw new Error("OpenRouter is not configured");
  }

  return ai({
    name: "openrouter",
    apiKey: config.openRouterApiKey,
    config: { model },
    referer: "https://textile.lol",
    title: "Textile",
    options: {
      fetch: withReasoningPolicy(
        reasoningPolicy,
        fetchOverride ?? globalThis.fetch,
        observeUsage,
      ),
    },
  });
}
