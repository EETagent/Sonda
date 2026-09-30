import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isHttpError } from "@sveltejs/kit";

vi.mock("$env/dynamic/private", () => ({ env: process.env }));

import { parseSubmission, validateReplay, validateScreenshot } from "../src/lib/server/uploads";
import {
  MAX_BODY_BYTES,
  MAX_SCREENSHOT_BYTES,
  replaySchema,
  submissionFieldsSchema,
} from "../src/lib/validation";
import { createSubmissionStore } from "../src/lib/server/storage";
import { POST } from "../src/routes/api/v1/submit/+server";
import { GET as list } from "../src/routes/api/v1/submissions/+server";
import { GET as get, DELETE as remove } from "../src/routes/api/v1/submissions/[id]/+server";
import { GET as artifact } from "../src/routes/api/v1/submissions/[id]/[artifact]/+server";
import { handle } from "../src/hooks.server";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const recording = {
  schemaVersion: 1,
  rrwebVersion: "2.1.6",
  metadata: { durationMs: 999_999 }, // Server must derive duration/count from the actual events.
  events: [
    { type: 4, timestamp: 1_000, data: { href: "https://example.com/", width: 1280, height: 720 } },
    {
      type: 2,
      timestamp: 1_001,
      data: { node: { type: 0, id: 1, childNodes: [] }, initialOffset: { top: 0, left: 0 } },
    },
    { type: 3, timestamp: 2_500, data: { source: 3, id: 1, x: 0, y: 20 } },
  ],
};

const multipart = (
  options: { screenshot?: boolean; replay?: boolean; fields?: Record<string, string> } = {
    screenshot: true,
    replay: true,
  },
) => {
  const form = new FormData();
  if (options.screenshot)
    form.set("screenshot", new Blob([png], { type: "image/png" }), "../../unsafe.png");
  if (options.replay)
    form.set(
      "replay",
      new Blob([JSON.stringify(recording)], { type: "application/json" }),
      "recording.json",
    );
  for (const [key, value] of Object.entries(options.fields ?? {})) form.set(key, value);
  return new Request("http://localhost:3001/api/v1/submit", { method: "POST", body: form });
};

const jsonRequest = (payload: unknown) => {
  return new Request("http://localhost:3001/api/v1/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
};

const expectStatus = async (operation: Promise<unknown>, status: number) => {
  try {
    await operation;
    expect.fail("Expected an HTTP error");
  } catch (cause) {
    expect(isHttpError(cause, status)).toBe(true);
  }
};

describe("Zod submission contracts", () => {
  it("trims fields and rejects unsafe source URLs and oversized titles", () => {
    expect(submissionFieldsSchema.parse({ title: "  A bug  " }).title).toBe("A bug");
    for (const url of [
      "javascript:alert(1)",
      "file:///tmp/test",
      "https://user:password@example.com",
    ]) {
      expect(submissionFieldsSchema.safeParse({ url }).success).toBe(false);
    }
    expect(submissionFieldsSchema.safeParse({ title: "a".repeat(161) }).success).toBe(false);
  });

  it("accepts versioned artifacts and raw rrweb event arrays", () => {
    expect(replaySchema.safeParse(recording).success).toBe(true);
    expect(replaySchema.safeParse(recording.events).success).toBe(true);
    const parsed = validateReplay(recording);
    expect(parsed.info).toMatchObject({ eventCount: 3, durationMs: 1500, rrwebVersion: "2.1.6" });
    expect(JSON.parse(parsed.bytes.toString())).toEqual(recording);
  });

  it("rejects non-playable, out-of-order and unsupported recordings", () => {
    expect(replaySchema.safeParse({ ...recording, schemaVersion: 2 }).success).toBe(false);
    expect(replaySchema.safeParse([recording.events[0], recording.events[2]]).success).toBe(false);
    expect(replaySchema.safeParse([...recording.events].reverse()).success).toBe(false);
    expect(
      replaySchema.safeParse([
        { ...recording.events[0], timestamp: "1000" },
        ...recording.events.slice(1),
      ]).success,
    ).toBe(false);
    expect(replaySchema.safeParse(null).success).toBe(false);
  });
});

describe("bounded upload parsing", () => {
  it("accepts both artifacts and optional JSON metadata", async () => {
    const input = await parseSubmission(
      multipart({
        screenshot: true,
        replay: true,
        fields: { title: "  Checkout issue  ", metadata: '{"browser":"test"}' },
      }),
    );
    expect(input.title).toBe("Checkout issue");
    expect(input.metadata).toEqual({ browser: "test" });
    expect(input.screenshot?.info).toMatchObject({ width: 1, height: 1 });
    expect(input.replay?.info.eventCount).toBe(3);
  });

  it("accepts screenshot-only, replay-only JSON, and generic client artifacts", async () => {
    expect((await parseSubmission(multipart({ screenshot: true }))).replay).toBeNull();
    expect(
      (await parseSubmission(jsonRequest({ replay: recording.events }))).screenshot,
    ).toBeNull();
    const form = new FormData();
    form.set("kind", "replay");
    form.set("artifact", new Blob([JSON.stringify(recording)]), "replay.json");
    const input = await parseSubmission(
      new Request("http://localhost/api/v1/submit", { method: "POST", body: form }),
    );
    expect(input.replay?.info.eventCount).toBe(3);
  });

  it("rejects missing artifacts, malformed files, metadata and duplicate files", async () => {
    await expectStatus(parseSubmission(jsonRequest({ title: "No files" })), 400);
    await expectStatus(parseSubmission(jsonRequest({ replay: "not a replay" })), 400);
    await expectStatus(
      parseSubmission(multipart({ screenshot: true, fields: { metadata: "not json" } })),
      400,
    );
    expect(() => validateScreenshot(Buffer.from("<svg/>"))).toThrow();
    expect(() => validateScreenshot(png.subarray(0, png.length - 4))).toThrow();
    const form = new FormData();
    form.append("screenshot", new Blob([png]), "one.png");
    form.append("screenshot", new Blob([png]), "two.png");
    await expectStatus(
      parseSubmission(
        new Request("http://localhost/api/v1/submit", { method: "POST", body: form }),
      ),
      400,
    );
  });

  it("rejects duplicate text fields and files used as text fields", async () => {
    for (const name of ["title", "description", "url", "metadata", "kind"]) {
      const form = new FormData();
      form.set("screenshot", new Blob([png]), "capture.png");
      form.append(name, "first");
      form.append(name, "second");
      await expectStatus(
        parseSubmission(
          new Request("http://localhost/api/v1/submit", { method: "POST", body: form }),
        ),
        400,
      );
      form.delete(name);
      form.set(name, new Blob(["text"]), "field.txt");
      await expectStatus(
        parseSubmission(
          new Request("http://localhost/api/v1/submit", { method: "POST", body: form }),
        ),
        400,
      );
    }
  });

  it("enforces request limits with and without Content-Length", async () => {
    const request = jsonRequest({ replay: recording });
    request.headers.set("content-length", String(MAX_BODY_BYTES + 1));
    await expectStatus(parseSubmission(request), 413);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1));
        controller.close();
      },
    });
    const streamed = new Request("http://localhost/api/v1/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expectStatus(parseSubmission(streamed), 413);
    expect(() => validateScreenshot(Buffer.alloc(MAX_SCREENSHOT_BYTES + 1))).toThrow();
    await expectStatus(
      parseSubmission(
        new Request("http://localhost/api/v1/submit", { method: "POST", body: "text" }),
      ),
      415,
    );
  });
});

describe("persistent versioned submission endpoints", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "sonda-backend-test-"));
    vi.stubEnv("SONDA_DATA_DIR", directory);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it("creates, lists, loads and downloads a submission across store instances", async () => {
    const response = await POST({ request: multipart() } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.url).toBe(`/submissions/${result.id}`);
    expect(response.headers.get("location")).toBe(result.url);
    const store = createSubmissionStore(directory);
    expect(await store.get(result.id)).toEqual(result.submission);
    expect(await store.artifact(result.id, "screenshot")).toEqual(png);
    const listed = await list({} as Parameters<typeof list>[0]);
    expect((await listed.json()).submissions).toHaveLength(1);
    const loaded = await get({ params: { id: result.id } } as Parameters<typeof get>[0]);
    expect((await loaded.json()).submission.id).toBe(result.id);
    const image = await artifact({
      params: { id: result.id, artifact: "screenshot" },
      url: new URL("http://localhost/file?download=1"),
    } as Parameters<typeof artifact>[0]);
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("content-disposition")).toContain("attachment;");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
    const replay = await store.artifact(result.id, "replay");
    expect(JSON.parse(replay!.toString())).toEqual(recording);
  });

  it("deletes a capture and both artifacts permanently", async () => {
    const store = createSubmissionStore(directory);
    const saved = await store.save(await parseSubmission(multipart()));
    const retained = await store.save(await parseSubmission(multipart()));
    const event = { params: { id: saved.id } } as Parameters<typeof remove>[0];
    expect((await remove(event)).status).toBe(204);
    expect(await store.get(saved.id)).toBeNull();
    expect(await store.artifact(saved.id, "screenshot")).toBeNull();
    expect(await store.artifact(saved.id, "replay")).toBeNull();
    expect(await readdir(directory)).toEqual([retained.id]);
    expect(await store.list()).toEqual([retained]);
    await expectStatus(Promise.resolve(remove(event)), 404);
    expect(await store.remove("../secret")).toBe(false);
  });

  it("returns validation errors as JSON and never saves invalid uploads", async () => {
    const response = await POST({ request: jsonRequest({}) } as Parameters<typeof POST>[0]);
    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("Attach");
    expect(await createSubmissionStore(directory).list()).toEqual([]);
  });

  it("handles empty stores, missing artifacts and path traversal safely", async () => {
    const store = createSubmissionStore(join(directory, "missing"));
    expect(await store.list()).toEqual([]);
    expect(await store.get("../../etc/passwd")).toBeNull();
    expect(await store.artifact("../secret", "screenshot")).toBeNull();
    await expectStatus(
      Promise.resolve(get({ params: { id: "missing" } } as Parameters<typeof get>[0])),
      404,
    );
    await expectStatus(
      Promise.resolve(
        artifact({
          params: { id: "missing", artifact: "other" },
          url: new URL("http://localhost"),
        } as Parameters<typeof artifact>[0]),
      ),
      404,
    );
  });
});

describe("upload origin policy", () => {
  const request = async (
    origin: string | null,
    method = "POST",
    backend = "http://localhost:3001",
  ) => {
    const headers = origin ? { origin } : undefined;
    const event = {
      request: new Request(`${backend}/api/v1/submit`, { method, headers }),
      url: new URL(`${backend}/api/v1/submit`),
    };
    return handle({ event, resolve: async () => new Response("ok") } as unknown as Parameters<
      typeof handle
    >[0]);
  };
  afterEach(() => vi.unstubAllEnvs());

  it("allows same-origin, configured demo origins and non-browser requests", async () => {
    expect((await request("http://localhost:3001")).status).toBe(200);
    const preflight = await request("http://127.0.0.1:5173", "OPTIONS");
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
    expect((await request(null)).status).toBe(200);
  });

  it("rejects untrusted origins and uses explicit allowlists", async () => {
    expect((await request("https://untrusted.example")).status).toBe(403);
    vi.stubEnv("SONDA_ALLOWED_ORIGINS", "https://demo.example");
    expect((await request("https://demo.example")).status).toBe(200);
    expect((await request("http://127.0.0.1:5173")).status).toBe(403);
  });

  it.each(["http://localhost:5174", "http://127.0.0.1:5174", "http://[::1]:5175"])(
    "allows %s on local backends with the default policy",
    async (origin) => {
      expect((await request(origin)).status).toBe(200);
      const preflight = await request(origin, "OPTIONS");
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("access-control-allow-origin")).toBe(origin);
      expect((await request(origin, "POST", "https://sonda.example")).status).toBe(403);
      vi.stubEnv("SONDA_ALLOWED_ORIGINS", "https://demo.example");
      expect((await request(origin)).status).toBe(403);
    },
  );

  it.each(["http://localhost.evil.example:5174", "null", "not-a-url"])(
    "rejects non-loopback origin %s",
    async (origin) => expect((await request(origin)).status).toBe(403),
  );
});
