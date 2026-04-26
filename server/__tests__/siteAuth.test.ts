import { describe, expect, it } from "bun:test";
import {
  createSiteAuthCookieValue,
  hasValidSiteSession,
  isSiteAuthConfigured,
  SITE_AUTH_COOKIE,
} from "../siteAuth";

const options = {
  sitePassword: "alpha",
  siteAuthSecret: "secret",
  isDevelopment: false,
};

describe("site auth", () => {
  it("is enabled only when a site password is configured", () => {
    expect(isSiteAuthConfigured(options)).toBe(true);
    expect(
      isSiteAuthConfigured({
        ...options,
        sitePassword: null,
      }),
    ).toBe(false);
  });

  it("recognizes the signed site session cookie", () => {
    const value = createSiteAuthCookieValue(options);
    expect(
      hasValidSiteSession(
        {
          headers: {
            cookie: `other=value; ${SITE_AUTH_COOKIE}=${encodeURIComponent(value)}`,
          },
        },
        options,
      ),
    ).toBe(true);
  });

  it("rejects missing or forged site session cookies", () => {
    expect(hasValidSiteSession({ headers: {} }, options)).toBe(false);
    expect(
      hasValidSiteSession(
        {
          headers: {
            cookie: `${SITE_AUTH_COOKIE}=v1.forged`,
          },
        },
        options,
      ),
    ).toBe(false);
  });
});
