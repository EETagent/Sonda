import { env } from "$env/dynamic/private";
import { error } from "@sveltejs/kit";
import {
  MAX_BODY_BYTES,
  MAX_SCREENSHOT_BYTES,
  MAX_REPLAY_BYTES,
  jsonSubmissionSchema,
  replaySchema,
  submissionFieldsSchema,
  validationMessage,
} from "../validation.js";
import type { ReplayInfo, ScreenshotInfo } from "../submissions.js";

export interface ValidatedSubmission {
  title: string;
  description: string;
  url: string | null;
  metadata: Record<string, unknown>;
  screenshot: { info: ScreenshotInfo; bytes: Buffer } | null;
  replay: { info: ReplayInfo; bytes: Buffer } | null;
}

const parseJson = (value: string, name: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    error(400, `${name} must contain valid JSON.`);
  }
};

export const validateScreenshot = (
  bytes: Buffer,
): NonNullable<ValidatedSubmission["screenshot"]> => {
  if (bytes.length > MAX_SCREENSHOT_BYTES) error(413, "Screenshot exceeds the 10 MB limit.");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    bytes.length < 45 ||
    !bytes.subarray(0, 8).equals(signature) ||
    bytes.readUInt32BE(8) !== 13 ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    error(400, "Screenshot must be a PNG image.");
  }
  // Check chunk boundaries as well as the signature, so truncated uploads are rejected.
  let offset = 8;
  let imageData = false;
  let ended = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (length > bytes.length - offset - 12) error(400, "PNG image is truncated.");
    if (type === "IDAT") imageData = true;
    offset += length + 12;
    if (type === "IEND") {
      ended = length === 0 && offset === bytes.length;
      break;
    }
  }
  if (!imageData || !ended) error(400, "PNG image is incomplete.");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (!width || !height || width > 32_768 || height > 32_768 || width * height > 80_000_000) {
    error(400, "Screenshot dimensions are invalid or exceed 80 megapixels.");
  }
  return { bytes, info: { filename: "screenshot.png", bytes: bytes.length, width, height } };
};

export const validateReplay = (value: unknown): NonNullable<ValidatedSubmission["replay"]> => {
  const bytes = Buffer.from(JSON.stringify(value) ?? "");
  if (bytes.length > MAX_REPLAY_BYTES) error(413, "Replay exceeds the 12 MB limit.");
  const parsed = replaySchema.safeParse(value);
  if (!parsed.success) error(400, validationMessage(parsed.error));
  const recording = parsed.data;
  const events = Array.isArray(recording) ? recording : recording.events;
  return {
    // Persist the original artifact, including unknown rrweb fields and version metadata.
    bytes,
    info: {
      filename: "replay.json",
      bytes: bytes.length,
      eventCount: events.length,
      durationMs: events[events.length - 1].timestamp - events[0].timestamp,
      rrwebVersion: Array.isArray(recording) ? null : (recording.rrwebVersion ?? null),
    },
  };
};

const boundedBody = async (request: Request): Promise<Uint8Array<ArrayBuffer>> => {
  const limit = env.VERCEL ? 4 * 1024 * 1024 : MAX_BODY_BYTES;
  const limitMessage = `Submission exceeds the ${limit / 1024 / 1024} MB request limit.`;
  const length = request.headers.get("content-length");
  if (length && Number(length) > limit) error(413, limitMessage);
  if (!request.body) error(400, "Submission body is required.");
  const reader = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        error(413, limitMessage);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const uploadFile = (form: FormData, name: string): File | null => {
  const values = form.getAll(name);
  if (values.length > 1) error(400, `Only one ${name} file is allowed.`);
  const value = values[0];
  if (value === undefined || (value instanceof File && value.size === 0 && value.name === ""))
    return null;
  if (!(value instanceof File)) error(400, `${name} must be a file.`);
  if (!value.size) error(400, `${name} file is empty.`);
  return value;
};

const textField = (form: FormData, name: string): string | undefined => {
  const values = form.getAll(name);
  if (values.length > 1) error(400, `Only one ${name} field is allowed.`);
  const value = values[0];
  if (value === undefined) return undefined;
  if (typeof value !== "string") error(400, `${name} must be text.`);
  return value;
};

/** HTTP/file parsing stays server-only; reusable payload validation lives in $lib/validation. */
export const parseSubmission = async (request: Request): Promise<ValidatedSubmission> => {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (mediaType !== "multipart/form-data" && mediaType !== "application/json") {
    error(415, "Use multipart/form-data for files or application/json for a replay.");
  }
  const body = await boundedBody(request);
  let fields: Record<string, unknown>;
  let screenshot: ValidatedSubmission["screenshot"] = null;
  let replay: ValidatedSubmission["replay"] = null;

  if (mediaType === "multipart/form-data") {
    let form: FormData;
    try {
      form = await new Response(body, { headers: { "content-type": contentType } }).formData();
    } catch {
      error(400, "Malformed multipart submission.");
    }
    fields = Object.fromEntries(
      ["title", "description", "url", "metadata", "kind"].map((name) => [
        name,
        textField(form, name),
      ]),
    );
    const png = uploadFile(form, "screenshot");
    const recording = uploadFile(form, "replay");
    // This alias maps directly to a sonda-accept event's blob + kind.
    const artifact = uploadFile(form, "artifact");
    if (artifact && fields.kind !== "screenshot" && fields.kind !== "replay")
      error(400, "artifact requires kind=screenshot or kind=replay.");
    if (
      artifact &&
      ((fields.kind === "screenshot" && png) || (fields.kind === "replay" && recording))
    )
      error(400, "Upload each artifact only once.");
    const screenshotFile = png ?? (fields.kind === "screenshot" ? artifact : null);
    const replayFile = recording ?? (fields.kind === "replay" ? artifact : null);
    if (screenshotFile) {
      if (screenshotFile.size > MAX_SCREENSHOT_BYTES)
        error(413, "Screenshot exceeds the 10 MB limit.");
      screenshot = validateScreenshot(Buffer.from(await screenshotFile.arrayBuffer()));
    }
    if (replayFile) {
      if (replayFile.size > MAX_REPLAY_BYTES) error(413, "Replay exceeds the 12 MB limit.");
      replay = validateReplay(parseJson(await replayFile.text(), "replay"));
    }
    if (typeof fields.metadata === "string")
      fields.metadata = fields.metadata ? parseJson(fields.metadata, "metadata") : undefined;
  } else {
    const result = jsonSubmissionSchema.safeParse(
      parseJson(new TextDecoder().decode(body), "Submission"),
    );
    if (!result.success) error(400, validationMessage(result.error));
    fields = result.data;
    if (fields.replay !== undefined) replay = validateReplay(fields.replay);
  }

  if (!screenshot && !replay) error(400, "Attach a PNG screenshot, an rrweb replay, or both.");
  const result = submissionFieldsSchema.safeParse(fields);
  if (!result.success) error(400, validationMessage(result.error));
  return {
    ...result.data,
    title:
      result.data.title ||
      (screenshot && replay
        ? "Screenshot and session replay"
        : screenshot
          ? "Screenshot submission"
          : "Session replay submission"),
    url: result.data.url || null,
    screenshot,
    replay,
  };
};
