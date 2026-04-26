/**
 * Render a real prose passage (matching the screenshot-2.png story text) in
 * every installed font, at the actual body text size textile uses, on a
 * neutral dark theme. This is what typography does in textile — nothing
 * else.
 */

import { chromium } from "playwright";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const LOCAL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/prose");

const PROSE = `Chapter 2: The Conspiracy

6. The not-Servaen character is a mysterious and unsettling figure. Their mismatched eyes and floating hair suggest they are not fully human or perhaps not fully real.

7. Grandmother Spider's message is cryptic and disorienting. It hints at a deeper truth about Thirel's identity and the nature of the Deep Fates program.

8. The chapter ends with a cliffhanger, as not-Servaen suggests they must now "begin" the conspiracy. This sets the stage for a mind-bending adventure across the multiverse.

Notes:
(See the end of the chapter for notes.)

The not-Servaen character led Thirel through the labyrinthine corridors of the Deep Fates facility, their mismatched eyes scanning the shadows for unseen threats.`;

async function main() {
  const fontFiles = (await readdir("client/assets/fonts")).filter((f) =>
    /\.(woff2?|otf|ttf)$/.test(f) && !f.startsWith("OFL-"),
  );
  // Map to font-family names as declared in terminal.css
  const FAMILY_BY_FILE: Record<string, string> = {
    "IosevkaTerm-Regular.woff2": "IosevkaTerm-Regular",
    "IosevkaTermSlab-Regular.woff2": "IosevkaTermSlab-Regular",
    "AnonymousPro-Regular.ttf": "AnonymousPro-Regular",
    "AtkinsonHyperlegibleMono-Regular.ttf": "AtkinsonHyperlegibleMono-Regular",
    "TX02Mono-Regular.woff2": "TX02Mono-Regular",
    "CommitMono-Regular.woff2": "CommitMono-Regular",
    "DepartureMono-Regular.woff2": "DepartureMono-Regular",
    "FiraCode-Regular.woff": "FiraCode-Regular",
    "GeistMono-Regular.woff2": "GeistMono-Regular",
    "IBMPlexMono-Regular.woff2": "IBMPlexMono-Regular",
    "JetBrainsMono-Regular.woff2": "JetBrainsMono-Regular",
    "MapleMono-Regular.woff2": "MapleMono-Regular",
    "MonaspaceArgon-Regular.woff2": "MonaspaceArgon-Regular",
    "MonaspaceKrypton-Regular.woff2": "MonaspaceKrypton-Regular",
    "MonaspaceNeon-Regular.woff2": "MonaspaceNeon-Regular",
    "MonaspaceRadon-Regular.woff2": "MonaspaceRadon-Regular",
    "MonaspaceXenon-Regular.woff2": "MonaspaceXenon-Regular",
    "SeriousShanns-Regular.otf": "SeriousShanns",
    "ShareTechMono-Regular.ttf": "ShareTechMono-Regular",
    "SpaceMono-Regular.ttf": "SpaceMono-Regular",
    "TT2020-Regular.woff2": "TT2020",
    "VictorMono-Regular.woff2": "VictorMono-Regular",
    "Workbench-Regular.woff2": "Workbench-Regular",
    "XanhMono-Regular.woff2": "0xProto-Regular", // see below
    "0xProto-Regular.woff2": "0xProto-Regular",
    "XanhMono-Regular.ttf": "XanhMono-Regular",
  };
  const families = Array.from(
    new Set(
      fontFiles.flatMap((f) =>
        FAMILY_BY_FILE[f] ? [FAMILY_BY_FILE[f]] : [],
      ),
    ),
  );

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 1400 },
  });
  const page = await ctx.newPage();
  await mkdir(OUT, { recursive: true });

  // Standalone HTML with every font loaded; swap which one is active.
  const css = fontFiles
    .map((f) => {
      const family = FAMILY_BY_FILE[f];
      if (!family) return "";
      const format = f.endsWith(".woff2")
        ? "woff2"
        : f.endsWith(".woff")
          ? "woff"
          : f.endsWith(".otf")
            ? "opentype"
            : "truetype";
      return `@font-face { font-family: "${family}"; src: url("http://localhost:5173/client/assets/fonts/${f}") format("${format}"); font-display: block; }`;
    })
    .join("\n");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${css}
html, body { margin: 0; padding: 0; background: #000000; color: #5cff3b; }
.page { padding: 1rem 1.25rem; font-size: 14px; line-height: 1.45; white-space: pre-wrap; }
.header { border-bottom: 1px solid rgba(92,255,59,0.3); padding-bottom: 0.5rem; margin-bottom: 0.75rem; display:flex; justify-content:space-between; font-size:12px; opacity: 0.75; }
</style>
</head>
<body>
<div class="page" id="page">
<div class="header"><span id="label">LOOM</span><span>START: MAP • SELECT: SETTINGS</span></div>
<div id="body">${PROSE.replace(/\n/g, "<br>")}</div>
</div>
</body>
</html>`;

  // Serve inline via setContent; but fonts need a real URL for the browser to
  // fetch. The dev server serves /client/assets/fonts/* at /client/assets/...
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  for (const family of families) {
    await page.evaluate((f) => {
      const page = document.getElementById("page")!;
      page.style.fontFamily = `"${f}", ui-monospace, monospace`;
      (document.getElementById("label") as HTMLElement).textContent = f;
    }, family);
    // Wait for font to load
    try {
      await page.evaluate(
        (f) => document.fonts.load(`14px "${f}"`),
        family,
      );
    } catch (error) {
      console.warn(`Font load check failed for ${family}:`, error);
    }
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(OUT, `${family}.png`),
      fullPage: true,
    });
    console.log(`✓ ${family}`);
  }
  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
