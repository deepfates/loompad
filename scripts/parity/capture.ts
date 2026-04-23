import { chromium, type Browser, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LIVE = "https://loompad.lol";
const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots");

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

// Each screen: a name + a series of keyboard actions to perform from a fresh page load.
// Keys: ArrowUp/Down/Left/Right, Enter (A), Backspace (B), ` (SELECT), Escape (START)
type Screen = { name: string; keys: string[] };
const SCREENS: Screen[] = [
  { name: "loom", keys: [] },
  { name: "map", keys: ["Escape"] },
  { name: "stories", keys: ["Escape", "`"] },
  { name: "settings", keys: ["`"] },
  { name: "edit", keys: ["Escape", "Backspace"] },
  {
    name: "models",
    keys: [
      "`",
      "ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown",
      "ArrowDown","ArrowDown","ArrowDown","ArrowDown",
      "Enter",
    ],
  },
  {
    name: "model-editor",
    keys: [
      "`",
      "ArrowDown","ArrowDown","ArrowDown","ArrowDown","ArrowDown",
      "ArrowDown","ArrowDown","ArrowDown","ArrowDown",
      "Enter",
      "ArrowDown",
      "Enter",
    ],
  },
];

async function pressSeq(page: Page, keys: string[]) {
  for (const k of keys) {
    await page.keyboard.press(k, { delay: 30 });
    await page.waitForTimeout(250);
  }
}

async function shoot(page: Page, url: string, keys: string[], outPath: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  await pressSeq(page, keys);
  await page.waitForTimeout(400);
  await page.screenshot({ path: outPath, fullPage: true });
}

async function captureAll(browser: Browser, baseUrl: string, label: string) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    for (const screen of SCREENS) {
      const dir = path.join(OUT, vp.name, screen.name);
      await mkdir(dir, { recursive: true });
      const file = path.join(dir, `${label}.png`);
      try {
        await shoot(page, baseUrl + "/", screen.keys, file);
        console.log(`✓ ${label} ${vp.name} ${screen.name}`);
      } catch (err) {
        console.error(
          `✗ ${label} ${vp.name} ${screen.name}: ${(err as Error).message}`,
        );
      }
    }
    await ctx.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  try {
    await captureAll(browser, LIVE, "live");
    await captureAll(browser, LOCAL, "local");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
