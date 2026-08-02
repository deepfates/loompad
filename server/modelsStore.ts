import fs from "fs";
import path from "path";
import type { AvailableModels, ModelConfig, ModelId } from "../shared/models";
import { resolveModelsFile } from "./runtimeData";

const BUNDLED_MODELS_FILE = path.join(
  process.cwd(),
  "server",
  "data",
  "models.json",
);
const MODELS_FILE = resolveModelsFile();

const DEFAULT_MODELS: AvailableModels = {
  "meta-llama/llama-3.1-405b": {
    name: "Llama 3.1 405B",
    maxTokens: 1024,
    defaultTemp: 0.7,
    generationMode: "instruction",
  },
  "moonshotai/kimi-k2": {
    name: "Kimi K2 0711",
    maxTokens: 1024,
    defaultTemp: 0.7,
    generationMode: "instruction",
  },
  "google/gemini-3-pro-preview": {
    name: "Gemini 3 Pro (preview)",
    maxTokens: 1024,
    defaultTemp: 0.7,
    generationMode: "instruction",
  },
};

let cachedModels: AvailableModels | null = null;

function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeModels(parsed: AvailableModels): AvailableModels {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Model catalog must be a JSON object");
  }
  return Object.fromEntries(
    Object.entries(parsed).map(([id, model]) => [
      id,
      {
        ...model,
        // Old private catalogs predate the explicit boundary. Raw continuation
        // is the only safe fallback because it does not add hidden instructions.
        generationMode: model.generationMode ?? "completion",
      },
    ]),
  );
}

function readModels(filePath: string): AvailableModels {
  return normalizeModels(
    JSON.parse(fs.readFileSync(filePath, "utf-8")) as AvailableModels,
  );
}

export function loadModelsFromFiles(
  mutableFile: string,
  bundledFile: string,
): AvailableModels {
  try {
    return readModels(mutableFile);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw new Error(`Mutable model catalog is unreadable: ${mutableFile}`, {
        cause: error,
      });
    }
  }

  let seed: AvailableModels;
  try {
    seed = readModels(bundledFile);
  } catch (error) {
    console.warn(
      `[Models] Bundled catalog is unreadable; using built-in defaults: ${error instanceof Error ? error.message : String(error)}`,
    );
    seed = { ...DEFAULT_MODELS };
  }

  ensureDirectoryExists(mutableFile);
  fs.writeFileSync(mutableFile, JSON.stringify(seed, null, 2), "utf-8");
  return seed;
}

function loadModelsFromDisk(): AvailableModels {
  return loadModelsFromFiles(MODELS_FILE, BUNDLED_MODELS_FILE);
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
