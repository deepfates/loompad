import crypto from "crypto";
import type { Application, NextFunction, Request, Response } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { hasValidApiAuthToken } from "./apiAuthToken";
import { config } from "./config";
import { createRateLimitMiddleware } from "./rateLimit";

export const SITE_AUTH_COOKIE = "textile_site";
const LOGIN_STYLES_PATH = "/_textile/terminal.css";
const LOGIN_FONT_PATH = "/_textile/fonts";
const LOGIN_FONT_FILES = new Set([
  "Iosevka-Regular.woff2",
  "IosevkaSlab-Regular.woff2",
]);

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

function rewriteLoginFontUrls(css: string) {
  return css.replace(
    /url\((["']?)(?:\.\.\/assets\/fonts\/|\/assets\/)(Iosevka(?:Slab)?-Regular\.woff2)\1\)/g,
    (_match, _quote, file: string) => `url("${LOGIN_FONT_PATH}/${file}")`,
  );
}

function loadLoginStylesheet() {
  const builtCssPath = path.resolve(
    process.cwd(),
    "dist/client/assets/index.css",
  );
  if (!config.isDevelopment && fs.existsSync(builtCssPath)) {
    return rewriteLoginFontUrls(fs.readFileSync(builtCssPath, "utf-8"));
  }

  const sourceCssPath = path.resolve(process.cwd(), "client/styles/terminal.css");
  const sourceCss = fs.readFileSync(sourceCssPath, "utf-8");

  return rewriteLoginFontUrls(
    sourceCss
      .replace(/@import\s+"tailwindcss";\s*/g, "")
      .replace(/@theme\s*\{[\s\S]*?\}\s*/g, "")
      .replace(/@source\s+[^;]+;\s*/g, ""),
  );
}

const themeBootstrapScript = `(() => {
  const LIGHT_THEMES = {
    "theme-light": 1,
    "theme-blue": 1,
    "theme-aperture": 1,
  };
  const DARK_THEMES = {
    "theme-black-green": 1,
    "theme-nerv": 1,
    "theme-outrun": 1,
  };
  const DEFAULT_LIGHT = "theme-light";
  const DEFAULT_DARK = "theme-black-green";
  const pickLight = (id) => (id && LIGHT_THEMES[id] ? id : DEFAULT_LIGHT);
  const pickDark = (id) => (id && DARK_THEMES[id] ? id : DEFAULT_DARK);

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let themeClass = prefersDark ? DEFAULT_DARK : DEFAULT_LIGHT;
  try {
    const raw = localStorage.getItem("textile-theme-preferences");
    if (raw) {
      const prefs = JSON.parse(raw);
      const mode = prefs && prefs.mode;
      if (mode === "light") {
        themeClass = pickLight(prefs.paletteLight);
      } else if (mode === "dark") {
        themeClass = pickDark(prefs.paletteDark);
      } else {
        themeClass = prefersDark
          ? pickDark(prefs.paletteDark)
          : pickLight(prefs.paletteLight);
      }
    } else {
      const legacy = localStorage.getItem("theme");
      if (legacy === "phosphor") themeClass = DEFAULT_DARK;
      else if (legacy === "light") themeClass = DEFAULT_LIGHT;
    }
    const font = localStorage.getItem("textile-font") || "iosevka";
    const fontClass = font === "iosevka-slab"
      ? "font-use-iosevka-slab"
      : "font-use-iosevka";
    document.documentElement.classList.add(themeClass, fontClass);
  } catch (_) {
    document.documentElement.classList.add(
      prefersDark ? DEFAULT_DARK : DEFAULT_LIGHT,
      "font-use-iosevka",
    );
  }
})();`;

function loginPage(next = "/", error = false) {
  const message = error
    ? "<p class=\"login-error\" role=\"alert\">That password did not work.</p>"
    : "";
  const safeNext = escapeAttribute(safeRedirectTarget(next));
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#2a2a2a" />
      <title>Textile</title>
      <script>${themeBootstrapScript}</script>
      <link rel="stylesheet" href="${LOGIN_STYLES_PATH}" />
      <style>
        .login-main {
          justify-content: center;
          padding: 1rem;
        }

        .login-container {
          justify-content: center;
          max-width: min(100%, 32rem);
          padding: 0;
        }

        .login-screen {
          flex: 0 1 auto;
          min-height: 0;
          min-width: min(var(--min-width), 100%);
          box-shadow: 0 0 0 1px var(--theme-border-subdued);
        }

        .login-status {
          min-width: 0;
          overflow: hidden;
          color: var(--theme-muted);
          opacity: 0.85;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .login-content {
          display: grid;
          gap: 1rem;
          padding: 1rem;
          line-height: 1.6;
        }

        .login-title {
          margin: 0;
          color: var(--theme-focused-foreground);
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: 0;
        }

        .login-form {
          display: grid;
          gap: 0.75rem;
        }

        .login-label {
          color: var(--theme-muted);
          font-weight: 700;
        }

        .login-input {
          width: 100%;
          min-height: var(--button-size);
          border: 2px solid var(--theme-text);
          border-radius: 0;
          background: var(--theme-background-input);
          color: var(--theme-focused-foreground);
          font: inherit;
          padding: 0.75rem;
        }

        .login-input:focus {
          border-color: var(--theme-focused-foreground);
          outline: none;
        }

        .login-submit {
          width: 100%;
          height: var(--button-size);
        }

        .login-error {
          margin: 0;
          padding: 0.75rem;
          border: 1px solid var(--theme-focused-foreground);
          color: var(--theme-focused-foreground);
        }

        @media (max-width: 22rem) {
          .login-main {
            padding: 0.75rem;
          }

          .login-content {
            padding: 0.75rem;
          }
        }
      </style>
    </head>
    <body>
      <main class="gamepad-main login-main">
        <div class="gamepad-container login-container">
          <section class="terminal-screen login-screen" aria-labelledby="title">
            <div class="mode-bar">
              <strong class="mode-bar-title">Textile</strong>
              <span class="login-status">private alpha</span>
            </div>
            <div class="login-content">
              <h1 class="login-title" id="title">Enter password</h1>
              ${message}
              <form class="login-form" method="post" action="/_textile/login">
                <input type="hidden" name="next" value="${safeNext}" />
                <label class="login-label" for="password">Password</label>
                <input class="login-input" id="password" name="password" type="password" autocomplete="current-password" autofocus />
                <button class="gamepad-btn login-submit" type="submit">Enter</button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </body>
  </html>`;
}

export function setupSiteAuthRoutes(app: Application) {
  app.get(LOGIN_STYLES_PATH, (_req, res) => {
    res
      .status(200)
      .type("text/css")
      .setHeader("Cache-Control", "no-cache")
      .send(loadLoginStylesheet());
  });

  app.get(`${LOGIN_FONT_PATH}/:file`, (req, res) => {
    const file = typeof req.params.file === "string" ? req.params.file : "";
    if (!LOGIN_FONT_FILES.has(file)) {
      res.status(404).send("Not found");
      return;
    }

    const sourceFontPath = path.resolve(
      process.cwd(),
      "client/assets/fonts",
      file,
    );
    const builtFontPath = path.resolve(
      process.cwd(),
      "dist/client/assets",
      file,
    );
    const fontPath = fs.existsSync(sourceFontPath)
      ? sourceFontPath
      : builtFontPath;
    if (!fs.existsSync(fontPath)) {
      res.status(404).send("Not found");
      return;
    }

    res
      .status(200)
      .type("font/woff2")
      .setHeader("Cache-Control", "public, max-age=31536000, immutable")
      .sendFile(fontPath);
  });

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
