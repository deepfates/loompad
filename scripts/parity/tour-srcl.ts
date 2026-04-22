/**
 * Scroll through srcl/sacred.computer capturing viewport-sized tiles so I
 * can actually read what the component demo shows, plus one zoom level
 * on monaspace.githubnext.com to compare the five variants.
 */

import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "scripts/parity/shots/srcl-tour");

async function captureTiles(page: Page, url: string, prefix: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  const total = (await page.evaluate(() => document.body.scrollHeight)) as number;
  const viewport = 900;
  const tiles = Math.ceil(total / viewport);
  console.log(`${prefix}: ${total}px, ${tiles} tiles`);
  for (let i = 0; i < Math.min(tiles, 40); i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * viewport);
    await page.waitForTimeout(300);
    const file = path.join(OUT, `${prefix}-${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: file, fullPage: false });
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });

  await captureTiles(page, "https://sacred.computer", "sacred");
  await captureTiles(page, "https://monaspace.githubnext.com", "monaspace");

  await ctx.close();
  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
