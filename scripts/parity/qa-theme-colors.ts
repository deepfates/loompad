import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/theme-colors");

const THEMES: Array<{ id: string; label: string; tone: "light" | "dark" }> = [
  { id: "theme-light", label: "Highlight", tone: "light" },
  { id: "theme-blue", label: "BSOD", tone: "light" },
  { id: "theme-aperture", label: "Aperture", tone: "light" },
  { id: "theme-black-green", label: "Phosphor", tone: "dark" },
  { id: "theme-nerv", label: "NERV", tone: "dark" },
  { id: "theme-outrun", label: "Outrun", tone: "dark" },
];

// Seed a story with several depths so the path renders:
//   depth 0 : root
//   depth 1 : ancestor
//   depth 2 : immediate parent (currentDepth)
//   depth 3 : cursor node (currentDepth + 1)
//   depth 4+: descendants
const SEED_TREE = {
  root: {
    id: "n0",
    text: "Once upon a time, in a cottage by the river, ",
    continuations: [
      {
        id: "n1",
        text: "there lived a quiet keeper of lamps. ",
        continuations: [
          {
            id: "n2",
            text: "Every evening she walked to the pier and ",
            continuations: [
              {
                id: "n3",
                text: "set each flame burning against the fog. ",
                continuations: [
                  {
                    id: "n4",
                    text: "A ship would then glide in from the dark harbor, ",
                    continuations: [
                      {
                        id: "n5",
                        text: "its hull painted with the names of vanished captains.",
                        continuations: [],
                      },
                    ],
                    lastSelectedIndex: 0,
                  },
                ],
                lastSelectedIndex: 0,
              },
            ],
            lastSelectedIndex: 0,
          },
        ],
        lastSelectedIndex: 0,
      },
    ],
    lastSelectedIndex: 0,
  },
};

async function seedAndTheme(page: Page, themeId: string, tone: "light" | "dark") {
  await page.addInitScript(
    ([prefs, treeJson]) => {
      localStorage.setItem("loompad-theme-preferences", prefs);
      localStorage.setItem("story-trees", treeJson);
      localStorage.setItem("font-preference", "iosevka");
    },
    [
      JSON.stringify({
        mode: tone,
        paletteLight: tone === "light" ? themeId : "theme-light",
        paletteDark: tone === "dark" ? themeId : "theme-black-green",
      }),
      JSON.stringify({ "Test Story": SEED_TREE }),
    ] as [string, string],
  );
}

async function shoot(page: Page, filename: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, filename), fullPage: false });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const t of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await seedAndTheme(page, t.id, t.tone);
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    // Navigate down a few levels so we have visible ancestors + cursor + descendants
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press("ArrowDown", { delay: 20 });
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
    // Loom shot
    await shoot(page, `${t.label.toLowerCase()}-1-loom.png`);
    // Map shot (toggle on)
    await page.keyboard.press("Escape", { delay: 20 });
    await page.waitForTimeout(350);
    await shoot(page, `${t.label.toLowerCase()}-2-map.png`);
    // Back to loom
    await page.keyboard.press("Escape", { delay: 20 });
    await ctx.close();
    console.log(`captured ${t.label}`);
  }
  await browser.close();
}

await main();
