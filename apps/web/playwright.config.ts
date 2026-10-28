import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

// Isolated ports + a throwaway SQLite DB so e2e never touches a developer's running servers/data.
const API_PORT = 8100;
const WEB_PORT = 3100;
const py = path.resolve(__dirname, "../../scripts/py.mjs");
const apiEnv = { DATABASE_URL: "sqlite:///./e2e.db" };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Fresh DB each run: delete, seed, serve.
      command: `node -e "require('fs').rmSync('e2e.db',{force:true})" && node "${py}" -m app.seed && node "${py}" -m uvicorn app.main:app --port ${API_PORT}`,
      cwd: path.resolve(__dirname, "../api"),
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: apiEnv,
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
