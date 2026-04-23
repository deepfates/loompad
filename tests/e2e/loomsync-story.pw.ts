import { expect, test, type Page } from "@playwright/test";

const generatedText = " The bronze door opened.";

async function mockGeneration(page: Page) {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
      body: `data: ${JSON.stringify({ content: generatedText })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.route("**/api/judge", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choice: 0 }),
    });
  });
}

async function openStoriesMenu(page: Page) {
  await page.getByRole("button", { name: "START" }).click();
  await expect(page.getByText("MAP", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "SELECT" }).click();
  await expect(page.getByText("STORIES", { exact: true })).toBeVisible();
}

async function currentStoryRootId(page: Page): Promise<string> {
  await openStoriesMenu(page);
  const label = page
    .locator(".menu-item-label")
    .filter({ hasText: /^automerge:/ })
    .first();
  await expect(label).toBeVisible();
  return (await label.textContent()) ?? "";
}

test("creates, persists, and shares a LoomSync story world", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await mockGeneration(page);

  await page.goto("/");
  await expect(page.getByLabel("Story Interface")).toBeVisible();
  await expect(page.locator(".story-text")).toContainText(
    "Once upon a time, in Absalom,",
  );

  await page.getByRole("button", { name: "↵" }).click();
  await expect(page.locator(".story-text")).toContainText(generatedText.trim());

  const rootId = await currentStoryRootId(page);
  expect(rootId).toMatch(/^automerge:/);

  await page.reload();
  await expect(page.locator(".story-text")).toContainText(generatedText.trim());

  const sharedPage = await context.newPage();
  await mockGeneration(sharedPage);
  await sharedPage.goto(`/?story=${encodeURIComponent(rootId)}`);
  await expect(sharedPage.locator(".story-text")).toContainText(
    generatedText.trim(),
  );

  await context.close();
});
