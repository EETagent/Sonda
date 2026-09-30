import { isHttpError, json } from "@sveltejs/kit";
import { parseSubmission } from "$lib/server/uploads";
import { submissionStore } from "$lib/server/storage";
import type { RequestHandler } from "./$types";

/** multipart: screenshot and/or replay files; title, description, url, metadata are optional. */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const input = await parseSubmission(request);
    const submission = await submissionStore().save(input);
    const url = `/submissions/${submission.id}`;
    return json(
      { id: submission.id, url, submission },
      {
        status: 201,
        headers: { location: url, "cache-control": "no-store" },
      },
    );
  } catch (cause) {
    if (isHttpError(cause)) return json(cause.body, { status: cause.status });
    throw cause;
  }
};
