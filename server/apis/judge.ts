import type { Request, Response } from "express";
import { ax, ai, type AxAI } from "@ax-llm/ax";
import { config } from "../config";

export async function judgeContinuation(req: Request, res: Response) {
  try {
    const { context, options, model, temperature } = req.body;

    if (!context || !options || !Array.isArray(options) || !model) {
      console.error("[Judge] Invalid request body:", req.body);
      return res
        .status(400)
        .json({ error: "Missing or invalid required parameters" });
    }

    console.log(
      `[Judge] Evaluating ${options.length} options with model ${model}`
    );

    // Define the signature for the judge
    const judge = ax(`
      context:string "The story so far",
      options:string[] "Possible next segments for the story"
      ->
      choice:number "The 1-based index of the best option. Return 0 if none are suitable."
    `);

    // Configure the LLM provider (OpenRouter via OpenAI compatible API)
    // Ax expects 'apiURL' at the top level for the OpenAI provider to override the default host
    const llm = ai({
      name: "openai",
      apiKey: config.openRouterApiKey,
      apiURL: "https://openrouter.ai/api/v1",
      config: {
        defaultHeaders: {
          "HTTP-Referer": "https://loompad.dev",
          "X-Title": "LoomPad",
        },
      } as unknown as AxAI["config"],
      model: model,
    });

    // Run the evaluation
    const result = await judge.forward(
      llm,
      {
        context,
        options,
      },
      {
        maxRetries: 2,
        modelConfig: {
          temperature: temperature ?? 0.1,
        } as unknown as AxAI["config"],
      }
    );

    console.log("[Judge] Result:", result);

    const choice = result.choice;

    // Validate result
    if (typeof choice === "number" && choice > 0 && choice <= options.length) {
      // Convert 1-based index (from ax prompt) to 0-based index (for frontend)
      return res.json({ choice: choice - 1, raw: JSON.stringify(result) });
    }

    return res.json({ choice: null, raw: JSON.stringify(result) });
  } catch (error) {
    console.error("[Judge] Error:", error);
    return res.status(500).json({
      error: "Judge evaluation failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
