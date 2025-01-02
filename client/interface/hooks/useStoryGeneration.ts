import { useState } from "react";
import { useTextGeneration } from "./useTextGeneration";
import type { StoryNode } from "../types";
import type { ModelId } from "../../../server/apis/generation";

interface GenerationParams {
  model: ModelId;
  temperature: number;
  maxTokens: number;
}

const createPrompt = (path: StoryNode[], depth: number) => {
  // Get the story context from the current path
  const context = path
    .slice(0, depth + 1)
    .map((node) => node.text)
    .join("");

  return context;
};

export function useStoryGeneration() {
  const { generate, isGenerating, error } = useTextGeneration();
  const [generatedText, setGeneratedText] = useState("");

  const generateContinuation = async (
    path: StoryNode[],
    depth: number,
    params: GenerationParams
  ): Promise<string> => {
    setGeneratedText("");
    let fullText = "";

    const prompt = createPrompt(path, depth);

    await generate(
      prompt,
      {
        model: params.model,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      },
      (token) => {
        fullText += token;
        setGeneratedText(fullText);
      },
      () => {
        // Clean up any trailing whitespace
        fullText = fullText.trim();
        setGeneratedText(fullText);
      }
    );

    return fullText;
  };

  return {
    generateContinuation,
    generatedText,
    isGenerating,
    error,
  };
}
