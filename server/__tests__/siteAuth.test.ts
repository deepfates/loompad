import { describe, expect, it } from "bun:test";
import express from "express";
import http from "http";
import {
  createSiteAuthCookieValue,
  hasSiteAccess,
  hasValidSiteSession,
  isSiteAuthConfigured,
  setupSiteAuthRoutes,
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

  it("treats malformed cookies as missing cookies", () => {
    expect(
      hasValidSiteSession(
        {
          headers: {
            cookie: `${SITE_AUTH_COOKIE}=%E0%A4%A`,
          },
        },
        options,
      ),
    ).toBe(false);
  });

  it("allows API token access through the site gate", () => {
    expect(
      hasSiteAccess(
        {
          headers: {
            authorization: "Bearer script-secret",
          },
        },
        options,
        "script-secret",
      ),
    ).toBe(true);
  });

  it("serves login styles without Tailwind source directives", async () => {
    const app = express();
    setupSiteAuthRoutes(app);
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close();
      throw new Error("Expected TCP test server address");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/_textile/terminal.css`,
      );
      const css = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/css");
      expect(css).toContain(".terminal-screen");
      expect(css).toContain(".gamepad-btn");
      expect(css).toContain("/_textile/fonts/Iosevka-Regular.woff2");
      expect(css).not.toContain('@import "tailwindcss"');
      expect(css).not.toContain("@theme");
      expect(css).not.toContain("@source");
    } finally {
      server.close();
    }
  });
});
