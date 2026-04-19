interface Config {
  completionsApiKey: string;
  isDevelopment: boolean;
  corsAllowedOrigins: string[] | null;
  apiAuthToken: string | null;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseAllowedOrigins(raw: string | undefined): string[] | null {
  if (!raw) {
    return null;
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validateConfig(): Config {
  const completionsApiKey =
    process.env.LOOMPAD_COMPLETIONS_API_KEY?.trim() || "not-required";
  const isDevelopment = process.env.NODE_ENV !== "production";
  const apiAuthToken = process.env.LOOMPAD_API_AUTH_TOKEN?.trim() || null;
  const corsAllowedOrigins = parseAllowedOrigins(
    process.env.CORS_ALLOWED_ORIGINS,
  );
  const rateLimitWindowMs = parsePositiveInt(
    process.env.LOOMPAD_RATE_LIMIT_WINDOW_MS,
    60_000,
  );
  const rateLimitMaxRequests = parsePositiveInt(
    process.env.LOOMPAD_RATE_LIMIT_MAX_REQUESTS,
    30,
  );

  if (!isDevelopment && !apiAuthToken) {
    console.warn(
      "⚠️ LOOMPAD_API_AUTH_TOKEN is not set. Cost-bearing APIs are unauthenticated.",
    );
  }

  return {
    completionsApiKey,
    isDevelopment,
    corsAllowedOrigins,
    apiAuthToken,
    rateLimitWindowMs,
    rateLimitMaxRequests,
  };
}

export const config = validateConfig();
