import { describe, expect, it } from "bun:test";

import {
  lookupOpenRouterGenerationUsage,
  usageFromGenerationRecord,
} from "../apis/providerGeneration";

describe("OpenRouter generation metadata", () => {
  it("normalizes asynchronous accounting without guessing absent fields", () => {
    expect(usageFromGenerationRecord({
      data: {
        tokens_prompt: 10,
        tokens_completion: 25,
        native_tokens_reasoning: 5,
        total_cost: 0.0015,
      },
    })).toEqual({
      promptTokens: 10,
      completionTokens: 25,
      totalTokens: 35,
      reasoningTokens: 5,
      cost: 0.0015,
    });
  });

  it("waits for an asynchronously materialized generation record", async () => {
    let calls = 0;
    const usage = await lookupOpenRouterGenerationUsage(
      "gen-later",
      async () => {
        calls += 1;
        return calls === 1
          ? new Response("not yet", { status: 404 })
          : Response.json({ data: { tokens_prompt: 2, tokens_completion: 3 } });
      },
    );
    expect(calls).toBe(2);
    expect(usage).toEqual({
      promptTokens: 2,
      completionTokens: 3,
      totalTokens: 5,
      reasoningTokens: undefined,
      cost: undefined,
    });
  });
});
