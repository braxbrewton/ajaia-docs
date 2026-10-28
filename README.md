# Ajaia Docs

Lightweight collaborative document editor: Next.js + TypeScript frontend, FastAPI backend.

> Work in progress. The full README (deployment, supported file types, scope notes) is finalized at the end.

## Layout

```
apps/web   Next.js (App Router, TypeScript, Tailwind, TipTap editor)
apps/api   FastAPI (Python), SQLAlchemy, pytest
scripts/   cross-platform helpers (py.mjs runs the API virtualenv's Python)
docs/      screenshots
```

## Local setup

Requires **Node 20+** and **Python 3.11+**. No database server needed locally (SQLite).

```bash
npm run setup   # one time: venv + dependencies + .env files + demo users
npm run dev     # API on :8000 and web on :3000 together (Ctrl+C stops both)
```

Then open http://localhost:3000. Works the same on Windows, macOS and Linux.

`npm run setup` is safe to re-run: it never overwrites existing `.env` files.

### Environment files

| File | Purpose | Created by |
|---|---|---|
| `apps/api/.env` | `DATABASE_URL` (local SQLite), `JWT_SECRET`, `COOKIE_SECURE`, … | `setup` (copies `.env.example` and generates a random `JWT_SECRET`) |
| `apps/web/.env.local` | `API_URL`, where Next proxies `/api/*` (default `http://127.0.0.1:8000`) | `setup` (copies `.env.example`) |

Both real env files are git-ignored; the `.env.example` files document every variable. The web app proxies `/api/*` to the API, so the session cookie stays same-origin and no CORS setup is needed.

<details>
<summary>Manual setup (what <code>npm run setup</code> does)</summary>

```bash
cd apps/api
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt      # Windows: .venv\Scripts\pip
cp .env.example .env                               # then set JWT_SECRET to a long random value
cd ../web && npm install && cp .env.example .env.local && cd ../..
npm run seed                                       # tables + demo users
npm run dev:api                                    # terminal 1
npm run dev:web                                    # terminal 2
```

</details>

### Seeded users (no password; pick one on the login screen)

| Email | Name |
|---|---|
| alice@ajaia.test | Alice Anderson |
| bob@ajaia.test | Bob Brown |
| carol@ajaia.test | Carol Chen |

To try sharing: sign in as Alice, create a document, click **Share**, add `bob@ajaia.test`, then use **Switch user** to sign in as Bob.

## File import

On the dashboard, drag a file in or click **Choose file** to turn it into a new, editable document you own.

| Type | Behavior |
|---|---|
| `.txt` | Blank-line-separated paragraphs; single line breaks preserved |
| `.md` / `.markdown` | Headings, bold, italic, lists, quotes. Raw HTML inside Markdown is shown as plain text, never executed |
| `.docx` | Headings, bold, italic, underline, lists. Images and tables are **not** imported |

Max 4 MB (Vercel caps request bodies at ~4.5 MB). Other file types are rejected with a message listing the supported ones. The document title comes from the file name. Validation happens in the browser for instant feedback and again on the server (extension, size, empty/corrupt files).

## Tests

```bash
npm run test:api   # pytest: access matrix, sharing, sanitization, file import, validation (39 tests)
npm run test:e2e   # Playwright: create/format/share/import flows in a real browser (first run: npx playwright install chromium)
```

The e2e run builds the web app and starts its own API (port 8100) and web server (port 3100) against a throwaway SQLite database, so it never touches your dev data.

## Regenerating API types

Frontend types come from the FastAPI OpenAPI schema. After changing API models/routes:

```bash
npm run gen:types
```

## Screenshots

`SCREENSHOTS=1 npm run test:e2e -- screenshots` regenerates the images in `docs/screenshots/`.
