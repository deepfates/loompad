import type { LengthMode } from "../../shared/lengthPresets";
import type { ModelConfig } from "../../shared/models";

const LENGTH_MODES: ReadonlySet<LengthMode> = new Set([
  "word",
  "sentence",
  "paragraph",
  "page",
]);

type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOptionalFiniteNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value;
}

export interface GenerateRequestBody {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  lengthMode?: LengthMode;
}

export function validateGenerateRequestBody(
  body: unknown,
): ValidationResult<GenerateRequestBody> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const prompt = body.prompt;
  const model = body.model;
  const temperature = parseOptionalFiniteNumber(body.temperature);
  const maxTokens = parseOptionalFiniteNumber(body.maxTokens);
  const lengthMode = body.lengthMode;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return { ok: false, error: "prompt must be a non-empty string" };
  }

  if (model !== undefined && (typeof model !== "string" || !model.trim())) {
    return { ok: false, error: "model must be a non-empty string when provided" };
  }

  if (
    temperature !== undefined &&
    (temperature < 0 || temperature > 2)
  ) {
    return { ok: false, error: "temperature must be between 0 and 2" };
  }

  if (
    maxTokens !== undefined &&
    (!Number.isInteger(maxTokens) || maxTokens <= 0)
  ) {
    return { ok: false, error: "maxTokens must be a positive integer" };
  }

  if (
    lengthMode !== undefined &&
    (typeof lengthMode !== "string" ||
      !LENGTH_MODES.has(lengthMode as LengthMode))
  ) {
    return { ok: false, error: "lengthMode is invalid" };
  }

  return {
    ok: true,
    value: {
      prompt,
      model: typeof model === "string" ? model.trim() : undefined,
      temperature,
      maxTokens,
      lengthMode: lengthMode as LengthMode | undefined,
    },
  };
}

export interface JudgeRequestBody {
  context: string;
  options: string[];
  model: string;
  temperature?: number;
}

export function validateJudgeRequestBody(
  body: unknown,
): ValidationResult<JudgeRequestBody> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const context = body.context;
  const options = body.options;
  const model = body.model;
  const temperature = parseOptionalFiniteNumber(body.temperature);

  if (typeof context !== "string" || !context.trim()) {
    return { ok: false, error: "context must be a non-empty string" };
  }

  if (!Array.isArray(options) || options.length === 0) {
    return { ok: false, error: "options must be a non-empty array" };
  }

  if (options.some((option) => typeof option !== "string" || !option.trim())) {
    return { ok: false, error: "each option must be a non-empty string" };
  }

  if (typeof model !== "string" || !model.trim()) {
    return { ok: false, error: "model must be a non-empty string" };
  }

  if (
    temperature !== undefined &&
    (temperature < 0 || temperature > 2)
  ) {
    return { ok: false, error: "temperature must be between 0 and 2" };
  }

  return {
    ok: true,
    value: {
      context,
      options,
      model,
      temperature,
    },
  };
}

export interface ModelPayload {
  id?: string;
  config: ModelConfig;
}

export function validateModelPayload(
  body: unknown,
  opts: { requireId: boolean },
): ValidationResult<ModelPayload> {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const id = body.id;
  const name = body.name;
  const maxTokens = body.maxTokens;
  const defaultTemp = body.defaultTemp;

  if (opts.requireId) {
    if (typeof id !== "string" || !id.trim()) {
      return { ok: false, error: "Model ID is required" };
    }
  }

  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "Model name is required" };
  }

  if (
    typeof maxTokens !== "number" ||
    !Number.isFinite(maxTokens) ||
    maxTokens <= 0 ||
    !Number.isInteger(maxTokens)
  ) {
    return { ok: false, error: "maxTokens must be a positive integer" };
  }

  if (
    typeof defaultTemp !== "number" ||
    !Number.isFinite(defaultTemp) ||
    defaultTemp < 0 ||
    defaultTemp > 2
  ) {
    return { ok: false, error: "defaultTemp must be between 0 and 2" };
  }

  return {
    ok: true,
    value: {
      id: typeof id === "string" ? id.trim() : undefined,
      config: {
        name: name.trim(),
        maxTokens,
        defaultTemp,
      },
    },
  };
}
