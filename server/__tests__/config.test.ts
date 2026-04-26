import { describe, expect, it } from "bun:test";
import { readApiAuthToken, validateConfig } from "../config";

describe("server config", () => {
  it("uses the Textile API auth token when present", () => {
    expect(
      readApiAuthToken({
        TEXTILE_API_AUTH_TOKEN: " textile-token ",
        LOOMPAD_API_AUTH_TOKEN: "loompad-token",
      }),
    ).toBe("textile-token");
  });

  it("does not read the previous Loompad API auth token after the cutover", () => {
    expect(
      readApiAuthToken({
        LOOMPAD_API_AUTH_TOKEN: " loompad-token ",
      }),
    ).toBeNull();
  });

  it("fails closed in production when Textile API auth is missing", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "production",
        OPENROUTER_API_KEY: "sk-or-test",
        LOOMPAD_API_AUTH_TOKEN: "loompad-token",
      }),
    ).toThrow("TEXTILE_API_AUTH_TOKEN environment variable is required in production");
  });
});
