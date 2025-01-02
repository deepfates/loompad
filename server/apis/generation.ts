import type { Request, Response } from "express";
import OpenAI from "openai";
import { config } from "../config";

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
export const AVAILABLE_MODELS = {
  "mistralai/mixtral-8x7b": {
    name: "Mixtral 8x7B",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "deepseek/deepseek-chat": {
    name: "DeepSeek v3",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
  "meta-llama/llama-3.1-405b": {
    name: "Llama 3.1 405B",
    maxTokens: 1024,
    defaultTemp: 0.7,
  },
} as const;

export type ModelId = keyof typeof AVAILABLE_MODELS;

interface GenerateRequest {
  prompt: string;
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
}

export async function generateText(req: Request, res: Response) {
  try {
    const { prompt, model, temperature, maxTokens } =
      req.body as GenerateRequest;

    if (!prompt || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (!AVAILABLE_MODELS[model]) {
      return res.status(400).json({ error: "Invalid model specified" });
    }

    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: temperature ?? AVAILABLE_MODELS[model].defaultTemp,
      max_tokens: maxTokens ?? AVAILABLE_MODELS[model].maxTokens,
      stream: true,
    });

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream the response
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
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
