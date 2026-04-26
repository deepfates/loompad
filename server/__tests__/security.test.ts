import { describe, expect, it } from "bun:test";
import { canAccessProtectedApi } from "../apis/security";

type HeaderMap = Record<string, string | undefined>;

function request(headers: HeaderMap) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    header(name: string) {
      return normalized[name.toLowerCase()];
    },
  };
}

describe("API auth", () => {
  it("rejects spoofable same-origin headers in production", () => {
    expect(
      canAccessProtectedApi(
        request({
          host: "textile.lol",
          origin: "https://textile.lol",
          referer: "https://textile.lol/story",
        }),
        null,
        false,
      ),
    ).toBe(false);
  });

  it("allows requests with a valid site session", () => {
    expect(
      canAccessProtectedApi(
        request({}),
        null,
        false,
        true,
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

  it("allows direct requests with the x-api-key header", () => {
    expect(
      canAccessProtectedApi(
        request({
          "x-api-key": "secret",
        }),
        "secret",
        false,
      ),
    ).toBe(true);
  });

  it("allows development requests without configured auth", () => {
    expect(canAccessProtectedApi(request({}), null, true)).toBe(true);
  });
});
