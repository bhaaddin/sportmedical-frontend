# CLAUDE.md — SportMedical frontend

React 19 + Vite + MUI v9 + react-query + zod + vitest. The API lives in `bhaaddin/sportmedical-api` (`/api` is proxied to `http://localhost:5092`, hardcoded in `vite.config.ts`).

## How we work: Spec Kit
Rules: `.specify/memory/constitution.md` (read it first; it outranks everything else here).
- New feature: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-converge`. Specs go under `specs/`.
- Defect: `/speckit-bug-assess` → `/speckit-bug-fix` → `/speckit-bug-test`. Reports go under `.specify/bugs/<slug>/`; a fix without a recorded `verified` verdict is not done.
- Small, obvious edits do not need a spec. Anything that touches the club order flow, the calendar pick mode, public pages or security does.

## Commands
- `npm run typecheck` (the only real check; `tsc -p tsconfig.json` checks nothing).
- `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run <paths> --maxWorkers=3` (a full run needs more than ten minutes; run it in the background).
- `npm run dev` serves :3000. Staff screens are behind `/login`; the public site is served at the root.

## Layouts and tests
Three layouts through `useDevice()` (phone ≤ 767, tablet 768–1279, desktop ≥ 1280). Tests call `setViewport` from `src/test/viewport.ts`. Touch targets are at least 44 px.

## Gotchas
- The Windows file watcher can miss an edit and Vite then serves the old module. If a compiling change does not show, `touch` the file or restart the dev server.
- Never leave a Playwright `page.route` mock active in the shared browser (`await page.context().unrouteAll()`); a stale mock once showed demo data as if it were real.
- Shell commands that carry Czech characters can arrive as the wrong encoding; send JSON from a UTF-8 file.
- Everything the clinic owns (prices, hours, wording) is a setting or a text slot (`src/site/slots/`), never a literal in a component.

## Git
Branch `claude/clean` is what Vercel builds. Push only to `bhaaddin/sportmedical-frontend` and verify the remote first.
