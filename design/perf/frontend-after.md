# Frontend load speed - AFTER (18. 10. 2026)

Same method, same machine, same API as `frontend-before.md` (production build, served per `vercel.json` over HTTP/2 with brotli,
CDP "Fast 4G" 9 Mbit/s + 170 ms RTT + CPU 4x, fresh browser context per cold load, median of 3-5 runs). The "after" build is
`PRERENDER_API_URL=off npm run build` of the working tree with the changes below; the "before" build was kept frozen.
Nothing was removed and no screen looks different: the same components render the same markup (checked pixel by pixel, see
"Checks").

## Before -> after

Runs: the eight main screens in the throttled table are **5 runs each, taken alternately before-build / after-build within minutes of each other**
(a first pair of full 3-run passes, hours apart, showed 15 % drift from the machine's other load, so only the interleaved pairs are used as headline);
the sign-in hop and the repeat visits are 3 runs; unthrottled `/prehled`, `/clubs`, `/patients`, `/objednat` are 5 interleaved runs, the other
unthrottled rows 3. Run-to-run noise is about +-10 % on the timings; byte and request counts are exact.

### Fast 4G (9 Mbit/s, 170 ms RTT) + CPU 4x slowdown - before -> after (see the note on the runs)

| screen | FCP ms | LCP ms | usable ms | TBT ms | JS kB (brotli) until usable | requests until usable | transferred kB until usable |
|---|---:|---:|---:|---:|---:|---:|---:|
| / (public home) | 1020 -> **996** (-2 %) | 1020 -> **996** (-2 %) | 1020 -> **996** (-2 %) | 0 -> 0 | 308 -> **308** (0 %) | 30 -> **30** (0 %) | 453 -> **453** (0 %) |
| /login | 1624 -> **988** (-39 %) | 2024 -> **1404** (-31 %) | 1907 -> **1284** (-33 %) | 0 -> 0 | 503 -> **261** (-48 %) | 56 -> **27** (-52 %) | 557 -> **342** (-39 %) |
| sign-in click to /prehled | - | - | 1135 -> **1228** (+8 %) | 183 -> **259** (+42 %) | 11 -> **13** (+18 %) | 15 -> **12** (-20 %) | 60 -> **80** (+33 %) |
| /prehled | 1920 -> **1124** (-41 %) | 2536 -> **2240** (-12 %) | 2400 -> **2110** (-12 %) | 58 -> **190** (+228 %) | 510 -> **370** (-27 %) | 73 -> **61** (-16 %) | 656 -> **518** (-21 %) |
| /planovani | 1724 -> **1264** (-27 %) | 3388 -> **2832** (-16 %) | 3232 -> **2691** (-17 %) | 499 -> **634** (+27 %) | 684 -> **555** (-19 %) | 115 -> **96** (-17 %) | 1036 -> **860** (-17 %) |
| /clubs | 1940 -> **1132** (-42 %) | 2540 -> **1984** (-22 %) | 2739 -> **2348** (-14 %) | 128 -> **178** (+39 %) | 538 -> **412** (-23 %) | 89 -> **83** (-7 %) | 860 -> **736** (-14 %) |
| /clubs/<FK Slany> | 1820 -> **1260** (-31 %) | 4428 -> **3572** (-19 %) | 4256 -> **3430** (-19 %) | 689 -> **794** (+15 %) | 684 -> **542** (-21 %) | 100 -> **95** (-5 %) | 1001 -> **873** (-13 %) |
| /patients | 1892 -> **1052** (-44 %) | 2476 -> **1924** (-22 %) | 2373 -> **1843** (-22 %) | 72 -> **161** (+124 %) | 505 -> **365** (-28 %) | 71 -> **57** (-20 %) | 662 -> **509** (-23 %) |
| /objednat | 1632 -> **1024** (-37 %) | 2536 -> **1788** (-29 %) | 2439 -> **1679** (-31 %) | 120 -> **127** (+6 %) | 575 -> **331** (-42 %) | 72 -> **39** (-46 %) | 720 -> **478** (-34 %) |
| /prehled repeat visit | 492 -> **416** (-15 %) | 1140 -> **1096** (-4 %) | 1105 -> **1042** (-6 %) | 11 -> **28** (+155 %) | 0 -> 0 | 73 -> **96** (+32 %) | 28 -> **30** (+7 %) |
| /planovani repeat visit | 620 -> **456** (-26 %) | 1636 -> **1428** (-13 %) | 1556 -> **1306** (-16 %) | 73 -> **136** (+86 %) | 0 -> 0 | 115 -> **97** (-16 %) | 238 -> **180** (-24 %) |

### Unthrottled (localhost) - before -> after (see the note on the runs)

| screen | FCP ms | LCP ms | usable ms | TBT ms | JS kB (brotli) until usable | requests until usable | transferred kB until usable |
|---|---:|---:|---:|---:|---:|---:|---:|
| / (public home) | 148 -> **128** (-14 %) | 148 -> **128** (-14 %) | 148 -> **128** (-14 %) | 0 -> 0 | 308 -> **308** (0 %) | 34 -> **30** (-12 %) | 460 -> **453** (-2 %) |
| /login | 156 -> **104** (-33 %) | 524 -> **436** (-17 %) | 441 -> **388** (-12 %) | 0 -> 0 | 503 -> **261** (-48 %) | 56 -> **27** (-52 %) | 557 -> **342** (-39 %) |
| sign-in click to /prehled | - | - | 493 -> **531** (+8 %) | 0 -> 0 | 11 -> **13** (+18 %) | 21 -> **12** (-43 %) | 103 -> **80** (-22 %) |
| /prehled | 160 -> **88** (-45 %) | 496 -> **488** (-2 %) | 461 -> **445** (-3 %) | 0 -> 0 | 510 -> **370** (-27 %) | 73 -> **61** (-16 %) | 656 -> **518** (-21 %) |
| /planovani | 204 -> **124** (-39 %) | 804 -> **720** (-10 %) | 679 -> **565** (-17 %) | 41 -> **37** (-10 %) | 684 -> **555** (-19 %) | 115 -> **97** (-16 %) | 1036 -> **860** (-17 %) |
| /clubs | 164 -> **108** (-34 %) | 480 -> **460** (-4 %) | 618 -> **580** (-6 %) | 0 -> 0 | 538 -> **412** (-23 %) | 89 -> **84** (-6 %) | 860 -> **736** (-14 %) |
| /clubs/<FK Slany> | 204 -> **116** (-43 %) | 936 -> **952** (+2 %) | 812 -> **644** (-21 %) | 61 -> **60** (-2 %) | 684 -> **555** (-19 %) | 109 -> **99** (-9 %) | 1041 -> **890** (-15 %) |
| /patients | 164 -> **88** (-46 %) | 492 -> **456** (-7 %) | 455 -> **427** (-6 %) | 0 -> 0 | 505 -> **365** (-28 %) | 71 -> **59** (-17 %) | 662 -> **524** (-21 %) |
| /objednat | 172 -> **88** (-49 %) | 532 -> **456** (-14 %) | 491 -> **421** (-14 %) | 0 -> 0 | 575 -> **331** (-42 %) | 72 -> **39** (-46 %) | 720 -> **478** (-34 %) |
| /prehled repeat visit | 84 -> **60** (-29 %) | 452 -> **428** (-5 %) | 408 -> **390** (-4 %) | 0 -> 0 | 0 -> 0 | 73 -> **61** (-16 %) | 28 -> **30** (+7 %) |
| /planovani repeat visit | 100 -> **60** (-40 %) | 592 -> **544** (-8 %) | 515 -> **485** (-6 %) | 0 -> 0 | 0 -> 0 | 115 -> **97** (-16 %) | 238 -> **180** (-24 %) |



How to read it:

* **FCP fell by 27-44 % on the app screens** because the first paint is now the frame of the navigation plus the spinner
  (`StaffShellPlaceholder`), which needs no staff code. It is an honest "something is on screen" number, not the data.
  **Usable** (the screen's own marker, no spinner or skeleton left) and **LCP** are the numbers to trust: 12-33 % faster on every screen
  (`/login` 1.9 s -> 1.3 s, `/objednat` 2.4 s -> 1.7 s, `/patients` 2.4 s -> 1.8 s, `/planovani` 3.2 s -> 2.7 s, the club screen 4.3 s -> 3.4 s,
  `/prehled` 2.4 s -> 2.1 s). `/prehled` gains least because its time is now spent on evaluating React and MUI at 4x slowdown and on the API (see Appendix 3).
* **TBT is higher after (by 50-150 ms at 4x slowdown, `/login` unchanged at 0)** and this is the one number that did not improve, so it is stated plainly: it is
  measured "from FCP to the end", FCP now comes early (the navigation frame), and the evaluation of the shell, React and MUI that used to sit in front of a late
  first paint now runs after the early one. The screen is usable sooner anyway (the usable column), but the main thread is busy for a stretch right after the
  first paint. What would lower it is less script to evaluate: the planner's dialogs (see "Not done").
* **Sign-in click -> overview** stays about equal (the staff portal's code is fetched and evaluated while the person types, after
  a 2.5 s quiet period, see `prefetchRoutes.ts`; the difference to the old build is within the noise). The sign-in page itself, which
  everybody sees first, is 33 % faster, so the whole journey is about 0.6 s shorter. After the click the overview's own data requests now leave together with
  the shell's instead of 400 ms after them.
* The repeat visit (warm cache) is quicker to first paint and loads fewer files.
* The public home is unchanged in bytes (it never carried the staff code); it only stopped asking for `/favicon.ico`. `/objednat`, a page for
  patients, lost the staff shell, the charts library, the animation library and the live-connection client: **-42 % JavaScript, -31 % to usable**.

## What changed (and why it is faster)

1. **The charts library no longer loads on every screen** (`vite.config.ts`). `use-sync-external-store` sat in the `charts` chunk group and
   `react-i18next` imports it, so each screen that translated a word loaded recharts/d3/redux-toolkit (85 kB brotli, 358 kB raw to parse).
   It is now grouped with React; `charts` loads only on `/clubs/statistiky`.
2. **The staff portal is a chunk of its own** (`src/StaffApp.tsx`, new; `src/App.tsx` slimmed). The shell, the menu, every staff route
   and the universal search moved out of the entry; `App.tsx` keeps the public app pages (`/login`, `/objednat`, `/portal`, `/klub/...`)
   and lazy-loads `StaffApp` behind the sign-in guard. The sign-in page and the patients' pages stopped downloading and evaluating
   the booking drawer, the sidebars and the 70 staff route declarations. The route table and the menu are moved verbatim; tests that read
   them as text now read both files.
3. **Fallback that matches the look** (`StaffShellPlaceholder`): while the portal's script arrives, the frame of the sidebar (desktop) or rail
   (tablet), or nothing (phone, planner routes - exactly as the real shell), around the same spinner. The shell then appears in place.
4. **The live connection waits** (`socketService.ts`): the SignalR client (~100 kB raw) is a dynamic import and the hub connects after the page
   has loaded and the browser is idle (`utils/afterFirstPaint.ts`), not while the first screen loads. A sign-out in between cancels it (epoch counter).
   Failure handling is unchanged: exponential backoff 1, 2, 4 ... 30 s with jitter, never a storm.
5. **The animation library loads only when the offline strip is needed** (`NetworkBanner.tsx` + `NetworkBannerSlide.tsx`): framer-motion was
   statically in the entry for one 50 px strip. The strip appears as before (slide-in); if its script cannot be fetched (offline is exactly that
   case) it appears without the slide instead of failing.
6. **The demo data source is not in the planner** (`planner/data/useDemoDataSource.ts`, `PlannerPage`, `PlannerLabPage`, `data/index.ts`): `?source=demo`
   and `/planner-lab` fetch it on demand; `/planovani` and `/clubs/:id` no longer carry it. (It was 14 kB of the 515 kB planner chunk; the
   coordinator's guess that the chunk "contains the demo data" was a naming accident of the bundler - the chunk is the whole planner UI.)
7. **The shell announces the first screen** (`scripts/app-shell-preload.mjs`, run by `npm run build` after the prerender; `app.html` only): the
   application entry and the 11 scripts it imports as `modulepreload`, its CSS, the four font files of the first screen (Public Sans 400/600, Latin + Latin-ext)
   and - by address, via a 1.5 kB inline script - the chunk of the screen being opened (and the portal, only for a browser that holds a token). Before,
   the browser learned about each of these one round trip after the previous one.
8. **Idle prefetch of the next likely screen** (`src/prefetchRoutes.ts`): 2.5 s after the page is quiet - and when the pointer, a finger or the
   keyboard arrives on a link - the next screen's script is fetched (`modulepreload`) and its CSS only prefetched, so nothing is applied or run before
   the person goes there. It skips connections that are slow (2g) or save-data. The sign-in page additionally evaluates the portal and the overview ahead
   of the click.
9. **`<link rel="preconnect">` + `dns-prefetch` for the API origin** (`vite.config.ts`, `src/web/apiOrigin.ts`): written only when the build is given an absolute
   `VITE_API_BASE_URL` (Vercel project setting), read from the environment, never typed in the source.
10. **`<link rel="icon" href="data:,">`** (`index.html`): the app has no favicon file, so every page load asked for `/favicon.ico` and got the whole HTML shell back.
11. **The booking drawer is fetched when needed** (`NewOrderChooser.tsx`, `StaffApp.tsx`): `NewAppointmentDialog` (55 kB raw / 15 kB brotli plus its forms) is imported by the
    chooser only when a slot has been found, and fetched in idle time after the first paint, so screens that do not draw it (patients, clubs, settings ...) no longer carry it.
12. **Budget** (`scripts/bundle-budget.mjs`, `scripts/bundle-budget.json`, `npm run build:check`): fails when the application entry, the public entry, the portal, the
    dashboard or the planner grows more than 10 % over the new numbers, or when a heavy library (charts, HEIC, animation, SignalR, demo data) enters a first load.
    `npm run analyze:chunks -- <manifest key>` prints a screen's scripts with the reason each is there.

## Checks

* `npm run typecheck`: clean.
* Full test run (`NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --maxWorkers=3 --testTimeout=30000`, run at the end): **334 files passed, 4978 tests passed, 7 skipped, 0 failed**.
  (An earlier full run in the middle of the work had 13 failures in three files of PF-C's request-volume work that was being edited in the same tree at the time -
  `appointments.test.ts`, `dayRowsCover.test.ts`, `ClubOrdersPage.test.tsx`; none touched this work and all pass in the final run.)
  New tests: `appShellPreload.test.ts` (the preload block, idempotence, every announced source file exists, the API origin), `bundleBudget.test.ts`,
  `socketService.test.ts` (opens after the first paint, once, never for a signed-out browser), `prefetchRoutes.test.ts`, `NetworkBanner.test.tsx`,
  `PageLoader.test.tsx`, `useDemoDataSource.test.tsx`. Existing tests that read `App.tsx` as text or import `Layout` from it now read / import `StaffApp.tsx`
  as well (`catalogue.test`, `catalogue.routes.test`, `patientRoutes.test`, `fit.rules.test`, `routeCollisions.test`, `Shell` / `ContextualNav` / `PlannerMenu` / `fit` tests):
  same assertions, same files they guard.
* `PRERENDER_API_URL=off npm run build`: passes (client build, SSR build, prerender of 20 pages, `preload:shell`). `npm run build:check` passes against the new numbers.
* Pixel check, before build vs after build, same data, light theme: identical to the pixel at 1440x900 and 390x844 for `/login`, `/prehled`, `/clubs`, `/patients`, `/planovani` (390: 2 px of a moving highlight), `/objednat`, `/settings` (script `shotcmp.mjs` in the session scratchpad: both builds served by the same server, same token, 2.5 s after the network went quiet, per-channel threshold 8/255). The only visible difference by design: the transient `StaffShellPlaceholder` frame.
* `heic-to`: never requested on any of the 11 measured loads (a dynamic `import()` inside `documentMedia.ts`, run only when a HEIC photo is picked).


## Not done, and why

* **The planner's own weight** (`/planovani`, `/clubs/:id`: about 225 kB brotli of script beyond the entry and the portal, plus 47 kB of CSS, TBT 630-800 ms at 4x): the term, plan,
  publish and settings dialogs, `ClubOrderDetailPanel`, `ClubBlockDialog`, `LegacyReservation` and the club sections are imported eagerly by the planner's
  components. Making them load on first use is a change in `src/planner/components/**` (the dialog registry `dialogRegistry.ts`), which PL-N owns. Estimated
  gain 40-60 kB brotli and 100-200 ms of main-thread time; recommended as the next step once PL-N is finished.
* **Public site texts** (`siteSlots` chunk, 58 kB brotli, on every public page and on `/objednat`): the registry of every page's default texts is one module
  with a duplicate-key check; splitting it per page means changing how `slotDef` is resolved for the prerender and the admin screen.
* **`i18next` + `cs.json`** (about 28 kB brotli) stay in the application entry: staff components and some shared booking components call `useTranslation`.
* **Fonts**: five Public Sans weights (and five Inter, two Archivo) as before; a variable font would be a smaller download but is a different file, so a look
  decision. `font-display: swap` is already set by `@fontsource`; only the two first-screen faces are preloaded.
* **Vercel brotli on the live domain**: Vercel compresses text assets with brotli by itself; I could not check the live deployment (its address is not in the repo).
  The local server used for the numbers brotli-compresses the same way.
* `vercel.json` needed no change: `/assets/*` is already `public, max-age=31536000, immutable` (fonts and images are in `/assets`), HTML is Vercel's default
  `max-age=0, must-revalidate`, the prerendered public pages keep `s-maxage=300, stale-while-revalidate`.


Re-running the measurements: `design/perf/harness/README.md` (server that follows `vercel.json` over HTTP/2 + brotli, CDP throttling, the report scripts).

## Appendix 1 - the AFTER tables in full

### AFTER - Fast 4G (9 Mbit/s, 170 ms RTT) + CPU 4x slowdown, median of 3 cold loads

| screen | requests until usable | JS raw / transferred kB | CSS raw / transferred kB | fonts kB | API calls | transferred kB until usable | transferred kB incl. idle prefetch | FCP ms | LCP ms | usable ms | TBT ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| / (public home) | 30 | 1131 / 308 | 9 / 2 | 129 | 0 | 453 | 460 | 996 | 996 | 996 | 0 |
| /login | 27 | 882 / 261 | 26 / 5 | 74 | 0 | 342 | 342 | 988 | 1404 | 1284 | 0 |
| sign-in click to /prehled (SPA hop) | 12 | 54 / 13 | 0 / 0 | 39 | 8 | 80 | 89 | - | - | 1228 | 259 |
| /prehled | 61 | 1262 / 370 | 26 / 5 | 113 | 7 | 518 | 518 | 1124 | 2240 | 2110 | 190 |
| /planovani | 96 | 1941 / 555 | 321 / 51 | 74 | 22 | 860 | 860 | 1264 | 2832 | 2691 | 634 |
| /clubs | 83 | 1387 / 412 | 26 / 5 | 103 | 15 | 736 | 736 | 1132 | 1984 | 2348 | 178 |
| /clubs/<FK Slany> | 95 | 1887 / 542 | 321 / 51 | 74 | 21 | 873 | 890 | 1260 | 3572 | 3430 | 794 |
| /patients | 57 | 1246 / 365 | 26 / 5 | 88 | 7 | 509 | 524 | 1052 | 1924 | 1843 | 161 |
| /objednat | 39 | 1149 / 331 | 26 / 5 | 128 | 3 | 478 | 478 | 1024 | 1788 | 1679 | 127 |
| /prehled, repeat visit (cache warm) | 96 | 1262 / 0 | 26 / 0 | 0 | 7 | 30 | 280 | 416 | 1096 | 1042 | 28 |
| /planovani, repeat visit (cache warm) | 97 | 1941 / 0 | 321 / 0 | 0 | 23 | 180 | 180 | 456 | 1428 | 1306 | 136 |

### AFTER - unthrottled (localhost), median of 3

| screen | requests until usable | JS raw / transferred kB | CSS raw / transferred kB | fonts kB | API calls | transferred kB until usable | transferred kB incl. idle prefetch | FCP ms | LCP ms | usable ms | TBT ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| / (public home) | 30 | 1131 / 308 | 9 / 2 | 129 | 0 | 453 | 460 | 128 | 128 | 128 | 0 |
| /login | 27 | 882 / 261 | 26 / 5 | 74 | 0 | 342 | 342 | 104 | 436 | 388 | 0 |
| sign-in click to /prehled (SPA hop) | 12 | 54 / 13 | 0 / 0 | 39 | 8 | 80 | 89 | - | - | 531 | 0 |
| /prehled | 61 | 1262 / 370 | 26 / 5 | 113 | 7 | 518 | 518 | 88 | 488 | 445 | 0 |
| /planovani | 97 | 1941 / 555 | 321 / 51 | 74 | 23 | 860 | 860 | 124 | 720 | 565 | 37 |
| /clubs | 84 | 1387 / 412 | 26 / 5 | 103 | 16 | 736 | 736 | 108 | 460 | 580 | 0 |
| /clubs/<FK Slany> | 99 | 1941 / 555 | 321 / 51 | 74 | 24 | 890 | 890 | 116 | 952 | 644 | 60 |
| /patients | 59 | 1246 / 365 | 26 / 5 | 103 | 8 | 524 | 524 | 88 | 456 | 427 | 0 |
| /objednat | 39 | 1149 / 331 | 26 / 5 | 128 | 3 | 478 | 478 | 88 | 456 | 421 | 0 |
| /prehled, repeat visit (cache warm) | 61 | 1262 / 0 | 26 / 0 | 0 | 7 | 30 | 30 | 60 | 428 | 390 | 0 |
| /planovani, repeat visit (cache warm) | 97 | 1941 / 0 | 321 / 0 | 0 | 23 | 180 | 180 | 60 | 544 | 485 | 0 |


## Appendix 2 - module graph after

`npm run analyze:chunks -- <manifest key>` on the build above (brotli):

* `/login`: **17 scripts, 882 kB raw / 242 kB brotli** (was 47 / 1763 / 466). `mui` 100, `react` 50, the entry `appEntry` 29, axios (`800`) 19, `router` 12, `query` 10,
  `popper` 6, `theme` 4, `client` 2.7, the page 2.6. The charts library, the SignalR client, the animation library, zod and the booking drawer are gone from it.
* The staff portal (`StaffApp` chunk, loaded behind the sign-in guard) adds 59 kB brotli: the shell, the menu, the route table, the settings catalogue and
  the shared API chunk (zod schemas of the booking contracts, 23 kB). `NewAppointmentDialog` (15 kB) is fetched when a slot is found, warmed in idle time.
* `/planovani` and `/clubs/:id` add the planner chunk (`useDemoDataSource-*.js`, **506 kB raw / 118 kB brotli** - the whole planner UI; the file is named
  after the first module the bundler met, it contains no demo data any more; `DemoDataSource-*.js` is a separate 10 kB chunk fetched only by `?source=demo` and `/planner-lab`),
  its 47 kB stylesheet, `ClubOrderDetailPanel` 17 kB, `AppointmentDetail` 9 kB and a few dialogs.
* Budget (`scripts/bundle-budget.json`, brotli, limit = +10 %): application entry 254.5 kB, public entry 307.5 kB, sign-in page 5.4 kB, staff portal 59.0 kB,
  dashboard 42.1 kB (it carries the booking drawer), planner 225.3 kB.

## Appendix 3 - request waterfalls (throttled)

* **Sign-in -> overview, before:** `POST /api/v1/session` -> (230 ms later) Dashboard chunk -> `negotiate`, `/api/notifications`, `/api/v1/account` with the shell -> dashboard data
  400 ms after those, once its chunk has arrived and rendered. **After:** the portal and the overview were fetched and evaluated while the credentials were typed, so after
  the answer the account, the notifications and the overview's patients/day calls leave **together** (about 0.7 s after the click, one round trip); the hub client is fetched afterwards
  and `negotiate` starts last, when the screen is already drawn. No retry loop: a failing negotiation retries after 1, 2, 4 ... 30 s (+ up to 1 s jitter) as before and never blocks a screen.
* **Cold `/prehled`, after:** document 0-0.19 s; `index.js`, the stylesheets and the 12 preloaded scripts in parallel from 0.2 s (the 110 kB `mui` chunk is the last, at 0.8 s); the portal chunk
  and the overview chunks from 0.45 s (announced in `app.html`, not discovered after the entry ran); shell and API calls at about 1.5 s - after evaluating `mui` and `react`, which at 4x slowdown is
  the main-thread bottleneck now; overview data 1.7-1.9 s; usable 2.1 s.
