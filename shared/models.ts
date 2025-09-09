export type ModelId = string;

export interface ModelConfig {
  name: string;
  maxTokens: number;
  defaultTemp: number;
}

export type AvailableModels = Record<ModelId, ModelConfig>;

