import OpenAI from "openai";
import { config } from "../config";

export const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  // The client is constructed in provider-free corpus mode too; generation
  // endpoints refuse explicitly before this placeholder can reach upstream.
  apiKey: config.openRouterApiKey ?? "sk-or-generation-disabled",
  defaultHeaders: {
    "HTTP-Referer": "https://textile.lol",
    "X-Title": "Textile",
  },
});
