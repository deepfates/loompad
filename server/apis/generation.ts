import type { Request, Response } from "express";
import OpenAI from "openai";
import { config } from "../config";
import type { AvailableModels, ModelId } from "../../shared/models";
import {
  DEFAULT_LENGTH_MODE,
  LENGTH_PRESETS,
  type LengthMode,
} from "../../shared/lengthPresets";

// Initialize OpenAI client with OpenRouter base URL
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterApiKey,
  defaultHeaders: {
    "HTTP-Referer": "https://loompad.dev",
    "X-Title": "LoomPad",
  },
});

// Available models and their configs
export const AVAILABLE_MODELS: AvailableModels = {
  "meta-llama/llama-3.1-405b": {
    name: "Llama 3.1 405B",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "deepseek/deepseek-v3.1-base": {
    name: "DeepSeek V3.1",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "moonshotai/kimi-k2": {
    name: "Kimi K2 0711",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
};

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  lengthMode?: LengthMode;
}

// Boundary regex by mode (CRLF-safe)
// We include the delimiter in the match so it is preserved in output.
function getBoundaryRegex(mode: LengthMode): RegExp | null {
  switch (mode) {
    case "word":
      // First non-space run followed by a single whitespace (space/tab/newline).
      // We match the word and the following whitespace so we can emit both.
      return /\S+(?:\r?\n|\s)+/;
    case "sentence":
      // ., ?, ! possibly followed by closing quotes/brackets; include them, not trailing space
      return /[.?!](?:['"”’»)\]\}]+)?(?=\s|$)/;
    case "paragraph":
      // Blank line (including optional spaces) OR Markdown horizontal rule
      return /\r?\n[ \t]*\r?\n|(?:^|\r?\n)[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*(?:\r?\n|$)/;
    case "page":
      // Three or more blank lines (page break) OR horizontal rule
      return /\r?\n(?:[ \t]*\r?\n){2,}|(?:^|\r?\n)[ \t]{0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*(?:\r?\n|$)/;
    default:
      return null;
  }
}

// Find the first boundary whose end is beyond sentIndex (seam-aware with overlap)
function findBoundaryCutoff(
  accumulated: string,
  sentIndex: number,
  rx: RegExp,
): number | null {
  const OVERLAP = 32;
  const start = Math.max(0, sentIndex - OVERLAP);
  const search = accumulated.slice(start);

  // Ensure global search
  const flags = rx.flags.includes("g") ? rx.flags : rx.flags + "g";
  const globalRx = new RegExp(rx.source, flags);

  let m: RegExpExecArray | null;
  while ((m = globalRx.exec(search)) !== null) {
    const end = m.index + m[0].length;
    if (start + end > sentIndex) {
      return start + end;
    }
  }
  return null;
}

type JoinState = {
  hasEmittedAny: boolean;
  endedWithWhitespace: boolean;
  endedWithNewline: boolean;
};

// Normalize the join between the previously emitted tail and the new segment.
// Goals:
// - Preserve necessary spaces/newlines.
// - Avoid duplicate space/newline when split across chunk seams.
// - Never remove the only separator between two words.
function normalizeJoin(prev: JoinState, segment: string): string {
  if (!segment) return segment;

  // If nothing emitted yet, we allow leading whitespace — but if it's all whitespace,
  // the caller should avoid finishing on it without content. We don't strip here.
  // We only compress duplicates across seams below.

  // If previous emission ended with CRLF or LF and the next segment starts with one,
  // drop duplicated leading newlines in the new segment (preserve only the previous one).
  if (prev.endedWithNewline) {
    // Remove one or more leading CRLF/LF
    segment = segment.replace(/^(?:\r?\n)+/, "");
  }

  // If previous ended with whitespace (space or tab) and next starts with spaces/tabs,
  // compress the leading spaces/tabs in the new segment to a single space.
  // If next starts with a newline, keep it (newline is stronger).
  if (prev.endedWithWhitespace && !prev.endedWithNewline) {
    segment = segment.replace(/^[ \t]+/, "");
  }

  // If previous emission ended with non-whitespace and next starts with non-whitespace,
  // consider inserting a single space? We DO NOT do that here; generation should
  // explicitly produce the separator. This avoids inventing text.
  return segment;
}

export async function generateText(req: Request, res: Response) {
  try {
    const { prompt, model, temperature, maxTokens, lengthMode } =
      req.body as GenerateRequest;

    if (!prompt || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (!AVAILABLE_MODELS[model]) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const mode = lengthMode ?? DEFAULT_LENGTH_MODE;
    const preset = LENGTH_PRESETS[mode] ?? LENGTH_PRESETS[DEFAULT_LENGTH_MODE];

    const modelMaxTokens = AVAILABLE_MODELS[model].maxTokens;
    const maxTokensToUse = Math.min(
      Math.min(preset.maxTokens, modelMaxTokens),
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
        temperature: temperature ?? AVAILABLE_MODELS[model].defaultTemp,
        max_tokens: maxTokensToUse,
        // Do NOT pass stop sequences to preserve delimiters exactly
        stop: undefined,
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

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.text ?? "";
      if (!delta) continue;

      accumulated += delta;

      // Check for boundary
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
          const containsNonWs = /\S/.test(toSend);
          if (toSend && (containsNonWs || hasEmittedNonWhitespace)) {
            res.write(`data: ${JSON.stringify({ content: toSend })}\n\n`);
            joinState.hasEmittedAny = true;
            if (/\S/.test(toSend)) hasEmittedNonWhitespace = true;
            joinState.endedWithNewline = /\r?\n$/.test(toSend);
            joinState.endedWithWhitespace = /\s$/.test(toSend);
          }

          // Abort upstream and end stream
          abortController.abort();
          endEarly();
          return;
        }
      }

      // No boundary yet
      if (!boundaryRegex) {
        let segment = accumulated.slice(sentIndex);
        if (segment) {
          // Avoid emitting purely leading whitespace when nothing has been emitted at all and no non-ws yet
          if (!joinState.hasEmittedAny && !/\S/.test(segment)) {
            // Buffer until we see content; don't emit whitespace-only lead
            continue;
          }

          // Normalize join to avoid duplicated spaces/newlines across chunk seams
          segment = normalizeJoin(joinState, segment);

          // Emit
          if (segment) {
            res.write(`data: ${JSON.stringify({ content: segment })}\n\n`);
            joinState.hasEmittedAny = true;
            if (/\S/.test(segment)) hasEmittedNonWhitespace = true;
            joinState.endedWithNewline = /\r?\n$/.test(segment);
            joinState.endedWithWhitespace = /\s$/.test(segment);
            sentIndex = accumulated.length;
          }
        }
      }
    }

    // Upstream finished without hitting our boundary; flush remaining buffer (if any) then close out
    if (!ended) {
      const remaining = accumulated.slice(sentIndex);
      if (remaining) {
        let segment = normalizeJoin(joinState, remaining);
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
