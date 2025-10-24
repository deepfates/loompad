import type { Request, Response } from "express";
import type { ModelId } from "../../shared/models";
import { getModel } from "../modelsStore";
import {
  DEFAULT_LENGTH_MODE,
  LENGTH_PRESETS,
  type LengthMode,
} from "../../shared/lengthPresets";
import {
  ENDING_NEWLINE_RE,
  ENDING_WHITESPACE_RE,
  NON_WHITESPACE_RE,
} from "../../shared/textSeams";
import {
  getBoundaryRegex as helperGetBoundaryRegex,
  findBoundaryCutoff as helperFindBoundaryCutoff,
  normalizeJoin as helperNormalizeJoin,
} from "./generation.helpers";

/**
 * Design note:
 * We intentionally omit 'stop' sequences from upstream OpenAI requests.
 * Instead, semantic stopping is enforced server-side using boundary detection
 * (see getBoundaryRegex and findBoundaryCutoff in this module). This preserves
 * delimiters exactly as generated and gives us more flexible control.
 */
import { openai } from "./openaiClient";

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  lengthMode?: LengthMode;
}

// Boundary regex is provided by helpers to keep API lean
function getBoundaryRegex(mode: LengthMode): RegExp | null {
  return helperGetBoundaryRegex(mode);
}

const OVERLAP = 32;

// Find the first boundary whose end is beyond sentIndex (delegated to helpers)
function findBoundaryCutoff(
  accumulated: string,
  sentIndex: number,
  rx: RegExp,
): number | null {
  return helperFindBoundaryCutoff(accumulated, sentIndex, rx);
}

type JoinState = {
  hasEmittedAny: boolean;
  endedWithWhitespace: boolean;
  endedWithNewline: boolean;
};

// Normalize join delegated to helpers for consistency across client/server
function normalizeJoin(prev: JoinState, segment: string): string {
  return helperNormalizeJoin(prev, segment);
}

// Tests should import helpers directly from ./generation.helpers; no __test export

export async function generateText(req: Request, res: Response) {
  try {
    const { prompt, model, temperature, maxTokens, lengthMode } =
      req.body as GenerateRequest;

    if (!prompt || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const modelConfig = getModel(model);
    if (!modelConfig) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const mode = lengthMode ?? DEFAULT_LENGTH_MODE;
    const preset = LENGTH_PRESETS[mode] ?? LENGTH_PRESETS[DEFAULT_LENGTH_MODE];

    const modelMaxTokens = modelConfig.maxTokens;
    const maxTokensToUse = Math.min(
      preset.maxTokens,
      modelMaxTokens,
      maxTokens ?? preset.maxTokens,
    );

    // Build boundary matcher (server-side semantic stopping)
    const boundaryRegex = getBoundaryRegex(mode);

    // Prepare upstream stream with abort support
    const abortController = new AbortController();
    const stream = await openai.completions.create(
      {
        model,
        prompt,
        temperature: temperature ?? modelConfig.defaultTemp,
        max_tokens: maxTokensToUse,
        // Omit upstream 'stop'; semantic stopping is handled server-side via boundary detection.
        stream: true,
      },
      { signal: abortController.signal },
    );

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // End helpers
    let ended = false;
    const endEarly = () => {
      if (!ended) {
        res.write("data: [DONE]\n\n");
        res.end();
        ended = true;
      }
    };
    req.on("close", () => {
      if (!ended) {
        abortController.abort();
        endEarly();
      }
    });

    // Stream state
    let accumulated = "";
    let sentIndex = 0;
    const joinState: JoinState = {
      hasEmittedAny: false,
      endedWithWhitespace: false,
      endedWithNewline: false,
    };

    // Whether we've emitted at least one non-whitespace character
    let hasEmittedNonWhitespace = false;

    // Track if we've seen any non-whitespace in word mode
    let wordModeBuffer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.text ?? "";
      if (!delta) continue;

      accumulated += delta;

      // Special handling for word mode: emit complete tokens
      if (mode === "word") {
        wordModeBuffer += delta;

        // If this token contains non-whitespace, we've found our word
        if (NON_WHITESPACE_RE.test(delta)) {
          // Emit the accumulated buffer
          // In word mode, preserve whitespace as generated (it acts as the separator)
          const toSend = wordModeBuffer;

          if (toSend) {
            res.write(`data: ${JSON.stringify({ content: toSend })}\n\n`);
            joinState.hasEmittedAny = true;
            joinState.endedWithNewline = ENDING_NEWLINE_RE.test(toSend);
            joinState.endedWithWhitespace = ENDING_WHITESPACE_RE.test(toSend);

            // Abort and end - we've emitted one word
            abortController.abort();
            endEarly();
            return;
          }
        }
        continue;
      }

      // Check for boundary (non-word modes)
      if (boundaryRegex) {
        const cutoff = findBoundaryCutoff(
          accumulated,
          sentIndex,
          boundaryRegex,
        );
        if (cutoff !== null) {
          let toSend = accumulated.slice(sentIndex, cutoff);

          // Normalize join across seam
          toSend = normalizeJoin(joinState, toSend);

          // Only prevent empty result; do not strip valid whitespace if we've already emitted words
          const containsNonWs = NON_WHITESPACE_RE.test(toSend);
          if (toSend && (containsNonWs || hasEmittedNonWhitespace)) {
            res.write(`data: ${JSON.stringify({ content: toSend })}\n\n`);
            joinState.hasEmittedAny = true;
            if (NON_WHITESPACE_RE.test(toSend)) hasEmittedNonWhitespace = true;
            joinState.endedWithNewline = ENDING_NEWLINE_RE.test(toSend);
            joinState.endedWithWhitespace = ENDING_WHITESPACE_RE.test(toSend);
          }

          // Abort upstream and end stream
          abortController.abort();
          endEarly();
          return;
        }
      }

      // No boundary yet; stream what we have since last send
      let segment = accumulated.slice(sentIndex);
      if (segment) {
        // Avoid emitting purely leading whitespace when nothing has been emitted at all and no non-whitespace yet
        if (!joinState.hasEmittedAny && !NON_WHITESPACE_RE.test(segment)) {
          // Buffer until we see content; don't emit whitespace-only lead
          continue;
        }

        // Normalize join to avoid duplicated spaces/newlines across chunk seams
        segment = normalizeJoin(joinState, segment);

        // Emit
        if (segment) {
          res.write(`data: ${JSON.stringify({ content: segment })}\n\n`);
          joinState.hasEmittedAny = true;
          if (NON_WHITESPACE_RE.test(segment)) hasEmittedNonWhitespace = true;
          joinState.endedWithNewline = ENDING_NEWLINE_RE.test(segment);
          joinState.endedWithWhitespace = ENDING_WHITESPACE_RE.test(segment);
          sentIndex = accumulated.length;
        }
      }
    }

    // Upstream finished without hitting our boundary; flush remaining buffer (if any) then close out
    if (!ended) {
      const remaining = accumulated.slice(sentIndex);
      if (remaining) {
        const segment = normalizeJoin(joinState, remaining);
        if (segment) {
          res.write(`data: ${JSON.stringify({ content: segment })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    }
  } catch (error: unknown) {
    console.error("Generation error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "An error occurred during text generation";

    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      res.status(500).json({ error: errorMessage });
    } else {
      // If streaming has started, send error in stream format
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
}
