import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/mobile");

async function press(page: Page, keys: string[]) {
  for (const k of keys) {
    await page.keyboard.press(k, { delay: 30 });
    await page.waitForTimeout(200);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const shots: [string, string[]][] = [
    ["01-loom", []],
    ["02-map", ["Escape"]],
    ["03-settings", ["Escape", "`"]],
    ["04-tab-cursor", ["ArrowUp"]],
    ["05-models", ["ArrowRight", "ArrowDown"]],
    ["06-stories", ["ArrowUp", "ArrowRight", "ArrowDown"]],
    ["07-close", ["Escape"]],
    ["08-edit", ["Backspace"]],
  ];
  for (const [name, keys] of shots) {
    await press(page, keys);
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    console.log(name);
  }
  await browser.close();
}
await main();
