import OpenAI from "openai";
import { config } from "../config";

export const openai = new OpenAI({
  baseURL: "http://212.247.220.167/v1",
  // This endpoint does not require model routing or OpenRouter headers.
  apiKey: config.completionsApiKey,
});
