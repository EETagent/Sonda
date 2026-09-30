import { submissionStore } from "$lib/server/storage";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ depends, setHeaders }) => {
  depends("sonda:submissions");
  setHeaders({ "cache-control": "no-store" });
  return { submissions: await submissionStore().list() };
};
