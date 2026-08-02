import { describe, expect, it } from "bun:test";
import express from "express";
import http from "http";
import {
  createSiteAuthCookieValue,
  hasSiteAccess,
  hasProtectedSyncAccess,
  hasValidSiteSession,
  isPublicPwaResource,
  isSiteAuthConfigured,
  renderSiteLoginPage,
  setupSiteAuthRoutes,
  SITE_AUTH_COOKIE,
} from "../siteAuth";

const options = {
  sitePassword: "alpha",
  siteAuthSecret: "secret",
  isDevelopment: false,
};

describe("site auth", () => {
  it("keeps PWA discovery public without exposing the app shell or worker", () => {
    for (const pathname of [
      "/manifest.webmanifest",
      "/client/manifest.webmanifest",
      "/assets/manifest.webmanifest",
      "/assets/icon-512.png",
      "/client/assets/icon-192.png",
      "/client/assets/icon-512-maskable.png",
    ]) {
      expect(isPublicPwaResource(pathname)).toBe(true);
    }

    for (const pathname of [
      "/",
      "/index.js",
      "/sw.js",
      "/registerSW.js",
      "/api/models",
      "/client/assets/index.css",
      "/client/assets/not-an-icon.png",
    ]) {
      expect(isPublicPwaResource(pathname)).toBe(false);
    }
  });

  it("advertises install metadata from the unauthenticated login page", () => {
    const html = renderSiteLoginPage();
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain(
      'rel="apple-touch-icon" href="/client/assets/icon-192.png"',
    );
    expect(html).toContain(
      'name="apple-mobile-web-app-capable" content="yes"',
    );
  });

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

  it("does not make durable sync public when the API token is the only gate", () => {
    const tokenOnly = { ...options, sitePassword: null };
    expect(hasSiteAccess({ headers: {} }, tokenOnly, "script-secret")).toBe(true);
    expect(hasProtectedSyncAccess({ headers: {} }, tokenOnly, "script-secret")).toBe(false);
    expect(hasProtectedSyncAccess({
      headers: { authorization: "Bearer script-secret" },
    }, tokenOnly, "script-secret")).toBe(true);
  });

  it("allows an ungated local development relay but not an ungated production relay", () => {
    const ungated = { ...options, sitePassword: null };
    expect(hasProtectedSyncAccess({ headers: {} }, { ...ungated, isDevelopment: true }, null)).toBe(true);
    expect(hasProtectedSyncAccess({ headers: {} }, ungated, null)).toBe(false);
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
