import { describe, expect, it } from "bun:test";
import {
  validateGenerateRequestBody,
  validateJudgeRequestBody,
  validateModelPayload,
} from "../apis/validators";

describe("validateGenerateRequestBody", () => {
  it("accepts a valid payload", () => {
    const result = validateGenerateRequestBody({
      prompt: "Hello",
      model: "meta-llama/llama-3.1-405b",
      temperature: 0.7,
      maxTokens: 120,
      lengthMode: "sentence",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects missing prompt", () => {
    const result = validateGenerateRequestBody({
      model: "meta-llama/llama-3.1-405b",
    });

    expect(result).toEqual({
      ok: false,
      error: "prompt must be a non-empty string",
    });
  });

  it("rejects invalid length mode", () => {
    const result = validateGenerateRequestBody({
      prompt: "Hello",
      model: "meta-llama/llama-3.1-405b",
      lengthMode: "chapter",
    });

    expect(result).toEqual({
      ok: false,
      error: "lengthMode is invalid",
    });
  });
});

describe("validateJudgeRequestBody", () => {
  it("accepts valid context and options", () => {
    const result = validateJudgeRequestBody({
      context: "Story so far",
      options: ["A", "B", "C"],
      model: "meta-llama/llama-3.1-405b",
      temperature: 0.2,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects empty option arrays", () => {
    const result = validateJudgeRequestBody({
      context: "Story so far",
      options: [],
      model: "meta-llama/llama-3.1-405b",
    });

    expect(result).toEqual({
      ok: false,
      error: "options must be a non-empty array",
    });
  });
});

describe("validateModelPayload", () => {
  it("accepts valid create payload", () => {
    const result = validateModelPayload(
      {
        id: "provider/model",
        name: "Model",
        maxTokens: 1024,
        defaultTemp: 0.7,
        generationMode: "completion",
      },
      { requireId: true },
    );

    expect(result.ok).toBe(true);
  });

  it("accepts the pre-generation-mode payload with an explicit legacy fallback", () => {
    const result = validateModelPayload(
      {
        id: "provider/legacy-model",
        name: "Legacy Model",
        maxTokens: 1024,
        defaultTemp: 0.7,
      },
      { requireId: true, fallbackGenerationMode: "completion" },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        id: "provider/legacy-model",
        config: {
          name: "Legacy Model",
          maxTokens: 1024,
          defaultTemp: 0.7,
          generationMode: "completion",
        },
      },
    });
  });

  it("rejects an unknown generation mode even when a fallback exists", () => {
    const result = validateModelPayload(
      {
        id: "provider/model",
        name: "Model",
        maxTokens: 1024,
        defaultTemp: 0.7,
        generationMode: "base",
      },
      { requireId: true, fallbackGenerationMode: "completion" },
    );

    expect(result).toEqual({
      ok: false,
      error: "generationMode must be completion or instruction",
    });
  });

  it("uses the supplied existing mode for a legacy edit", () => {
    const result = validateModelPayload(
      {
        name: "Edited Model",
        maxTokens: 2048,
        defaultTemp: 0.5,
      },
      { requireId: false, fallbackGenerationMode: "instruction" },
    );

    expect(result.ok && result.value.config.generationMode).toBe("instruction");
  });

  it("rejects invalid max token values", () => {
    const result = validateModelPayload(
      {
        id: "provider/model",
        name: "Model",
        maxTokens: 0,
        defaultTemp: 0.7,
        generationMode: "completion",
      },
      { requireId: true },
    );

    expect(result).toEqual({
      ok: false,
      error: "maxTokens must be a positive integer",
    });
  });
});
