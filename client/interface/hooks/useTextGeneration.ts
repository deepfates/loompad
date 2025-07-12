import { useState, useCallback } from "react";
import type { ModelId } from "../../../server/apis/generation";

interface GenerationOptions {
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
}

interface GenerationError {
  message: string;
}

export function useTextGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<GenerationError | null>(null);

  const generate = useCallback(
    async (
      prompt: string,
      options: GenerationOptions,
      onToken: (token: string) => void,
      onComplete: () => void
    ) => {
      setIsGenerating(true);
      setError(null);

      // Check if we're offline
      if (!navigator.onLine) {
        setError({ message: "No internet connection - generation requires online access" });
        setIsGenerating(false);
        return;
      }

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            ...options,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate text");
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to initialize stream reader");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "") continue;

            const message = line.replace(/^data: /, "");
            if (message === "[DONE]") {
              onComplete();
              continue;
            }

            try {
              const { content, error } = JSON.parse(message);
              if (error) throw new Error(error);
              if (content) onToken(content);
            } catch (e) {
              console.error("Failed to parse SSE message:", e);
            }
          }
        }
      } catch (error: unknown) {
        let errorMessage = "An error occurred during generation";
        
        if (error instanceof Error) {
          if (error.name === "TypeError" && error.message.includes("fetch")) {
            errorMessage = "Network error - check your connection";
          } else {
            errorMessage = error.message;
          }
        }
        
        setError({ message: errorMessage });
        console.error("Generation error:", error);
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return {
    generate,
    isGenerating,
    error,
  };
}
