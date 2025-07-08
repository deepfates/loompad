import type { Request, Response } from "express";
import OpenAI from "openai";
import { config } from "../config";
import getCredentials from "../../credentials";

// User-defined model configuration interface
export interface ModelConfig {
  name: string;
  id: string;
  maxTokens: number;
  defaultTemp: number;
  baseURL?: string;
  apiKey?: string;
}

// Default built-in models
const DEFAULT_MODELS: Record<string, ModelConfig> = {
  "gpt-4-base": {
    name: "GPT-4-base",
    id: "gpt-4-base",
    maxTokens: 1024,
    defaultTemp: 0.7,
    baseURL: "https://api.openai.com/v1",
    apiKey: getCredentials("api_keys", "openai_api_key", ""),
  },
  "deepseek-v3-base": {
    name: "DeepSeek-V3-base",
    id: "deepseek-ai/DeepSeek-V3-Base",
    maxTokens: 1024,
    defaultTemp: 0.7,
    baseURL: "https://llm.chutes.ai/v1/",
    apiKey: getCredentials("api_keys", "chutes_api_key", ""),
  },
  "llama-3.1-405b-base": {
    name: "Llama-3.1-405b-base",
    id: "meta-llama/llama-3.1-405b",
    maxTokens: 1024,
    defaultTemp: 0.7,
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: getCredentials("api_keys", "openrouter_api_key", ""),
  }
};

// Store user-defined models (in production, this would be in a database)
let userModels: Record<string, ModelConfig> = {};

// Combined available models
export const getAvailableModels = () => ({
  ...DEFAULT_MODELS,
  ...userModels,
});

export type ModelId = string; // Changed from keyof to string to support dynamic models

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
}

// Create OpenAI client for a specific model
const createOpenAIClient = (modelConfig: ModelConfig) => {
  return new OpenAI({
    baseURL: modelConfig.baseURL || "https://api.openai.com/v1",
    apiKey: modelConfig.apiKey || "your-api-key-here",
    defaultHeaders: {
      "Content-Type": "application/json",
    },
  });
};

export async function generateText(req: Request, res: Response) {
  try {
    const { prompt, model, temperature, maxTokens } =
      req.body as GenerateRequest;

    if (!prompt || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const availableModels = getAvailableModels();
    const modelConfig = availableModels[model];

    if (!modelConfig) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const openai = createOpenAIClient(modelConfig);

    const stream = await openai.completions.create({
      model: modelConfig.id,
      prompt,
      temperature: temperature ?? modelConfig.defaultTemp,
      max_tokens: maxTokens ?? modelConfig.maxTokens,
      stream: true,
    });

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream the response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.text || "";
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: unknown) {
    console.error("Generation error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "An error occurred during text generation";

    // If headers haven't been sent, send error response
    if (!res.headersSent) {
      res.status(500).json({ error: errorMessage });
    } else {
      // If streaming has started, send error in stream format
      res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      res.end();
    }
  }
}

// Get available models
export async function getModels(req: Request, res: Response) {
  res.json(getAvailableModels());
}

// Add a new user-defined model
export async function addModel(req: Request, res: Response) {
  try {
    const { id, name, modelId, maxTokens, defaultTemp, baseURL, apiKey } = req.body;

    if (!id || !name || !modelId) {
      return res.status(400).json({ error: "Missing required fields: id, name, modelId" });
    }

    userModels[id] = {
      name,
      id: modelId,
      maxTokens: maxTokens || 1024,
      defaultTemp: defaultTemp || 0.7,
      baseURL,
      apiKey,
    };

    res.json({ success: true, model: userModels[id] });
  } catch (error: unknown) {
    console.error("Error adding model:", error);
    res.status(500).json({ error: "Failed to add model" });
  }
}

// Update an existing model
export async function updateModel(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, modelId, maxTokens, defaultTemp, baseURL, apiKey } = req.body;

    const availableModels = getAvailableModels();
    if (!availableModels[id]) {
      return res.status(404).json({ error: "Model not found" });
    }

    // Don't allow updating default models
    if (DEFAULT_MODELS[id]) {
      return res.status(400).json({ error: "Cannot update built-in models" });
    }

    userModels[id] = {
      name: name || userModels[id].name,
      id: modelId || userModels[id].id,
      maxTokens: maxTokens || userModels[id].maxTokens,
      defaultTemp: defaultTemp || userModels[id].defaultTemp,
      baseURL: baseURL !== undefined ? baseURL : userModels[id].baseURL,
      apiKey: apiKey !== undefined ? apiKey : userModels[id].apiKey,
    };

    res.json({ success: true, model: userModels[id] });
  } catch (error: unknown) {
    console.error("Error updating model:", error);
    res.status(500).json({ error: "Failed to update model" });
  }
}

// Delete a user-defined model
export async function deleteModel(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (DEFAULT_MODELS[id]) {
      return res.status(400).json({ error: "Cannot delete built-in models" });
    }

    if (!userModels[id]) {
      return res.status(404).json({ error: "Model not found" });
    }

    delete userModels[id];
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting model:", error);
    res.status(500).json({ error: "Failed to delete model" });
  }
}
