// One-command local setup: `npm run setup`
// Creates the API virtualenv, installs dependencies, writes the .env files (without overwriting
// existing ones), and seeds the demo users into a local SQLite database.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");
const webDir = join(root, "apps", "web");
const isWin = process.platform === "win32";

const step = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);
const fail = (msg) => {
  console.error(`\n\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
};

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin && opts.shell !== false, ...opts });
  if (r.status !== 0) fail(`Command failed: ${cmd} ${args.join(" ")}`);
}

function findPython() {
  const candidates = isWin ? [["py", ["-3"]], ["python", []]] : [["python3", []], ["python", []]];
  for (const [cmd, pre] of candidates) {
    const r = spawnSync(cmd, [...pre, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], {
      encoding: "utf8",
      shell: false,
    });
    if (r.status === 0) {
      const [maj, min] = r.stdout.trim().split(".").map(Number);
      if (maj === 3 && min >= 11) return [cmd, pre];
    }
  }
  return null;
}

// ── 0. prerequisites ─────────────────────────────────────────────────────────────────────
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) fail(`Node 20+ is required (found ${process.versions.node}).`);
const py = findPython();
if (!py) fail("Python 3.11+ is required but was not found on PATH.");

// ── 1. API virtualenv + dependencies ─────────────────────────────────────────────────────
const venvPython = [join(apiDir, ".venv", "Scripts", "python.exe"), join(apiDir, ".venv", "bin", "python")].find(
  existsSync,
);
let venv = venvPython;
if (!venv) {
  step("Creating API virtualenv (apps/api/.venv)");
  run(py[0], [...py[1], "-m", "venv", join(apiDir, ".venv")], { shell: false });
  venv = [join(apiDir, ".venv", "Scripts", "python.exe"), join(apiDir, ".venv", "bin", "python")].find(existsSync);
}
step("Installing API dependencies");
run(venv, ["-m", "pip", "install", "-q", "-r", "requirements-dev.txt"], { cwd: apiDir, shell: false });

// ── 2. Web dependencies ──────────────────────────────────────────────────────────────────
step("Installing web dependencies");
run("npm", ["install", "--no-audit", "--no-fund"], { cwd: webDir });

// ── 3. Env files ─────────────────────────────────────────────────────────────────────────
step("Writing env files");
const apiEnv = join(apiDir, ".env");
if (existsSync(apiEnv)) {
  console.log("  apps/api/.env already exists, leaving it alone");
} else {
  const secret = randomBytes(48).toString("base64url");
  const text = readFileSync(join(apiDir, ".env.example"), "utf8").replace(
    "replace-me-with-a-long-random-string",
    secret,
  );
  writeFileSync(apiEnv, text);
  console.log("  created apps/api/.env (with a freshly generated JWT_SECRET)");
}
const webEnv = join(webDir, ".env.local");
if (existsSync(webEnv)) {
  console.log("  apps/web/.env.local already exists, leaving it alone");
} else {
  copyFileSync(join(webDir, ".env.example"), webEnv);
  console.log("  created apps/web/.env.local");
}

// ── 4. Database ──────────────────────────────────────────────────────────────────────────
step("Creating database tables and seeding demo users");
run(venv, ["-m", "app.seed"], { cwd: apiDir, shell: false });

console.log(`
\x1b[32m✔ Setup complete.\x1b[0m

  Start everything:   npm run dev
  Then open:          http://localhost:3000
  Sign in as:         alice@ajaia.test / bob@ajaia.test / carol@ajaia.test (no password)

  Optional, for browser tests:  npx --prefix apps/web playwright install chromium
`);
