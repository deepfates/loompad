import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { config } from "../config";
import { hasValidSiteSession } from "../siteAuth";
import {
  hasValidApiAuthToken,
  type HeaderSource,
} from "../apiAuthToken";
export { createRateLimitMiddleware } from "../rateLimit";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

const allowedOrigins = new Set(
  (config.corsAllowedOrigins ?? []).map((origin) => normalizeOrigin(origin)),
);

export const apiCors = cors({
  origin(origin, callback) {
    // If no allowlist is configured, preserve default permissive behavior.
    if (!config.corsAllowedOrigins || config.corsAllowedOrigins.length === 0) {
      callback(null, true);
      return;
    }

    // Same-origin and non-browser requests may not set Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.has(normalized)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS policy: ${origin}`));
  },
});

export function canAccessProtectedApi(
  req: HeaderSource,
  expected: string | null,
  isDevelopment: boolean,
  hasSiteSession = false,
) {
  if (hasValidApiAuthToken(req, expected)) {
    return true;
  }

  if (hasSiteSession) {
    return true;
  }

  if (!expected && isDevelopment) {
    return true;
  }

  return false;
}

export function requireApiAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (
    canAccessProtectedApi(
      req,
      config.apiAuthToken,
      config.isDevelopment,
      hasValidSiteSession(req),
    )
  ) {
    next();
    return;
  }

  if (!config.isDevelopment && !config.apiAuthToken && !config.sitePassword) {
    res.status(503).json({
      error:
        "Protected APIs require TEXTILE_SITE_PASSWORD or TEXTILE_API_AUTH_TOKEN in production",
    });
    return;
  }

  res.status(401).json({ error: "Unauthorized" });
}
