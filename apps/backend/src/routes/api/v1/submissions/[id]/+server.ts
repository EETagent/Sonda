import { error, json } from "@sveltejs/kit";
import { requireSubmission, submissionStore } from "$lib/server/storage";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  return json(
    { submission: await requireSubmission(params.id) },
    { headers: { "cache-control": "no-store" } },
  );
};

export const DELETE: RequestHandler = async ({ params }) => {
  if (!(await submissionStore().remove(params.id))) error(404, "Submission not found.");
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
};
