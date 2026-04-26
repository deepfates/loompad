import crypto from "crypto";
import type { Application, NextFunction, Request, Response } from "express";
import express from "express";
import { config } from "./config";

export const SITE_AUTH_COOKIE = "textile_site";

type HeaderRequest = {
  headers: {
    cookie?: string | string[];
  };
};

interface SiteAuthOptions {
  sitePassword: string | null;
  siteAuthSecret: string;
  isDevelopment: boolean;
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionValue(secret: string) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update("textile-site-session-v1")
    .digest("base64url");
  return `v1.${signature}`;
}

function parseCookies(raw: string | string[] | undefined) {
  const cookieHeader = Array.isArray(raw) ? raw.join(";") : raw;
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }

  return cookies;
}

function getSiteAuthOptions(): SiteAuthOptions {
  return {
    sitePassword: config.sitePassword,
    siteAuthSecret: config.siteAuthSecret,
    isDevelopment: config.isDevelopment,
  };
}

export function isSiteAuthConfigured(options = getSiteAuthOptions()) {
  return Boolean(options.sitePassword);
}

export function createSiteAuthCookieValue(
  options: Pick<SiteAuthOptions, "siteAuthSecret"> = getSiteAuthOptions(),
) {
  return sessionValue(options.siteAuthSecret);
}

export function hasValidSiteSession(
  req: HeaderRequest,
  options = getSiteAuthOptions(),
) {
  if (!isSiteAuthConfigured(options)) return false;
  const actual = parseCookies(req.headers.cookie).get(SITE_AUTH_COOKIE);
  if (!actual) return false;
  return timingSafeEqualString(actual, sessionValue(options.siteAuthSecret));
}

function safeRedirectTarget(raw: unknown) {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/_textile/login")) return "/";
  return raw;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function loginPage(next = "/", error = false) {
  const message = error
    ? "<p class=\"error\">That password did not work.</p>"
    : "";
  const safeNext = escapeAttribute(safeRedirectTarget(next));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Textile</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #10130f;
        color: #f3f0e8;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      main {
        width: min(28rem, calc(100vw - 2rem));
      }
      label, input, button {
        display: block;
        width: 100%;
        box-sizing: border-box;
      }
      label {
        margin-bottom: 0.5rem;
        color: #b9b4a7;
      }
      input {
        margin-bottom: 1rem;
        padding: 0.75rem;
        border: 1px solid #555044;
        background: #191c16;
        color: inherit;
        font: inherit;
      }
      button {
        padding: 0.75rem;
        border: 1px solid #d8c98b;
        background: #d8c98b;
        color: #10130f;
        font: inherit;
        cursor: pointer;
      }
      .error {
        color: #ffb0a8;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Textile</h1>
      ${message}
      <form method="post" action="/_textile/login">
        <input type="hidden" name="next" value="${safeNext}" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" autofocus />
        <button type="submit">Enter</button>
      </form>
    </main>
  </body>
</html>`;
}

export function setupSiteAuthRoutes(app: Application) {
  app.get("/_textile/login", (req, res) => {
    if (!isSiteAuthConfigured() || hasValidSiteSession(req)) {
      res.redirect(safeRedirectTarget(req.query.next));
      return;
    }
    res
      .status(200)
      .setHeader("Content-Type", "text/html")
      .send(loginPage(safeRedirectTarget(req.query.next)));
  });

  app.post(
    "/_textile/login",
    express.urlencoded({ extended: false }),
    (req, res) => {
      if (!isSiteAuthConfigured()) {
        res.redirect("/");
        return;
      }

      const password =
        typeof req.body.password === "string" ? req.body.password : "";
      if (!timingSafeEqualString(password, config.sitePassword ?? "")) {
        res
          .status(401)
          .setHeader("Content-Type", "text/html")
          .send(loginPage(safeRedirectTarget(req.body.next), true));
        return;
      }

      res.cookie(SITE_AUTH_COOKIE, createSiteAuthCookieValue(), {
        httpOnly: true,
        secure: !config.isDevelopment,
        sameSite: "lax",
        path: "/",
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
      res.redirect(safeRedirectTarget(req.body.next));
    },
  );

  app.post("/_textile/logout", (_req, res) => {
    res.clearCookie(SITE_AUTH_COOKIE, { path: "/" });
    res.redirect("/_textile/login");
  });
}

function wantsHtml(req: Request) {
  return req.method === "GET" && req.accepts(["html", "json"]) === "html";
}

export function requireSiteAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isSiteAuthConfigured() || hasValidSiteSession(req)) {
    next();
    return;
  }

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Site password required" });
    return;
  }

  if (wantsHtml(req)) {
    res.redirect(`/_textile/login?next=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  res.status(401).send("Site password required");
}
