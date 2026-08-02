export type GenerationMode = "completion" | "instruction";
export type ReasoningPolicy = "none" | "low";

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
