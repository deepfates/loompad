/**
 * Drive textile through a realistic session and snapshot each step.
 * The goal isn't parity — it's to actually feel each interaction and
 * catch the things screenshots don't.
 */
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/try-it");

const steps: { name: string; run: (p: Page) => Promise<string | void> }[] = [
  {
    name: "00-loom-cold",
    run: async () => "Just opened the app.  Does the LOOM chrome look right?",
  },
  {
    name: "01-open-config",
    run: async (p) => {
      await p.keyboard.press("`");
      return "Pressed SELECT.  Drawer open on Settings tab?";
    },
  },
  {
    name: "02-cycle-tabs-right",
    run: async (p) => {
      // Cursor starts on the first row, not tabs; go up to tab strip
      await p.keyboard.press("ArrowUp");
      return "ArrowUp from row 0: cursor should be on the Settings tab.";
    },
  },
  {
    name: "03-tab-right",
    run: async (p) => {
      await p.keyboard.press("ArrowRight");
      return "Right arrow on tab strip: now Models tab?";
    },
  },
  {
    name: "04-tab-right-again",
    run: async (p) => {
      await p.keyboard.press("ArrowRight");
      return "Right again: Stories tab?";
    },
  },
  {
    name: "05-down-to-rows",
    run: async (p) => {
      await p.keyboard.press("ArrowDown");
      return "ArrowDown should drop the cursor into the Stories rows.";
    },
  },
  {
    name: "06-tab-back-left",
    run: async (p) => {
      await p.keyboard.press("ArrowUp");
      await p.keyboard.press("ArrowLeft");
      return "Up to tabs, Left: Models again.";
    },
  },
  {
    name: "07-down-into-models",
    run: async (p) => {
      await p.keyboard.press("ArrowDown");
      return "Into Models rows; Sort row should be selected.";
    },
  },
  {
    name: "08-down-to-newmodel",
    run: async (p) => {
      await p.keyboard.press("ArrowDown");
      return "+ New Model row selected.";
    },
  },
  {
    name: "09-enter-editor",
    run: async (p) => {
      await p.keyboard.press("Enter");
      return "Open editor for a new model.  Tabs should still be visible above.";
    },
  },
  {
    name: "10-back-to-list",
    run: async (p) => {
      await p.keyboard.press("Backspace");
      return "Backspace: back to Models list.";
    },
  },
  {
    name: "11-tab-left-settings",
    run: async (p) => {
      await p.keyboard.press("ArrowUp");
      await p.keyboard.press("ArrowLeft");
      await p.keyboard.press("ArrowDown");
      return "Back on Settings tab, first row (Temperature).";
    },
  },
  {
    name: "12-right-to-raise-temp",
    run: async (p) => {
      for (let i = 0; i < 5; i++) {
        await p.keyboard.press("ArrowRight");
        await p.waitForTimeout(80);
      }
      return "Right 5x on Temperature row should raise the value.";
    },
  },
  {
    name: "13-close-drawer",
    run: async (p) => {
      await p.keyboard.press("Escape");
      return "START: back to Loom.  Temperature should have persisted.";
    },
  },
  {
    name: "14-open-map",
    run: async (p) => {
      await p.keyboard.press("Escape");
      return "START from Loom: opens Map.  No duplicate nav dots at bottom.";
    },
  },
  {
    name: "15-back-to-loom",
    run: async (p) => {
      await p.keyboard.press("Escape");
      return "START again: back to Loom.";
    },
  },
];

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });

  page.on("pageerror", (err) => console.error("[page-error]", err.message));
  page.on("console", (msg) => {
    const t = msg.type();
    if (t === "error" || t === "warning") {
      console.log(`[console ${t}]`, msg.text());
    }
  });

  await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  for (const step of steps) {
    const note = await step.run(page);
    await page.waitForTimeout(400);
    const file = path.join(OUT, `${step.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`${step.name}  — ${note ?? ""}`);
  }

  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
