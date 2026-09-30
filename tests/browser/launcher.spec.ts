import { expect, test, type Locator } from "@playwright/test";
import type { BuddyAvatar } from "../../packages/buddy/buddy-avatar";
import type { SondaCapture } from "../../packages/client/src/sonda-capture";

async function samplePoses(avatar: Locator): Promise<string[]> {
  return avatar.evaluate(async (element: BuddyAvatar) => {
    await element.updateComplete;
    const poses: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      poses.push(element.shadowRoot!.querySelector("#face")!.getAttribute("transform")!);
    }
    return poses;
  });
}

test("the avatar follows capture activity and the panel supports keyboard dismissal", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  const launcher = widget.locator(".launcher");
  const avatar = launcher.locator("buddy-avatar");
  const panel = widget.getByRole("region", { name: "Capture options" });
  const ripple = () =>
    launcher.evaluate((element) => getComputedStyle(element, "::before").animationName);

  await expect(avatar).toHaveJSProperty("isRunning", false);
  await expect(avatar).toHaveAttribute("shape", "blob");
  await expect(avatar).toHaveJSProperty("isFollowingPointer", true);
  await expect(avatar.locator("svg")).toHaveAttribute("data-buddy-state", "idle");
  await expect(launcher).toHaveCSS("border-radius", "50%");
  expect(await ripple()).toBe("none");

  await launcher.focus();
  await launcher.press("Enter");
  await expect(panel).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "true");
  await expect(avatar).toHaveJSProperty("isRunning", true);
  await expect(avatar.locator("svg")).toHaveAttribute("data-buddy-state", "working");
  expect(new Set(await samplePoses(avatar)).size).toBeGreaterThan(1);
  expect(await ripple()).toBe("launcher-ripple");

  if (testInfo.project.name === "chromium") {
    await page.screenshot({
      path: testInfo.outputPath("active-buddy-launcher.png"),
      clip: { x: 910, y: 340, width: 370, height: 560 },
    });
  }

  await launcher.click();
  await expect(panel).toHaveCount(0);
  await expect(avatar).toHaveJSProperty("isRunning", false);
  expect(await ripple()).toBe("none");

  await launcher.click();
  await panel.getByRole("button", { name: /Capture screenshot/ }).press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await expect(avatar).toHaveJSProperty("isRunning", false);

  await launcher.click();
  await page.locator("h1").click();
  await expect(panel).toHaveCount(0);
  await expect(avatar).toHaveJSProperty("isRunning", false);
});

test("the same avatar keeps animating during recording and resets after review", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  const launcher = widget.locator(".launcher");
  const avatar = launcher.locator("buddy-avatar");
  const originalAvatar = await avatar.elementHandle();

  await launcher.click();
  await widget.getByRole("button", { name: /Record session/ }).click();
  await expect(widget.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
  await expect(launcher).toBeVisible();
  await expect(launcher).toBeDisabled();
  expect(await originalAvatar!.evaluate((element) => element.isConnected)).toBe(true);
  expect(new Set(await samplePoses(avatar)).size).toBeGreaterThan(1);

  await page.locator("h1").click();
  await expect(avatar).toHaveJSProperty("isRunning", true);
  await widget.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(widget.getByRole("dialog")).toBeVisible();
  await widget.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(widget.getByRole("dialog")).toHaveCount(0);
  await expect(launcher).toBeEnabled();
  await expect(avatar).toHaveJSProperty("isRunning", false);
  expect(await originalAvatar!.evaluate((element) => element.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});

test("screenshot capture still opens the editor and returns to an idle avatar", async ({
  page,
}) => {
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  const launcher = widget.locator(".launcher");
  const avatar = launcher.locator("buddy-avatar");
  await launcher.click();
  await widget.getByRole("button", { name: /Capture screenshot/ }).click();
  await expect(widget.getByRole("dialog")).toBeVisible();
  await expect(widget.locator("sonda-screenshot-editor")).toBeVisible();
  await expect(avatar).toHaveJSProperty("isRunning", true);
  await widget.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(launcher).toBeEnabled();
  await expect(avatar).toHaveJSProperty("isRunning", false);
});

test("reduced motion disables both avatar motion and the background ripple", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const launcher = page.locator("sonda-capture .launcher");
  const avatar = launcher.locator("buddy-avatar");
  await launcher.click();
  await expect(avatar.locator("svg")).toHaveAttribute("data-reduced-motion", "true");
  expect(new Set(await samplePoses(avatar)).size).toBe(1);
  expect(
    await launcher.evaluate((element) => getComputedStyle(element, "::before").animationName),
  ).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(avatar.locator("svg")).toHaveAttribute("data-reduced-motion", "false");
  expect(new Set(await samplePoses(avatar)).size).toBeGreaterThan(1);
});

test("recording controls fit beside the avatar at every desktop and mobile corner", async ({
  page,
}) => {
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  await widget.evaluate((element: SondaCapture) => element.startRecording());
  await expect(widget.getByRole("button", { name: "Stop", exact: true })).toBeVisible();

  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const position of ["bottom-right", "bottom-left", "top-right", "top-left"] as const) {
      await widget.evaluate((element: SondaCapture, position) => {
        element.position = position;
      }, position);
      await expect(widget).toHaveAttribute("position", position);
      const status = await widget.locator(".status-pill").boundingBox();
      const launcher = await widget.locator(".launcher").boundingBox();
      expect(status).not.toBeNull();
      expect(launcher).not.toBeNull();
      expect(status!.x).toBeGreaterThanOrEqual(0);
      expect(status!.y).toBeGreaterThanOrEqual(0);
      expect(status!.x + status!.width).toBeLessThanOrEqual(width);
      expect(status!.y + status!.height).toBeLessThanOrEqual(800);
      expect(
        status!.x + status!.width <= launcher!.x ||
          launcher!.x + launcher!.width <= status!.x ||
          status!.y + status!.height <= launcher!.y ||
          launcher!.y + launcher!.height <= status!.y,
      ).toBe(true);
    }
  }
  await widget.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(widget.locator("buddy-avatar")).toHaveJSProperty("isRunning", false);
});

test("a paused replay shows the initial page and keeps it visible when seeking to zero", async ({
  page,
}) => {
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  await widget.evaluate((element: SondaCapture) => element.startRecording());
  await widget.getByRole("button", { name: "Stop", exact: true }).click();
  const play = widget.getByRole("button", { name: "Play replay", exact: true });
  await expect(play).toBeEnabled();
  const recordedPage = page.frameLocator("sonda-capture iframe");
  await expect(recordedPage.locator("h1").first()).toBeVisible();
  await widget.getByRole("slider", { name: "Replay position" }).fill("0");
  await expect(recordedPage.locator("h1").first()).toBeVisible();
  await widget.getByRole("button", { name: "Discard", exact: true }).click();
});

test("Escape cancels text editing and discard restores the host app's focus", async ({ page }) => {
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "capture-trigger";
    button.textContent = "Host capture trigger";
    document.body.append(button);
    button.focus();
  });
  await widget.evaluate((element: SondaCapture) => element.captureScreenshot());
  const editor = widget.locator("sonda-screenshot-editor");
  await editor.getByRole("button", { name: "Add text", exact: true }).click();
  await editor.locator("#ink").click({ position: { x: 40, y: 40 } });
  const text = editor.getByRole("textbox", { name: "Annotation text" });
  await text.fill("Cancelled annotation");
  await text.press("Escape");
  await expect(text).toHaveCount(0);
  await expect(editor.getByText("0 annotations")).toBeVisible();
  await widget.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page.locator("#capture-trigger")).toBeFocused();
});

test("an editor reconnects with its screenshot and remains usable", async ({ page }) => {
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  await widget.evaluate((element: SondaCapture) => element.captureScreenshot());
  const editor = widget.locator("sonda-screenshot-editor");
  await editor.evaluate((element) => {
    const parent = element.parentElement!;
    element.remove();
    parent.append(element);
  });
  await expect
    .poll(() => editor.locator("#base").evaluate((element) => (element as HTMLCanvasElement).width))
    .toBeGreaterThan(0);
  await editor.getByRole("button", { name: "Add text", exact: true }).click();
  await editor.locator("#ink").click({ position: { x: 30, y: 30 } });
  const text = editor.getByRole("textbox", { name: "Annotation text" });
  await text.fill("Still editable after reconnecting");
  await text.press("Control+Enter");
  await expect(editor.getByText("1 annotation", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.getByText("0 annotations", { exact: true })).toBeVisible();
});

test("text editing stays inside the screenshot when adding a label at its right edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  await widget.evaluate((element: SondaCapture) => element.captureScreenshot());
  const editor = widget.locator("sonda-screenshot-editor");
  await editor.getByRole("button", { name: "Add text", exact: true }).click();
  const ink = editor.locator("#ink");
  const stage = (await ink.boundingBox())!;
  await ink.click({ position: { x: stage.width - 4, y: 20 } });
  const input = editor.getByRole("textbox", { name: "Annotation text" });
  await expect(input).toBeVisible();
  const bounds = (await input.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(stage.x);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  await input.fill("Label near the edge");
  await input.press("Control+Enter");
  await expect(editor.getByText("1 annotation", { exact: true })).toBeVisible();
});
