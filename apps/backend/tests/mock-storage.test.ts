import { describe, expect, it, vi } from "vitest";
vi.mock("$env/dynamic/private", () => ({ env: process.env }));
import { createMockSubmissionStore } from "../src/lib/server/mock-storage";
import { submissionStore } from "../src/lib/server/storage";
import type { ValidatedSubmission } from "../src/lib/server/uploads";

const input: ValidatedSubmission = {
  title: "Mock capture",
  description: "",
  url: null,
  metadata: {},
  replay: null,
  screenshot: {
    bytes: Buffer.from("sample"),
    info: { filename: "screenshot.png", bytes: 6, width: 1, height: 1 },
  },
};
describe("mock storage", () => {
  it("round-trips submissions and artifacts without exposing mutable state", async () => {
    const store = createMockSubmissionStore();
    const saved = await store.save(input);
    expect(await store.list()).toEqual([saved]);
    saved.title = "Changed";
    expect((await store.get(saved.id))?.title).toBe("Mock capture");
    expect(await store.artifact(saved.id, "screenshot")).toEqual(Buffer.from("sample"));
    expect(await store.artifact(saved.id, "replay")).toBeNull();
    expect(await store.get("missing")).toBeNull();
    expect(await createMockSubmissionStore().list()).toEqual([]);
  });
  it("removes captures and releases their capacity", async () => {
    const store = createMockSubmissionStore(800);
    const first = await store.save(input);
    const retained = await store.save(input);
    expect(await store.remove(first.id)).toBe(true);
    expect(await store.get(first.id)).toBeNull();
    expect(await store.artifact(first.id, "screenshot")).toBeNull();
    const next = await store.save(input);
    expect(await store.list()).toHaveLength(2);
    expect(await store.get(retained.id)).toEqual(retained);
    expect(await store.get(next.id)).toEqual(next);
    expect(await store.remove(first.id)).toBe(false);
  });
  it("evicts older entries when memory is full", async () => {
    const store = createMockSubmissionStore(400);
    const first = await store.save(input);
    const second = await store.save(input);
    expect(await store.get(first.id)).toBeNull();
    expect(await store.get(second.id)).not.toBeNull();
    await expect(createMockSubmissionStore(1).save(input)).rejects.toThrow("capacity");
  });
  it("uses the same warm-instance store on Vercel without Blob credentials", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("SONDA_STORAGE_PROVIDER", "mock");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    try {
      expect(submissionStore()).toBe(submissionStore());
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
