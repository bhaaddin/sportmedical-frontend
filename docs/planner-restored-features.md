# Planner: features restored from the old calendar

The old calendar (`CalendarGridPage`, `TimeGrid`, `MonthView`, `PhoneCalendar`, removed in `4b12291`) had three
things the new planner (`src/planner/**`, `/planovani` and `/clubs/:clubId`) lacked. All three are back, in the planner's
own classes and models, on the endpoints the old calendar used. No backend change is needed for any of them; the
items under "Not restored / backend wishes" are improvements, not blockers.

Old code: `git show 4b12291^:src/components/booking/calendar/<file>` and `git show 4b12291^:src/pages/booking/CalendarGridPage.tsx`.

## 1. Club-inquiry day markers

A club order that blocks no time yet (status `Invited` with offered days, `Requested` with the days or periods the club
chose) is drawn as a dashed chip, never as a filled block; a confirmed order's blocks take over.

| Where | What |
|---|---|
| week heading (desktop, tablet 7 days) | dashed flag `Poptávka` / `Poptávka ×2` in the corner of the day; one inquiry opens its order (`/clubs/objednavky`, `openOrderId`), several open a small list first |
| tablet / phone one-day strip | dashed ring on the day button |
| month tile | `Poptávka · FK Slaný` (clubs of the day, each once) |
| day list ("Den") and the phone agenda | one chip per inquiry above the rows, a button into the order |
| phone month list | dashed `Poptávka · …` line on the day |

The order being processed in club planning (`session.editOrder.mode === 'process'`) reads `Klub žádá`
(`BoardConfig.inquiryOrderId`, set by `PlannerPage`). A restricted period says its činnost (`Poptávka · Dukla · Spiroergometrie`).

* Pure model: `src/planner/model/inquiries.ts` (+ test). Read: `useInquiries` (`components/board/useInquiries.ts`),
  one `clubOrdersApi.list({})` under the key `['club-orders', 'inquiries']`, `retry: false`; a failed read draws nothing.
* Words: `src/planner/text.ts` (`PLANNER_TEXT.inquiry`).
* Not marked: the left mini calendar.

## 2. Month: Ctrl-drag several days, block whole days

Month view of the planner (standard ordering, tablet and desktop, with `bookings.create` or `bookings.edit`):

* **Drag** across tiles marks a run; letting go opens the selection popover (the same `SelectionPopover` as the time
  drag): *Objednat pacienta* (books from the first day, first calendar on screen), *Zablokovat čas*, *Přidat do objednávky
  klubu* (hands whole days to `AddToClubOrderDialog`). A press and release on one tile still opens the day.
* **Ctrl, Cmd or Shift** keeps what is marked and adds one more place (a single day too). The marked places sit in a tray
  at the bottom of the month (chip with an x each, `Zablokovat dny`, `Zrušit výběr`); a place that began in the past is
  struck through and cannot be blocked. Esc drops everything.
* **Touch** has no modifier key: a press held 380 ms starts the drag; the toggles `Vybrat od–do` (tap first and last day)
  and `Vybrat víc dnů` (every tap adds a place) are above the tiles.
* **Block whole days** (`DaysBlockDialog`): one reason, the calendars ticked (all by default), per place one block from
  00:00 of its first day to 24:00 of its last (`appointmentsApi.createBlock` per calendar per place, as the old
  `MultiBlockDialog`). The server refuses a block over a booked patient with its own sentence, shown in the dialog; places
  saved before the refusal stay saved; the calendar is read again either way. Past days are trimmed (a block starts today at
  the earliest). Success: toast `Zablokováno: n míst.`, the tile reads `Blokováno`.
* A tile says `Blokováno` when every calendar on screen has a manual block over the whole day (`blockedDaysOf`; a club
  window is not the desk's block).
* Not offered while a club order is planned (the board belongs to the order) and not on the phone (the month is a list there).

Pure model: `src/planner/model/daySelect.ts` (reducer + `blockableRanges`), `components/board/boardModel.ts`
(`blockedDaysOf`, tile fields). Pointer wiring: `components/board/month/useDaySelect.ts`; UI: `month/MonthSelectionUi.tsx`,
`month/DaysBlockDialog.tsx`, `month/month.css`.

Also fixed on the way: the sticky hour column of the board (z-index 20) showed through the Den / Měsíc list on the desktop;
the list now sits above it (`board.css`).

## 3. Phone list view (up to 767 px)

* **Den** is an agenda: a strip of the week's seven days (count, club dots, inquiry ring, closed days hatched; tap a day
  or swipe the list a day on or back) and under it the day's bookings, terms of the file, club windows and manual blocks
  in the order they start (time, name, činnost, status, price, činnost colour). A tap opens the booking detail, the club
  window's popover, the block, or the term. An empty day says so and offers the booking. The week is read for the strip.
* **Měsíc** is one row per day of the month: closed day / holiday, `Blokováno`, the count of terms and bookings, the club
  windows (`FK Slaný · 08:00–16:00`), the inquiry, or `Žádné rezervace`; a tap opens that day as the agenda.
* **Týden** stays the board with one day at a time (the planner's own compact layout).
* Rows are 44-64 px; the lists are one long page inside the planner's own scroller (the document does not scroll), the strip
  sticks to the top.

Models: `components/board/phoneModel.ts` (+ test); UI: `PhoneAgenda.tsx`, `phone.css`, `planner.compact.css` (phone rules).

## Not restored / backend wishes

* The old month's hover/tap day panel (people split by služba) and the old phone **Týden** as strip + list.
* The old phone cards showed `3/22 zapsáno` on a club window (`clubBlocksApi.list({from,to})` details and
  `useWindowRestrictions`); the planner's list shows the club and its time only. The endpoint exists; it is not wired.
* Marking several **time ranges** with Ctrl in the week grid (old `PickedTime` places) is not part of this; only days.
* Blocking N days in M calendars is N x M calls (`POST /api/calendars/{id}/blocks`); a failure in the middle leaves the
  earlier ones saved. A batch endpoint (all or nothing, optionally clinic-wide) would make it atomic.
* `GET /api/v1/club-orders` returns every order and the page filters `Invited` / `Requested` itself; a status list or a
  `from`/`to` filter on the server would shrink the payload on a clinic with many orders.

## Verified

`npm run typecheck`, `npx vitest run` (all of `src/planner`), `PRERENDER_API_URL=off npm run build`, and a real browser
against the dev stack (frontend :3000, API :5092) at 390x844, 820x1180, 1440x900 and 1920x1080: screenshots in
`design/restored/`. The dev database got two test blocks (4. 11. - 6. 11. and 26. 11. - 27. 11. 2026 in the four calendars,
reason `ZZ QA test blokace (smazat)`) made through the new dialog; they were deleted again through the API.
