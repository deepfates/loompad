import { expect, test, type Page } from "@playwright/test";

async function waitForStory(page: Page) {
  await expect(page.locator(".gamepad-main")).toHaveAttribute(
    "data-story-ready",
    "true",
  );
}

test("offline advice never disables local choices or a later generation retry", async ({
  page,
  context,
}) => {
  await page.route("**/api/generate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"content":" The connection returned."}\n\ndata: [DONE]\n\n',
    });
  });

  await page.goto("/");
  await waitForStory(page);
  await context.setOffline(true);

  // Rise from the root to the floor and create a local loom using the physical
  // controls. This used to be impossible because offline status disabled A
  // globally, even though creating a story needs no network.
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".mode-bar-title")).toHaveText("LOOMS");
  await page.getByRole("button", { name: "Select button" }).click();
  await expect(page.locator(".action-sheet-title")).toHaveText("FLOOR");
  await page.getByRole("button", { name: "A button" }).click();
  await expect(page.locator(".mode-bar-title")).toHaveText("LOOM");

  // A real failed request is visible, but it must not latch generation off.
  await page.getByRole("button", { name: "A button" }).click();
  await expect(page.locator(".navigation-bar")).toContainText("Network error");

  await context.setOffline(false);
  await page.getByRole("button", { name: "A button" }).click();
  await expect(page.locator(".navigation-bar")).not.toContainText(
    "Network error",
  );
  await expect(page.locator(".story-text")).toContainText(
    "The connection returned.",
  );
});
