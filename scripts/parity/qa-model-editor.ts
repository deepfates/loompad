import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/editor");

async function press(page: Page, keys: string[]) {
  for (const k of keys) {
    await page.keyboard.press(k, { delay: 30 });
    await page.waitForTimeout(180);
  }
}
async function readTitle(page: Page) {
  return (await page.$eval(".mode-bar, [class*=mode-bar]", (n) => n.textContent?.trim() ?? "")).slice(0, 60);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // open settings
  await press(page, ["`"]);
  console.log("1 open-settings:", await readTitle(page));
  // up to tabs → right → right? No: settings -> right = models
  await press(page, ["ArrowUp", "ArrowRight", "ArrowDown"]);
  console.log("2 on-models-body:", await readTitle(page));
  await page.screenshot({ path: path.join(OUT, "2-models-body.png") });
  // down to first real model (past sort + new)
  await press(page, ["ArrowDown", "ArrowDown"]);
  console.log("3 on-first-model:", await readTitle(page));
  // open editor
  await press(page, ["Enter"]);
  console.log("4 model-editor:", await readTitle(page));
  await page.screenshot({ path: path.join(OUT, "4-editor-open.png") });
  // cancel out
  await press(page, ["Backspace"]);
  console.log("5 back-to-list:", await readTitle(page));
  await page.screenshot({ path: path.join(OUT, "5-back-to-list.png") });
  // close drawer
  await press(page, ["Escape"]);
  console.log("6 closed:", await readTitle(page));

  await browser.close();
}
await main();
