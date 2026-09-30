import node from "@sveltejs/adapter-node";
import vercel from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: process.env.VERCEL ? vercel({ runtime: "nodejs22.x" }) : node(),
    // hooks.server.ts enforces an explicit Origin allowlist, including JSON requests.
    // This lets multipart API clients without an Origin header (e.g. curl) submit too.
    csrf: { trustedOrigins: ["*"] },
  },
};
