import type { Express } from "express";
import { config } from "./config";

export function trustedProxySetting(hops: number) {
  return hops > 0 ? hops : false;
}

export function configureTrustedProxies(app: Express) {
  app.set("trust proxy", trustedProxySetting(config.trustProxyHops));
}
