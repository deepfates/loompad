import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/verify-switch");

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });
  await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);

  // Open settings
  await page.keyboard.press("`");
  await page.waitForTimeout(300);

  // selectedParam order in SettingsMenu: 0 Temperature, 1 Length, 2 Model, 3 Theme Mode, 4 Light Theme, 5 Dark Theme, 6 Font, 7 Text Splitting, 8 Auto Mode, 9 Manage Models

  // Navigate to Theme Mode (3)
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(80);
  }
  // Cycle Theme Mode twice: System → Light → Dark
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);

  // Move to Dark Theme (5) — two more downs
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(80);

  // Cycle Dark Theme a few times and capture MAP to prove bg follows
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Enter"); // advance dark palette
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, `settings-${i}.png`),
      fullPage: true,
    });
    // Close settings, open map
    await page.keyboard.press("Escape"); // START closes settings
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape"); // open map
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, `map-${i}.png`),
      fullPage: true,
    });
    // Close map and reopen settings
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await page.keyboard.press("`");
    await page.waitForTimeout(200);
    for (let j = 0; j < 5; j++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(80);
    }
  }
  await ctx.close();
  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
