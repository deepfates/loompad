import type { NextFunction, Request, Response } from "express";
import { config } from "./config";

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
