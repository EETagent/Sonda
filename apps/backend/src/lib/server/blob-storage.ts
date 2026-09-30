import { del, get as readBlob, list as listBlobs, put } from "@vercel/blob";
import type { ArtifactKind, Submission } from "../submissions.js";
import type { ValidatedSubmission } from "./uploads.js";
import {
  createSubmission,
  ID_PATTERN,
  newestFirst,
  type SubmissionStore,
} from "./submission-store.js";

/** Immutable artifacts are written first; the manifest publishes the completed submission. */
export const createBlobSubmissionStore = (token: string): SubmissionStore => {
  const prefix = "sonda/submissions/";
  const options = { token, access: "private" as const, addRandomSuffix: false };
  const read = async (pathname: string): Promise<Buffer | null> => {
    const result = await readBlob(pathname, { token, access: "private", useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error("Unexpected Blob response.");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  };
  const get = async (id: string): Promise<Submission | null> => {
    if (!ID_PATTERN.test(id)) return null;
    const bytes = await read(`${prefix}${id}/submission.json`);
    return bytes ? (JSON.parse(bytes.toString()) as Submission) : null;
  };
  const list = async (): Promise<Submission[]> => {
    const submissions: Submission[] = [];
    let cursor: string | undefined;
    do {
      const page = await listBlobs({ token, prefix, cursor });
      for (const blob of page.blobs) {
        const parts = blob.pathname.slice(prefix.length).split("/");
        if (parts.length !== 2 || parts[1] !== "submission.json") continue;
        const submission = await get(parts[0]);
        if (submission) submissions.push(submission);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return submissions.sort(newestFirst);
  };
  const save = async (input: ValidatedSubmission): Promise<Submission> => {
    const submission = createSubmission(input);
    const { id } = submission;
    if (input.screenshot)
      await put(`${prefix}${id}/screenshot.png`, input.screenshot.bytes, {
        ...options,
        contentType: "image/png",
      });
    if (input.replay)
      await put(`${prefix}${id}/replay.json`, input.replay.bytes, {
        ...options,
        contentType: "application/json",
      });
    await put(`${prefix}${id}/submission.json`, JSON.stringify(submission), {
      ...options,
      contentType: "application/json",
    });
    return submission;
  };
  const artifact = async (id: string, kind: ArtifactKind): Promise<Buffer | null> => {
    const submission = await get(id);
    if (!submission?.[kind]) return null;
    return read(`${prefix}${id}/${kind === "screenshot" ? "screenshot.png" : "replay.json"}`);
  };
  const remove = async (id: string): Promise<boolean> => {
    const submission = await get(id);
    if (!submission) return false;
    const directory = `${prefix}${id}/`;
    // Keep the manifest until artifact cleanup succeeds so failures can be retried.
    const artifacts = [
      ...(submission.screenshot ? [`${directory}screenshot.png`] : []),
      ...(submission.replay ? [`${directory}replay.json`] : []),
    ];
    if (artifacts.length) await del(artifacts, { token });
    await del(`${directory}submission.json`, { token });
    return true;
  };
  return { get, list, save, artifact, remove };
};
