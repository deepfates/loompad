import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { config } from "../config";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

const allowedOrigins = new Set(
  config.corsAllowedOrigins.map((origin) => normalizeOrigin(origin)),
);

export const apiCors = cors({
  origin(origin, callback) {
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

function getAuthToken(req: Request): string | null {
  const headerToken = req.header("x-api-key");
  if (headerToken) return headerToken;

  const authorization = req.header("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) {
    return token;
  }

  return null;
}

function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function requireApiAuth(req: Request, res: Response, next: NextFunction) {
  const expected = config.apiAuthToken;
  if (!expected) {
    next();
    return;
  }

  const provided = getAuthToken(req);
  if (!provided || !secureEquals(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitBucket>();

export function createRateLimitMiddleware(scope: string) {
  const windowMs = config.rateLimitWindowMs;
  const maxRequests = config.rateLimitMaxRequests;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${scope}:${ip}`;
    const current = rateLimitStore.get(key);

    let bucket: RateLimitBucket;
    if (!current || now >= current.resetAt) {
      bucket = {
        count: 0,
        resetAt: now + windowMs,
      };
    } else {
      bucket = current;
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    bucket.count += 1;
    rateLimitStore.set(key, bucket);

    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, maxRequests - bucket.count)),
    );
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    next();
  };
}
