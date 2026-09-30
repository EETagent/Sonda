import { z } from "zod";

import { MAX_EVENTS, MAX_METADATA_BYTES } from "./upload-limits.js";
export * from "./upload-limits.js";

export const submissionFieldsSchema = z.object({
  title: z.string().max(160).trim().default(""),
  description: z.string().max(10_000).trim().default(""),
  url: z
    .string()
    .max(2048)
    .trim()
    .default("")
    .refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
      } catch {
        return false;
      }
    }, "Must be an absolute HTTP or HTTPS URL without credentials."),
  metadata: z
    .record(z.string(), z.unknown())
    .default({})
    .refine(
      (value) => new TextEncoder().encode(JSON.stringify(value)).length <= MAX_METADATA_BYTES,
      "Metadata must not exceed 64 KB.",
    ),
});

const snapshotDataSchema = z.object({
  node: z.object({ type: z.literal(0), id: z.number().int(), childNodes: z.array(z.unknown()) }),
  initialOffset: z.object({ top: z.number(), left: z.number() }),
});

const viewportSchema = z.object({
  width: z.number().positive().max(32_768),
  height: z.number().positive().max(32_768),
});

export const rrwebEventSchema = z
  .object({
    type: z.number().int().min(0).max(7),
    timestamp: z.number().nonnegative(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough()
  .superRefine((event, context) => {
    if (event.type === 2 && !snapshotDataSchema.safeParse(event.data).success) {
      context.addIssue({ code: "custom", path: ["data"], message: "Invalid full DOM snapshot." });
    }
    if (event.type === 4 && !viewportSchema.safeParse(event.data).success) {
      context.addIssue({
        code: "custom",
        path: ["data"],
        message: "Invalid replay viewport dimensions.",
      });
    }
  });

const eventsSchema = z.array(rrwebEventSchema).min(2).max(MAX_EVENTS);

/** Accept both the Sonda versioned artifact and an rrweb event array without changing event data. */
export const replaySchema = z
  .union([
    eventsSchema,
    z
      .object({
        schemaVersion: z.literal(1).optional(),
        rrwebVersion: z.string().max(64).optional(),
        events: eventsSchema,
      })
      .passthrough(),
  ])
  .superRefine((recording, context) => {
    const events = Array.isArray(recording) ? recording : recording.events;
    if (!events.some((event) => event.type === 2) || !events.some((event) => event.type === 4)) {
      context.addIssue({
        code: "custom",
        message: "Replay needs a full DOM snapshot and viewport metadata to be playable.",
      });
    }
    if (events.some((event, index) => index > 0 && event.timestamp < events[index - 1].timestamp)) {
      context.addIssue({ code: "custom", message: "Replay events must be in timestamp order." });
    }
  });

export const jsonSubmissionSchema = z
  .object({
    replay: z.unknown().optional(),
    screenshot: z.never().optional(),
  })
  .passthrough();

export type ReplayRecording = z.infer<typeof replaySchema>;

export const validationMessage = (error: z.ZodError): string => {
  const issue = error.issues[0];
  return issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message;
};
