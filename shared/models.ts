import type { GenerationMode } from "./generation";

export type ModelId = string;

export interface ModelConfig {
  name: string;
  maxTokens: number;
  defaultTemp: number;
  /**
   * `completion` continues the exact loom text through the raw completions API.
   * `instruction` runs the declared Textile continuation program through Ax.
   */
  generationMode: GenerationMode;
}

export type AvailableModels = Record<ModelId, ModelConfig>;
