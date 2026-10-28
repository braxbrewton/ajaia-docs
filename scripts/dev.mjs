// Runs the API (uvicorn, port 8000) and the web app (next dev, port 3000) together.
// Usage: `npm run dev`. Ctrl+C stops both.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");
const webDir = join(root, "apps", "web");
const isWin = process.platform === "win32";

const venv = [join(apiDir, ".venv", "Scripts", "python.exe"), join(apiDir, ".venv", "bin", "python")].find(existsSync);
if (!venv || !existsSync(join(apiDir, ".env")) || !existsSync(join(webDir, "node_modules"))) {
  console.error("Not set up yet. Run `npm run setup` first.");
  process.exit(1);
}

const colors = { api: "\x1b[35m", web: "\x1b[36m" };
const children = [];

function start(name, cmd, args, cwd, shell) {
  const child = spawn(cmd, args, { cwd, shell, env: process.env });
  children.push(child);
  const tag = `${colors[name]}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) if (line.trim()) out.write(tag + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`${tag}exited with code ${code}; stopping.`);
      shutdown(code ?? 1);
    }
  });
}

let shuttingDown = false;
function shutdown(code = 0) {
  shuttingDown = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (isWin) spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting API on http://127.0.0.1:8000 and web on http://localhost:3000 …");
start("api", venv, ["-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"], apiDir, false);
start("web", "npm", ["run", "dev"], webDir, isWin);
