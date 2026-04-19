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
      temperature: 0.7,
      maxTokens: 120,
      lengthMode: "sentence",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects missing prompt", () => {
    const result = validateGenerateRequestBody({
      temperature: 0.4,
    });

    expect(result).toEqual({
      ok: false,
      error: "prompt must be a non-empty string",
    });
  });

  it("rejects invalid length mode", () => {
    const result = validateGenerateRequestBody({
      prompt: "Hello",
      lengthMode: "chapter",
    });

    expect(result).toEqual({
      ok: false,
      error: "lengthMode is invalid",
    });
  });

  it("rejects non-string model when provided", () => {
    const result = validateGenerateRequestBody({
      prompt: "Hello",
      model: 123,
    });

    expect(result).toEqual({
      ok: false,
      error: "model must be a non-empty string when provided",
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
      },
      { requireId: true },
    );

    expect(result.ok).toBe(true);
  });

  it("rejects invalid max token values", () => {
    const result = validateModelPayload(
      {
        id: "provider/model",
        name: "Model",
        maxTokens: 0,
        defaultTemp: 0.7,
      },
      { requireId: true },
    );

    expect(result).toEqual({
      ok: false,
      error: "maxTokens must be a positive integer",
    });
  });
});
