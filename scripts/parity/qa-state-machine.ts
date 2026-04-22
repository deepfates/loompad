import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/state");

type Step = { name: string; keys: string[] };

const STEPS: Step[] = [
  { name: "01-loom", keys: [] },
  { name: "02-map", keys: ["Escape"] },
  { name: "03-loom-again", keys: ["Escape"] },
  { name: "04-drawer-settings", keys: ["`"] },
  { name: "05-drawer-tabs-cursor", keys: ["ArrowUp"] },
  { name: "06-drawer-models-tab", keys: ["ArrowRight"] },
  { name: "07-drawer-models-body", keys: ["ArrowDown"] },
  { name: "08-drawer-stories-tab", keys: ["ArrowUp", "ArrowRight"] },
  { name: "09-drawer-stories-body", keys: ["ArrowDown"] },
  { name: "10-drawer-closed", keys: ["Escape"] },
  { name: "11-drawer-from-map", keys: ["Escape", "`"] },
  { name: "12-back-to-map", keys: ["Escape"] },
  { name: "13-edit-from-map", keys: ["Backspace"] },
  { name: "14-cancel-edit", keys: ["`"] },
  // Settings knobs / cyclers
  { name: "15-back-to-loom", keys: ["Escape"] },
  { name: "16-open-settings", keys: ["`"] },
  { name: "17-temp-up", keys: ["ArrowRight", "ArrowRight"] },
  { name: "18-length-cycle", keys: ["ArrowDown", "Enter"] },
  { name: "19-model-cycle", keys: ["ArrowDown", "ArrowRight"] },
  // Model editor expansion-in-place
  { name: "20-goto-models-tab", keys: ["ArrowUp", "ArrowRight", "ArrowDown"] },
  { name: "21-goto-first-model", keys: ["ArrowDown", "ArrowDown"] },
  { name: "22-open-model-editor", keys: ["Enter"] },
  { name: "23-cancel-editor", keys: ["Backspace"] },
  { name: "24-close-drawer", keys: ["Escape"] },
];

async function press(page: Page, keys: string[]) {
  for (const k of keys) {
    await page.keyboard.press(k, { delay: 30 });
    await page.waitForTimeout(200);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  for (const step of STEPS) {
    await press(page, step.keys);
    await page.waitForTimeout(300);
    const file = path.join(OUT, `${step.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const title = await page.$eval(
      ".mode-bar-title, [class*='mode-bar']",
      (n) => n.textContent?.trim() ?? ""
    ).catch(() => "");
    console.log(`${step.name}  title=${title}`);
  }

  await browser.close();
}

await main();
