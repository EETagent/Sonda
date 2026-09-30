import { expect, test } from "@playwright/test";
import type { ScreenshotEditor } from "../../packages/client/src/screenshot-editor";
import type { SondaCapture } from "../../packages/client/src/sonda-capture";

for (const scrollY of [0, 300]) {
  test(`screenshots contain page content in the preview and PNG at scroll ${scrollY}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate((scrollY) => {
      const marker = document.createElement("div");
      marker.style.cssText =
        "position:fixed;left:40px;top:40px;width:80px;height:80px;background:rgb(220,30,60);z-index:1000";
      document.body.append(marker);
      window.scrollTo(0, scrollY);
    }, scrollY);
    const widget = page.locator("sonda-capture");
    await widget.evaluate((element: SondaCapture) => element.captureScreenshot());
    const editor = widget.locator("sonda-screenshot-editor");
    await expect(editor).toBeVisible();
    const pixel = await editor.evaluate((element: ScreenshotEditor) => {
      const canvas = element.shadowRoot!.querySelector<HTMLCanvasElement>("#base")!;
      const { width, height } = element.capture.metadata;
      return Array.from(
        canvas
          .getContext("2d")!
          .getImageData(
            Math.round((80 / width) * canvas.width),
            Math.round((80 / height) * canvas.height),
            1,
            1,
          ).data,
      );
    });
    expect(pixel).toEqual([220, 30, 60, 255]);
    await widget.getByRole("button", { name: "Accept", exact: true }).click();
    const image = page.locator(".result-card img");
    await expect(image).toBeVisible();
    const exportedPixel = await image.evaluate(async (element: HTMLImageElement) => {
      const bitmap = await createImageBitmap(await (await fetch(element.src)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return Array.from(ctx.getImageData(80, 80, 1, 1).data);
    });
    expect(exportedPixel).toEqual([220, 30, 60, 255]);
  });
}

test("annotation controls preserve text styling, history, movement, and accepted data", async ({
  page,
}) => {
  await page.goto("/");
  const widget = page.locator("sonda-capture");
  await widget.evaluate((element: SondaCapture) => {
    element.addEventListener(
      "sonda-accept",
      (event) => {
        if (event.detail.kind === "screenshot") {
          // Retain the public event payload so this checks the accepted document,
          // not just the editor's visible annotation count.
          const output = document.createElement("pre");
          output.id = "accepted-annotations";
          output.textContent = JSON.stringify(event.detail.annotations);
          document.body.append(output);
        }
      },
      { once: true },
    );
    return element.captureScreenshot();
  });
  const editor = widget.locator("sonda-screenshot-editor");
  await editor.getByRole("button", { name: "Add text", exact: true }).click();
  await editor.getByRole("button", { name: "Blue", exact: true }).click();
  await editor.getByLabel("Text size", { exact: true }).selectOption("36");
  await editor.locator("#ink").click({ position: { x: 50, y: 50 } });
  const input = editor.getByRole("textbox", { name: "Annotation text" });
  await input.fill("First line\nSecond line");
  await input.press("Control+Enter");
  await expect(editor.getByText("1 annotation", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(editor.getByText("0 annotations", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(editor.getByText("1 annotation", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Select and move", exact: true }).click();
  await editor.locator("#ink").click({ position: { x: 50, y: 50 } });
  const before = await editor.evaluate((element: ScreenshotEditor) => element.getDocument());
  await editor.locator("#ink").press("Shift+ArrowRight");
  await widget.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.locator("#accepted-annotations")).toBeAttached();
  const accepted = JSON.parse((await page.locator("#accepted-annotations").textContent())!);
  expect(accepted).toMatchObject({
    schemaVersion: 1,
    width: before.width,
    height: before.height,
    items: [
      {
        ...before.items[0],
        kind: "text",
        text: "First line\nSecond line",
        color: "#3867e8",
        fontSize: 36,
        x: (before.items[0] as { x: number }).x + 10,
      },
    ],
  });
});
