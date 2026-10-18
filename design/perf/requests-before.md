# API requests per screen — BEFORE (PF-C, 2026-10-18)

How it was measured: a headless Chromium (Playwright, 1672x941) driven through one signed-in session of 37 steps against
the dev stack (API :5092, dev database `sportmedical_dev`, rate limit raised). Every `/api/*` request was recorded
(method, path, query, start, duration, decoded body bytes). The build measured is **`HEAD` of `claude/clean`** (`ba6e4cf`),
served by a second Vite dev server from a `git archive` copy, so nothing of the work below is in it. The script is
`run.mjs` (kept with the other measurement scripts in the agent scratchpad); "cold" = a full page load with an empty cache,
"SPA" = a navigation inside the running application, "<30 s" = the same screen visited again within 30 s.

Reading the numbers: the dev API is on the same machine, so durations are 5-250 ms and say little about wall time. **The
request count is the lever** - on the real deployment (Vercel -> Render, which sleeps and has latency) every avoidable round
trip costs real time and counts against the 100-requests-a-minute-per-session limit. "Exact duplicates" = the same method +
URL + query sent more than once inside one step.

## Per-step table

| # | Screen / step | Requests | Exact duplicates | KB | Biggest response |
|---|---|---:|---:|---:|---|
| 01 | sign-in -> /prehled (cold) | 11 | 4 | 49.7 | notifications 21.7 KB |
| 02 | /planovani cold load | 37 | 2 | 256.8 | calendars/{id}/preview 22.5 KB |
| 03 | planner: next week | 9 | 0 | 15.0 | calendars/{id}/preview 3.9 KB |
| 04 | planner: previous week (back, should be cached) | 9 | 0 | 15.0 | calendars/{id}/preview 3.9 KB |
| 05 | planner: Den | 9 | 0 | 3.0 | calendars/{id}/preview 0.7 KB |
| 06 | planner: Měsíc | 9 | 0 | 102.1 | calendars/{id}/preview 22.5 KB |
| 07 | planner: Týden again | 9 | 0 | 15.0 | calendars/{id}/preview 3.9 KB |
| 08 | planner: change service filter | 0 | 0 | 0.0 | - |
| 09 | planner: tab hidden 1 s, then visible (focus) | 15 | 0 | 94.6 | notifications 21.7 KB |
| 09b | planner: tab hidden 35 s, then visible (focus) | 25 | 0 | 209.2 | calendars/{id}/preview 22.5 KB |
| 10 | /clubs cold load | 17 | 2 | 234.4 | v1/club-orders 92.1 KB |
| 11 | clubs -> FK Slaný (SPA nav) | 28 | 4 | 258.2 | v1/club-orders 50.0 KB |
| 12 | club: click a club window (popover) | 2 | 0 | 4.8 | v1/club-orders/{id} 3.8 KB |
| 13 | club: close popover, click it again (cache) | 0 | 0 | 0.0 | - |
| 14 | club cold load /clubs/{id} | 30 | 4 | 261.0 | v1/club-orders 50.0 KB |
| 15 | club: back to /clubs (Zpět na kluby) | 15 | 2 | 231.6 | v1/club-orders 92.1 KB |
| 16 | /clubs/objednavky cold load | 7 | 2 | 147.3 | v1/club-orders 92.1 KB |
| 17 | orders: open an order | 3 | 0 | 25.0 | activities 15.7 KB |
| 17b | orders: open another order | 1 | 0 | 3.8 | v1/club-orders/{id} 3.8 KB |
| 18 | /patients cold load | 9 | 2 | 69.5 | notifications 21.7 KB |
| 19 | patients -> a patient | 24 | 14 | 44.8 | activities 15.7 KB |
| 20 | settings /nastaveni/cenik (cold load) | 11 | 3 | 76.6 | notifications 21.7 KB |
| 20 | settings /nastaveni/sluzby (cold load) | 10 | 3 | 63.5 | notifications 21.7 KB |
| 20 | settings /calendars (cold load) | 10 | 3 | 63.5 | notifications 21.7 KB |
| 21 | settings /activities (SPA nav from /calendars) | 3 | 1 | 6.8 | services 6.8 KB |
| 22 | SPA nav /prehled | 5 | 2 | 4.4 | patients 3.0 KB |
| 23 | SPA nav /planovani (remount, cache warm) | 33 | 2 | 236.7 | calendars/{id}/preview 22.5 KB |
| 24 | history back | 8 | 4 | 44.8 | notifications 21.7 KB |
| 25 | history back | 2 | 1 | 0.1 | v1/settings/changes 0.0 KB |
| 26 | history forward | 4 | 2 | 1.4 | patients 0.6 KB |
| 27a | SPA -> /clubs (fresh) | 11 | 0 | 188.2 | v1/club-orders 92.1 KB |
| 27b | SPA -> /clubs/{FK Slaný} (hover-less) | 20 | 3 | 217.1 | v1/club-orders 50.0 KB |
| 27c | SPA -> /clubs again (<30 s) | 11 | 2 | 229.6 | v1/club-orders 92.1 KB |
| 27d | SPA -> /clubs/{FK Slaný} again (<30 s) | 19 | 3 | 161.5 | v1/club-orders 50.0 KB |
| 27e | SPA -> /planovani (<30 s of 23) | 25 | 2 | 212.1 | calendars/{id}/preview 22.5 KB |
| 27f | SPA -> /prehled -> /planovani (<30 s) | 21 | 8 | 103.2 | notifications 21.7 KB |
| | **Total** | **462** | **75** | **3650.1** | |

(Step 25/26 are browser history moves across a full-page-load boundary in this script, so they sometimes restore from the
browser's own back/forward cache and sometimes reload - treat them as noise; 27c-27f are the clean "visit it again" cases.)

## What the numbers say

1. **Nothing was kept.** Every revisit asked for everything again: planner previous week 9 requests (the week was on screen
   a second earlier), Den -> Měsíc -> Týden 9 each, clubs list again within 30 s 11, a club again 19, the planner again 25.
   The query client had `staleTime: 0`, so every mount refetched. 27c-27f alone are 76 requests for data seen seconds before.
2. **Focus refetches the world.** Coming back to the tab after one second refetched **15** requests, after 35 s **25**
   (4 x preview x 3 windows, 8 x blocks, days, club blocks, ...). `refetchOnWindowFocus` was on for every query.
3. **N-per-item fan-out dominates the calendar.** `GET /api/calendars/{id}/preview` is 105 of the 462 requests (23 %) and
   `GET /api/calendars/{id}/blocks` 69 (15 %): one request per calendar (4 here) **per window**, and the planner asks three
   overlapping windows at once on a cold load (the six weeks of the mini calendar, the next four weeks, the visible week):
   12 previews + 8 blocks + 2 day calls = 22 requests before anything else.
   - clubs list: `GET /api/v1/clubs/{id}/summary` x4 (one per card; the page's filter hides deactivated clubs, but with the
     "Neaktivní" chip the 9 deactivated ones would each ask too), `GET /api/calendars/{id}/partner-orders` x4 (44.7 KB for
     one calendar, 78 bytes for the other three).
   - the club screen: 7 previews, 2 blocks, 2 day calls, 2 `club-blocks` (the list 38 KB and the detail 12.5 KB), 2 `activities`.
   - `club-blocks` x3, `club-orders` x3 with different filters (all 92 KB / 50 KB), `activities` x2: the same data under
     different keys on different screens (Rezervace, Hráči, club list, club screen), so each screen asked again.
4. **Exact duplicates (75).** Two bells ask `notifications` + `notifications/seen` (21.7 KB!) on every page; the patient card
   asks `patients/{id}`, `profile`, `documents/templates`, `check`, `documents/patient/{id}`, `day` **3 times each** (24
   requests, 14 of them duplicates); the dashboard asks `patients` 3 times and `day` twice; the Cenik settings page asks
   `services` twice; settings pages ask `settings/changes` twice.
5. **Biggest responses** (decoded): `club-orders` list 92 KB, `partner-orders` 45 KB, `club-blocks` 38 KB, one calendar's month
   of `preview` 22.5 KB (about 500 bytes a day), `notifications` 21.7 KB (polled every 60 s by each bell), `activities`
   15.7 KB, `day` 11.7 KB.
6. **What blocks first paint.** The planner: account -> (calendars + settings + activities + services) -> previews/day/blocks
   -> second wave for the visible week: **four dependent round trips** before the board is complete; the board is `ready` only
   once calendars **and** the day range are in. The club list: `clubs` then summaries / partner-orders (which wait for
   `calendars`). The club screen: club + orders + blocks, then the planner reads.
7. **429.** None in this run (the dev limit is raised), but the figures above show why the new screens hit it: the club list
   -> club click sequence is 11 + 28 = 39 requests, the planner cold load 37, and `retry` treated a 429 as retryable
   *without waiting* (`shouldRetryQuery` retried 429 with a 1-10 s growing delay per query, all queries at once).

## Per-screen request groups (cold loads, before)

### /planovani, cold (37)
`preview` x12 (4 calendars x 3 windows), `blocks` x8, `day` x2, `notifications` x2 + `seen` x2, `account`, `public/clinic`,
`calendars`, `settings/calendar-display`, `activities` (15.7 KB), `clinic-services`, `settings/clubs`, `holidays/2026`,
`club-blocks` (12.5 KB), `settings/company`, `users`.

### /clubs, cold (17)
`clubs/{id}/summary` x4, `calendars/{id}/partner-orders` x4, `notifications` x2 + `seen` x2, `account`, `clubs`,
`club-blocks` (38 KB), `calendars`, `club-orders` (92 KB).

### /clubs/{id}, cold (30)
`preview` x7, `clubs/{id}` x2, `club-blocks` x2, `activities` x2, `day` x2, `blocks` x2, `notifications` x2 + `seen` x2,
`account`, `club-orders` (50 KB), `club-orders/{id}`, `calendars`, `settings/calendar-display`, `public/clinic`,
`clinic-services`, `settings/clubs`, `holidays/2026`.

### /patients -> a patient (24)
`patients/{id}` x3, `profile` x3, `documents/templates` x3, `documents/patient/{id}/check` x3, `day` x3,
`documents/patient/{id}` x3, `consents` x2, `diagnostics/.../sessions` x2, `activities`, `billing/invoices` (714 ms).

### /nastaveni/cenik (11) / /nastaveni/sluzby (10) / /calendars (10)
`notifications` x2 + `seen` x2, `account`, `activities`, `clinic-services`, plus `services` x2, `documents/templates`,
`settings/service-colors` (cenik) or `settings/changes` x2 + `calendars` (the other two).
