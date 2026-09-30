import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const recording = {
  schemaVersion: 1,
  rrwebVersion: "2.1.6",
  events: [
    {
      type: 4,
      timestamp: 1000,
      data: { href: "https://example.com/checkout", width: 1024, height: 640 },
    },
    {
      type: 2,
      timestamp: 1001,
      data: {
        initialOffset: { top: 0, left: 0 },
        node: {
          type: 0,
          id: 1,
          childNodes: [
            { type: 1, id: 2, name: "html", publicId: "", systemId: "" },
            {
              type: 2,
              id: 3,
              tagName: "html",
              attributes: {},
              childNodes: [
                { type: 2, id: 4, tagName: "head", attributes: {}, childNodes: [] },
                {
                  type: 2,
                  id: 5,
                  tagName: "body",
                  attributes: {
                    style:
                      "margin:0;padding:48px;background:#f6f7f2;color:#29362d;font:24px system-ui",
                  },
                  childNodes: [
                    {
                      type: 2,
                      id: 6,
                      tagName: "h1",
                      attributes: {},
                      childNodes: [{ type: 3, id: 7, textContent: "Your checkout, captured." }],
                    },
                    {
                      type: 2,
                      id: 8,
                      tagName: "p",
                      attributes: {},
                      childNodes: [{ type: 3, id: 9, textContent: "Waiting for confirmation…" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      type: 3,
      timestamp: 3000,
      data: {
        source: 0,
        texts: [{ id: 9, value: "Order confirmed." }],
        attributes: [],
        removes: [],
        adds: [],
      },
    },
    { type: 3, timestamp: 5000, data: { source: 3, id: 1, x: 0, y: 0 } },
  ],
};

const createSubmission = async (
  request: import("@playwright/test").APIRequestContext,
  title: string,
  withScreenshot = true,
) => {
  const response = await request.post("/api/v1/submit", {
    multipart: {
      title,
      description: "The confirmation should appear after two seconds.",
      url: "https://example.com/checkout",
      ...(withScreenshot
        ? { screenshot: { name: "capture.png", mimeType: "image/png", buffer: png } }
        : {}),
      replay: {
        name: "replay.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(recording)),
      },
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
};

test("versioned API persists both artifacts and renders PNG plus working replay controls", async ({
  page,
  request,
}) => {
  const submission = await createSubmission(request, "Checkout capture test");
  expect((await page.goto(submission.url))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Checkout capture test" })).toBeVisible();
  const image = page.getByRole("img", { name: "Screenshot attached to Checkout capture test" });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBe(1);
  await page.getByRole("tab", { name: /session replay/i }).click();
  expect((await page.reload())?.status()).toBe(200);
  const play = page.getByRole("button", { name: "Play replay", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(page.getByRole("button", { name: "Pause replay", exact: true })).toBeVisible();
  await expect(page.frameLocator("iframe").getByText("Order confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Restart replay", exact: true }).click();
  await expect(page.frameLocator("iframe").getByText("Waiting for confirmation…")).toBeVisible();
  await page.getByRole("combobox", { name: "Playback speed" }).selectOption("2");
  await expect(page.getByRole("combobox", { name: "Playback speed" })).toHaveValue("2");
  await page.getByRole("slider", { name: "Seek replay" }).fill("3000");
  await expect(page.frameLocator("iframe").getByText("Order confirmed.")).toBeVisible();
  const json = await request.get(`/api/v1/submissions/${submission.id}/replay`);
  expect(await json.json()).toEqual(recording);
  expect(
    (await request.get(`/api/v1/submissions/${submission.id}/screenshot?download=1`)).headers()[
      "content-disposition"
    ],
  ).toContain("attachment");
});

test("upload form creates a submission and opens its detail view", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: /new submission/i })
    .first()
    .click();
  await page
    .locator('input[name="screenshot"]')
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  await page.locator('input[name="title"]').fill("Uploaded from the inbox");
  await page.getByRole("button", { name: "Create submission", exact: true }).click();
  await expect(page).toHaveURL(/\/submissions\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Uploaded from the inbox" })).toBeVisible();
});

test("replay-only mobile detail has no horizontal overflow", async ({ page, request }) => {
  const submission = await createSubmission(request, "Mobile session test", false);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.goto(submission.url))?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Play replay", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("sidebar search and selection navigate between persisted reports", async ({
  page,
  request,
}) => {
  // The disk-backed server intentionally retains reports across repeated test runs.
  const suffix = randomUUID();
  const first = await createSubmission(request, `Sidebar alpha ${suffix}`);
  const secondTitle = `Sidebar beta ${suffix}`;
  const second = await createSubmission(request, secondTitle, false);
  await page.goto(first.url);
  const sidebar = page.getByRole("navigation", { name: "Submissions" });
  await expect(sidebar.locator(`a[href="${first.url}"]`)).toHaveAttribute("aria-current", "page");
  await page.getByRole("searchbox", { name: "Search reports" }).fill(secondTitle);
  await expect(sidebar.locator("a")).toHaveCount(1);
  await sidebar.locator(`a[href="${second.url}"]`).click();
  await expect(page.getByRole("heading", { name: secondTitle })).toBeVisible();
  await expect(sidebar.locator(`a[href="${second.url}"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Play replay", exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle report inbox" }).click();
  await expect(sidebar).toBeVisible();
});

test("production rejects invalid uploads, untrusted origins, old endpoints and unknown IDs", async ({
  request,
}) => {
  expect((await request.get("/api/v1/health")).status()).toBe(200);
  const invalid = await request.post("/api/v1/submit", { data: { replay: { events: [] } } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).message).toBeTruthy();
  expect(
    (
      await request.post("/api/v1/submit", {
        headers: { origin: "https://evil.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const preflight = await request.fetch("/api/v1/submit", {
    method: "OPTIONS",
    headers: { origin: "http://127.0.0.1:5173" },
  });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");
  expect((await request.get("/api/submissions")).status()).toBe(404);
  expect((await request.get("/submissions/missing")).status()).toBe(404);
  expect((await request.get("/api/v1/submissions/missing/replay")).status()).toBe(404);
});

test("switching evidence resets a failed screenshot and loads it again", async ({
  page,
  request,
}) => {
  const submission = await createSubmission(request, "Screenshot loading state");
  let attempts = 0;
  await page.route(`**/api/v1/submissions/${submission.id}/screenshot`, async (route) => {
    attempts++;
    if (attempts === 1) await route.abort();
    else await route.continue();
  });
  await page.goto(submission.url);
  await expect(page.getByText("The screenshot could not be loaded.")).toBeVisible();
  await page.getByRole("tab", { name: /session replay/i }).click();
  await expect(page.getByRole("button", { name: "Play replay", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: /screenshot/i }).click();
  await expect
    .poll(() =>
      page
        .getByRole("img", { name: "Screenshot attached to Screenshot loading state" })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await expect(page.getByText("The screenshot could not be loaded.")).toHaveCount(0);
});

test("a recording ending at its first snapshot still has a visible paused frame", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/v1/submit", {
    data: {
      title: "Snapshot only",
      replay: { ...recording, events: recording.events.slice(0, 2) },
    },
  });
  expect(response.status()).toBe(201);
  const submission = await response.json();
  await page.goto(submission.url, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Play replay", exact: true })).toBeEnabled();
  await expect(page.frameLocator("iframe").getByText("Waiting for confirmation…")).toBeVisible();
  await page.getByRole("slider", { name: "Seek replay" }).fill("0");
  await expect(page.frameLocator("iframe").getByText("Waiting for confirmation…")).toBeVisible();
});

test("replay skips, keyboard controls and fullscreen preserve the recorded DOM", async ({
  page,
  request,
}, testInfo) => {
  const submission = await createSubmission(request, "Checkout replay", false);
  await page.goto(submission.url);
  const play = page.getByRole("button", { name: "Play replay", exact: true });
  const seek = page.getByRole("slider", { name: "Seek replay" });
  const frame = page.frameLocator("iframe");
  await expect(play).toBeEnabled();
  await page.getByRole("button", { name: "Forward 5 seconds" }).click();
  await expect(seek).toHaveValue("4000");
  await expect(frame.getByText("Order confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Back 5 seconds" }).click();
  await expect(seek).toHaveValue("0");
  await expect(frame.getByText("Waiting for confirmation…")).toBeVisible();
  await play.focus();
  await page.keyboard.press("ArrowRight");
  await expect(seek).toHaveValue("4000");
  await page.keyboard.press("Home");
  await expect(seek).toHaveValue("0");
  // The native slider's arrow keys must still seek a single step.
  await seek.focus();
  await page.keyboard.press("ArrowRight");
  await expect(seek).toHaveValue("1");
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
  await expect(frame.getByText("Waiting for confirmation…")).toBeVisible();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(page.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  const controls = await play.boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: testInfo.outputPath("replay-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("replay-mobile.png") });
});

test("failed replay loads can be retried with a raw rrweb event array", async ({
  page,
  request,
}) => {
  const submission = await createSubmission(request, "Retry recording", false);
  let attempts = 0;
  await page.route(`**/api/v1/submissions/${submission.id}/replay`, async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.fulfill({ json: recording.events });
  });
  await page.goto(submission.url);
  await expect(page.getByRole("alert")).toContainText("Replay unavailable");
  await expect(page.getByRole("button", { name: "Play replay", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Play replay", exact: true })).toBeEnabled();
  await expect(page.frameLocator("iframe").getByText("Waiting for confirmation…")).toBeVisible();
});

test("mock handoffs prepare a report brief without sending it externally", async ({
  page,
  request,
  context,
}) => {
  const report = await createSubmission(request, `Agent handoff ${randomUUID()}`);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(report.url);
  const composer = page.getByRole("region", { name: "What should happen next?" });
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) mutations.push(request.url());
  });
  await expect(composer.getByRole("button", { name: "Send to Cursor Agent" })).toBeDisabled();
  await composer.getByRole("button", { name: "Investigate and fix" }).click();
  await expect(composer.getByRole("textbox", { name: "Handoff instructions" })).toHaveValue(
    /Investigate/,
  );
  await composer.getByRole("button", { name: "Send to Cursor Agent" }).click();
  await expect(composer.getByRole("status")).toContainText("Nothing was sent");
  await composer.getByText("Review handoff", { exact: true }).click();
  await expect(composer.locator(".handoff-brief")).toContainText(
    "Screenshot + Session replay included",
  );
  await composer.getByRole("button", { name: "Copy brief" }).click();
  await expect(composer.getByRole("status")).toContainText("Handoff brief copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    `/submissions/${report.id}`,
  );
  await composer.getByRole("button", { name: "Slack", exact: true }).click();
  await composer.getByRole("textbox").fill("Please triage this customer report in #engineering.");
  await composer.getByRole("textbox").press("Control+Enter");
  await expect(composer.locator(".handoff-result")).toHaveCount(2);
  await expect(composer.getByRole("status")).toContainText("Mock handoff prepared for Slack");
  expect(mutations).toEqual([]);
});

test("agent composers fit mobile screens and reset for a different report", async ({
  page,
  request,
}, testInfo) => {
  const report = await createSubmission(request, `Handoff design ${randomUUID()}`);
  const second = await createSubmission(request, `Another handoff ${randomUUID()}`, false);
  await page.goto(report.url);
  const composer = page.getByRole("region", { name: "What should happen next?" });
  for (const destination of ["Slack", "Linear", "GitHub", "Cursor Agent"]) {
    await composer.getByRole("button", { name: destination, exact: true }).click();
    await expect(composer.getByRole("button", { name: destination, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await composer.getByRole("button", { name: "Investigate and fix" }).click();
  await composer.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("agent-handoff-desktop.png") });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await composer.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await page.screenshot({ path: testInfo.outputPath("agent-handoff-mobile.png") });
  await composer.getByRole("button", { name: "Send to Cursor Agent" }).click();
  await expect(composer.locator(".handoff-result")).toHaveCount(1);
  await page.goto(second.url);
  await expect(composer.getByRole("textbox")).toHaveValue("");
  await expect(composer.locator(".handoff-result")).toHaveCount(0);
  await expect(composer.locator(".context-count")).toHaveText("1");
});

test("deleting a capture supports cancellation and refreshes the inbox", async ({
  page,
  request,
}) => {
  const title = `Delete capture ${randomUUID()}`;
  const submission = await createSubmission(request, title);
  await page.goto(submission.url);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete capture", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  expect((await request.get(`/api/v1/submissions/${submission.id}`)).status()).toBe(200);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete capture", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link").filter({ hasText: title })).toHaveCount(0);
  expect((await request.get(`/api/v1/submissions/${submission.id}`)).status()).toBe(404);
  expect((await request.get(`/api/v1/submissions/${submission.id}/screenshot`)).status()).toBe(404);
  expect((await request.get(`/api/v1/submissions/${submission.id}/replay`)).status()).toBe(404);
});

test("failed capture deletion displays an error and allows retry", async ({ page, request }) => {
  const submission = await createSubmission(request, `Delete failure ${randomUUID()}`);
  await page.goto(submission.url);
  await page.route(`**/api/v1/submissions/${submission.id}`, (route) =>
    route.fulfill({ status: 500 }),
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete capture", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not delete this capture. Please try again.",
  );
  await expect(page.getByRole("button", { name: "Delete capture", exact: true })).toBeEnabled();
  expect((await request.get(`/api/v1/submissions/${submission.id}`)).status()).toBe(200);
});
