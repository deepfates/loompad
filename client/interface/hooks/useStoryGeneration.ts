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
  if (!Number.isInteger(depth) || depth < 0 || depth >= path.length) {
    throw new Error(
      `Invalid depth: ${depth}. Must be an integer between 0 and path.length - 1 (${path.length - 1}).`,
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

  return {
    generateContinuation,
    generatedText,
    error,
  };
}
