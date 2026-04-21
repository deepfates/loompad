import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/generation");

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });
  page.on("console", (msg) => console.log("[page]", msg.type(), msg.text()));
  page.on("requestfailed", (req) =>
    console.log("[req-failed]", req.url(), req.failure()?.errorText),
  );
  page.on("response", (res) => {
    if (res.url().includes("/api/")) {
      console.log("[api]", res.status(), res.url());
    }
  });

  await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "before.png"), fullPage: true });

  // Press Enter (A button) to generate
  await page.keyboard.press("Enter");
  console.log("pressed Enter, waiting for generation...");
  await page.waitForTimeout(15000);
  await page.screenshot({ path: path.join(OUT, "after.png"), fullPage: true });

  await ctx.close();
  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
