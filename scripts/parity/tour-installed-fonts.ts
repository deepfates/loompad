/**
 * Render every installed font in the actual loompad app at mobile width,
 * on a story reader screen. This is the evidence that matters.
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/installed-fonts");

// All font-use classes currently registered in terminal.css.
const FONTS = [
  "font-use-iosevka-term",
  "font-use-iosevka-term-slab",
  "font-use-anonymous-pro",
  "font-use-atkinson-hyperlegible-mono",
  "font-use-berkeley-mono",
  "font-use-commit-mono",
  "font-use-departure-mono",
  "font-use-fira-code",
  "font-use-ibm-plex-mono",
  "font-use-jetbrains-mono",
  "font-use-maple-mono",
  "font-use-monaspace-argon",
  "font-use-monaspace-krypton",
  "font-use-monaspace-neon",
  "font-use-monaspace-radon",
  "font-use-monaspace-xenon",
  "font-use-serious-shanns",
  "font-use-share-tech-mono",
  "font-use-space-mono",
  "font-use-tt2020",
  "font-use-victor-mono",
  "font-use-workbench",
  "font-use-xanh-mono",
  "font-use-0xproto",
];

async function main() {
  const browser = await chromium.launch();
  // Mobile-width context, phosphor theme (dark, good test bed)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });

  for (const fontClass of FONTS) {
    await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
    // Apply theme + font to html (single-writer convention)
    await page.evaluate(
      ({ font, allFonts }) => {
        const html = document.documentElement;
        const body = document.body;
        for (const c of [...html.classList, ...body.classList]) {
          if (c.startsWith("theme-")) {
            html.classList.remove(c);
            body.classList.remove(c);
          }
        }
        for (const f of allFonts) {
          html.classList.remove(f);
          body.classList.remove(f);
        }
        html.classList.add("theme-black-green", font);
      },
      { font: fontClass, allFonts: FONTS },
    );
    await page.waitForTimeout(600);
    // Open settings — that's where the most text/menu items are visible
    await page.keyboard.press("`");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT, `${fontClass}.png`),
      fullPage: false,
    });
    console.log(`✓ ${fontClass}`);
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
