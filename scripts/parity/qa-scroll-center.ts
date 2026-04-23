import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const URL = "http://localhost:5173";
const OUT = path.resolve(process.cwd(), "scripts/parity/shots/scroll");

// A story deep enough that current-depth navigation has real scroll
// distance to travel.  Short paragraphs so the centering case triggers.
function makeNode(id: string, text: string, kids: any[] = []): any {
  return { id, text, continuations: kids, lastSelectedIndex: 0 };
}
const long = (n: number, s: string) =>
  `[Paragraph ${n}] ${s.repeat(4)}`;
const SEED = {
  root: makeNode("n0", long(0, "the opening, before the story knows what it is about, drifts across the table like smoke that cannot decide which candle to follow. "), [
    makeNode("n1", long(1, "the second movement gathers weight, and the characters begin to walk without being told; a room becomes a location, a sigh becomes a line. "), [
      makeNode("n2", long(2, "a middle that refuses to hurry — dust settling, the pier counting its beams, the keeper noticing her own reflection for the first time in months. "), [
        makeNode("n3", long(3, "the turn, when the ship finally appears out of the dark harbor and somebody onboard speaks our keeper's name. "), [
          makeNode("n4", long(4, "a resolution so quiet it could almost be silence; a lamp goes out, and another is lit, and the page is ready to be turned. "), [
            makeNode("n5", long(5, "the last lines, longer than they need to be because nobody wants to stop reading yet, and the paragraphs keep running on. "), []),
          ]),
        ]),
      ]),
    ]),
  ]),
};

async function seed(page: Page) {
  await page.addInitScript(
    ([tree]) => {
      localStorage.setItem(
        "loompad-theme-preferences",
        JSON.stringify({
          mode: "light",
          paletteLight: "theme-light",
          paletteDark: "theme-black-green",
        }),
      );
      localStorage.setItem("story-trees", tree);
      localStorage.setItem("font-preference", "iosevka");
    },
    [JSON.stringify({ "Scroll Test": SEED })] as [string],
  );
}

async function inspect(page: Page, label: string): Promise<void> {
  const data = await page.evaluate(() => {
    const container = document.querySelector(".story-text") as HTMLElement;
    if (!container) return { error: "no container" };
    const cursor = container.querySelector(".cursor-node") as HTMLElement;
    if (!cursor) return { error: "no cursor-node" };
    // The CENTER target is path[currentDepth] — the span immediately
    // before the .cursor-node in DOM order (cursor is at D+1).
    const spans = Array.from(
      container.querySelectorAll(".story-node"),
    ) as HTMLElement[];
    const cursorIdx = spans.indexOf(cursor);
    const parent = cursorIdx > 0 ? spans[cursorIdx - 1] : null;
    if (!parent) return { error: "no parent span before cursor" };
    const cRect = container.getBoundingClientRect();
    const pRect = parent.getBoundingClientRect();
    const parentCenter = pRect.top - cRect.top + pRect.height / 2;
    const viewportCenter = cRect.height / 2;
    return {
      containerH: container.clientHeight,
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
      parentId: parent.getAttribute("data-node-id"),
      parentTopInViewport: pRect.top - cRect.top,
      parentHeight: pRect.height,
      parentCenter,
      viewportCenter,
      offCenterBy: parentCenter - viewportCenter,
    };
  });
  console.log(label, JSON.stringify(data));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await seed(page);
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowDown", { delay: 30 });
    await page.waitForTimeout(500);
    await inspect(page, `after ArrowDown ${i + 1}`);
    await page.screenshot({ path: path.join(OUT, `after-down-${i + 1}.png`) });
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("ArrowUp", { delay: 30 });
    await page.waitForTimeout(500);
    await inspect(page, `after ArrowUp ${i + 1}`);
  }

  await browser.close();
}
await main();
