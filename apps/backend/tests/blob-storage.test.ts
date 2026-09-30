import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: process.env }));
const blobs = vi.hoisted(() => new Map<string, string | Buffer>());
const sdk = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => sdk);
import { createBlobSubmissionStore } from "../src/lib/server/blob-storage";
import { submissionStore } from "../src/lib/server/storage";
import { validateScreenshot } from "../src/lib/server/uploads";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const input = {
  title: "Capture",
  description: "",
  url: null,
  metadata: {},
  screenshot: validateScreenshot(png),
  replay: null,
};

describe("private Blob submissions", () => {
  beforeEach(() => {
    blobs.clear();
    vi.resetAllMocks();
    sdk.del.mockImplementation(async (paths) => {
      for (const path of Array.isArray(paths) ? paths : [paths]) blobs.delete(path);
    });
    sdk.put.mockImplementation(async (path, body) => {
      blobs.set(path, body);
    });
    sdk.get.mockImplementation(async (path) => {
      const body = blobs.get(path);
      return body === undefined
        ? null
        : {
            statusCode: 200,
            stream: new Response(typeof body === "string" ? body : new Uint8Array(body)).body,
          };
    });
    sdk.list.mockImplementation(async () => ({
      blobs: [...blobs.keys()].map((pathname) => ({ pathname })),
      hasMore: false,
    }));
  });

  it("publishes the manifest last and reads across store instances", async () => {
    const saved = await createBlobSubmissionStore("test-token").save(input);
    expect(sdk.put.mock.calls.map((call) => call[0])).toEqual([
      `sonda/submissions/${saved.id}/screenshot.png`,
      `sonda/submissions/${saved.id}/submission.json`,
    ]);
    expect(sdk.put.mock.calls[0][2]).toMatchObject({
      token: "test-token",
      access: "private",
      addRandomSuffix: false,
    });
    const store = createBlobSubmissionStore("test-token");
    expect(await store.get(saved.id)).toEqual(saved);
    expect(await store.list()).toEqual([saved]);
    expect(await store.artifact(saved.id, "screenshot")).toEqual(png);
    expect(await store.artifact(saved.id, "replay")).toBeNull();
    expect(await store.get("../secret")).toBeNull();
  });

  it("deletes the manifest and attachments while preserving other captures", async () => {
    const store = createBlobSubmissionStore("test-token");
    const saved = await store.save(input);
    const retained = await store.save(input);
    expect(await store.remove(saved.id)).toBe(true);
    expect(await store.get(saved.id)).toBeNull();
    expect(await store.artifact(saved.id, "screenshot")).toBeNull();
    expect(await store.list()).toEqual([retained]);
    expect([...blobs.keys()].some((path) => path.includes(saved.id))).toBe(false);
    expect(await store.remove(saved.id)).toBe(false);
    expect(await store.remove("../secret")).toBe(false);
  });

  it("keeps the manifest available for retry when artifact deletion fails", async () => {
    const store = createBlobSubmissionStore("test-token");
    const saved = await store.save(input);
    sdk.del.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(store.remove(saved.id)).rejects.toThrow("Storage unavailable");
    expect(await store.get(saved.id)).toEqual(saved);
    expect(await store.remove(saved.id)).toBe(true);
  });

  it("does not publish a submission when an artifact upload fails", async () => {
    sdk.put.mockRejectedValueOnce(new Error("Storage unavailable"));
    const store = createBlobSubmissionStore("test-token");
    await expect(store.save(input)).rejects.toThrow("Storage unavailable");
    expect(await store.list()).toEqual([]);
    expect(sdk.put).toHaveBeenCalledTimes(1);
  });

  it("follows pagination and ignores unpublished artifacts", async () => {
    const store = createBlobSubmissionStore("test-token");
    const saved = await store.save(input);
    sdk.list.mockResolvedValueOnce({
      blobs: [{ pathname: `sonda/submissions/${saved.id}/screenshot.png` }],
      hasMore: true,
      cursor: "next",
    });
    sdk.list.mockResolvedValueOnce({
      blobs: [{ pathname: `sonda/submissions/${saved.id}/submission.json` }],
      hasMore: false,
    });
    expect(await store.list()).toEqual([saved]);
    expect(sdk.list.mock.calls[1][0].cursor).toBe("next");
  });

  it("refuses ephemeral filesystem storage on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    try {
      expect(() => submissionStore()).toThrow("private Vercel Blob store");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
