/**
 * Tour textile.lol across every theme + every font, on three screens
 * (loom, map, settings), so I can actually see the combinatoric space
 * before opining.
 */

import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LIVE = "https://textile.lol";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/textile-tour");

const THEMES = [
  "theme-aperture",
  "theme-blue",
  "theme-light",
  "theme-macos9",
  "theme-win95",
  "theme-westworld",
  "theme-hologram",
  "theme-nerv",
  "theme-dark",
  "theme-black-red",
  "theme-black-green",
  "theme-black-amber",
  "theme-lcars",
  "theme-outrun",
];

const FONTS = [
  "font-use-iosevka-term",
  "font-use-anonymous-pro",
  "font-use-atkinson-hyperlegible-mono",
  "font-use-berkeley-mono",
  "font-use-fira-code",
  "font-use-monaspace-argon",
  "font-use-monaspace-krypton",
  "font-use-monaspace-neon",
  "font-use-monaspace-radon",
  "font-use-monaspace-xenon",
  "font-use-serious-shanns",
  "font-use-sfmono-square",
  "font-use-share-tech-mono",
  "font-use-space-mono",
  "font-use-tt2020",
  "font-use-xanh-mono",
];

const SCREENS: { name: string; keys: string[] }[] = [
  { name: "loom", keys: [] },
  { name: "map", keys: ["Escape"] },
  { name: "settings", keys: ["`"] },
];

async function applyClass(page: Page, themeClass: string, fontClass: string) {
  await page.evaluate(
    ({ theme, font, allThemes, allFonts }) => {
      for (const el of [document.documentElement, document.body]) {
        for (const t of allThemes) el.classList.remove(t);
        for (const f of allFonts) el.classList.remove(f);
        el.classList.add(theme, font);
      }
    },
    { theme: themeClass, font: fontClass, allThemes: THEMES, allFonts: FONTS },
  );
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });

  await page.goto(LIVE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);

  // Sweep 1: every theme × loom/map/settings, font fixed to Iosevka
  for (const theme of THEMES) {
    await applyClass(page, theme, "font-use-iosevka-term");
    await page.waitForTimeout(300);
    for (const screen of SCREENS) {
      // Reset to home each time
      await page.goto(LIVE, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(600);
      await applyClass(page, theme, "font-use-iosevka-term");
      await page.waitForTimeout(200);
      for (const k of screen.keys) {
        await page.keyboard.press(k, { delay: 30 });
        await page.waitForTimeout(250);
      }
      const dir = path.join(OUT, "themes", theme);
      await mkdir(dir, { recursive: true });
      await page.screenshot({
        path: path.join(dir, `${screen.name}.png`),
        fullPage: false,
      });
      console.log(`✓ theme ${theme} ${screen.name}`);
    }
  }

  // Sweep 2: every font on the settings screen, theme fixed to phosphor (dark)
  for (const font of FONTS) {
    await page.goto(LIVE, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(600);
    await applyClass(page, "theme-black-green", font);
    await page.waitForTimeout(200);
    await page.keyboard.press("`", { delay: 30 });
    await page.waitForTimeout(400);
    const dir = path.join(OUT, "fonts");
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: path.join(dir, `${font}.png`),
      fullPage: false,
    });
    console.log(`✓ font ${font}`);
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
