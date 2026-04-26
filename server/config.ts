interface Config {
  openRouterApiKey: string;
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

export function readApiAuthToken(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.TEXTILE_API_AUTH_TOKEN?.trim() || null;
}

export function validateConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const openRouterApiKey = env.OPENROUTER_API_KEY;
  const isDevelopment = env.NODE_ENV !== "production";
  const apiAuthToken = readApiAuthToken(env);
  const corsAllowedOrigins = parseAllowedOrigins(
    env.CORS_ALLOWED_ORIGINS,
  );
  const rateLimitWindowMs = parsePositiveInt(
    env.TEXTILE_RATE_LIMIT_WINDOW_MS,
    60_000,
  );
  const rateLimitMaxRequests = parsePositiveInt(
    env.TEXTILE_RATE_LIMIT_MAX_REQUESTS,
    30,
  );

  if (!isDevelopment && !apiAuthToken) {
    throw new Error("TEXTILE_API_AUTH_TOKEN environment variable is required in production");
  }

  if (!openRouterApiKey) {
    // Treat any non-production environment as development
    if (isDevelopment) {
      console.warn("⚠️ Using placeholder OpenRouter API key for development");
      return {
        openRouterApiKey: "sk-or-placeholder-key",
        isDevelopment,
        corsAllowedOrigins,
        apiAuthToken,
        rateLimitWindowMs,
        rateLimitMaxRequests,
      };
    }
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  return {
    openRouterApiKey,
    isDevelopment,
    corsAllowedOrigins,
    apiAuthToken,
    rateLimitWindowMs,
    rateLimitMaxRequests,
  };
}

export const config = validateConfig();
