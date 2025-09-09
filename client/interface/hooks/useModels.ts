import { useState, useEffect } from "react";
import type { AvailableModels, ModelId } from "../../../shared/models";

export function useModels() {
  const [models, setModels] = useState<AvailableModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error("Failed to fetch models");
        }
        const data = await response.json();
        setModels(data);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An error occurred while fetching models";
        setError(errorMessage);
        console.error("Error fetching models:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchModels();
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
