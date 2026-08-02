import { ax, type AxAIService } from "@ax-llm/ax";
import type OpenAI from "openai";

import {
  CONTINUATION_REASONING_POLICY,
  type GenerationMode,
  type GenerationUsage,
} from "../../shared/generation";
import { createOpenRouterAI } from "./axProvider";
import { openai } from "./openaiClient";

export interface GenerationBackendRequest {
  model: string;
  storySoFar: string;
  temperature: number;
  maxTokens: number;
  signal: AbortSignal;
}

export type GenerationStreamEvent =
  | { type: "text"; text: string }
  | { type: "usage"; usage: GenerationUsage };

export type GenerationTextStream = AsyncIterable<GenerationStreamEvent>;

export interface GenerationBackends {
  completion: (request: GenerationBackendRequest) => GenerationTextStream;
  instruction: (request: GenerationBackendRequest) => GenerationTextStream;
}

type OpenRouterRawCompletionParams =
  OpenAI.CompletionCreateParamsStreaming & {
    reasoning: { effort: "none" };
  };

export function rawContinuationParams(
  request: GenerationBackendRequest,
): OpenRouterRawCompletionParams {
  return {
    model: request.model,
    prompt: request.storySoFar,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
    stream: true,
    // Continuation is token prediction, not a reasoning task. Make the policy
    // explicit so provider defaults cannot consume hidden output budget.
    reasoning: { effort: "none" },
  };
}

function numberField(
  value: unknown,
): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function normalizeOpenRouterUsage(
  value: unknown,
): GenerationUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const details =
    usage.completion_tokens_details &&
    typeof usage.completion_tokens_details === "object"
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : {};
  const normalized: GenerationUsage = {
    promptTokens: numberField(usage.prompt_tokens),
    completionTokens: numberField(usage.completion_tokens),
    totalTokens: numberField(usage.total_tokens),
    reasoningTokens: numberField(details.reasoning_tokens),
    cost: numberField(usage.cost),
  };
  return Object.values(normalized).some((field) => field !== undefined)
    ? normalized
    : undefined;
}

export async function* streamRawContinuation(
  request: GenerationBackendRequest,
): AsyncGenerator<GenerationStreamEvent> {
  const stream = await openai.completions.create(
    rawContinuationParams(request),
    { signal: request.signal },
  );

  for await (const chunk of stream) {
    const usage = (chunk as { usage?: unknown }).usage;
    if (usage !== undefined) {
      console.log("[OpenRouter] Usage:", usage);
      const normalized = normalizeOpenRouterUsage(usage);
      if (normalized) yield { type: "usage", usage: normalized };
    }
    const text = chunk.choices?.[0]?.text ?? "";
    if (text) yield { type: "text", text };
  }
}

export async function* streamAxContinuation(
  request: GenerationBackendRequest,
): AsyncGenerator<GenerationStreamEvent> {
  let providerUsage: GenerationUsage | undefined;
  yield* streamAxContinuationWithAI(
    request,
    createOpenRouterAI(
      request.model,
      CONTINUATION_REASONING_POLICY,
      undefined,
      (usage) => {
        providerUsage = normalizeOpenRouterUsage(usage);
      },
    ),
  );
  if (providerUsage) yield { type: "usage", usage: providerUsage };
}

export async function* streamAxContinuationWithAI(
  request: GenerationBackendRequest,
  llm: AxAIService,
): AsyncGenerator<GenerationStreamEvent> {
  const continuation = ax(
    'storySoFar:string "The exact visible story path" -> continuation:string "The next passage of the story"',
    {
      description:
        "Continue the supplied story with the next passage. The continuation is story text, not commentary about the task.",
    },
  );

  const stream = continuation.streamingForward(
    llm,
    { storySoFar: request.storySoFar },
    {
      abortSignal: request.signal,
      // The OpenRouter request wrapper enforces `reasoning.effort = none`.
      // Ax's `thinkingTokenBudget: "none"` is not equivalent: its
      // OpenAI-compatible adapter omits the field and provider defaults win.
      // Ax counts total attempts, not retries: 1 means one call and no retry.
      maxRetries: 1,
      modelConfig: {
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      },
    },
  );

  for await (const chunk of stream) {
    const text = chunk.delta.continuation;
    if (text) yield { type: "text", text };
  }

}

export const defaultGenerationBackends: GenerationBackends = {
  completion: streamRawContinuation,
  instruction: streamAxContinuation,
};

export function getGenerationBackend(
  backends: GenerationBackends,
  mode: GenerationMode,
): GenerationBackends[GenerationMode] {
  return backends[mode];
}
