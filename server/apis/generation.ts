import type { Request, Response } from "express";
import OpenAI from "openai";
import { config } from "../config";
import type { AvailableModels, ModelId } from "../../shared/models";
import {
  DEFAULT_LENGTH_MODE,
  LENGTH_PRESETS,
  type LengthMode,
} from "../../shared/lengthPresets";

// Initialize OpenAI client with OpenRouter base URL
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterApiKey,
  defaultHeaders: {
    "HTTP-Referer": "https://loompad.dev", // Replace with your actual domain
    "X-Title": "LoomPad",
  },
});

// Available models and their configs
export const AVAILABLE_MODELS: AvailableModels = {
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
};

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  lengthMode?: LengthMode;
}

export async function generateText(req: Request, res: Response) {
  try {
    const { prompt, model, temperature, maxTokens, lengthMode } =
      req.body as GenerateRequest;

    if (!prompt || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (!AVAILABLE_MODELS[model]) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const preset =
      LENGTH_PRESETS[lengthMode ?? DEFAULT_LENGTH_MODE] ??
      LENGTH_PRESETS[DEFAULT_LENGTH_MODE];

    const modelMaxTokens = AVAILABLE_MODELS[model].maxTokens;
    const fallbackMaxTokens = Math.min(preset.maxTokens, modelMaxTokens);
    const maxTokensToUse = Math.min(
      maxTokens ?? fallbackMaxTokens,
      modelMaxTokens,
    );

    const stopSequences = preset.stop.filter((sequence) => sequence.trim().length > 0);

    const stream = await openai.completions.create({
      model,
      prompt: prompt,
      temperature: temperature ?? AVAILABLE_MODELS[model].defaultTemp,
      max_tokens: maxTokensToUse,
      stop: stopSequences.length ? stopSequences : undefined,
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
