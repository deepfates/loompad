/**
 * Render real mono fonts from their actual specimen pages so I can look
 * at them in pixels, not read a subagent's summary about them.
 */

import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "scripts/parity/shots/fonts-shopping");

async function tile(page: Page, url: string, prefix: string, tiles = 6) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 40000 });
  await page.waitForTimeout(1500);
  const total = (await page.evaluate(() => document.body.scrollHeight)) as number;
  const viewport = 900;
  const n = Math.min(Math.ceil(total / viewport), tiles);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * viewport);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, `${prefix}-${String(i).padStart(2, "0")}.png`),
      fullPage: false,
    });
  }
  console.log(`✓ ${prefix} (${n} tiles)`);
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });

  const targets: [string, string][] = [
    ["https://typeof.net/Iosevka/", "iosevka-specimen"],
    ["https://typeof.net/Iosevka/customizer", "iosevka-customizer"],
    ["https://departuremono.com/", "departure-mono"],
    ["https://commitmono.com/", "commit-mono"],
    ["https://www.recursive.design/", "recursive"],
    ["https://monaspace.githubnext.com/", "monaspace"],
    ["https://font.subf.dev/en/", "maple-mono"],
    ["https://github.com/protesilaos/aporetic", "aporetic"],
    ["https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono", "atkinson-mono"],
    ["https://fonts.google.com/specimen/JetBrains+Mono", "jetbrains-mono"],
    ["https://fonts.google.com/specimen/IBM+Plex+Mono", "ibm-plex-mono"],
    ["https://fonts.google.com/specimen/Victor+Mono", "victor-mono"],
    ["https://fonts.google.com/specimen/Workbench", "workbench"],
    ["https://fonts.google.com/specimen/JuliaMono", "julia-mono"],
    ["https://fonts.google.com/specimen/Xanh+Mono", "xanh-mono"],
    ["https://github.com/0xType/0xProto", "0xproto"],
  ];

  for (const [url, prefix] of targets) {
    try {
      await tile(page, url, prefix);
    } catch (e) {
      console.error(`✗ ${prefix}: ${(e as Error).message}`);
    }
  }

  await ctx.close();
  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
