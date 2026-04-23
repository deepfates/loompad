import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/selection");

const THEMES: Array<{ id: string; label: string; tone: "light" | "dark" }> = [
  { id: "theme-light", label: "Highlight", tone: "light" },
  { id: "theme-blue", label: "BSOD", tone: "light" },
  { id: "theme-aperture", label: "Aperture", tone: "light" },
  { id: "theme-black-green", label: "Phosphor", tone: "dark" },
  { id: "theme-nerv", label: "NERV", tone: "dark" },
  { id: "theme-outrun", label: "Outrun", tone: "dark" },
];

async function seed(page: Page, id: string, tone: "light" | "dark") {
  await page.addInitScript(
    ([prefs]) => {
      localStorage.setItem("loompad-theme-preferences", prefs);
      localStorage.setItem("font-preference", "iosevka");
    },
    [
      JSON.stringify({
        mode: tone,
        paletteLight: tone === "light" ? id : "theme-light",
        paletteDark: tone === "dark" ? id : "theme-black-green",
      }),
    ] as [string],
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const t of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await seed(page, t.id, t.tone);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    // open settings via backtick (SELECT)
    await page.keyboard.press("`", { delay: 30 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, `${t.label.toLowerCase()}-settings.png`), fullPage: false });
    await ctx.close();
    console.log(t.label);
  }
  await browser.close();
}

await main();
