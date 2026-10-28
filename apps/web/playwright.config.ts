import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Two modes:
//  - default: starts its own API (port 8100, throwaway SQLite DB) + web server (port 3100), so
//    e2e never touches a developer's running servers/data.
//  - E2E_BASE_URL=https://your-deployment: runs the same tests against a live deployment
//    (tests clean up the documents they create).
const remote = process.env.E2E_BASE_URL?.replace(/\/$/, "");

const API_PORT = 8100;
const WEB_PORT = 3100;
const py = path.resolve(__dirname, "../../scripts/py.mjs");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: remote ?? `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: remote
    ? undefined
    : [
        {
          // Fresh DB each run: delete, seed, serve.
          command: `node -e "require('fs').rmSync('e2e.db',{force:true})" && node "${py}" -m app.seed && node "${py}" -m uvicorn app.main:app --port ${API_PORT}`,
          cwd: path.resolve(__dirname, "../api"),
          url: `http://127.0.0.1:${API_PORT}/health`,
          env: { DATABASE_URL: "sqlite:///./e2e.db" },
          reuseExistingServer: false,
          timeout: 60_000,
        },
        {
          command: `npm run build && npm run start -- -p ${WEB_PORT}`,
          url: `http://127.0.0.1:${WEB_PORT}/login`,
          env: { API_URL: `http://127.0.0.1:${API_PORT}` },
          reuseExistingServer: false,
          timeout: 180_000,
        },
      ],
});
