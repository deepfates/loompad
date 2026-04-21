import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LIVE = "https://loompad.lol";
const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/themes");

const LIGHT_THEMES = [
  "theme-aperture",
  "theme-blue",
  "theme-light",
  "theme-macos9",
  "theme-win95",
  "theme-westworld",
];
const DARK_THEMES = [
  "theme-hologram",
  "theme-nerv",
  "theme-dark",
  "theme-black-red",
  "theme-black-green",
  "theme-black-amber",
  "theme-lcars",
  "theme-outrun",
];
const ALL_THEMES = [...LIGHT_THEMES, ...DARK_THEMES];

async function main() {
  const browser = await chromium.launch();
  try {
    for (const [label, base] of [
      ["live", LIVE],
      ["local", LOCAL],
    ] as const) {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      const page = await ctx.newPage();
      await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(800);
      // Open Settings
      await page.keyboard.press("`");
      await page.waitForTimeout(300);
      for (const themeClass of ALL_THEMES) {
        await page.evaluate((cls) => {
          const all = [
            "theme-aperture","theme-blue","theme-light","theme-macos9","theme-win95","theme-westworld",
            "theme-hologram","theme-nerv","theme-dark","theme-black-red","theme-black-green","theme-black-amber","theme-lcars","theme-outrun",
          ];
          for (const c of all) {
            document.documentElement.classList.remove(c);
            document.body.classList.remove(c);
          }
          document.documentElement.classList.add(cls);
          document.body.classList.add(cls);
        }, themeClass);
        await page.waitForTimeout(200);
        const dir = path.join(OUT, themeClass);
        await mkdir(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage: true });
        console.log(`✓ ${label} ${themeClass}`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
