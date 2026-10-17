# Planner rebuild — shared brief (read first)

Repo `C:\Users\Matko\sportmedical-frontend`, branch `planner/new-look` (checked out; never switch branches, never
commit/stash/checkout/reset — the coordinator commits). Several agents work in the same tree at once: edit ONLY the
files you own (listed in your task). Shared files (`src/planner/state/plannerState.ts`, `model/types.ts`,
`components/PlannerShell.tsx`, `components/dialogRegistry.ts`): additive edits only (append, never reorder or rename),
re-read the file right before editing, say in your report what you added.

## What the owner wants (17.–18. 10. 2026, his words, translated)
Take the partner's finished design `design/planner-v65.html` (also served at http://127.0.0.1:8799/planner-v65.html,
render at 1672×941) and put it into our code: "remove our CSS, add the new CSS and make it work — make the new CSS with
its buttons connected to our system"; "the calendar functions also for standard ordering", and "when I plan for clubs
you see the whole planner interface"; "absolutely everything down to the last thing, connected — functions and front
end"; "make sure all the functions work"; "no extra bullshit, only what's inside". So: the file's look and layout
exactly, every button of it wired to OUR existing logic and data. Do not invent features; do not rebuild logic that
already works in our system — bind to it. Where the file has something our system lacks, build it from the file.
Where our system has something the file lacks but it is part of everyday booking (book a patient, block time, move a
booking and tell the patient, appointment detail, prices), keep it, drawn in the file's language.

## What already exists (built by PL-A, committed — read `src/planner/**` before you start)
- `src/planner/model/*` pure functions pinned against ~700 answers of the prototype (rings, week geometry, placement
  validation, move/resize proposals, carousel maths, mini-calendar flyout state machine). Reuse the UI maths; do NOT
  wire the prototype's own demo persistence (merge/create/commit functions, `plannedFrom`/`totals`, `bookingState`…)
  where our system already does it: real seats/merge/create/move belong to `clubOrdersApi`, `appointmentsApi`,
  `src/components/booking/calendar/pickPlan.ts` (per-činnost counter, sequential plan, split, trim), `usePickOrder`.
- `src/planner/state/*` the store (`usePlannerSelector`, `usePlannerActions`, `usePlannerModel`), 
  `src/planner/data/PlannerDataSource.ts` the interface (+ `DemoDataSource` for tests/lab, `PlannerDataProvider`),
  `src/planner/styles/planner.css` (the file's CSS, scoped under `.sm-planner`; `planner.extras.css` hand-written),
  `components/PlannerStage` (1672×941 scaled to fit, provides the scale), `components/PlannerShell` + one stub file per
  panel with the file's ids/classes/`data-testid`s, `PlannerLabPage` at `/planner-lab`.
- PL-I restyled the app theme/shell/clubs dark to the file's palette. In dark use `toneColors(theme, tone)` and
  `primary.contrastText`, never `DESIGN.tone.*`/`DESIGN.paper`/`'#fff'` on `primary.main`.
- Our system pieces to bind to (find them, read them): `src/api/appointments.ts` (`range`, `createQuick`,
  `reschedule(…, {notifyPatient})`, `setPrice`, blocks), `bookingContracts.ts`, `clubOrders.ts`, `clubs.ts` (club +
  `management`), `clubBlocks.ts`, `clinicServices.ts`, `displaySettings.ts` (holiday/lunch colours), `ares.ts`;
  `src/components/booking/NewAppointmentDialog.tsx` (bubble with `anchor`), `AppointmentDetail.tsx`,
  `calendar/MoveConfirmDialog.tsx`, `grid/moveDrag.ts`, `grid/appointmentPrice.ts`, `price/agreedPrice.ts`,
  `calendar/pickPlan.ts`, `usePickOrder.ts`, `PickShortfallDialog.tsx`, `AddToClubOrderDialog.tsx`,
  `grid/clubWindows.ts` (`drawnBlocksOfDay`: one block across lunch), `src/components/clubs/order/orderFormat.ts`
  (`formatCzk`), `clubs/orders/orderMoney.ts`, `clubs/order/editSession.ts`.

## Rules
- Czech UI (turn the prototype's Slovak strings into Czech). Nothing the clinic owns is a literal: činnosti, prices,
  colours, hours, wording come from the API/settings (the prototype's 6 demo categories exist only as test fixtures).
  Money through `formatCzk`; "bez ceny" when none. Constitution (`.specify/memory/constitution.md`): the desk decides,
  nothing trimmed or filled silently; a club order is one thing (windows of one order, edits one call); birth/insurance
  numbers never shown or logged; moves of a booking ask first and can notify the patient.
- Desktop (≥1280) = the stage exactly as the file. Phone/tablet are a LATER phase: do not design them, but keep your
  components free of hard-coded pixel assumptions that the stage `compact` flag could not override later.
- Accessibility: keyboard reachable, focus visible, `aria-label`s (the file has Czech/Slovak ones — keep, fix to Czech),
  touch targets are for the later phase.
- Tests: vitest next to the code (`src/planner/**`), `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run <paths>
  --maxWorkers=3`; `npm run typecheck` must be clean when you finish (if it fails only in another agent's file, say so).
- Verify visually and functionally in YOUR OWN headless Chromium (a Playwright script from the scratchpad; the shared MCP
  browser pane is driven by other agents — do not use it): `/planner-lab` against the prototype at 1672×941, pixel
  geometry and screenshots (save as `pl-<yourid>-*.png` in the repo root, they are evidence, not committed). The dev
  stack is up: frontend :3000, API :5092; sign in at /login as admin@sportmedical.cz (the dev-only password is in
  `C:\Users\Matko\SportMedical.Booking\.dev-login.txt`). Once PL-F's `ApiDataSource` exists (check
  `src/planner/data/ApiDataSource.ts`) also run the lab with `?source=api` against the real dev API and say what you saw.
  Never leave a `page.route` mock active in a shared browser; never move real data without need (the dev DB is
  throwaway, but do not delete clubs/orders you did not create).
- Report (last message): files changed, tests run with counts, what you saw (per function), decisions, notDone,
  notesForIntegrator. Be exact about what is verified and what is not.
