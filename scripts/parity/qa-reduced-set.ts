/**
 * QA the reduced design space: 2 fonts × 6 themes × 3 screens (loom,
 * map, settings). 36 shots total. Running against the dev server on
 * :5173.
 */

import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/qa-reduced");

const FONTS = ["font-use-iosevka", "font-use-iosevka-slab"];
const THEMES = [
  "theme-light",
  "theme-blue",
  "theme-aperture",
  "theme-black-green",
  "theme-nerv",
  "theme-outrun",
];
const SCREENS: { name: string; keys: string[] }[] = [
  { name: "loom", keys: [] },
  { name: "map", keys: ["Escape"] },
  { name: "settings", keys: ["`"] },
];

async function apply(page: Page, theme: string, font: string) {
  await page.evaluate(
    ({ theme, font }) => {
      const html = document.documentElement;
      const body = document.body;
      for (const el of [html, body]) {
        [...el.classList].forEach((c) => {
          if (c.startsWith("theme-") || c.startsWith("font-use-")) {
            el.classList.remove(c);
          }
        });
      }
      html.classList.add(theme, font);
    },
    { theme, font },
  );
  await page.waitForTimeout(250);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });
  for (const font of FONTS) {
    for (const theme of THEMES) {
      for (const screen of SCREENS) {
        await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(500);
        await apply(page, theme, font);
        for (const k of screen.keys) {
          await page.keyboard.press(k, { delay: 30 });
          await page.waitForTimeout(250);
        }
        const dir = path.join(OUT, font, theme);
        await mkdir(dir, { recursive: true });
        await page.screenshot({
          path: path.join(dir, `${screen.name}.png`),
          fullPage: false,
        });
        console.log(`✓ ${font} ${theme} ${screen.name}`);
      }
    }
  }
  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
