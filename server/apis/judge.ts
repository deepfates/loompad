import type { Request, Response } from "express";
import type { ModelId } from "../../shared/models";
import { getModel } from "../modelsStore";
import { openai } from "./openaiClient";

interface JudgeRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  candidateCount?: number;
}

const FALLBACK_MAX_TOKENS = 96;

function parseChoiceValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const numeric = Number.parseInt(value, 10);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function extractChoice(rawText: string): number | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0] ?? "{}");
      const candidate =
        parseChoiceValue(
          (parsed as { choice?: unknown; index?: unknown; selection?: unknown })
            .choice ??
            (parsed as { index?: unknown }).index ??
            (parsed as { selection?: unknown }).selection,
        ) ??
        parseChoiceValue((parsed as { value?: unknown }).value);
      if (candidate !== null) {
        return candidate;
      }
    } catch (error) {
      console.warn("Failed to parse judge JSON:", error, trimmed);
    }
  }

  const labeledMatch = trimmed.match(
    /(?:choice|index|selection|option|pick)\s*(?:=|:)?\s*"?(\d+)"?/i,
  );
  if (labeledMatch) {
    const numeric = Number.parseInt(labeledMatch[1] ?? "", 10);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  const fallbackMatch = trimmed.match(/-?\d+/);
  if (fallbackMatch) {
    const numeric = Number.parseInt(fallbackMatch[0] ?? "", 10);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

export async function judgeContinuation(req: Request, res: Response) {
  try {
    const { prompt, model, temperature, maxTokens, candidateCount } =
      req.body as JudgeRequest;

    if (!prompt || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const modelConfig = getModel(model);
    if (!modelConfig) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const limit = Math.min(
      modelConfig.maxTokens,
      maxTokens ?? FALLBACK_MAX_TOKENS,
      FALLBACK_MAX_TOKENS,
    );

    const completion = await openai.completions.create({
      model,
      prompt,
      temperature: temperature ?? Math.min(modelConfig.defaultTemp, 0.8),
      max_tokens: limit,
      stream: false,
      stop: ["\n", "\r"],
    });

    const raw =
      completion.choices?.map((choice) => choice.text ?? "").join("") ?? "";

    const parsedChoice = extractChoice(raw);

    if (parsedChoice === null || parsedChoice <= 0) {
      return res.json({ choice: null, raw });
    }

    const normalized = parsedChoice - 1;
    if (
      typeof candidateCount === "number" &&
      Number.isInteger(candidateCount) &&
      candidateCount > 0 &&
      normalized >= candidateCount
    ) {
      return res.json({ choice: null, raw });
    }

    return res.json({ choice: normalized, raw });
  } catch (error) {
    console.error("Judge request failed:", error);
    return res.status(500).json({ error: "Failed to evaluate continuations" });
  }
}
