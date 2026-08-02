import { ai } from "@ax-llm/ax";

import type {
  GenerationReasoning,
  ReasoningPolicy,
} from "../../shared/generation";
import { config } from "../config";
import { extractOpenRouterReasoning } from "./providerReasoning";

type UsageObserver = (usage: unknown) => void;
type ReasoningObserver = (reasoning: GenerationReasoning) => void;
type GenerationIdObserver = (generationId: string) => void;

function observeProviderLine(
  line: string,
  usageObserver?: UsageObserver,
  reasoningObserver?: ReasoningObserver,
): void {
  if ((!usageObserver && !reasoningObserver) || !line.startsWith("data:")) return;
  const data = line.slice(5).trim();
  if (!data || data === "[DONE]") return;
  try {
    const payload = JSON.parse(data) as { usage?: unknown };
    if (payload.usage !== undefined) usageObserver?.(payload.usage);
    const reasoning = extractOpenRouterReasoning(payload);
    if (reasoning) reasoningObserver?.(reasoning);
  } catch {
    // A partial line remains buffered; a complete non-JSON SSE event is not a
    // provider usage receipt and is intentionally ignored.
  }
}

function observeStreamingProviderData(
  response: Response,
  usageObserver?: UsageObserver,
  reasoningObserver?: ReasoningObserver,
): Response {
  if ((!usageObserver && !reasoningObserver) || !response.body) return response;

  const decoder = new TextDecoder();
  let buffered = "";
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffered += decoder.decode(chunk, { stream: true });
        let newline = buffered.indexOf("\n");
        while (newline >= 0) {
          observeProviderLine(
            buffered.slice(0, newline).replace(/\r$/, ""),
            usageObserver,
            reasoningObserver,
          );
          buffered = buffered.slice(newline + 1);
          newline = buffered.indexOf("\n");
        }
        controller.enqueue(chunk);
      },
      flush() {
        buffered += decoder.decode();
        if (buffered) {
          observeProviderLine(
            buffered.replace(/\r$/, ""),
            usageObserver,
            reasoningObserver,
          );
        }
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
  observeReasoning?: ReasoningObserver,
  observeGenerationId?: GenerationIdObserver,
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
    const generationId = response.headers.get("x-generation-id");
    if (generationId) observeGenerationId?.(generationId);

    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      return observeStreamingProviderData(
        response,
        observeUsage,
        observeReasoning,
      );
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
    if (observeReasoning) {
      try {
        const payload = await response.clone().json();
        const reasoning = extractOpenRouterReasoning(payload);
        if (reasoning) observeReasoning(reasoning);
      } catch {
        // The provider exposed no readable reasoning artifact.
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
  observeReasoning?: ReasoningObserver,
  observeGenerationId?: GenerationIdObserver,
) {
  if (!config.openRouterApiKey) {
    throw new Error("OpenRouter is not configured");
  }

  return ai({
    name: "openrouter",
    apiKey: config.openRouterApiKey,
    config: { model },
    referer: "https://textile.quest",
    title: "Textile",
    options: {
      fetch: withReasoningPolicy(
        reasoningPolicy,
        fetchOverride ?? globalThis.fetch,
        observeUsage,
        observeReasoning,
        observeGenerationId,
      ),
    },
  });
}
