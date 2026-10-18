# Frontend load speed - BEFORE (18. 10. 2026, branch `claude/clean` at `ba6e4cf` + the uncommitted planner work of that day)

Measured on the production build (`PRERENDER_API_URL=off npm run build`) served exactly as `vercel.json` says (rewrites,
cache headers, brotli, **HTTP/2** - a first run over HTTP/1.1 was discarded: its 6-connections-per-host limit queued
the 70-100 small scripts and made every number look worse than Vercel would), against the live dev API on :5092
(PostgreSQL `sportmedical_dev`). Headless Chromium (Playwright 1.63 / Chromium 1243), a fresh browser context for every cold
load (empty HTTP cache), 1440x900, median of 3 runs.

* **Throttled** = Chrome DevTools Protocol `Network.emulateNetworkConditions` 9 Mbit/s down+up, 170 ms RTT ("Fast 4G")
  and `Emulation.setCPUThrottlingRate` 4x. **Unthrottled** = localhost.
* FCP/LCP: PerformanceObserver (`paint`, `largest-contentful-paint`). **Usable** = the screen-specific marker is on the page
  AND no `MuiSkeleton`/`MuiCircularProgress`/`aria-busy` is left: `/prehled` the greeting heading, `/planovani` and the
  club screen `[data-testid=board-body]`, `/clubs` the first club card, `/patients` the first table row, `/login` the
  submit button, public pages the `h1` (they are prerendered, so usable = FCP). **TBT** = sum of (long task - 50 ms) from
  FCP to usable (`longtask` observer).
* Bytes: raw = decoded body, transferred = bytes on the wire (brotli) from `Network.loadingFinished`; "until usable" counts
  only requests started before max(FCP, LCP, usable) - later ones (the idle prefetch added by this work, the live
  hub) are in the last bytes column.
* The sign-in row is the SPA hop only: `/login` already open, credentials typed, from the click on "Přihlásit se" to the
  overview being usable.
* The API answers from localhost (about 20-30 ms per call), so the API share of each load is smaller than from Render;
  the numbers show what the frontend itself costs. Other agents were changing the backend and request volume at the same
  time (PF-B, PF-C); the API-call column is whatever the frozen `dist-before` build asked for.

Raw measurements (JSON, request lists with start/end times): kept in the session scratchpad, not committed.

### BEFORE - Fast 4G (9 Mbit/s, 170 ms RTT) + CPU 4x slowdown, median of 3 cold loads

| screen | requests until usable | JS raw / transferred kB | CSS raw / transferred kB | fonts kB | API calls | transferred kB until usable | transferred kB incl. idle prefetch | FCP ms | LCP ms | usable ms | TBT ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| / (public home) | 30 | 1130 / 308 | 9 / 2 | 129 | 0 | 453 | 460 | 1020 | 1020 | 1020 | 0 |
| /login | 56 | 1763 / 503 | 26 / 5 | 49 | 0 | 557 | 557 | 1624 | 2024 | 1907 | 0 |
| sign-in click to /prehled (SPA hop) | 15 | 30 / 11 | 0 / 0 | 25 | 5 | 60 | 103 | - | - | 1135 | 183 |
| /prehled | 73 | 1785 / 510 | 26 / 5 | 113 | 7 | 656 | 656 | 1920 | 2536 | 2400 | 58 |
| /planovani | 115 | 2439 / 684 | 321 / 51 | 64 | 36 | 1036 | 1036 | 1724 | 3388 | 3232 | 499 |
| /clubs | 89 | 1874 / 538 | 26 / 5 | 103 | 16 | 860 | 860 | 1940 | 2540 | 2739 | 128 |
| /clubs/<FK Slany> | 100 | 2439 / 684 | 321 / 51 | 64 | 20 | 1001 | 1041 | 1820 | 4428 | 4256 | 689 |
| /patients | 71 | 1769 / 505 | 26 / 5 | 103 | 8 | 662 | 662 | 1892 | 2476 | 2373 | 72 |
| /objednat | 72 | 2035 / 575 | 26 / 5 | 128 | 3 | 720 | 720 | 1632 | 2536 | 2439 | 120 |
| /prehled, repeat visit (cache warm) | 73 | 1785 / 0 | 26 / 0 | 0 | 7 | 28 | 28 | 492 | 1140 | 1105 | 11 |
| /planovani, repeat visit (cache warm) | 115 | 2439 / 0 | 321 / 0 | 0 | 36 | 238 | 238 | 620 | 1636 | 1556 | 73 |

### BEFORE - unthrottled (localhost), median of 3

| screen | requests until usable | JS raw / transferred kB | CSS raw / transferred kB | fonts kB | API calls | transferred kB until usable | transferred kB incl. idle prefetch | FCP ms | LCP ms | usable ms | TBT ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| / (public home) | 34 | 1130 / 308 | 9 / 2 | 129 | 4 | 460 | 460 | 148 | 148 | 148 | 0 |
| /login | 56 | 1763 / 503 | 26 / 5 | 49 | 0 | 557 | 557 | 156 | 524 | 441 | 0 |
| sign-in click to /prehled (SPA hop) | 21 | 30 / 11 | 0 / 0 | 64 | 8 | 103 | 103 | - | - | 493 | 0 |
| /prehled | 73 | 1785 / 510 | 26 / 5 | 113 | 7 | 656 | 656 | 160 | 496 | 461 | 0 |
| /planovani | 115 | 2439 / 684 | 321 / 51 | 64 | 36 | 1036 | 1036 | 204 | 804 | 679 | 41 |
| /clubs | 89 | 1874 / 538 | 26 / 5 | 103 | 16 | 860 | 860 | 164 | 480 | 618 | 0 |
| /clubs/<FK Slany> | 109 | 2439 / 684 | 321 / 51 | 64 | 29 | 1041 | 1041 | 204 | 936 | 812 | 61 |
| /patients | 71 | 1769 / 505 | 26 / 5 | 103 | 8 | 662 | 662 | 164 | 492 | 455 | 0 |
| /objednat | 72 | 2035 / 575 | 26 / 5 | 128 | 3 | 720 | 720 | 172 | 532 | 491 | 0 |
| /prehled, repeat visit (cache warm) | 73 | 1785 / 0 | 26 / 0 | 0 | 7 | 28 | 28 | 84 | 452 | 408 | 0 |
| /planovani, repeat visit (cache warm) | 115 | 2439 / 0 | 321 / 0 | 0 | 36 | 238 | 238 | 100 | 592 | 515 | 0 |

## Where the bytes and the time go (module graph)

Static import closure of what a screen needs before it can run (`node scripts/chunk-report.mjs <manifest key>` on the
build above; brotli sizes):

**`/login` - 47 scripts, 1763 kB raw / 466 kB brotli** for one form and a button.

| script | brotli kB | why it is there |
|---|---:|---|
| `appEntry` | 103 | `App.tsx` imported the **whole staff shell** statically (sidebar, tablet rail, phone shell, account menu, the "Nová objednávka" booking drawer `NewAppointmentDialog` + `NewOrderChooser`, `UniversalSearch`, the settings catalogue, `NetworkBanner` with **framer-motion**, ~340 modules) |
| `mui`, `react`, `router`, `query`, `800` (axios), `popper`, `theme` | 100 / 50 / 12 / 10 / 16 / 6 / 4 | the framework; needed |
| **`charts`** (recharts, d3, redux toolkit, immer, es-toolkit ...) | **85** | **a chunking bug**: `vite.config.ts` put `use-sync-external-store` into the `charts` group, and `react-i18next`'s `useTranslation` imports it, so every screen that translates a string (the shell does) dragged the whole charts library, plus `ClubStatsPage` (18 kB) and its API modules, into the first load. The charts are used by one screen (`/clubs/statistiky`) |
| `schemas` (zod) + ~25 tiny API/contract chunks | 19 + ~25 | the shell and `NewAppointmentDialog` import API clients, which import their zod schemas |
| `client` | 14 | axios setup **plus the SignalR client (~100 kB raw)**, imported statically by `socketService` from `api/client.ts` |
| `Login` | 2.6 | the page itself |

**`/planovani` and `/clubs/:id`** add `PlannerPage` (10 kB raw), `ClubPlannerPage` and **one 515 kB raw / 131 kB brotli
chunk named `DemoDataSource-*.js` plus a 300 kB raw / 47 kB brotli stylesheet**. The name is misleading: it is the whole
planner UI (176 modules: `BoardSurface`, the term and plan dialogs, `ApiDataSource`, `PlanningCarousel`, club sections,
`ClubBlockDialog` ...). `DemoDataSource.ts` + `demoFixtures.ts` are only 14 kB of it, but `PlannerPage` and `PlannerLabPage` imported
them statically, so production shipped them. Also in the closure: `ClubOrderDetailPanel` 18 kB, `AppointmentDetail` 9 kB.

Checked and fine: **`heic-to` (2.9 MB raw / 719 kB gz) is a dynamic `import()` inside `documentMedia.ts`**, requested by no
page load in any of the 11 measured loads. `@mui/icons-material`: 137 modules / 52 kB rendered, i.e. tree-shaken (the
barrel import in `App.tsx` costs nothing in the build). No second date or chart library (`recharts` only; no moment/dayjs/date-fns).
`siteSlots` (230 kB raw / 58 kB brotli: every public page's default texts) loads on the public site and `/objednat` only.
`charts` was the only misplaced heavy library; `framer-motion` (only `NetworkBanner` uses it) and `@microsoft/signalr`
were in the entry.

Request chain of a cold staff page (throttled, `/planovani`, times from the start of the navigation): HTML 0-0.19 s -> `index.js`
(5 kB) 0.22-0.41 s -> only then `appEntry` and its ~40 dependencies 0.43-1.1 s -> evaluating them (the main thread is the
bottleneck at 4x slowdown) -> only then the route's chunk, requested at **1.66 s**, and the 515 kB planner chunk and its stylesheet
(done at 2.08 s) -> first API call (`/api/v1/account`, from the shell) at 1.8 s, the board's data later (3-3.8 s). Each
hop is a round trip of 170 ms plus the time to evaluate the module before the next `import()` can run.

Sign-in chain (throttled): `POST /api/v1/session` (0.2 s) -> Dashboard chunk requested 230 ms after the answer -> hub
`negotiate`, `/api/notifications`, `/api/v1/account` start with the shell at 0.56 s (the hub negotiation competes with the
first screen) -> the dashboard's own data only at 1.07 s, after its chunk has arrived and rendered.
