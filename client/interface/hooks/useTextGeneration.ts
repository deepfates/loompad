import { useState, useCallback } from "react";
import type { ModelId } from "../../../shared/models";
import type { LengthMode } from "../../../shared/lengthPresets";
import type { GenerationReceipt } from "../../../shared/generation";

interface GenerationOptions {
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  lengthMode?: LengthMode;
}

interface GenerationError {
  message: string;
}

export const OPENROUTER_API_KEY_ERROR_MESSAGE =
  "OpenRouter API key is missing or invalid. Add or update OPENROUTER_API_KEY to generate.";

const OPENROUTER_AUTH_ERROR_PATTERNS = [
  /\b401\b.*(?:missing authentication header|user not found|invalid api key|incorrect api key|no auth credentials)/i,
  /missing authentication header/i,
  /invalid api key/i,
  /incorrect api key/i,
  /no auth credentials/i,
];

export function formatGenerationErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "An error occurred during generation";
  }

  if (error.name === "TypeError" && error.message.includes("fetch")) {
    return "Network error - check your connection";
  }

  if (
    OPENROUTER_AUTH_ERROR_PATTERNS.some((pattern) =>
      pattern.test(error.message),
    )
  ) {
    return OPENROUTER_API_KEY_ERROR_MESSAGE;
  }

  return error.message;
}

export function useTextGeneration() {
  const [error, setError] = useState<GenerationError | null>(null);

  const generate = useCallback(
    async (
      prompt: string,
      options: GenerationOptions,
      onToken: (token: string) => void,
      onComplete: () => void,
    ): Promise<GenerationReceipt> => {
      setError(null);

      try {
        // Do not gate the request on navigator.onLine. Browsers and installed
        // PWAs can report a stale offline value even when this origin is
        // reachable. The fetch itself is the authoritative connectivity check,
        // and its failure is translated into the visible network error below.
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

        const mode = response.headers.get("X-Textile-Generation-Mode");
        const program = response.headers.get("X-Textile-Generation-Program");
        const reasoningPolicy = response.headers.get(
          "X-Textile-Reasoning-Policy",
        );
        if (
          (mode !== "completion" && mode !== "instruction") ||
          !program ||
          (reasoningPolicy !== "none" && reasoningPolicy !== "low")
        ) {
          throw new Error(
            "Generation response omitted its mode, program, or reasoning policy",
          );
        }
        let receipt: GenerationReceipt = { mode, program, reasoningPolicy };

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to initialize stream reader");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
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

            let payload: {
              content?: string;
              error?: string;
              receipt?: GenerationReceipt;
            };
            try {
              payload = JSON.parse(message) as {
                content?: string;
                error?: string;
                receipt?: GenerationReceipt;
              };
            } catch (e) {
              console.error("Failed to parse SSE message:", e);
              continue;
            }

            if (payload.error) {
              throw new Error(payload.error);
            }

            if (payload.receipt) {
              if (
                payload.receipt.mode !== mode ||
                payload.receipt.program !== program ||
                payload.receipt.reasoningPolicy !== reasoningPolicy
              ) {
                throw new Error(
                  "Generation receipt disagreed with its response headers",
                );
              }
              receipt = payload.receipt;
            }

            if (payload.content) {
              onToken(payload.content);
            }
          }
        }
        return receipt;
      } catch (error: unknown) {
        const errorMessage = formatGenerationErrorMessage(error);
        setError({ message: errorMessage });
        console.error("Generation error:", error);
        throw new Error(errorMessage);
      }
    },
    [],
  );

  return {
    generate,
    error,
  };
}
