interface Config {
  openRouterApiKey: string;
  isDevelopment: boolean;
  corsAllowedOrigins: string[] | null;
  apiAuthToken: string | null;
  sitePassword: string | null;
  siteAuthSecret: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  trustProxyHops: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
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
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  const isDevelopment = process.env.NODE_ENV !== "production";
  const apiAuthToken = process.env.TEXTILE_API_AUTH_TOKEN?.trim() || null;
  const sitePassword = process.env.TEXTILE_SITE_PASSWORD?.trim() || null;
  const siteAuthSecret =
    process.env.TEXTILE_SITE_AUTH_SECRET?.trim() ||
    sitePassword ||
    apiAuthToken ||
    "textile-development-site-auth-secret";
  const corsAllowedOrigins = parseAllowedOrigins(
    process.env.CORS_ALLOWED_ORIGINS,
  );
  const rateLimitWindowMs = parsePositiveInt(
    process.env.TEXTILE_RATE_LIMIT_WINDOW_MS,
    60_000,
  );
  const rateLimitMaxRequests = parsePositiveInt(
    process.env.TEXTILE_RATE_LIMIT_MAX_REQUESTS,
    30,
  );
  const trustProxyHops = parseNonNegativeInt(
    process.env.TEXTILE_TRUST_PROXY_HOPS,
    isDevelopment ? 0 : 1,
  );

  if (!isDevelopment && !apiAuthToken && !sitePassword) {
    console.warn(
      "⚠️ TEXTILE_SITE_PASSWORD or TEXTILE_API_AUTH_TOKEN is required for production generation APIs.",
    );
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
        sitePassword,
        siteAuthSecret,
        rateLimitWindowMs,
        rateLimitMaxRequests,
        trustProxyHops,
      };
    }
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  return {
    openRouterApiKey,
    isDevelopment,
    corsAllowedOrigins,
    apiAuthToken,
    sitePassword,
    siteAuthSecret,
    rateLimitWindowMs,
    rateLimitMaxRequests,
    trustProxyHops,
  };
}

export const config = validateConfig();
