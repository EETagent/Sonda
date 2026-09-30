import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  if (process.env.VERCEL) {
    const backend = loadEnv(mode, process.cwd()).VITE_SONDA_BACKEND_URL;
    if (!backend || new URL(backend).protocol !== "https:") {
      throw new Error("Set VITE_SONDA_BACKEND_URL to the backend HTTPS URL before deploying.");
    }
  }
  return {
    resolve:
      mode === "production"
        ? {}
        : {
            alias: {
              "@sonda/client": fileURLToPath(
                new URL("../../packages/client/src/index.ts", import.meta.url),
              ),
            },
          },
  };
});
