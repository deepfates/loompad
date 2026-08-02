import type { Request, Response } from "express";
import { ax } from "@ax-llm/ax";
import {
  AX_CONTINUATION_JUDGE_PROGRAM,
  JUDGE_REASONING_POLICY,
  type GenerationUsage,
} from "../../shared/generation";
import { config } from "../config";
import { createOpenRouterAI } from "./axProvider";
import { normalizeOpenRouterUsage } from "./generation.backends";
import { validateJudgeRequestBody } from "./validators";

export const JUDGE_TIMEOUT_MS = 30_000;

export class JudgeTimeoutError extends Error {
  constructor() {
    super(`Judge exceeded its ${JUDGE_TIMEOUT_MS / 1000}-second deadline`);
    this.name = "JudgeTimeoutError";
  }
}

export async function withJudgeTimeout<T>(
  operation: Promise<T>,
  abort: () => void,
  timeoutMs = JUDGE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          abort();
          reject(new JudgeTimeoutError());
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function judgeContinuation(req: Request, res: Response) {
  try {
    if (!config.openRouterApiKey) {
      return res.status(503).json({
        error: "Automatic judging is disabled. Set OPENROUTER_API_KEY to enable it.",
      });
    }
    const parsed = validateJudgeRequestBody(req.body);
    if (!parsed.ok) {
      console.error("[Judge] Invalid request body:", req.body);
      return res.status(400).json({ error: parsed.error });
    }
    const { context, options, model, temperature } = parsed.value;

    console.log(
      `[Judge] Evaluating ${options.length} options with model ${model}`,
    );

    // Define the signature for the judge
    const judge = ax(
      `
        context:string "The exact visible story path",
        options:string[] "Candidate next passages, in display order"
        ->
        choice:number "The 1-based index of the most natural and coherent story continuation. Return 0 only if none continue the story."
      `,
      {
        description:
          "Choose which candidate should become the next story passage. Prefer prose that continues the context directly; task commentary or assistant framing is not story continuation.",
      },
    );

    // Configure Ax's native OpenRouter provider with an explicit model.
    let usage: GenerationUsage | undefined;
    const llm = createOpenRouterAI(
      model,
      JUDGE_REASONING_POLICY,
      undefined,
      (providerUsage) => {
        usage = normalizeOpenRouterUsage(providerUsage);
      },
    );

    // Run the evaluation
    const abortController = new AbortController();
    const result = await withJudgeTimeout(
      judge.forward(
        llm,
        {
          context,
          options,
        },
        {
          abortSignal: abortController.signal,
          // Ax counts total attempts, not retries: 1 means one call and no retry.
          maxRetries: 1,
          // The OpenRouter request wrapper applies the explicit low-reasoning
          // policy to the actual provider request body.
          modelConfig: {
            temperature: temperature ?? 0.1,
          } as unknown as Record<string, unknown>,
        },
      ),
      () => abortController.abort(),
    );

    console.log("[Judge] Result:", result);

    const choice = result.choice;
    // Validate result
    if (typeof choice === "number" && choice > 0 && choice <= options.length) {
      // Convert 1-based index (from ax prompt) to 0-based index (for frontend)
      return res.json({
        choice: choice - 1,
        raw: JSON.stringify(result),
        program: AX_CONTINUATION_JUDGE_PROGRAM,
        reasoningPolicy: JUDGE_REASONING_POLICY,
        ...(usage ? { usage } : {}),
      });
    }

    return res.json({
      choice: null,
      raw: JSON.stringify(result),
      program: AX_CONTINUATION_JUDGE_PROGRAM,
      reasoningPolicy: JUDGE_REASONING_POLICY,
      ...(usage ? { usage } : {}),
    });
  } catch (error) {
    console.error("[Judge] Error:", error);
    const timedOut = error instanceof JudgeTimeoutError;
    return res.status(timedOut ? 504 : 500).json({
      error: timedOut ? error.message : "Judge evaluation failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
