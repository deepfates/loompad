import crypto from "crypto";
import type { Application, NextFunction, Request, Response } from "express";
import express from "express";
import { hasValidApiAuthToken } from "./apiAuthToken";
import { config } from "./config";
import { createRateLimitMiddleware } from "./rateLimit";

export const SITE_AUTH_COOKIE = "textile_site";

type HeaderRequest = {
  headers: Record<string, string | string[] | undefined> & {
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
    try {
      cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
    } catch {
      continue;
    }
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

export function hasSiteAccess(
  req: HeaderRequest,
  options = getSiteAuthOptions(),
  apiAuthToken = config.apiAuthToken,
) {
  return (
    !isSiteAuthConfigured(options) ||
    hasValidSiteSession(req, options) ||
    hasValidApiAuthToken(req, apiAuthToken)
  );
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
    ? "<p class=\"error\" role=\"alert\">That password did not work.</p>"
    : "";
  const safeNext = escapeAttribute(safeRedirectTarget(next));
  return `<!doctype html>
	<html lang="en">
	  <head>
    <meta charset="utf-8" />
	    <meta name="viewport" content="width=device-width, initial-scale=1" />
	    <title>Textile</title>
	    <style>
	      :root {
	        --theme-background: #000;
	        --theme-background-modal: #262626;
	        --theme-background-input: #525252;
	        --theme-border: #393939;
	        --theme-border-subdued: rgba(82, 82, 82, 0.3);
	        --theme-text: #24a148;
	        --theme-button: #24a148;
	        --theme-button-text: #044317;
	        --theme-focused-foreground: #c6c6c6;
	        --theme-muted: #6fdc8c;
	        --font-family-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	      }
	      * {
	        box-sizing: border-box;
	      }
	      body {
	        margin: 0;
	        min-height: 100dvh;
	        display: flex;
	        align-items: center;
	        justify-content: center;
	        padding: 1rem;
	        background: var(--theme-background);
	        color: var(--theme-text);
	        font-family: var(--font-family-mono);
	      }
	      main {
	        width: min(90vw, 32rem);
	        min-width: min(20rem, calc(100vw - 2rem));
	      }
	      .screen {
	        width: 100%;
	        border: 2px solid var(--theme-text);
	        background: var(--theme-background);
	        box-shadow: 0 0 0 1px var(--theme-border-subdued);
	      }
	      .mode-bar {
	        display: flex;
	        align-items: center;
	        justify-content: space-between;
	        gap: 1.5ch;
	        min-width: 0;
	        padding: 0.75ch 1.25ch;
	        border-bottom: 1px solid var(--theme-border);
	      }
	      .mode-bar-title {
	        font-weight: 700;
	        white-space: nowrap;
	      }
	      .mode-bar-status {
	        min-width: 0;
	        overflow: hidden;
	        color: var(--theme-muted);
	        text-overflow: ellipsis;
	        white-space: nowrap;
	      }
	      .content {
	        padding: 1rem;
	        line-height: 1.6;
	      }
	      h1 {
	        margin: 0 0 1rem;
	        color: var(--theme-focused-foreground);
	        font-size: 1.25rem;
	        font-weight: 700;
	      }
	      form {
	        display: grid;
	        gap: 0.75rem;
	      }
	      label {
	        color: var(--theme-muted);
	      }
	      input,
	      button {
	        width: 100%;
	        min-height: 3rem;
	        border: 2px solid var(--theme-text);
	        border-radius: 0;
	        font: inherit;
	      }
	      input {
	        padding: 0.75rem;
	        background: var(--theme-background-input);
	        color: var(--theme-focused-foreground);
	      }
	      input:focus {
	        border-color: var(--theme-focused-foreground);
	        outline: none;
	        box-shadow: 0 0 0 2px var(--theme-border);
	      }
	      button {
	        display: flex;
	        align-items: center;
	        justify-content: center;
	        background: transparent;
	        color: var(--theme-text);
	        cursor: pointer;
	        user-select: none;
	        transition: background-color 0.1s ease, border-color 0.1s ease, color 0.1s ease;
	      }
	      button:hover,
	      button:focus-visible {
	        border-color: var(--theme-focused-foreground);
	        color: var(--theme-focused-foreground);
	        outline: none;
	      }
	      button:active {
	        background: var(--theme-focused-foreground);
	        color: var(--theme-background);
	        border-color: var(--theme-focused-foreground);
	      }
	      .error {
	        margin: 0 0 1rem;
	        padding: 0.75rem;
	        border: 1px solid #c83232;
	        color: #ff9632;
	      }
	      @media (max-width: 22rem) {
	        body {
	          padding: 0.75rem;
	        }
	        main {
	          min-width: 0;
	          width: 100%;
	        }
	        .content {
	          padding: 0.75rem;
	        }
	      }
	    </style>
	  </head>
	  <body>
	    <main>
	      <section class="screen" aria-labelledby="title">
	        <div class="mode-bar">
	          <span class="mode-bar-title">Textile</span>
	          <span class="mode-bar-status">private alpha</span>
	        </div>
	        <div class="content">
	          <h1 id="title">Enter password</h1>
	          ${message}
	          <form method="post" action="/_textile/login">
	            <input type="hidden" name="next" value="${safeNext}" />
	            <label for="password">Password</label>
	            <input id="password" name="password" type="password" autocomplete="current-password" autofocus />
	            <button type="submit">Enter</button>
	          </form>
	        </div>
	      </section>
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
    createRateLimitMiddleware("site-login"),
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
  if (hasSiteAccess(req)) {
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
