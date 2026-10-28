// Cross-platform launcher: runs the API's virtualenv Python with the given args, cwd = apps/api.
// Usage: node scripts/py.mjs -m pytest -q
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "apps", "api");
const candidates = [
  join(apiDir, ".venv", "Scripts", "python.exe"), // Windows
  join(apiDir, ".venv", "bin", "python"), // macOS / Linux
];
const python = candidates.find(existsSync);

if (!python) {
  console.error(
    "API virtualenv not found. Run:\n  cd apps/api && python -m venv .venv && .venv/bin/pip install -r requirements.txt  (Windows: .venv\\Scripts\\pip)",
  );
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { cwd: apiDir, stdio: "inherit" });
process.exit(result.status ?? 1);
