import { useState, useEffect, useCallback } from "react";
import type { ModelConfig, ModelId } from "../../../server/apis/generation";

export function useModels() {
  const [models, setModels] = useState<Record<string, ModelConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const getModelName = (modelId: ModelId) => {
    return models?.[modelId]?.name || modelId;
  };

  const getModelConfig = (modelId: ModelId) => {
    return models?.[modelId] || null;
  };

  const addModel = useCallback(async (modelConfig: Omit<ModelConfig, "id"> & { id: string; modelId: string }) => {
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modelConfig),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add model");
      }

      // Refresh models after adding
      await fetchModels();
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while adding the model";
      setError(errorMessage);
      console.error("Error adding model:", error);
      return false;
    }
  }, [fetchModels]);

  const updateModel = useCallback(async (modelId: string, updates: Partial<ModelConfig> & { modelId?: string }) => {
    try {
      const response = await fetch(`/api/models/${modelId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update model");
      }

      // Refresh models after updating
      await fetchModels();
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while updating the model";
      setError(errorMessage);
      console.error("Error updating model:", error);
      return false;
    }
  }, [fetchModels]);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      const response = await fetch(`/api/models/${modelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete model");
      }

      // Refresh models after deleting
      await fetchModels();
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred while deleting the model";
      setError(errorMessage);
      console.error("Error deleting model:", error);
      return false;
    }
  }, [fetchModels]);

  return {
    models,
    loading,
    error,
    getModelName,
    getModelConfig,
    addModel,
    updateModel,
    deleteModel,
    refreshModels: fetchModels,
  };
}
