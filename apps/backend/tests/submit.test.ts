import { afterEach, expect, it, vi } from "vitest";
import { submitReport } from "../src/lib/submit";

afterEach(() => vi.unstubAllGlobals());

it("returns the saved report ID and passes the upload and cancellation signal to fetch", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ id: "saved-report", url: "https://untrusted.example" }, { status: 201 }),
    );
  vi.stubGlobal("fetch", fetch);
  const body = new FormData();
  body.set("title", "Checkout issue");
  const controller = new AbortController();
  expect(await submitReport(body, controller.signal)).toBe("saved-report");
  expect(fetch).toHaveBeenCalledWith("/api/v1/submit", {
    method: "POST",
    body,
    signal: controller.signal,
  });
});

it.each([null, [], {}, { id: "" }, { id: 12 }])(
  "rejects a malformed success response: %j",
  async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(submitReport(new FormData(), new AbortController().signal)).rejects.toThrow(
      "unexpected response",
    );
  },
);

it("shows the server's validation error and handles a non-JSON error response", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ message: "Screenshot is incomplete." }, { status: 400 }))
    .mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }));
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  await expect(submitReport(new FormData(), signal)).rejects.toThrow("Screenshot is incomplete.");
  await expect(submitReport(new FormData(), signal)).rejects.toThrow(
    "Submission could not be saved (502)",
  );
});
