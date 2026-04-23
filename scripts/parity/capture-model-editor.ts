/** Force Model Editor open by clicking through UI. */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/desktop/model-editor");

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  // Open settings
  await page.keyboard.press("`");
  await page.waitForTimeout(300);
  // Navigate to Manage Models (index 9)
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(60);
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  // Now in Models. Move to New Model (index 1)
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, "local.png"), fullPage: false });
  console.log("✓ model-editor");
  await ctx.close();
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
