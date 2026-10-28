# Architecture Note

A lightweight collaborative document editor: create, rename, rich-text edit, import files, share with
other users, and persist everything. Built to be the strongest *working* slice of a Google-Docs-like
product in a 4–6 hour box, with deliberate scope cuts.

## System overview

```
Browser ──► Next.js (Vercel, apps/web)  ──/api/* rewrite──►  FastAPI (Vercel, apps/api)  ──►  Postgres (Neon)
            React + TipTap editor                            auth · access rules · import
```

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind. Rich text via **TipTap** (ProseMirror).
- **Backend:** FastAPI (Python) with SQLAlchemy 2, Pydantic v2 validation, PyJWT sessions.
- **Storage:** Postgres on Neon in production; SQLite locally (zero setup). Same models, selected by `DATABASE_URL`.
- **Same-origin API:** the browser only talks to `/api/*` on the web origin; Next proxies it to FastAPI. The
  session cookie is therefore first-party (no CORS, no third-party-cookie blocking between two `*.vercel.app` hosts).
- **Types:** frontend API types are generated from FastAPI's OpenAPI schema (`npm run gen:types`), so the two
  sides cannot silently drift.

## Data model

| Table | Key fields |
|---|---|
| `users` | id, email (unique), name |
| `documents` | id, title, **content (sanitized HTML)**, owner_id, created_at, updated_at |
| `document_shares` | document_id, user_id, role (`viewer` \| `editor`), unique (document, user), cascade delete |

Content is stored as sanitized **HTML**. TipTap emits and loads HTML natively, and the server can convert
`.md`/`.docx` to HTML, so one format serves editing, import and persistence. The tradeoff is that HTML is harder
to merge than an operation log or CRDT. That was acceptable because real-time collaboration is out of scope.

## Access model (the part I treated as most important)

All permission logic lives in one place, `apps/api/app/access.py`:

- Roles: `viewer < editor < owner`. Every document route declares the minimum role it needs through a FastAPI
  dependency (`require_doc(Access.editor)`), so a route cannot forget its check.
- A user with **no access gets 404, not 403**, so document IDs can't be probed for existence. A user who can see
  a document but lacks the role gets 403 (e.g. a viewer trying to PATCH).
- Only the owner can share, change roles, revoke, or delete. Editors can edit; viewers are read-only (and the UI
  reflects it: no toolbar, read-only title, banner).

## Security and robustness decisions

- **Sanitize on write.** Every document body goes through an `nh3` allowlist (only the tags the toolbar can
  produce). Imported text is escaped; Markdown is parsed with raw HTML disabled. A stored-XSS payload can't
  reach another user's browser through a shared document.
- **Sessions:** signed JWT in an `HttpOnly; Secure; SameSite=Lax` cookie. Lax blocks cross-site POSTs from
  carrying the cookie, which covers the CSRF case for this API.
- **Auth is mocked on purpose:** a login screen listing seeded accounts, no passwords. Authorization, which is
  what the exercise is about, is real and enforced server-side on every request.
- **Validation:** Pydantic everywhere (title 1–255 chars, content cap ~2M characters), upload extension/size/empty/
  corrupt checks, and one consistent error shape `{error: {code, message}}` that the UI shows verbatim.
- **Autosave safety:** debounced, *serialized* saves (a slow response can't overwrite newer text), failed saves
  keep the changes and retry on the next edit, pending edits flush on navigation, and the tab warns before closing
  with unsaved work.

## What I prioritized, and why

1. **Core document loop done well**: create → rename → format → autosave → reopen, with formatting preserved.
   This is the product; everything else hangs off it.
2. **Sharing with real enforcement**, not just UI hiding. Owned vs shared is visible on the dashboard, and the
   server is the source of truth.
3. **File import that is product-relevant**: a `.txt`/`.md`/`.docx` becomes a new editable document you own. Limits
   are stated in the UI and README.
4. **A shippable deployment and tests that exercise the real thing**: 44 API tests plus browser tests that run
   two users end to end, and that can be pointed at the live URL.

## What I deliberately cut

- **Real-time collaboration / presence.** Concurrent editors are last-write-wins. Read-only viewers poll every 5s
  so they see the owner's edits, which is "refresh", not live co-editing.
- **Real authentication** (passwords, OAuth, invites for unregistered emails).
- **Version history, comments, suggestion mode, PDF export.**
- **Images/tables/attachments.** `.docx` images and tables are dropped on import, and the UI says so.
- **Database migrations (Alembic).** Schema is created by the seed script (`create_all`). Fine for one deploy,
  but it would be the first thing to replace before a schema change.

## Known limitations and tradeoffs

- Two people editing the same document at once can overwrite each other's most recent change.
- Upload cap is 4 MB (Vercel rejects request bodies above ~4.5 MB), and converted documents above ~2M characters
  are rejected to keep the editor responsive.
- Serverless cold starts can make the first request after idle slow.
- Demo accounts are public by design. Anyone with the URL can sign in as any seeded user.

## What I'd build next (2–4 more hours)

1. Alembic migrations and a CI job (pytest + lint + Playwright against a preview deploy).
2. Optimistic-concurrency saves (`updated_at`/version check, with a "document changed, reload?" prompt) to remove
   silent overwrites, as a step toward Yjs-based real-time editing and presence.
3. Real auth (email magic link or OAuth) and sharing by invite for people without an account.
4. Version history (snapshot on idle/save), then Markdown/PDF export.

## Testing strategy

- `apps/api/tests` (pytest, in-memory SQLite, 44 tests): the access matrix (owner/editor/viewer/stranger on every
  verb), sharing and role changes, revocation, sanitization, validation, timestamp normalization, import
  conversion for all three formats (including a `.docx` built in memory), size limits and config parsing.
- `apps/web/e2e` (Playwright): a two-user browser test (format → persist → share → permissions → role upgrade →
  edit visible to the owner), an import flow (reject `.png`, import `.md`, edit, return to dashboard), and the
  signed-out redirect. Runs against throwaway local servers by default, or `E2E_BASE_URL=<url>` for a live deploy.
