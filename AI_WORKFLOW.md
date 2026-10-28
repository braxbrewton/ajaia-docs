# AI-Native Workflow Note

## Tools used

- **Cursor (agent mode)** with a Claude model: planning, scaffolding, writing code and tests, running commands,
  and reading failures. It ran in my repo with a shell, so it could build, run the test suites and drive a real
  browser rather than just suggest code.
- **Playwright**, driven by the agent, for end-to-end checks and screenshots. I used the screenshots to review the
  UI myself.

I made the product and scope decisions (what to build, what to cut, the stack, where to deploy). The AI did most
of the typing and much of the debugging.

## Where AI materially sped things up

- **Scaffolding the full stack quickly.** Monorepo, FastAPI app with models/auth/sharing, Next.js screens, TipTap
  editor, import pipeline, cross-platform setup scripts. This is the bulk of the time saved.
- **Test volume.** The access matrix (owner/editor/viewer/stranger across every verb), import conversion for three
  formats (including building a `.docx` in memory), and a two-user Playwright flow would have been tedious by hand.
- **Plumbing I'd otherwise look up:** OpenAPI → TypeScript type generation, Playwright multi-context setup, Vercel
  Python/Next configuration, Neon connection string handling.
- **Tight loops:** write → run → read failure → fix, with the agent running the suites itself.

## What I directed, changed, or rejected

Decisions I made or redirected:
- **Stack:** the first plan used a Node backend; I switched it to **Python/FastAPI**. The plan was revised
  around that, and content storage moved from TipTap JSON to sanitized HTML because the server could now
  convert `.md`/`.docx` directly.
- **Deployment:** the first plan suggested hosting the API on Render. I went with **Vercel for both apps**
  (one account, no sleeping free-tier service) and Neon for Postgres.
- **Scope order:** stretch features last, after everything required works.

AI output that was wrong or weak, and what happened to it:

| AI output | Problem | Resolution |
|---|---|---|
| Used pydantic `EmailStr` for login/share emails | Rejected the seeded `@ajaia.test` accounts (reserved TLD). All auth tests failed on first run | Replaced with a format-only validator, plus a comment explaining why |
| Datetimes straight from SQLite | Returned without a timezone, so browsers would show wrong "last edited" times. Found during a real-server smoke test, not by unit tests | Normalize all API timestamps to UTC; added a regression test |
| TipTap `StarterKit` defaults | Offered code blocks, inline code, horizontal rules and links that my server-side sanitizer would silently strip on save | Disabled those extensions so the toolbar only offers what persists |
| Root npm scripts calling `.venv/Scripts/python` | Failed under `cmd` on Windows | Replaced with a small cross-platform launcher |
| Busy-state flags (`creating`, `importing`) | With Next's Cache Components, a navigated-away page stays mounted, so the "Creating…" button stayed stuck after returning. Caught by **looking at a screenshot**, not by a passing test | Added a `useResetWhenHidden` hook and a regression step in the e2e test |
| 5 MB upload limit | Vercel rejects request bodies above ~4.5 MB; verified live (`FUNCTION_PAYLOAD_TOO_LARGE`) | Lowered to 4 MB everywhere, including UI copy |
| "A file at the limit imports fine" test | Failed: a 4 MB text file exceeds the editor's content cap, an inconsistency I hadn't intended | Kept the cap (editor responsiveness), tested both limits separately, with a clear error message |
| A couple of lazy assertions (`... or True`, a convoluted `onerror` check) | Tests that couldn't fail | Rewritten to assert real behavior |
| Several first-draft Playwright locators | Strict-mode violations (duplicate headings, Next's route announcer, hidden-but-mounted pages) | Tightened locators; no app behavior was changed to make a test pass |

## How I verified correctness, UX quality, and reliability

- **Automated:** 44 pytest tests (access rules, sharing, sanitization, validation, import, config) and 3
  Playwright browser tests that run two signed-in users against each other. Lint, type-check and production build
  are clean.
- **Against the real thing, not just mocks:** a smoke test against the actual Neon Postgres (login, create,
  reload with formatting, delete); direct requests to the deployed API to check cookie flags
  (`HttpOnly; Secure; SameSite=Lax`), the 401/415/oversize paths; and the **same Playwright suite pointed at the
  live Vercel URL** (`E2E_BASE_URL`). The first live run failed only on a 30 s timeout. The page showed the
  correct state, so I raised the timeout for remote runs instead of changing the app.
- **UX review:** screenshots of every main screen (login, dashboard, editor, share dialog, viewer mode) reviewed by
  eye. That's how the stuck button above was found.
- **Trust but verify:** I ran or re-ran the commands behind every claim in the docs rather than accepting "it
  should work", and two of the bugs above only surfaced that way.
- [Add anything you personally clicked through or tested by hand, and roughly how long the build took.]

## Limits of this verification

- Browser coverage is Chromium only, with no cross-browser or mobile pass.
- No accessibility audit beyond using semantic roles/labels that the tests rely on.
- Real-time conflict behavior is untested because it's not implemented (last-write-wins).
