import type {
  GenerationReasoning,
  ReasoningDetail,
} from "../../shared/generation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractOpenRouterReasoning(
  payload: unknown,
): GenerationReasoning | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return undefined;
  const choice = payload.choices[0];
  if (!isRecord(choice)) return undefined;
  const carrier = isRecord(choice.delta)
    ? choice.delta
    : isRecord(choice.message)
      ? choice.message
      : choice;
  const rawText = carrier.reasoning ?? carrier.reasoning_content;
  const text = typeof rawText === "string" && rawText ? rawText : undefined;
  const details = Array.isArray(carrier.reasoning_details)
    ? carrier.reasoning_details.filter(isRecord) as ReasoningDetail[]
    : undefined;
  if (!text && !details?.length) return undefined;
  return {
    ...(text ? { text } : {}),
    ...(details?.length ? { details } : {}),
  };
}

export function mergeGenerationReasoning(
  current: GenerationReasoning | undefined,
  next: GenerationReasoning,
): GenerationReasoning {
  return {
    ...((current?.text || next.text)
      ? { text: `${current?.text ?? ""}${next.text ?? ""}` }
      : {}),
    ...((current?.details?.length || next.details?.length)
      ? { details: [...(current?.details ?? []), ...(next.details ?? [])] }
      : {}),
  };
}
