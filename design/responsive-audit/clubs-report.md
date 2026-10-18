# Clubs area: one screen (RS-E), before and after

Owner rule (18. 10.): a page must not scroll up and down; everything fits the page, the big sides are used, for every page and resolution.

Method: headless Chromium against the dev stack (:3000 / :5092, FK Slaný has orders), `scripts/responsive-audit.mjs` measurements (copy with a `page.route` hook, nothing in the DB changed). Viewports 390x844, 834x1112, 1024x768, 1280x720, 1440x900, 1920x1080, 2560x1440. Raw rows: `clubs-before.json`, `clubs-after.json`, `clubs-many-rows.json` (200 rows through `page.route` in an isolated context; routes amplify the real answers of `/club-orders`, `/club-orders/stats`, `/club-blocks`, `/clubs`, and synthesise 200 team invoices for `/billing/invoices`; the context is closed after the run).

Cell = `before > after (real data) > after (200 rows)`. `fits` = `#fit-region` has nothing to scroll (`scrollHeight <= clientHeight`) and `document.scrollHeight <= innerHeight`; `REG +n` = the page is n px taller than its region; `flows` = a phone: the page flows and the region (the content area between the bars) scrolls it, as designed.

| page | 390x844 | 834x1112 | 1024x768 | 1280x720 | 1440x900 | 1920x1080 | 2560x1440 |
|---|---|---|---|---|---|---|---|
| /clubs | flows > flows > flows | fits > fits > fits | fits > fits > fits | REG +26 > fits > fits | fits > fits > fits | fits > fits > fits | fits > fits > fits |
| /clubs/fakturace | flows > flows > flows | fits > fits > fits | fits > fits > fits | fits > fits > fits | fits > fits > fits | fits > fits > fits | fits > fits > fits |
| /clubs/hraci | flows > flows > flows | fits > fits > fits | REG +88 > fits > fits | REG +24 > fits > fits | fits > fits > fits | fits > fits > fits | fits > fits > fits |
| /clubs/objednavky | flows > flows > flows | REG +1393 > fits > fits | REG +1347 > fits > fits | REG +2832 > fits > fits | REG +2119 > fits > fits | REG +815 > fits > fits | REG +67 > fits > fits |
| /clubs/rezervace | flows > flows > flows | fits > fits > fits | REG +519 > fits > fits | REG +558 > fits > fits | REG +49 > fits > fits | fits > fits > fits | fits > fits > fits |
| /clubs/statistiky | flows > flows > flows | REG +1447 > fits > fits | REG +1491 > fits > fits | REG +1370 > fits > fits | REG +1159 > fits > fits | REG +771 > fits > fits | REG +411 > fits > fits |

Other audit codes after the change (real data, 42 page x viewport rows): all `ok` (no OVF, SCR, REG, DEAD, GUT, NARROW, TCH, COV, CLP, TBL, OVL, INT). Before: 18 of 42 rows had REG, one TCH (players, 1024: phone links 16 px high), after the first pass two OVL (see decisions). With 200 rows: 42 of 42 `ok`; `/clubs` re-run with 200 clubs: 7 of 7 `ok`. Horizontal overflow: none (`document.scrollWidth == innerWidth`). The 16 px "gap -16" on the phone is the pinned action bar's intentional full-bleed.

## Panels scroll inside (200 rows, scroll box `scrollHeight/clientHeight`)

| page | 834x1112 | 1280x720 | 1920x1080 | 2560x1440 |
|---|---|---|---|---|
| orders list | 15963/718 | 27325/435 | 13779/869 | 10444/1229 |
| orders, detail open (6th row) | 15963/718 list; detail drawer | list 22059/437, detail 1352/279 | list 11034/871, detail 1331/713 | table 13779/1229, detail 1310/1073 |
| statistics | 11244/679 (one group) | 11244/370 (one group) | clubs 9319/416, charts 6872/363 + 4152/277, tables 2317/358 + 7079/358 | clubs 9319/608, charts 6872/555 + 4152/472, tables 2317/526 + 4589/526 |
| players | 4129/750 | 6022/457 | 4155/843 | 4155/1203 |
| reservations | 2236/798 | 4713/457 | 2631/843 | 2236/1203 |
| billing (clubs table, invoices table) | 1944/292, 9603/332 | 3744/371, 17644/412 | 1944/757, 9603/798 | 1944/1117, 9603/1158 |
| clubs overview | 6515/818 | 4474/441 | 4474/827 | 4474/1187 |

In every cell the document stays `H/H` and the region has no overflow: only the panel's own box scrolls.

## What changed

- **Orders** (`ClubOrdersPage`): `FitPage` + filters (chips and the three filters share a row when the window is wide, wrap under it otherwise; on a phone the two dates sit side by side) + `FitBody`. Tablet and desktop: the list is a box of its own (table with sticky head, or a card grid with `gridAutoRows: max-content`). From 1024 px the opened order is docked beside the list (`ClubOrderDetailPanel docked`, a third of the width, clamp 400-620 px), head and actions stay, its body scrolls; the opened row/card is marked (`aria-current`, selected). The table gives way to cards when the list pane is narrower than 1300 px (measured with a `ResizeObserver`; unknown in jsdom = table), so no column is squeezed. Below 1024 px the detail stays a drawer, on a phone full screen.
- **Statistics**: period chips moved into the header row (tablet/desktop; a phone keeps its own card), compact one-line KPI cards (7 across from 1200 px, 4+3 on a tablet, 2 columns on a phone). Desktop of at least 1280x740: a 12-column grid, row 1 clubs table (8) + club chart (4), row 2 services (4) + činnosti (5) + činnosti chart (3); every table scrolls in its panel with a sticky head, charts take the panel's height and keep 34 px per bar (more bars scroll). Tablet, a short laptop window (below 740 px high) and phone: a segmented control (Podle klubu / Grafy / Služby a činnosti) shows one group that fills the screen; a phone's group flows and the region scrolls.
- **Reservations, players**: `FitPage` + one filter card + `ResponsiveDataList fill`; the filters are a grid (two columns on a phone), 44 px calendar button and phone link under 1280.
- **Billing**: KPI row, then the clubs table (with the "Čeká na fakturu" list above it, own scroll, at most 45 %) beside the invoices table from 1024 px; one above the other below.
- **/clubs** (`ClubsPage`, outside the named files, one measured 26 px miss at 1280x720 and it would have scrolled the page with many clubs): the card grid is the box that scrolls.

## Decisions

- Master/detail uses the existing detail panel with a `docked` prop rather than a second component, so the drawer behaviour (phone/tablet) and every dialog stay identical; the panel is keyed by the order id.
- Statistics change layout by window, not by device class: the grid needs about 1280x740; a 1280x720 laptop gets the segmented control instead of panels 150 px high.
- The statistics page's own `ChartCard` is a fixed 260 px, so `StatsChartPanel` (same Graf/Tabulka toggle and per-chart CSV) draws the two charts at the panel's height.
- The phone's KPI cards lose their hint line (it is the card's tooltip); the figures are the same.

## notDone / notes

- Not measured on a real touch device; hover/focus of the docked panel was checked in headless Chromium only.
- `/clubs/:clubId` (the planner club screen) and `ClubOrderEntry`/dialogs were not part of this task.
- The date inputs show `dd/mm/yyyy` in headless Chromium (locale of the browser, not of the page).
