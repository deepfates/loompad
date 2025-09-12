import { useState, useEffect } from "react";
import type { AvailableModels, ModelId } from "../../../shared/models";

// Simple module-level cache so models persist across component mounts
let cachedModels: AvailableModels | null = null;
let cachedError: string | null = null;
let hasFetchedModels = false;

export function useModels() {
  const [models, setModels] = useState<AvailableModels | null>(cachedModels);
  const [loading, setLoading] = useState(!cachedModels && !cachedError);
  const [error, setError] = useState<string | null>(cachedError);

  useEffect(() => {
    // If we've already fetched once (and cached), don't re-fetch or flip loading
    if (hasFetchedModels && (cachedModels || cachedError)) {
      setModels(cachedModels);
      setError(cachedError);
      setLoading(false);
      return;
    }

    async function fetchModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error("Failed to fetch models");
        }
        const data = await response.json();
        cachedModels = data;
        cachedError = null;
        hasFetchedModels = true;
        setModels(data);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An error occurred while fetching models";
        cachedError = errorMessage;
        hasFetchedModels = true;
        setError(errorMessage);
        console.error("Error fetching models:", error);
      } finally {
        setLoading(false);
      }
    }

    // Only fetch if we have nothing cached yet
    if (!cachedModels && !cachedError) {
      fetchModels();
    }
  }, []);

  const getModelName = (modelId: ModelId) => {
    return models?.[modelId]?.name || modelId;
  };

  const getModelConfig = (modelId: ModelId) => {
    return models?.[modelId] || null;
  };

  return {
    models,
    loading,
    error,
    getModelName,
    getModelConfig,
  };
}
