import { requireSubmission } from "$lib/server/storage";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  return { submission: await requireSubmission(params.id) };
};
