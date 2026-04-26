import { chromium } from "playwright";

const LOCAL = "http://localhost:5173";

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(LOCAL + "/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);

  for (const font of ["font-use-iosevka", "font-use-iosevka-slab"]) {
    await page.evaluate((f) => {
      const html = document.documentElement;
      const body = document.body;
      for (const el of [html, body]) {
        [...el.classList].forEach((c) => {
          if (c.startsWith("font-use-")) el.classList.remove(c);
        });
      }
      html.classList.add(f);
    }, font);
    await page.waitForTimeout(300);

    const probe = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const heading = document.querySelector(".mode-bar") || document.body;
      const htmlVar = getComputedStyle(html).getPropertyValue("--font-family-mono").trim();
      const bodyFont = getComputedStyle(body).fontFamily;
      const headingFont = getComputedStyle(heading as Element).fontFamily;
      const htmlClasses = [...html.classList];
      const bodyClasses = [...body.classList];
      // Check loaded fonts
      const fonts = document.fonts as FontFaceSet;
      const loaded = Array.from(fonts).map((f) => ({
        family: f.family,
        status: f.status,
      }));
      return { htmlVar, bodyFont, headingFont, htmlClasses, bodyClasses, loaded };
    });
    console.log(font, JSON.stringify(probe, null, 2));
  }
  await ctx.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
