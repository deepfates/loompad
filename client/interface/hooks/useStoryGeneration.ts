import { useState } from "react";
import { useTextGeneration } from "./useTextGeneration";
import { splitTextToNodes } from "../utils/textSplitter";
import { joinSegments } from "../utils/join";
import type { StoryNode } from "../types";
import type { ModelId } from "../../../shared/models";
import type { LengthMode } from "../../../shared/lengthPresets";

interface GenerationParams {
  model: ModelId;
  temperature: number;
  lengthMode: LengthMode;
  textSplitting: boolean;
}

export const createPrompt = (path: StoryNode[], depth: number) => {
  // Validate that depth is within bounds
  if (path.length === 0) {
    throw new Error(`Invalid depth: ${depth}. Path is empty (length 0).`);
  }
  if (!Number.isInteger(depth) || depth < 0 || depth >= path.length) {
    const maxIndex = path.length - 1;
    throw new Error(
      `Invalid depth: ${depth}. Must be an integer between 0 and ${maxIndex}.`,
    );
  }

  // Get the story context from the current path
  const context = joinSegments(
    path.slice(0, depth + 1).map((node) => node.text),
  );

  return context;
};

export function useStoryGeneration() {
  const { generate, error } = useTextGeneration();
  const [generatedText, setGeneratedText] = useState("");

  const flattenNodeText = (node: StoryNode): string => {
    const segments: string[] = [];
    let current: StoryNode | undefined = node;
    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      segments.push(current.text);
      if (current.continuations?.length === 1) {
        current = current.continuations[0];
      } else {
        break;
      }
    }

    return joinSegments(segments);
  };

  const generateContinuation = async (
    path: StoryNode[],
    depth: number,
    params: GenerationParams,
  ): Promise<StoryNode> => {
    setGeneratedText("");
    let fullText = "";

    const prompt = createPrompt(path, depth);

    await generate(
      prompt,
      {
        model: params.model,
        temperature: params.temperature,
        lengthMode: params.lengthMode,
      },
      (token) => {
        fullText += token;
        setGeneratedText(fullText);
      },
      () => {
        setGeneratedText(fullText);
      },
    );

    // Conditionally split the generated text based on settings
    if (params.textSplitting) {
      const nodeChain = splitTextToNodes(fullText);

      // If splitting succeeded, return the chain
      if (nodeChain) {
        return nodeChain;
      }
    }

    // Fallback to single node (if splitting disabled or failed)
    return {
      id: Math.random().toString(36).substring(2, 15),
      text: fullText || "...",
      continuations: [],
    };
  };

  const chooseContinuation = async (
    path: StoryNode[],
    candidates: StoryNode[],
    params: GenerationParams,
  ): Promise<number | null> => {
    if (!candidates.length) {
      return null;
    }

    const context = joinSegments(path.map((node) => node.text));
    const options = candidates
      .map((candidate, index) => {
        const text = flattenNodeText(candidate).trim() || "(empty)";
        return `${index + 1}. """\n${text}\n"""`;
      })
      .join("\n\n");

    const rankingPrompt = [
      "You are evaluating possible continuations for an interactive fiction story.",
      "Story so far:",
      `"""\n${context.trim()}\n"""`,
      "Select exactly one option number to expand next. If none should be expanded, respond with 0.",
      "Respond ONLY with JSON of the form {\"choice\": <number>} with no extra text.",
      "Options:",
      options,
    ].join("\n\n");

    let result = "";

    await generate(
      rankingPrompt,
      {
        model: params.model,
        temperature: Math.max(0.1, Math.min(params.temperature, 0.8)),
        lengthMode: "sentence",
      },
      (token) => {
        result += token;
      },
      () => {},
    );

    const trimmed = result.trim();
    if (!trimmed) {
      return null;
    }

    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const jsonCandidate = jsonMatch ? jsonMatch[0] : trimmed;

    const parseChoice = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value);
      }
      if (typeof value === "string") {
        const num = Number.parseInt(value, 10);
        if (Number.isFinite(num)) {
          return num;
        }
      }
      return null;
    };

    const candidateCount = candidates.length;

    try {
      const parsed = JSON.parse(jsonCandidate);
      const rawChoice = parseChoice(
        (parsed as { choice?: unknown; index?: unknown; selection?: unknown })
          .choice ??
          (parsed as { index?: unknown }).index ??
          (parsed as { selection?: unknown }).selection,
      );
      if (rawChoice !== null) {
        if (rawChoice <= 0) {
          return null;
        }
        if (rawChoice >= 1 && rawChoice <= candidateCount) {
          return rawChoice - 1;
        }
      }
    } catch (err) {
      console.warn("Failed to parse auto-mode selection JSON:", err, result);
    }

    const fallbackMatch = trimmed.match(/\d+/);
    if (fallbackMatch) {
      const numeric = Number.parseInt(fallbackMatch[0] ?? "", 10);
      if (Number.isFinite(numeric)) {
        if (numeric <= 0) {
          return null;
        }
        if (numeric >= 1 && numeric <= candidateCount) {
          return numeric - 1;
        }
      }
    }

    return null;
  };

  return {
    generateContinuation,
    chooseContinuation,
    generatedText,
    error,
  };
}
