import { describe, expect, it } from "bun:test";
import express from "express";
import {
  configureTrustedProxies,
  TRUSTED_PROXY_SUBNETS,
} from "../trustedProxy";

describe("trusted proxy policy", () => {
  it("trusts private reverse proxies without globally trusting clients", () => {
    const app = express();
    configureTrustedProxies(app);

    const trustProxy = app.get("trust proxy fn") as (
      ip: string,
      index: number,
    ) => boolean;

    expect(app.get("trust proxy")).toEqual([...TRUSTED_PROXY_SUBNETS]);
    expect(trustProxy("10.0.0.12", 0)).toBe(true);
    expect(trustProxy("172.16.4.8", 0)).toBe(true);
    expect(trustProxy("192.168.1.20", 0)).toBe(true);
    expect(trustProxy("127.0.0.1", 0)).toBe(true);
    expect(trustProxy("203.0.113.10", 0)).toBe(false);
    expect(trustProxy("8.8.8.8", 0)).toBe(false);
  });
});
