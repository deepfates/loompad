import { useState, useEffect, useCallback } from "react";
import type { AvailableModels, ModelConfig, ModelId } from "../../../shared/models";

// Simple module-level cache so models persist across component mounts
let cachedModels: AvailableModels | null = null;
let cachedError: string | null = null;
let hasFetchedModels = false;

export function useModels() {
  const [models, setModels] = useState<AvailableModels | null>(cachedModels);
  const [loading, setLoading] = useState(!cachedModels && !cachedError);
  const [error, setError] = useState<string | null>(cachedError);
  const [saving, setSaving] = useState(false);

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
        const data = (await response.json()) as AvailableModels;
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

  const handleModelsResponse = useCallback(
    async (response: Response) => {
      let data: unknown = null;
      try {
        data = await response.json();
      } catch (parseError) {
        // Ignore parsing error; will throw below if not OK
      }

      if (!response.ok) {
        const message =
          typeof data === "object" && data && "error" in data
            ? String((data as { error?: unknown }).error)
            : "Failed to update models";
        throw new Error(message);
      }

      const nextModels = (data as AvailableModels) ?? null;
      if (nextModels) {
        cachedModels = nextModels;
        cachedError = null;
        hasFetchedModels = true;
        setModels(nextModels);
      }
      return nextModels;
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/models");
      await handleModelsResponse(response);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred while refreshing models";
      cachedError = message;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [handleModelsResponse]);

  const createModel = useCallback(
    async (modelId: ModelId, config: ModelConfig) => {
      setSaving(true);
      setError(null);
      try {
        const response = await fetch("/api/models", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: modelId, ...config }),
        });
        const nextModels = await handleModelsResponse(response);
        return nextModels;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An error occurred while creating the model";
        cachedError = message;
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [handleModelsResponse],
  );

  const updateExistingModel = useCallback(
    async (modelId: ModelId, config: ModelConfig) => {
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/models/${encodeURIComponent(modelId)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        });
        const nextModels = await handleModelsResponse(response);
        return nextModels;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An error occurred while updating the model";
        cachedError = message;
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [handleModelsResponse],
  );

  const deleteExistingModel = useCallback(
    async (modelId: ModelId) => {
      setSaving(true);
      setError(null);
      try {
        const response = await fetch(`/api/models/${encodeURIComponent(modelId)}`, {
          method: "DELETE",
        });
        const nextModels = await handleModelsResponse(response);
        return nextModels;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An error occurred while deleting the model";
        cachedError = message;
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [handleModelsResponse],
  );

  return {
    models,
    loading,
    error,
    saving,
    refresh,
    createModel,
    updateModel: updateExistingModel,
    deleteModel: deleteExistingModel,
    getModelName,
    getModelConfig,
  };
}
