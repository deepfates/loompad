import { describe, expect, it } from "bun:test";

import {
  extractOpenRouterReasoning,
  mergeGenerationReasoning,
} from "../apis/providerReasoning";

describe("provider reasoning provenance", () => {
  it("extracts standard streaming text and structured detail blocks", () => {
    expect(
      extractOpenRouterReasoning({
        choices: [
          {
            delta: {
              reasoning: "Consider the branch.",
              reasoning_details: [
                {
                  type: "reasoning.summary",
                  summary: "Compared the branches",
                  index: 0,
                },
              ],
            },
          },
        ],
      }),
    ).toEqual({
      text: "Consider the branch.",
      details: [
        {
          type: "reasoning.summary",
          summary: "Compared the branches",
          index: 0,
        },
      ],
    });
  });

  it("preserves observed stream chunks in order without inventing content", () => {
    const merged = mergeGenerationReasoning(
      { text: "First ", details: [{ type: "reasoning.text", text: "First " }] },
      { text: "then.", details: [{ type: "reasoning.text", text: "then." }] },
    );

    expect(merged.text).toBe("First then.");
    expect(merged.details?.map((detail) => detail.text)).toEqual([
      "First ",
      "then.",
    ]);
    expect(extractOpenRouterReasoning({ choices: [{ delta: {} }] })).toBeUndefined();
  });
});
