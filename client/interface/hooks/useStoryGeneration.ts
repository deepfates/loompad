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
  ): Promise<{ 
    text: string; 
    generatedByModel: ModelId;
    generationMetadata: {
      model: ModelId;
      temperature: number;
      maxTokens: number;
      timestamp: number;
      depth: number;
    };
  }> => {
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
        setGeneratedText(fullText);
      }
    );

    const metadata = {
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      timestamp: Date.now(),
      depth: depth + 1, // The depth where this generation will be placed
    };

    return {
      text: fullText,
      generatedByModel: params.model,
      generationMetadata: metadata,
    };
  };

  return {
    generateContinuation,
    generatedText,
    isGenerating,
    error,
  };
}
