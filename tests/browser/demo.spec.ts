import { expect, test, type Page } from "@playwright/test";
import type { SondaCapture } from "../../packages/client/src/sonda-capture";

async function acceptScreenshot(page: Page): Promise<void> {
  await page.locator("#capture-screenshot").click();
  const widget = page.locator("sonda-capture");
  await expect(widget.locator("sonda-screenshot-editor")).toBeVisible();
  await widget.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(widget.getByRole("dialog")).toHaveCount(0);
}

test("privacy fixtures work and the page fits desktop and mobile screens", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: /Privacy test/ }).click();
  await expect(page).toHaveURL(/#capture-lab$/);
  await page.getByLabel("Customer name").fill("Demo customer");
  await expect(page.getByLabel("Customer name")).toHaveValue("Demo customer");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  const scroller = page.locator(".scroller");
  await scroller.evaluate((element) => {
    element.scrollTop = 100;
  });
  await expect(scroller).toHaveJSProperty("scrollTop", 100);
  for (const width of [1440, 1024, 768, 580, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    if (testInfo.project.name === "chromium" && (width === 1440 || width === 390)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`demo-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("earlier accepted captures remain downloadable after capture and widget remount", async ({
  page,
}) => {
  await page.goto("/");
  await acceptScreenshot(page);
  const firstUrl = await page.locator(".result-actions a").getAttribute("href");
  await acceptScreenshot(page);
  await expect(page.locator(".result-card")).toHaveCount(2);
  await expect(page.locator("#capture-count")).toHaveText("2 CAPTURES THIS SESSION");
  await expect(page.locator(".result-actions a").first()).toHaveAttribute("href", firstUrl!);
  expect(await page.evaluate(async (url) => (await fetch(url)).ok, firstUrl!)).toBe(true);
  await page.evaluate(() => window.sondaDemo.remount());
  await expect(page.locator(".result-card")).toHaveCount(2);
  expect(await page.evaluate(async (url) => (await fetch(url)).ok, firstUrl!)).toBe(true);
  // A persisted pagehide represents entry into the browser's back/forward cache.
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
  );
  await expect(page.locator("sonda-capture")).toHaveCount(1);
  await expect(page.locator(".backend-submission")).toHaveCount(1);
});

test("accepting stays local and an invalid backend response can be retried", async ({ page }) => {
  let uploads = 0;
  await page.route("**/api/v1/submit", async (route) => {
    uploads++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: uploads === 1 ? "null" : JSON.stringify({ id: "demo-report" }),
    });
  });
  await page.goto("/");
  await acceptScreenshot(page);
  expect(uploads).toBe(0);
  const panel = page.locator(".backend-submission");
  await panel.getByRole("button", { name: "Submit to backend" }).click();
  await expect(panel.getByRole("status")).toContainText("invalid response");
  await expect(panel.getByRole("button")).toBeEnabled();
  await panel.getByRole("button").click();
  await expect(panel.getByRole("link", { name: "View submission" })).toHaveAttribute(
    "href",
    /\/submissions\/demo-report$/,
  );
  expect(uploads).toBe(2);
});

test("the widget applies live bot colors and preserves them on remount", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const widget = page.locator("sonda-capture");
  const avatar = widget.locator("buddy-avatar");
  const body = avatar.locator('[part="body"]');
  const eyes = avatar.locator("#eyes path").first();
  await expect(body).toHaveCSS("fill", "rgb(162, 127, 246)");
  await expect(eyes).toHaveCSS("fill", "rgb(255, 255, 255)");
  await widget.evaluate((element: SondaCapture) => {
    element.botColor = "#127acc";
    element.botEyeColor = "#fff099";
    return element.updateComplete;
  });
  await expect(body).toHaveCSS("fill", "rgb(18, 122, 204)");
  await expect(eyes).toHaveCSS("fill", "rgb(255, 240, 153)");
  await page.evaluate(() => window.sondaDemo.remount());
  await expect(body).toHaveCSS("fill", "rgb(18, 122, 204)");
  await expect(eyes).toHaveCSS("fill", "rgb(255, 240, 153)");
});
