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

const loginLayoutScript = `(() => {
  const container = document.getElementById("login-container");
  if (!container) return;
  const update = () => {
    const aspectRatio = container.clientWidth / container.clientHeight;
    const landscape = aspectRatio >= 1.33;
    container.classList.toggle("landscape", landscape);
    container.classList.toggle("portrait", !landscape);
  };
  new ResizeObserver(update).observe(container);
  update();
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
        .login-form {
          display: contents;
        }

        .login-menu {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding-top: 0.5rem;
        }

        .login-input {
          width: 100%;
          min-width: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: inherit;
          font: inherit;
          line-height: 1.3;
          outline: none;
          padding: 0;
        }

        .login-input::placeholder {
          color: currentColor;
          opacity: 0.55;
        }

        .login-action {
          appearance: none;
          text-align: left;
        }

        .login-submit {
          border: 0;
          font: inherit;
        }

        .login-error {
          margin: 0 1rem 0.5rem;
          padding: 0.25rem 0.75rem;
          background: var(--theme-background-input);
          color: inherit;
        }

        .login-controls {
          pointer-events: none;
        }
      </style>
    </head>
    <body>
      <main class="gamepad-main bg-theme-bg text-theme-text font-mono" aria-label="Textile Login">
        <div id="login-container" class="gamepad-container portrait">
          <section class="terminal-screen" aria-labelledby="title">
            <div class="mode-bar">
              <strong class="mode-bar-title" id="title">LOGIN</strong>
              <div class="mode-bar-hint-frame">
                <span class="mode-bar-hint" aria-label="status">PRIVATE ALPHA</span>
              </div>
            </div>
            <form class="login-form" method="post" action="/_textile/login">
              <input type="hidden" name="next" value="${safeNext}" />
              <div class="drawer">
                <div class="drawer-body">
                  <div class="menu-content login-menu">
                    ${message}
                    <label class="menu-item menu-item--row menu-item--pick selected" for="password">
                      <span class="menu-item-label">Password:</span>
                      <input class="login-input" id="password" name="password" type="password" autocomplete="current-password" placeholder="required" autofocus />
                    </label>
                    <button class="menu-item menu-item--row menu-item--action login-action" type="submit">
                      <span class="menu-item-glyph" aria-hidden="true">↵</span>
                      <span class="menu-item-label">Enter</span>
                      <span class="menu-item-preview">continue to Textile</span>
                    </button>
                  </div>
                </div>
              </div>
            </form>
            <div class="navigation-bar">
              <span class="navbar-minibuffer" aria-live="polite">Textile private alpha</span>
            </div>
          </section>
          <div class="gamepad-controls login-controls" aria-hidden="true">
            <div class="controls-top">
              <div class="terminal-grid">
                <div class="terminal-grid-cell"><button class="gamepad-btn" type="button" tabindex="-1">▲</button></div>
                <div class="terminal-grid-cell"><button class="gamepad-btn" type="button" tabindex="-1">◀</button></div>
                <div class="terminal-grid-cell"><button class="gamepad-btn" type="button" tabindex="-1">▶</button></div>
                <div class="terminal-grid-cell"><button class="gamepad-btn" type="button" tabindex="-1">▼</button></div>
              </div>
              <div class="terminal-buttons">
                <button class="gamepad-btn" type="button" tabindex="-1">⌫</button>
                <button class="gamepad-btn" type="button" tabindex="-1">↵</button>
              </div>
            </div>
            <div class="terminal-menu">
              <button class="gamepad-btn" type="button" tabindex="-1">SELECT</button>
              <button class="gamepad-btn" type="button" tabindex="-1">START</button>
            </div>
          </div>
        </div>
        <script>${loginLayoutScript}</script>
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
