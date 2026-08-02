export type GenerationMode = "completion" | "instruction";
export const REASONING_POLICIES = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type ReasoningPolicy = (typeof REASONING_POLICIES)[number];

export function isReasoningPolicy(value: unknown): value is ReasoningPolicy {
  return REASONING_POLICIES.includes(value as ReasoningPolicy);
}

export type ReasoningDetail = Record<string, unknown>;

/** Exact reasoning material OpenRouter chose to expose; absent means unobserved. */
export interface GenerationReasoning {
  text?: string;
  details?: ReasoningDetail[];
}

export interface GenerationUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cost?: number;
}

export interface GenerationReceipt {
  mode: GenerationMode;
  program: string;
  reasoningPolicy: ReasoningPolicy;
  reasoning?: GenerationReasoning;
  usage?: GenerationUsage;
}

export const RAW_CONTINUATION_PROGRAM = "textile/raw-continuation-v2";
export const AX_CONTINUATION_PROGRAM = "textile/ax-continuation-v2";
export const AX_CONTINUATION_JUDGE_PROGRAM =
  "textile/ax-continuation-judge-v3";
export const CONTINUATION_REASONING_POLICY = "none" as const;
export const JUDGE_REASONING_POLICY = "low" as const;

export function generationProgramForMode(mode: GenerationMode): string {
  return mode === "instruction"
    ? AX_CONTINUATION_PROGRAM
    : RAW_CONTINUATION_PROGRAM;
}
