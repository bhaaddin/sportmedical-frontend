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

## Planner (the calendar at `/planovani`)
The calendar is the planner: `src/planner/PlannerPage.tsx` is the page (lazy route in `App.tsx`), the partner's finished design `design/planner-v65.html` is its visual and functional reference (`design/PLANNER-BRIEF.md` is the brief). The old grid (`CalendarGridPage`, `TimeGrid`, the pick-mode panels) is gone; pick logic that survives lives in `components/booking/calendar/` (`pickPlan`, `pickCoverage`, the činnost bubble and shortfall dialogs) and is used by the planner.
- **Layout:** `model/` pure functions pinned against the prototype (`__golden__`), `state/` the store, `data/` the data sources, `api/` the mappers and deps of `ApiDataSource`, `components/` one file per panel, `components/dialogs/*` one folder per group of dialogs (registered in `components/dialogRegistry.ts`; every `DialogKind` has a body - `dialogs/leftover/` holds the term dialogs), `styles/` the CSS.
- **Data:** every panel reads `PlannerDataSource` (`data/PlannerDataSource.ts`). `ApiDataSource` implements it over the application's own API clients and query keys (`useApiDataSource`): standard ordering (no order) shows and moves real bookings, club planning (`pickOrder.start` in the router state, a `PickSession`) works on a LOCAL DRAFT of the order's windows and `finishPlan` makes the one real call. `DemoDataSource` (in-memory, nothing is written) is for tests and the lab. The board draws the clinic's real calendar (`boardCalendar.ts`, `realCalendar` in `BoardConfig`) on top of it.
- **Router state other screens hand over to `/planovani`:** `newAppointment` (+ `patientId`), `openClubOrder`, `date`, `serviceId`, `pickOrder` (`true` / `{ clubId, parent }` = setup form first, `{ start }` = planning, incl. `editSessionFor` edit sessions). `PlannerPage.calendar.test.tsx` pins each.
- **Lab:** `/planner-lab` (demo data; `?source=api` = our system, `?source=demo` on `/planovani` too; params are listed at the top of `PlannerLabPage.tsx`). Compare against the prototype at 1672x941; desktop (>= 1280) is the stage exactly as the file.
- **CSS port:** `src/planner/styles/planner.css` is GENERATED from the prototype by `node scripts/planner-scope-css.mjs` (everything scoped under `.sm-planner`; never edit by hand, `planner.css.test.ts` guards it). The same script wraps every cyan/aqua/teal colour as `hsl(from <old colour> var(--sm-hsl, h s l))` (`src/accent.ts`), so the desk's accent (Nastavení -> Osobní -> Vzhled) recolours the stage; without `--sm-hsl` the fallback is the identity = the prototype's own colours. A new cyan-range literal anywhere must be wrapped (`accentCss`, `accentLiteral(theme, ...)`) or come from the theme - `src/accent.guard.test.ts` fails otherwise; `node scripts/accent-check.mjs` clicks every swatch in a real browser. Hand-written additions go in `planner.extras.css` (and the compact/phone rules next to it); the icon sprite is regenerated with `node scripts/planner-icons.mjs`.
- **Rules:** in dark use `toneColors(theme, tone)` and `primary.contrastText`, never `DESIGN.tone.*` / `'#fff'` on `primary.main`; nothing the clinic owns (činnosti, prices, hours, colours) is a literal; a booking is moved/cancelled only through `AppointmentDetail` / the move confirmation (which can notify the patient), never by an in-memory edit.

## Shelf system (`src/ui/shelf`, everything staff except the calendar and the club planner)
Pages are `PageFrame`s of `Shelf`s (titled rows of cards with a count, "Zobrazit vše", loading / error / empty-with-the-next-action states); anything that names a patient, club, invoice, appointment, document or service is an `EntityChip` / `EntityLink` (one address in `entityTarget`, a peek on hover, plain text without the permission); the home has "Vyžaduje pozornost" (pure rules in `attention.ts`), the person has "Připnuté a nedávné" (ids and names only), and Ctrl/Cmd+K opens the command palette (a lazy chunk behind `components/UniversalSearch`). Read `docs/ui-shelf-system.md` (anatomy, usage, conversion checklist, the table of all 67 routes) before converting a page; `node scripts/shelf-check.mjs` verifies it in a real browser (own Chromium, screenshots in `design/shelf/`). Import primitives from `ui/shelf`; data shelves (`AttentionShelf`, `PatientRelated`) by their own path, never `peek.ts` into a card.

## Layouts and tests
Three layouts through `useDevice()` (phone ≤ 767, tablet 768–1279, desktop ≥ 1280). Tests call `setViewport` from `src/test/viewport.ts`. Touch targets are at least 44 px.

## Gotchas
- The Windows file watcher can miss an edit and Vite then serves the old module. If a compiling change does not show, `touch` the file or restart the dev server.
- Never leave a Playwright `page.route` mock active in the shared browser (`await page.context().unrouteAll()`); a stale mock once showed demo data as if it were real.
- Shell commands that carry Czech characters can arrive as the wrong encoding; send JSON from a UTF-8 file.
- Everything the clinic owns (prices, hours, wording) is a setting or a text slot (`src/site/slots/`), never a literal in a component.

## Git
Branch `claude/clean` is what Vercel builds. Push only to `bhaaddin/sportmedical-frontend` and verify the remote first.
