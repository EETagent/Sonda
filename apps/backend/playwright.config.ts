import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./test-results/browser",
  fullyParallel: true,
  timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm build && exec node --env-file-if-exists=.env server.js",
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
    url: "http://127.0.0.1:3101/api/v1/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: "3101",
      SHUTDOWN_TIMEOUT: "1",
      HOST: "127.0.0.1",
      ORIGIN: "http://127.0.0.1:3101",
      SONDA_DATA_DIR: resolve("test-results/data"),
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
