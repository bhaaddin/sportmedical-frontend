# Club screen (`/clubs/:clubId`) - loading speed, before / after

Measured 2026-10-21 with `scripts/club-planning/speed.mjs` (own headless Chromium, 1440x900, CDP network events,
**80 ms added to every `/api/` request** before it leaves the browser - a live-like round trip, the same before and
after), club **FK Slaný** (13 orders) on the dev API (:5092), 5 runs per variant after one warm-up run, medians.
Raw runs (every request's start/end, level, status): `design/club-planning/speed-{before,after}.json` (Vite dev server)
and `speed-build-{before,after}.json` (production build, `vite build`, served as static files with `/api` proxied).
Before = `claude/clean` @ 11a6dc9; after = branch `claude/club-speed`.

* **ready** - the stage is drawn with its data: `.sm-planner #day-board`, no `club-planner-loading`, no `planner-loading`
  (ms from the `goto` / from the click).
* **depth** - the longest chain of API calls where each starts only after the previous one answered (6 = six round
  trips in a row). Requests = API calls of the opening (incl. the shell's notifications on a cold load).

## Production build (the shape live has)

| Variant | ready before | ready after | API requests | depth (before ready) | duplicates |
|---|---|---|---|---|---|
| cold deep link `/clubs/:id` | 842 ms | **520 ms** | 25 -> 24 | 4 -> **2** | 0 -> 0 |
| from `/clubs`, click at once | 1015 ms | **463 ms** | 19 -> 17 | 5 -> **1** | 0 -> 0 |
| from `/clubs`, pointer rests on the card first | 795 ms | **462 ms** | 19 -> 17 | 4 -> **1** (all answered before the click) | 0 -> 0 |

## Vite dev server (:3132, as instructed; module loading dominates a cold load here)

| Variant | ready before | ready after | API requests | depth (before ready) |
|---|---|---|---|---|
| cold deep link | 2093 ms | **1774 ms** | 25 -> 24 | 5 -> 2 |
| click at once | 1068 ms | **498 ms** | 19 -> 17 | 5 -> 2 |
| pointer rests first | 861 ms | **502 ms** | 19 -> 17 | 4 -> 2 |

What is left after the click (~360 ms to the shell) is code + first render of the planner, not the network: the API is
done at 176 ms (click at once) or before the click (pointer rested).

## The waterfall

Before (production build, cold, median run) - the chain the network analysis described (section 3.3):

```
115  W1  club, club-orders?clubId, club-blocks, calendars, activities, services, settings x2, holidays, clinic
392  W2  account                                   (after the shell had drawn)
413  L2  club-orders/{id}                          (the stage's data source loads the order)
521  L3  calendars/{id}/preview  (the order's day) (needs the order)
617  L4  club-blocks + preview + day + blocks of the visible range (needs the preview)
843  L5  club-orders (unfiltered, board inquiries) + 3 previews + day of the board's week   <- after "ready"
```

After (production build, cold, median run):

```
138  L1  club, club-orders?clubId, club-blocks, calendars, activities (+ the catalogue: same request), services,
         settings x2, holidays, clinic, account
256  L2  the order (club-orders/{id}), its days + the visible range + the look-ahead (ONE preview request per calendar:
         merged), day, blocks, club windows, the board week (3 previews + day), the inquiries (club-orders)
     ready 520 ms - the club screen's loading state never shows
```

From the club list (click at once), everything is one wave at the click: the club and its orders are taken from the
list's own answers (`/api/clubs`, unfiltered `club-orders` - verified identical to `/api/clubs/{id}` and
`club-orders?clubId=`), so the stage's reads start at once; the two filtered reads still run once, behind.

## What changed

* **Stage reads in parallel** (`src/planner/club/clubStageReads.ts`): from the orders and the calendar list alone the
  stage's every read is worked out and started together, through the data source's own deps / the board's keys:
  the order, the preview of its days, day + blocks + club windows + previews of the visible range, the 28-day look-ahead,
  holidays, the board's week (every active calendar), the inquiries. Pinned by a test that runs the real `ApiDataSource`
  against recording deps and compares its reads with the plan.
* **Route entry** (`useClubPlannerData`, `warmReads.prefetchClubScreen`): club, orders, club windows, the činnost
  catalogue (shares `/api/activities` with the reference read), reference data and settings start at once; a deep link
  also starts the account read (`/api/v1/account`) and the screen's code; `?order=` and the router-state window are honoured.
* **Seeded from what is already here**: the club and its orders from the club list's answers (each still asked once in
  the background - an identical answer changes nothing); the board's inquiries from the list's unfiltered orders (one
  request fewer); the data source's first order read from a current answer of `club-orders/{id}` or, else, from the
  order's row in a current list - the list row equals the single read except `history`, which the stage does not use
  (checked against the dev API by the script: `orderFieldsDiffer: ["history"]`). The single read always runs behind it; a
  disagreement in anything but `history` rebuilds the data source from the real answer.
* **Warm-up on the card**: pointer rest (200 ms, `HOVER_INTENT_MS`) or focus starts the reads AND the lazy route chunk; a
  click before the rest warms at once.
* **Duplicates**: none before or after (the HTTP layer already shares identical in-flight GETs, `requestPolicy.ts`; the
  preview cover merges ranges of one calendar). After: the board's second unfiltered `club-orders` is gone (shared), the
  separate preview of the order's day is merged into the range's preview.
* **Skeleton**: the loading box has the planner page's exact size (no jump); on a cold load it no longer shows at all.
* **Bundle**: within budget (app-entry 257.9 kB, public-entry 317.8 kB, planner 237.5 kB brotli). `@popperjs` got an
  explicit vendor group in `vite.config.ts`: with the new import graph the bundler had merged it into an app chunk that
  the `mui` chunk then imported (+45 kB in the public and app entries).

No new backend endpoint; every early read fails silently and the screen asks again.
