import type { GenerationUsage } from "../../shared/generation";
import { config } from "../config";

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Decode the stable accounting fields from OpenRouter's generation record. */
export function usageFromGenerationRecord(payload: unknown): GenerationUsage | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const promptTokens = finite(record.tokens_prompt);
  const completionTokens = finite(record.tokens_completion);
  const normalized: GenerationUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens !== undefined && completionTokens !== undefined
      ? promptTokens + completionTokens
      : undefined,
    reasoningTokens: finite(record.native_tokens_reasoning),
    cost: finite(record.total_cost),
  };
  return Object.values(normalized).some((value) => value !== undefined)
    ? normalized
    : undefined;
}

/** Recover accounting after Textile intentionally closes a provider stream early. */
export async function lookupOpenRouterGenerationUsage(
  generationId: string,
  fetchImplementation: typeof fetch = globalThis.fetch,
): Promise<GenerationUsage | undefined> {
  if (!config.openRouterApiKey) return undefined;
  // Generation accounting is asynchronously materialized. Keep this bounded:
  // prose has already streamed, and missing accounting must not hang the call.
  const delays = [0, 250, 750, 1_500, 2_500];
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const response = await fetchImplementation(
        `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
        { headers: { Authorization: `Bearer ${config.openRouterApiKey}` } },
      );
      if (!response.ok) continue;
      const usage = usageFromGenerationRecord(await response.json());
      if (usage) return usage;
    } catch {
      // The provider identity remains in the receipt; unavailable accounting
      // must not turn already-delivered prose into a failed generation.
    }
  }
  return undefined;
}
