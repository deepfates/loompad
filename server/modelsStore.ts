import fs from "fs";
import path from "path";
import type { AvailableModels, ModelConfig, ModelId } from "../shared/models";

const MODELS_FILE = path.join(process.cwd(), "server", "data", "models.json");

const DEFAULT_MODELS: AvailableModels = {
  "meta-llama/llama-3.1-405b": {
    name: "Llama 3.1 405B",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "deepseek/deepseek-v3.1-base": {
    name: "DeepSeek V3.1",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "moonshotai/kimi-k2": {
    name: "Kimi K2 0711",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "google/gemini-3-pro-preview": {
    name: "Gemini 3 Pro (preview)",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
};

let cachedModels: AvailableModels | null = null;

function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadModelsFromDisk(): AvailableModels {
  try {
    const raw = fs.readFileSync(MODELS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as AvailableModels;
    // Basic validation: ensure it's an object with entries
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_MODELS };
    }
    return parsed;
  } catch (error) {
    // If file doesn't exist or is invalid, seed with defaults
    ensureDirectoryExists(MODELS_FILE);
    fs.writeFileSync(
      MODELS_FILE,
      JSON.stringify(DEFAULT_MODELS, null, 2),
      "utf-8",
    );
    return { ...DEFAULT_MODELS };
  }
}

function persistModels(models: AvailableModels) {
  ensureDirectoryExists(MODELS_FILE);
  fs.writeFileSync(MODELS_FILE, JSON.stringify(models, null, 2), "utf-8");
}

function getCachedModels(): AvailableModels {
  if (!cachedModels) {
    cachedModels = loadModelsFromDisk();
  }
  return cachedModels;
}

export function getModels(): AvailableModels {
  return { ...getCachedModels() };
}

export function getModel(modelId: ModelId): ModelConfig | undefined {
  const models = getCachedModels();
  return models[modelId];
}

export function createModel(modelId: ModelId, config: ModelConfig): AvailableModels {
  const models = getCachedModels();
  if (models[modelId]) {
    throw new Error("Model already exists");
  }
  const updated: AvailableModels = { ...models, [modelId]: config };
  cachedModels = updated;
  persistModels(updated);
  return updated;
}

export function updateModel(
  modelId: ModelId,
  config: ModelConfig,
): AvailableModels {
  const models = getCachedModels();
  if (!models[modelId]) {
    throw new Error("Model not found");
  }
  const updated: AvailableModels = { ...models, [modelId]: config };
  cachedModels = updated;
  persistModels(updated);
  return updated;
}

export function deleteModel(modelId: ModelId): AvailableModels {
  const models = getCachedModels();
  if (!models[modelId]) {
    throw new Error("Model not found");
  }
  const updated: AvailableModels = { ...models };
  delete updated[modelId];
  cachedModels = updated;
  persistModels(updated);
  return updated;
}

export function setModels(models: AvailableModels) {
  cachedModels = { ...models };
  persistModels(cachedModels);
}

export function resetModelsToDefault() {
  cachedModels = { ...DEFAULT_MODELS };
  persistModels(cachedModels);
}
