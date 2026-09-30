import type { ArtifactKind, Submission } from "../submissions.js";
import type { ValidatedSubmission } from "./uploads.js";
import { createSubmission, newestFirst, type SubmissionStore } from "./submission-store.js";

/** Demo-only, bounded memory storage. Each server instance has its own inbox. */
export const createMockSubmissionStore = (maxBytes = 32 * 1024 * 1024): SubmissionStore => {
  const entries = new Map<
    string,
    { submission: Submission; screenshot: Buffer | null; replay: Buffer | null; size: number }
  >();
  let bytes = 0;
  const get = async (id: string): Promise<Submission | null> => {
    const entry = entries.get(id);
    return entry ? structuredClone(entry.submission) : null;
  };
  const list = async (): Promise<Submission[]> =>
    [...entries.values()].map((entry) => structuredClone(entry.submission)).sort(newestFirst);
  const save = async (input: ValidatedSubmission): Promise<Submission> => {
    const submission = createSubmission(input);
    const screenshot = input.screenshot ? Buffer.from(input.screenshot.bytes) : null;
    const replay = input.replay ? Buffer.from(input.replay.bytes) : null;
    const size =
      (screenshot?.length ?? 0) +
      (replay?.length ?? 0) +
      Buffer.byteLength(JSON.stringify(submission));
    if (size > maxBytes) throw new Error("Capture exceeds mock storage capacity.");
    while (bytes + size > maxBytes || entries.size >= 100) {
      const oldest = entries.keys().next().value!;
      bytes -= entries.get(oldest)!.size;
      entries.delete(oldest);
    }
    entries.set(submission.id, { submission, screenshot, replay, size });
    bytes += size;
    return structuredClone(submission);
  };
  const artifact = async (id: string, kind: ArtifactKind): Promise<Buffer | null> => {
    const value = entries.get(id)?.[kind];
    return value ? Buffer.from(value) : null;
  };
  const remove = async (id: string): Promise<boolean> => {
    const entry = entries.get(id);
    if (!entry) return false;
    bytes -= entry.size;
    entries.delete(id);
    return true;
  };
  return { get, list, save, artifact, remove };
};

// Reused across requests on a warm function instance; never a durable database.
export const mockSubmissionStore = createMockSubmissionStore();
