import { describe, expect, it } from "bun:test";
import express from "express";
import { trustedProxySetting } from "../trustedProxy";

describe("trusted proxy policy", () => {
  it("defaults to no proxy trust when hops are zero", () => {
    expect(trustedProxySetting(0)).toBe(false);
  });

  it("can be bounded to a fixed number of proxy hops", () => {
    const app = express();
    app.set("trust proxy", trustedProxySetting(1));

    const trustProxy = app.get("trust proxy fn") as (
      ip: string,
      index: number,
    ) => boolean;

    expect(app.get("trust proxy")).toBe(1);
    expect(trustProxy("203.0.113.10", 0)).toBe(true);
    expect(trustProxy("203.0.113.10", 1)).toBe(false);
  });
});
