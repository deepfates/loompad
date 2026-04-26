import { describe, expect, it } from "bun:test";
import { canAccessProtectedApi, isSameOriginRequest } from "../apis/security";

type HeaderMap = Record<string, string | undefined>;

function request(headers: HeaderMap, protocol = "https") {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    protocol,
    get(name: string) {
      return normalized[name.toLowerCase()];
    },
    header(name: string) {
      return normalized[name.toLowerCase()];
    },
  };
}

describe("API auth", () => {
  it("recognizes same-origin browser requests", () => {
    expect(
      isSameOriginRequest(
        request({
          host: "textile.lol",
          origin: "https://textile.lol",
        }),
      ),
    ).toBe(true);
  });

  it("rejects off-origin production requests when no API token is configured", () => {
    expect(
      canAccessProtectedApi(
        request({
          host: "textile.lol",
          origin: "https://attacker.example",
        }),
        null,
        false,
      ),
    ).toBe(false);
  });

  it("allows first-party production requests when no API token is configured", () => {
    expect(
      canAccessProtectedApi(
        request({
          host: "textile.lol",
          origin: "https://textile.lol",
        }),
        null,
        false,
      ),
    ).toBe(true);
  });

  it("allows direct requests with the configured API token", () => {
    expect(
      canAccessProtectedApi(
        request({
          host: "textile.lol",
          authorization: "Bearer secret",
        }),
        "secret",
        false,
      ),
    ).toBe(true);
  });
});
