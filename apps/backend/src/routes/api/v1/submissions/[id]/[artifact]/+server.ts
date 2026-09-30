import { error } from "@sveltejs/kit";
import { submissionStore } from "$lib/server/storage";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  if (params.artifact !== "screenshot" && params.artifact !== "replay")
    error(404, "Artifact not found.");
  const bytes = await submissionStore().artifact(params.id, params.artifact);
  if (!bytes) error(404, "Artifact not found.");
  const png = params.artifact === "screenshot";
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": png ? "image/png" : "application/json; charset=utf-8",
      "content-length": String(bytes.length),
      "content-disposition": `${disposition}; filename="sonda-${params.id}.${png ? "png" : "json"}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
};
