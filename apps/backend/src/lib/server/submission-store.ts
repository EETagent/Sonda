import { randomUUID } from "node:crypto";
import type { ArtifactKind, Submission } from "../submissions.js";
import type { ValidatedSubmission } from "./uploads.js";

export interface SubmissionStore {
  get(id: string): Promise<Submission | null>;
  list(): Promise<Submission[]>;
  save(input: ValidatedSubmission): Promise<Submission>;
  artifact(id: string, kind: ArtifactKind): Promise<Buffer | null>;
  remove(id: string): Promise<boolean>;
}

export const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Snapshot caller-owned metadata before a store begins asynchronous writes. */
export const createSubmission = (input: ValidatedSubmission): Submission => ({
  id: randomUUID(),
  title: input.title,
  description: input.description,
  url: input.url,
  createdAt: new Date().toISOString(),
  metadata: structuredClone(input.metadata),
  screenshot: input.screenshot ? structuredClone(input.screenshot.info) : null,
  replay: input.replay ? structuredClone(input.replay.info) : null,
});

export const newestFirst = (a: Submission, b: Submission): number =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
