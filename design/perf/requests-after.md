# API requests per screen — AFTER (PF-C, 2026-10-18)

Same script, same 37 steps, same dev stack as `requests-before.md`, run against the working tree of `claude/clean` with the
changes below (Vite dev server on :3000). The "before" column is `HEAD` (`ba6e4cf`) served from a separate dev server.
Scripts and the two raw result files are in `design/perf/measure/` (`node run.mjs <label>` with `BASE=http://localhost:3000`;
`node cmp.mjs before after` prints the table; the paths at the top of `lib.mjs` point at this machine's Playwright).

**462 -> 197 requests (-57 %), 75 -> 0 exact duplicates, 3.65 MB -> 1.79 MB of response bodies (-51 %)** over the session.
The dev API is local, so this is request count and bytes, not milliseconds; on Vercel -> Render every removed round trip is
real time and one request less against the 100-a-minute limit.

## Before / after per step

| # | Screen / step | Req before | Req after | Dup before | Dup after | KB before | KB after |
|---|---|---:|---:|---:|---:|---:|---:|
| 01 | sign-in -> /prehled (cold) | 11 | 7 | 4 | 0 | 50 | 27 |
| 02 | /planovani cold load | 37 | 22 | 2 | 0 | 257 | 176 |
| 03 | planner: next week | 9 | 0 | 0 | 0 | 15 | 0 |
| 04 | planner: previous week (back, should be cached) | 9 | 0 | 0 | 0 | 15 | 0 |
| 05 | planner: Den | 9 | 0 | 0 | 0 | 3 | 0 |
| 06 | planner: Měsíc | 9 | 0 | 0 | 0 | 102 | 0 |
| 07 | planner: Týden again | 9 | 0 | 0 | 0 | 15 | 0 |
| 08 | planner: change service filter | 0 | 0 | 0 | 0 | 0 | 0 |
| 09 | planner: tab hidden 1 s, then visible (focus) | 15 | 2 | 0 | 0 | 95 | 23 |
| 09b | planner: tab hidden 35 s, then visible (focus) | 25 | 8 | 0 | 0 | 209 | 52 |
| 10 | /clubs cold load | 17 | 15 | 2 | 0 | 234 | 213 |
| 11 | clubs -> FK Slaný (SPA nav) | 28 | 18 | 4 | 0 | 258 | 143 |
| 12 | club: click a club window (popover) | 2 | 2 | 0 | 0 | 5 | 5 |
| 13 | club: close popover, click it again (cache) | 0 | 0 | 0 | 0 | 0 | 0 |
| 14 | club cold load /clubs/{id} | 30 | 23 | 4 | 0 | 261 | 206 |
| 15 | club: back to /clubs (Zpět na kluby) | 15 | 10 | 2 | 0 | 232 | 150 |
| 16 | /clubs/objednavky cold load | 7 | 5 | 2 | 0 | 147 | 126 |
| 17 | orders: open an order | 3 | 3 | 0 | 0 | 25 | 25 |
| 17b | orders: open another order | 1 | 1 | 0 | 0 | 4 | 4 |
| 18 | /patients cold load | 9 | 7 | 2 | 0 | 69 | 48 |
| 19 | patients -> a patient | 24 | 9 | 14 | 0 | 45 | 24 |
| 20 | settings /nastaveni/cenik (cold load) | 11 | 8 | 3 | 0 | 77 | 48 |
| 20 | settings /nastaveni/sluzby (cold load) | 10 | 7 | 3 | 0 | 64 | 42 |
| 20 | settings /calendars (cold load) | 10 | 7 | 3 | 0 | 64 | 42 |
| 21 | settings /activities (SPA nav from /calendars) | 3 | 2 | 1 | 0 | 7 | 7 |
| 22 | SPA nav /prehled | 5 | 3 | 2 | 0 | 4 | 4 |
| 23 | SPA nav /planovani (remount, cache warm) | 33 | 16 | 2 | 0 | 237 | 134 |
| 24 | history back | 8 | 1 | 4 | 0 | 45 | 1 |
| 25 | history back | 2 | 1 | 1 | 0 | 0 | 0 |
| 26 | history forward | 4 | 1 | 2 | 0 | 1 | 1 |
| 27a | SPA -> /clubs (fresh) | 11 | 11 | 0 | 0 | 188 | 188 |
| 27b | SPA -> /clubs/{FK Slaný} (hover-less) | 20 | 5 | 3 | 0 | 217 | 84 |
| 27c | SPA -> /clubs again (<30 s) | 11 | 2 | 2 | 0 | 230 | 22 |
| 27d | SPA -> /clubs/{FK Slaný} again (<30 s) | 19 | 0 | 3 | 0 | 161 | 0 |
| 27e | SPA -> /planovani (<30 s of 23) | 25 | 0 | 2 | 0 | 212 | 0 |
| 27f | SPA -> /prehled -> /planovani (<30 s) | 21 | 1 | 8 | 0 | 103 | 1 |
| | **Total** | **462** | **197** | **75** | **0** | **3650** | **1793** |

Reading it: steps that are cold loads (full page, empty cache) can only lose duplicates and fan-out (-2 to -15); steps
that revisit something seen seconds ago go to **0-2 requests** (planner week/day/month switches 9 -> 0, clubs list again
11 -> 2, a club again 19 -> 0, the planner again 25 -> 0, the tab coming back after a second 15 -> 2). The "2" left on
27c is the notification bell: its list is kept 15 s and was older. Step 23 (33 -> 16) follows three full page loads
(step 20), so the cache it meets holds only what steps 20-22 fetched - it is a half-cold load, not a revisit.
Steps 24-26 are browser history moves across those full-page-load boundaries and are noisy in both columns.

## What changed, and what each change bought

| Change | Where | Measured effect |
|---|---|---|
| **Query defaults**: `staleTime` 30 s, `gcTime` 30 min, `refetchOnWindowFocus` off, no retry of 4xx / 429 | `src/api/queryClient.ts` | revisit / back / forward steps 9-25 -> 0-2; focus 15 -> 2 |
| **Staleness tiers by key** (`setQueryDefaults`): reference data 5 min (calendars, activities, clinic-services, services, `settings/*`, club-block-activities, documents rules / templates, working hours, periods, previews), holidays 10 min, partner orders 2 min, free slots (`availability`) always 0 | same | 04-07, 24-27 |
| **Live keys keep their focus refresh**: `day-range`, `day-summary`, `blocks`, `club-blocks`, `club-order(s)`, `partner-orders`, `availability`, `planner` | same | 09b: only the live reads come back after 35 s away (8), not 25 |
| **A write marks the cache stale** (client-side signal after every accepted POST / PUT / PATCH / DELETE; reference data only for configuration writes; questions asked by POST ignored; signing in empties the cache) | `queryClient.ts` + `onWriteSucceeded` in `src/api/requestPolicy.ts` | the freshness safety net, see below |
| **Identical GETs share one request** (in flight, plus 1 s after the answer; the polled notification feed only in flight; never across a write; never when the caller can cancel), a private copy of the data for every caller | `src/api/requestPolicy.ts`, installed in `client.ts` | 75 -> 0 duplicates; patient card 24 -> 9; sign-in 11 -> 7; every cold load -2 |
| **429-aware reads**: wait the `Retry-After` the server asked (a growing pause without one, at most 2 tries, never for a pause over 10 s), hold every other read for that pause (+ jitter) so queued reads do not become the next burst; writes never retried | `requestPolicy.ts` | not provoked on the dev API (limit raised) - proven by tests |
| **A small range is cut out of a bigger one already held** (preview per date, bookings by start day, blocks by Prague-day overlap - the rules were checked against the live API on 108 windows, 0 mismatches) and requests that arrive together are merged into one for the union | `src/api/dayRowsCover.ts`, used by `workingHoursApi.preview`, `appointmentsApi.range`, `appointmentsApi.blocks` | planner cold: previews 12 -> 4, blocks 8 -> 4, day 2 -> 1; every week / day / month switch inside the held window 9 -> 0 |
| **No summary for a deactivated club** (`enabled`), summary kept 60 s | `useClubSummary` + `ClubCard` | the 9 deactivated clubs' cards no longer ask (visible under the "Neaktivní" chip) |
| **Shared keys**: Rezervace and Hráči read `['club-blocks','list']`, `['club-orders','','','']` and `['calendars']` (own copies before); the planner source's club read uses the club screen's key | `ClubReservationsPage`, `ClubPlayersPage`, `deps.ts` | 27c / 27d, 11 / 14 |
| **Club screen warmed on card hover / focus** (200 ms of intent; club + its orders + blocks + the reference data, same keys as the screen) | `src/api/warmReads.ts`, `ClubCard`, `ClubsPage` | not in the table (the script clicks without hovering); the club screen's first wave is already in the cache at the click |
| **Reference reads start at page load for a calendar / club address** (reload, bookmark, link), while the screen's code is still downloading; `warmStart.ts` is tiny and on the first-load path, `warmReads.ts` (the API clients) is loaded only then | `src/api/warmStart.ts`, `warmReads.ts` | planner cold: the chain of 5 dependent waves became 2 (below) |
| **Notification bells share the last list** (a bell mounted within 15 s of an answer starts from it; the 60 s poll, the socket nudge and any read / delete / seen still refresh it) | `useNotificationFeed.ts` | the 22 KB list is no longer downloaded on every navigation: 27d, 27e, 27f -> 0-1 |
| **Cancellable reads for input-driven lists** (`signal` passed by the orders filter, stats range, day / service overview date) | `clubOrders.list` / `stats`, `appointmentsApi.range` / `daySummary`, 4 pages | switching a filter quickly no longer awaits the old answers (not visible in counts) |

### Cold planner: the dependency chain

Before: `account` (t=0) -> reference reads (t=350) -> `preview`/`holidays` (t=400) -> `day`/`blocks`/`club-blocks` (t=450) ->
second wave for the visible week: `day`, `preview`, `blocks` (t=900). After: reference reads at t=0 (started by `warmStart`
while the code downloads), the board's reads in one wave (t=600: one preview call per calendar for the union of the three
windows, one `day`, one `blocks` per calendar), nothing waits for a second wave. On the real deployment each level is a
Render round trip.

## What stays fresh (kept on purpose)

- **Writes**: every accepted write marks everything non-reference stale, and reference data too unless it was an ordinary
  booking / patient / order / block write. The screens' own `invalidateClubWorld` / `day-range` / `blocks` invalidations are
  untouched and still refetch what is on screen. The range caches are emptied by the same signal.
  *Checked in the browser*: `blocks` for a week inside a held window = 0 requests; `createBlock` -> the new block is in the
  week and in the month; `deleteBlock` -> gone (`verify-write.mjs`).
- **Live permission refresh** (`/api/v1/account` on start, focus, 403): untouched; it appears once per cold load and on focus.
- **Notifications**: still polled every 60 s and nudged by the socket. The poll and the nudge always ask (the HTTP layer shares
  them only while in flight, never an answer that has already arrived); only a bell that is *mounted* within 15 s of an answer
  starts from it, and any read / delete / seen through a bell empties that memory.
- **Day overview / dashboard / planner board** keep their 60 s `refetchInterval`; the board's `day-range` is refetched on
  focus after 30 s.
- **Free slots** (`availability`): `staleTime` 0, refetched on focus, cleared by every write - a slot another person just took
  is never offered from the cache.
- **Nothing visible changed**: planner week / month / day texts compared old vs new server are identical
  (`verify-planner.mjs`), and the whole suite passes: `NODE_OPTIONS=--max-old-space-size=4096 npx vitest run --maxWorkers=3 --testTimeout=30000` -> 334 files / 4,978 tests passed, 7 skipped; `npm run typecheck` clean.
- Freshness windows are the only change: another user's edit is seen after at most 30 s (bookings, blocks, orders) or 5 min
  (configuration), or at once after your own write. A second browser tab of the same user has its own cache.

## What is still N-per-item (needs a backend call, not built here)

| Pattern | Now | Cold-load cost |
|---|---|---|
| `GET /api/calendars/{id}/preview?from&to` per calendar | 4 (union range, merged) | 4 x 14-26 KB |
| `GET /api/calendars/{id}/blocks?from&to` per calendar | 4 (+1 for the club screen's window) | 4 |
| `GET /api/calendars/{id}/partner-orders` per calendar (clubs list, overview dialog) | 4, one of them 44.7 KB | 4 |
| `GET /api/v1/clubs/{id}/summary` per active club card | 4 | 4 |
| patient card: 8 separate reads | 8 (9 with the catalogue) | 8 |

## Recommended batch endpoints (NOT built - backend, PF-B or the coordinator)

Each replaces an N-per-item pattern above with ONE call; every answer item keeps the shape the single call has today, plus
the id it belongs to. When one exists the client change is one line in the matching `src/api/*.ts` function (the range
covers, the keys and the staleness tiers stay as they are).

1. **Club summaries** - `GET /api/v1/clubs/summaries?ids=<clubId>,<clubId>` (no `ids` = every active club) ->
   `ClubSummary[]` (today `GET /api/v1/clubs/{id}/summary`, each already carrying `clubId`). Replaces N cards x 1.
2. **Partner orders** - `GET /api/partner-orders?calendarIds=<id>,<id>&clubId=<optional>&status=<optional>` ->
   `PartnerOrderDetail[]` with `calendarId` on each item (today `GET /api/calendars/{id}/partner-orders`; one calendar's
   list is 44.7 KB and the other three are empty). The `clubId` filter also lets the club overview ask for one club only.
3. **Blocks** - `GET /api/blocks?calendarIds=<id>,<id>&from=YYYY-MM-DD&to=YYYY-MM-DD` -> `TimeBlock[]` (each already has
   `calendarId`; same Prague-day overlap rule as `GET /api/calendars/{id}/blocks`, same 62-day limit as `/api/day`).
4. **Previews** - `GET /api/preview?calendarIds=<id>,<id>&from&to` -> `[{ calendarId, days: PreviewDay[] }]` (400-day limit as
   today). Also slim the row: a day costs ~500 bytes now (26 KB per calendar for the 48 days the planner opens with); leave out `null` and
   `false` fields and let the client default them.
5. **Club orders list** - `GET /api/v1/club-orders?view=list` without `blocks[].athletes`, `history` and `addenda` bodies
   (92 KB for 23 orders, 50 KB for one club's), plus `limit`/`cursor`. The detail (`/club-orders/{id}`) already has the rest.
6. **Notifications** - return `lastSeenAtUtc` inside `GET /api/notifications` (one call instead of two) and support
   `If-None-Match`/ETag or `?since=<timestamp>` so a 60 s poll that finds nothing new costs a 304. 21.7 KB today per poll
   per bell.
7. **Patient workspace** - `GET /api/patients/{id}/workspace` -> `{ patient, profile, consents, requirements, documents,
   sessions, upcoming }` for the patient card (8 requests now; the templates are reference data and stay cached).
8. **Bootstrap** - `GET /api/v1/bootstrap` -> `{ account, permissions, calendars, activities, clinicServices,
   calendarDisplay, clubSettings, publicClinic }`: the six reads every calendar screen opens with, in one call, written
   into the query cache with `setQueryData` (5-minute tier). Not needed if 3-4 above exist and the warm start is kept.
9. **429 contract** - send `Retry-After` (seconds) on every 429 and list it in `Access-Control-Expose-Headers`; without
   the second the browser hides the header from a cross-origin client (Vercel -> Render) and the client falls back to
   its own 1 s / 2 s pause.

## What blocks first paint, after

- Planner board: `calendars` (now started at page load, in parallel with the code download) and the day range for the
  visible window; previews, blocks and club blocks are drawn as they arrive (placeholder data), and the second wave for
  the visible week no longer exists because it is cut out of the month window.
- Club list: `/api/clubs` only - the code already treats everything else (calendars, partner orders, blocks, orders,
  summaries) as enrichment that arrives later.
- Club screen: the club, its orders and (for an editable order) the blockable činnosti; started on card hover.
- Everything else is unchanged.

## For the owners of the files this task did not touch

- `src/planner/components/board/boardCalendar.ts` (PL-N): nothing is required - the range covers answer its week from the
  month request. When the batch endpoints above exist replace the per-calendar `Promise.all` in `previewQuery` and the
  `useQueries` over `shown` by one `appointmentsApi.blocksFor(ids, from, to)` / `workingHoursApi.previewFor(ids, from, to)`.
  Then add the adjacent-window prefetch (deliberately not done today, one extra week would cost 5 requests):
  ```ts
  useEffect(() => {
    if (!appointmentsQuery.isSuccess || from === '') return;
    const id = requestIdleCallback(() => {
      const next = [addDays(from, 7), addDays(to, 7)];
      void queryClient.prefetchQuery({ queryKey: ['day-range', next[0], next[1], allIds.join(',')], queryFn: () => appointmentsApi.range(next[0], next[1], allIds) });
    });
    return () => cancelIdleCallback(id);
  }, [appointmentsQuery.isSuccess, from, to]);
  ```
- `useBoardCalendar` is called once for the mini calendar's six weeks and once for the visible week; with the covers the second
  costs nothing, so there is no need to merge them.

## Risks

- **Freshness windows.** Another user's change (a booking, a block, an order) is seen after up to 30 s, configuration after up
  to 5 min, unless the person looks at the same data after their own write (cleared at once) or the screen's own interval
  (60 s on the board and the day overview) comes first. A second tab of the same user has its own cache.
- **The range covers are rules about the server.** A booking belongs to the range its Prague start day lies in; a block to
  every range that shares a Prague day with it. Verified on the dev API over 108 windows (single days and weeks, 12 bookings,
  18 blocks): 0 differences. Not provable on this data: a block ending exactly at midnight (assumed to belong to the day
  before - a different server rule would show one zero-height sliver at most).
- **Shared reads copy the data once per caller** (`structuredClone`), which costs a few ms on the 92 KB list.
- **Hover warm-up** can start up to 10 reads per club card (only those not fresh; 200 ms of rest needed; deactivated clubs never).
- **Prod bundle**: the new code on the first-load path is `requestPolicy.ts` (the HTTP client's rules, ~3 KB of source) and
  `warmStart.ts` (a few hundred bytes); the API clients the warm start needs (`warmReads.ts`) are loaded on demand. Not measured with a production build (PF-A's budget script is the place).
- The measurement is on the Vite dev server against a local API: request counts and bytes are real, durations are not.
