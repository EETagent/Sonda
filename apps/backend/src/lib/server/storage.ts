import { createBlobSubmissionStore } from "./blob-storage.js";
import { mockSubmissionStore } from "./mock-storage.js";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { error } from "@sveltejs/kit";
import type { ArtifactKind, Submission } from "../submissions.js";
import { env } from "$env/dynamic/private";
import type { ValidatedSubmission } from "./uploads.js";
import {
  createSubmission,
  ID_PATTERN,
  newestFirst,
  type SubmissionStore,
} from "./submission-store.js";

const missing = (cause: unknown): boolean => {
  return cause instanceof Error && "code" in cause && cause.code === "ENOENT";
};

/** One directory per submission; publish by atomic rename only after all writes succeed. */
export const createSubmissionStore = (directory: string): SubmissionStore => {
  const root = resolve(directory);

  const get = async (id: string): Promise<Submission | null> => {
    if (!ID_PATTERN.test(id)) return null;
    try {
      return JSON.parse(await readFile(resolve(root, id, "submission.json"), "utf8")) as Submission;
    } catch (cause) {
      if (missing(cause)) return null;
      throw cause;
    }
  };

  const list = async (): Promise<Array<Submission>> => {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (cause) {
      if (missing(cause)) return [];
      throw cause;
    }
    const submissions: Array<Submission> = [];
    // Sequential reads avoid exhausting file descriptors as the local inbox grows.
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue;
      const submission = await get(entry.name);
      if (submission) submissions.push(submission);
    }
    return submissions.sort(newestFirst);
  };

  const save = async (input: ValidatedSubmission): Promise<Submission> => {
    const submission = createSubmission(input);
    const { id } = submission;
    const temporary = resolve(root, `.pending-${id}`);
    await mkdir(root, { recursive: true, mode: 0o700 });
    await mkdir(temporary, { mode: 0o700 });
    try {
      if (input.screenshot)
        await writeFile(resolve(temporary, "screenshot.png"), input.screenshot.bytes, {
          mode: 0o600,
        });
      if (input.replay)
        await writeFile(resolve(temporary, "replay.json"), input.replay.bytes, { mode: 0o600 });
      await writeFile(resolve(temporary, "submission.json"), JSON.stringify(submission, null, 2), {
        mode: 0o600,
      });
      await rename(temporary, resolve(root, id));
      return submission;
    } catch (cause) {
      await rm(temporary, { recursive: true, force: true });
      throw cause;
    }
  };

  const artifact = async (id: string, kind: ArtifactKind): Promise<Buffer | null> => {
    const submission = await get(id);
    if (!submission?.[kind]) return null;
    try {
      // Artifact filenames are fixed rather than derived from uploaded filenames/metadata.
      return await readFile(
        resolve(root, id, kind === "screenshot" ? "screenshot.png" : "replay.json"),
      );
    } catch (cause) {
      if (missing(cause)) return null;
      throw cause;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    if (!(await get(id))) return false;
    await rm(resolve(root, id), { recursive: true, force: true });
    return true;
  };

  return { get, list, save, artifact, remove };
};

export const submissionStore = (): SubmissionStore => {
  if (env.SONDA_STORAGE_PROVIDER === "mock") return mockSubmissionStore;
  if (env.BLOB_READ_WRITE_TOKEN) return createBlobSubmissionStore(env.BLOB_READ_WRITE_TOKEN);
  if (env.VERCEL) throw new Error("Connect a private Vercel Blob store before using the inbox.");
  return createSubmissionStore(env.SONDA_DATA_DIR || resolve(process.cwd(), "data/submissions"));
};

export const requireSubmission = async (id: string): Promise<Submission> => {
  const submission = await submissionStore().get(id);
  if (!submission) error(404, "Submission not found.");
  return submission;
};
