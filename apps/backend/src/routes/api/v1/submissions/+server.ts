import { json } from "@sveltejs/kit";
import { submissionStore } from "$lib/server/storage";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
  const submissions = await submissionStore().list();
  return json({ submissions }, { headers: { "cache-control": "no-store" } });
};
