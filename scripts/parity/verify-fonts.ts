import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/fonts");

const FONT_CLASSES = [
  "font-use-iosevka-term",
  "font-use-share-tech-mono",
  "font-use-tt2020",
  "font-use-fira-code",
  "font-use-monaspace-radon",
];

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
  for (const fontClass of FONT_CLASSES) {
    await page.evaluate((cls) => {
      const all = [
        "font-use-anonymous-pro","font-use-atkinson-hyperlegible-mono",
        "font-use-berkeley-mono","font-use-fira-code","font-use-iosevka-term",
        "font-use-monaspace-argon","font-use-monaspace-krypton",
        "font-use-monaspace-neon","font-use-monaspace-radon",
        "font-use-monaspace-xenon","font-use-serious-shanns",
        "font-use-share-tech-mono",
        "font-use-space-mono","font-use-tt2020","font-use-xanh-mono",
      ];
      for (const c of all) {
        document.documentElement.classList.remove(c);
        document.body.classList.remove(c);
      }
      document.documentElement.classList.add(cls);
      document.body.classList.add(cls);
    }, fontClass);
    await page.waitForTimeout(500); // allow font to load
    await page.screenshot({ path: path.join(OUT, `${fontClass}.png`), fullPage: true });
    console.log(`✓ ${fontClass}`);
  }
  await ctx.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
