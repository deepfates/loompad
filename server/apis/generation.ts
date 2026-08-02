import type { Request, Response } from "express";

import {
  CONTINUATION_REASONING_POLICY,
  generationProgramForMode,
  type GenerationReceipt,
  type ReasoningPolicy,
} from "../../shared/generation";
import type { ModelId } from "../../shared/models";
import {
  DEFAULT_LENGTH_MODE,
  LENGTH_PRESETS,
  type LengthMode,
} from "../../shared/lengthPresets";
import { config } from "../config";
import { getModel } from "../modelsStore";
import type { ModelConfig } from "../../shared/models";
import {
  defaultGenerationBackends,
  getGenerationBackend,
  type GenerationBackends,
} from "./generation.backends";
import {
  findBoundaryCutoff,
  findWordCutoff,
  getBoundaryRegex,
} from "./generation.helpers";
import { validateGenerateRequestBody } from "./validators";
import { mergeGenerationReasoning } from "./providerReasoning";
import { resolveContinuationReasoningPolicy } from "./reasoningPolicy";

const STREAM_BOUNDARY_LOOKBEHIND = 32;

function writeContent(res: Response, content: string): void {
  if (content) {
    res.write(`data: ${JSON.stringify({ content })}\n\n`);
  }
}

export async function generateTextWithBackends(
  req: Request,
  res: Response,
  backends: GenerationBackends,
  modelLookup: (model: ModelId) => ModelConfig | undefined = getModel,
  reasoningPolicyLookup: (
    model: ModelId,
  ) => Promise<ReasoningPolicy> = async () => CONTINUATION_REASONING_POLICY,
): Promise<Response | void> {
  let ended = false;
  let clientDisconnected = false;
  let activeAbortController: AbortController | null = null;

  let receipt: GenerationReceipt | null = null;

  const finish = () => {
    if (ended) return;
    if (receipt) {
      res.write(`data: ${JSON.stringify({ receipt })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
    ended = true;
  };

  try {
    if (!config.openRouterApiKey) {
      return res.status(503).json({
        error:
          "Generation is disabled. Set OPENROUTER_API_KEY to generate; local corpus reading and curation remain available.",
      });
    }

    const parsed = validateGenerateRequestBody(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const { prompt, model, temperature, maxTokens, lengthMode } = parsed.value;
    const modelConfig = modelLookup(model as ModelId);
    if (!modelConfig) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const mode = lengthMode ?? DEFAULT_LENGTH_MODE;
    const preset = LENGTH_PRESETS[mode] ?? LENGTH_PRESETS[DEFAULT_LENGTH_MODE];
    const maxTokensToUse = Math.max(
      1,
      Math.min(
        modelConfig.maxTokens,
        preset.maxTokens,
        maxTokens ?? preset.maxTokens,
      ),
    );
    const generationMode = modelConfig.generationMode;
    const program = generationProgramForMode(generationMode);
    const reasoningPolicy = await reasoningPolicyLookup(model as ModelId);
    receipt = {
      mode: generationMode,
      program,
      reasoningPolicy,
    };
    const abortController = new AbortController();
    activeAbortController = abortController;

    console.log("[OpenRouter] Request:", {
      model,
      generation_mode: generationMode,
      program,
      max_tokens: maxTokensToUse,
      temperature: temperature ?? modelConfig.defaultTemp,
      prompt_length: prompt.length,
      prompt_preview: prompt.slice(-100),
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Textile-Generation-Mode", generationMode);
    res.setHeader("X-Textile-Generation-Program", program);
    res.setHeader(
      "X-Textile-Reasoning-Policy",
      reasoningPolicy,
    );
    res.flushHeaders();

    res.on("close", () => {
      if (!ended && !res.writableEnded) {
        clientDisconnected = true;
        ended = true;
        activeAbortController?.abort();
      }
    });

    const backend = getGenerationBackend(backends, generationMode);
    const stream = backend({
      model,
      storySoFar: prompt,
      temperature: temperature ?? modelConfig.defaultTemp,
      maxTokens: maxTokensToUse,
      reasoningPolicy,
      onReasoning: (reasoning) => {
        if (!receipt) return;
        receipt = {
          ...receipt,
          reasoning: mergeGenerationReasoning(receipt.reasoning, reasoning),
        };
      },
      signal: abortController.signal,
    });

    const boundaryRegex = getBoundaryRegex(mode);
    let accumulated = "";
    let sentIndex = 0;

    for await (const event of stream) {
      if (ended) continue;
      if (event.type === "usage") {
        if (receipt) receipt = { ...receipt, usage: event.usage };
        continue;
      }
      const delta = event.text;
      if (!delta) continue;
      accumulated += delta;

      if (mode === "word") {
        const cutoff = findWordCutoff(accumulated);
        if (cutoff !== null) {
          writeContent(res, accumulated.slice(0, cutoff));
          // Returning closes the async iterator. Explicitly aborting Ax here
          // dispatches an unhandled AbortError from its stream listener under
          // Bun and can terminate the whole Textile server.
          finish();
          return;
        }
        continue;
      }

      if (boundaryRegex) {
        const cutoff = findBoundaryCutoff(accumulated, 0, boundaryRegex);
        if (cutoff !== null) {
          writeContent(res, accumulated.slice(sentIndex, cutoff));
          // Let async-iterator cleanup cancel the unread remainder. Ax's abort
          // listener can otherwise reject outside this request's try/catch.
          finish();
          return;
        }

        const safeEnd = Math.max(
          sentIndex,
          accumulated.length - STREAM_BOUNDARY_LOOKBEHIND,
        );
        writeContent(res, accumulated.slice(sentIndex, safeEnd));
        sentIndex = safeEnd;
      }
    }

    if (!ended) {
      writeContent(res, accumulated.slice(sentIndex));
      finish();
    }
  } catch (error: unknown) {
    if (ended) return;

    console.error("Generation error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An error occurred during text generation";

    if (!res.headersSent) {
      return res.status(500).json({ error: errorMessage });
    }
    if (!clientDisconnected && !res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
      ended = true;
      return;
    }
    res.end();
    ended = true;
  }
}

export async function generateText(req: Request, res: Response) {
  return generateTextWithBackends(
    req,
    res,
    defaultGenerationBackends,
    getModel,
    resolveContinuationReasoningPolicy,
  );
}
