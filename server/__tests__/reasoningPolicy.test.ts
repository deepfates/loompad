import { describe, expect, it } from "bun:test";

import {
  policyFromOpenRouterModel,
  resolveContinuationReasoningPolicy,
} from "../apis/reasoningPolicy";

describe("continuation reasoning capability", () => {
  it("keeps reasoning disabled when the exact model permits it", () => {
    expect(
      policyFromOpenRouterModel("provider/optional", {
        data: [
          {
            id: "provider/optional",
            reasoning: {
              mandatory: false,
              supported_efforts: ["high", "medium", "low"],
            },
          },
        ],
      }),
    ).toBe("none");
  });

  it("selects the weakest advertised effort when reasoning is mandatory", () => {
    expect(
      policyFromOpenRouterModel("provider/mandatory", {
        data: [
          {
            id: "provider/mandatory",
            reasoning: {
              mandatory: true,
              supported_efforts: ["max", "high", "medium", "low"],
            },
          },
        ],
      }),
    ).toBe("low");

    expect(
      policyFromOpenRouterModel("provider/minimal", {
        data: [
          {
            id: "provider/minimal",
            reasoning: {
              mandatory: true,
              supported_efforts: ["high", "minimal"],
            },
          },
        ],
      }),
    ).toBe("minimal");
  });

  it("fails before generation when no mandatory effort is usable", () => {
    expect(() =>
      policyFromOpenRouterModel("provider/odd", {
        data: [
          {
            id: "provider/odd",
            reasoning: { mandatory: true, supported_efforts: [] },
          },
        ],
      }),
    ).toThrow("requires reasoning but advertises no usable effort");
  });

  it("resolves the exact model rather than a fuzzy search neighbor", async () => {
    const policy = await resolveContinuationReasoningPolicy(
      "provider/exact",
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "provider/exact-fast",
                reasoning: { mandatory: true, supported_efforts: ["low"] },
              },
              {
                id: "provider/exact",
                reasoning: { mandatory: false, supported_efforts: ["low"] },
              },
            ],
          }),
        ),
    );

    expect(policy).toBe("none");
  });
});
