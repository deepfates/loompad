import OpenAI from "openai";
import { config } from "../config";

export const openai = new OpenAI({
  baseURL: "https://xob3rm6bnyl1j1-8000.proxy.runpod.net/v1",
  // This endpoint does not require model routing or OpenRouter headers.
  apiKey: config.completionsApiKey,
});
