import type { Express } from "express";

export const TRUSTED_PROXY_SUBNETS = [
  "loopback",
  "linklocal",
  "uniquelocal",
] as const;

export function configureTrustedProxies(app: Express) {
  // Trust forwarded headers only from local/private reverse proxies.
  app.set("trust proxy", [...TRUSTED_PROXY_SUBNETS]);
}
