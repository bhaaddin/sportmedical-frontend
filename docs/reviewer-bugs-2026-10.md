# Reviewer's report, October 2026: six items in the Main Planner and in Clubs

The owner pasted a reviewer's report of six recordings (`/planovani` and Clubs & Teams) and made it the work order. Branch
`fix/reviewer-bugs` (from `claude/clean` 347396a), nothing pushed, nothing deployed.

**Method.** Every item was reproduced first in the real app with an own headless Chromium (`scripts/reviewer-bugs/*.mjs`, never the
shared browser pane) against the local dev stack: the unchanged app on `:3000` is the "before", this worktree's Vite on `:3003`
(proxy to the API on `:5092`, so no shared setting was edited) is the "after". Evidence screenshots are in `design/reviewer-bugs/`
(`before-<item>-*` / `after-<item>-*`, three layouts: 390x844, 820x1180, 1440x900). The recordings may be from an older build,
so each item says honestly whether it still reproduced. Test data: `node scripts/reviewer-bugs/seed.mjs` writes event bookings
named `ZZ reviewer test (smazat)` into a quiet week of the dev database (`SEED_MONDAY`, default 11. 1. 2027); `seed.mjs clean`
cancels them again. Cancelled bookings stay in the database (nothing is deleted), so the dev DB keeps a few cancelled `ZZ` rows.

| # | Item | Reproduced | Result |
|---|---|---|---|
| 2.1 | list of predefined times although the time is chosen | yes | fixed, owner's decision applied |
| 2.2 | every booking its own item in the day summaries | yes | fixed: one row per činnost |
| 2.3 | a club opens straight into planning | yes | fixed: the club opens as its overview |
| 2.4 | the two calendars and their selector are gone | yes | restored (columns + selector) |
| 2.5 | white text on a light background when hovering, popup too low | contrast yes; "too low" only for tall ranges | fixed, with an AA audit |
| 2.6 | no colour per činnost in Settings | partly: it existed, but palette-only | extended, one helper, propagated |

---

## 2.1 Booking: no list of times for a time the desk chose

**Reproduced: yes.** `before-2.1-c-desktop-690-b-activity.png`: click 11:30 on an empty Thursday, "Jen zablokovat čas bez pacienta" ->
Pokračovat -> choose *Základní sportovní prohlídka*: "V 11:30 tuto činnost nabídnout nelze" and, below it, "Volné začátky v tento den"
with up to 36 time buttons plus a "Jiný čas" field and, in step 2, `Datum` / `Čas od` as fields to fill in again (the native time
dropdown). 09:00 on the same day was "Slot je volný", 17:30 had the list again.

**Cause of the intermittence.** `NewAppointmentDialog` compared the minute of the gesture with the server's list of starts by
exact instant (`isStartOffered`). That list depends on the činnost (its length against lunch, closing time, chained starts, the
board's step), so the same click gave "free" for one činnost / minute and a whole list for another - it only looked random. There is no
race with the availability query (a loading answer shows a skeleton and books nothing).

**Decision (owner's question "everywhere or only the first booking?").** The list never appears when the start comes from the desk's
own gesture - a click or drag on the board, a free slot, "Příští volný termín" (all arrive as `initialStart` + calendar) - in every day
state (empty, partly full, club days, holidays). It stays only where NO time was chosen (the dialog opened with a day only, the
desk types the time) and there it depends on the typed minute alone, so it is consistent.

**Fix** (`components/booking/NewAppointmentDialog.tsx`): step 2 shows the chosen slot with its end ("Čtvrtek 19. 11. 2026 · 11:30 — 12:10 · 40 min ·
Ordinace 1" + *Změnit*) instead of date/time fields; a chosen start the server does not offer gets ONE sentence naming the činnost
and its length ("V 11:30 se Základní sportovní prohlídka (40 min) nevejde …"), the single nearest offered time as a button
("Nejbližší volný čas 12:30"), "Zkusit přesně 11:30" (the server decides) and, for `bookings.edit`, the override as before. The
server stays the authority (rule 6.1/6.4 untouched).

**Tests.** `NewAppointmentDialog.test.tsx` (44): the old list/"Jiný čas" tests now run on the no-time flow, 7 new ones for the gesture
contract (never a list on an empty / partly full / full day, deterministic, "Zkusit přesně" books the exact minute, an offered start books
directly with no time field, *Změnit* -> "Jiné datum a čas" still edits by hand). Browser: `scripts/reviewer-bugs/r21.mjs`
(after screenshots at 390 / 820 / 1440: no list, no time field for 09:00, 11:30 across lunch, 17:30 across closing).

---

## 2.2 A day is summarised per činnost

**Reproduced: yes** (unchanged app, Thursday with six komplexní prohlídky, `before-2.2-*`): the mini calendar's day flyout lists six rows
"… 1 slotů", the agenda list six rows, the Den list six rows, the month tile "6 termínů", the day panel six cards, the phone agenda the same.

**Fix.** One pure helper, `planner/model/activityGroups.ts` (`groupByActivity`, `summariseDay`), folds a day into one row per činnost
with the count and the slots: "Komplexní prohlídka ×10 · 10 slotů", openable to the people behind it. Used by: the mini calendar's
flyout (`dayTooltipModel.groups`, the prototype's `events` list is untouched and stays golden), the agenda lists ("Činnosti termínů v
kalendáři" / "Všechny termíny", one row per činnost and day, a lone entry keeps its detail), the Den list (`groupDayRows`), the
month tile (up to two činnosti and "+n"), the phone agenda and phone month, the day panel (folded term card and folded record line)
and the agenda KPI. **Slot rule (one, no second calculation):** a booking counts its people (`booked`, never the free parallel
seats in its term's `capacity`: parallel 2 and one patient is 1 slot, not 2); a window counts its `capacity`, which the planner already lays
through the open pieces of the day (`layoutSlots`: hours minus lunch), so the lunch break is never subtracted twice. Also fixed on the
way: "1 slotů" (Czech plural). **Left as it is on purpose:** the board still draws every booking as its own card, and the dashboard's
"Objednaní" is a work queue of people (it names who to receive), not a summary.

**Tests.** `activityGroups.test.ts` (15: x10, 30 people in one row, group bookings, parallel capacity, club window, a block across lunch via
`addPlannedInterval`, ordering, the flyout model), `dayGroups.test.tsx` (11: Den list, month tile, phone agenda/month, 30-people day stays two rows long until
opened), `foldDay.test.ts` (7), `agendaView.groups.test.ts` (5); `MiniCalendar`, `ReservationDrawer.records` and `RestoredFeatures` tests updated to the
new contract. `golden.test.ts` passes. Browser: `r22.mjs`.

---

## 2.3 A club opens as its overview, planning is a choice

**Reproduced: yes** (`before-2.3-desktop-1-after-click.png`): clicking *FK Slaný* in the clubs list landed on the planning stage: the root order of the
group on the board, the činnost cards, "Celková objednávka" with *Připravit formulář*, the "Vyberte činnost" strip.

**Cause.** `useClubPlannerData` built the edit session of the selected group whenever the root order was Confirmed, so planning
started on arrival.

**Fix.** `/clubs/:clubId` now opens the club's overview in the same planner layout and with the club's own data: header, the club's windows on the board and
in the left lists, the order in view and **the quick actions in the deck** (*Nová objednávka*, *Plánovat termíny*, *Přidat hráče*, *Otevřít
objednávku*, *Přehled klubu*; by status: an Invited / Requested / Completed order says why it cannot be planned and offers *Otevřít* /
*Zpracovat poptávku*). The planning chrome (činnost cards, progress bar, hint strip) is not drawn. Planning starts only with `?plan=1`
(*Plánovat termíny*, an order's *Upravit termíny*, the order switcher while planning) or a `pickOrder.start` session in the router state, so every deep link that
meant "plan now" still does (order panel *Upravit termíny* / *Zpracovat*, the calendar's *Přidat do objednávky klubu* flow, `pickOrder` route state). *Přehled
klubu* in the order switcher leaves planning again. Phone and tablet: the actions sit directly under the header, before the board.

**Tests.** `ClubPlannerPage.test.tsx` (46; 8 rewritten for the new contract, 8 new: overview by default, *Plánovat termíny* starts planning, `plan=1`, `?order=` + overview /
planning, a window hand-over opens the owner group's overview, a router session still plans, switcher keeps the mode, leave planning, quick actions per
status, three layouts), `clubStageReads.test.ts` (`planning` flag). Browser: `r23.mjs` (3 layouts: overview deck, no document scroll, no console
errors, *Plánovat termíny* -> planning deck). `scripts/club-planning/*` now click `ov-new-order` where they used the empty deck.

---

## 2.4 The clinic's calendars are columns of every day again (Main Planner only)

**Reproduced: yes** (`before-2.4-*`): the week draws every calendar into one column per day (simultaneous bookings of different calendars in lanes) and the
choice of calendars lived only behind the gear. The old grid (`git show 4b12291^:src/components/booking/grid/TimeGrid.tsx`) had "a sub-column per calendar when
several are on screen" and the toolbar's "Kalendáře" menu.

**Fix.** With two or three calendars on screen each day splits into one column per calendar (`calendarColumns.ts`, order = the calendars' own `sortOrder`), each headed by a chip with
the calendar's own **name and colour** (from the calendars data, nothing is a literal); a calendar selector (a toggle chip per calendar) is back under the toolbar
(`CalendarStrip`, the same state as the gear's rows). Bookings, club windows and manual blocks sit in their calendar's column (lanes divide that column, two simultaneous
bookings of two calendars no longer share lanes); a click / drag / "Zablokovat čas" belongs to the calendar of the column it started in (`cellAtFraction`, `BoardSelection.sub`);
a booking dragged over the other calendar's column is refused (the ghost says "Jiný kalendář", it stays in its calendar); a calendar closed on a day the other works is
hatched in its own column and cannot be marked; the month tile counts bookings per calendar under their chips; the phone month writes "Ordinace 1 3 · Diagnostika 5"; with one day shown
(tablet / phone) the chips head the column pair above the board. **Decisions:** one calendar = one column; **more than three calendars do not split** (a card would be a sliver; the
selector says "vyberte jich nejvýše 3"); the club planner is not touched (`mode === 'standard'` only). The dev database has four active calendars, so it needs two
ticked to split; the clinic's two split at once.

**Tests.** `calendarColumns.test.ts` (16: when it splits, pointer -> column, `cardLeftWidth` with columns, board model of a split week: cards, lanes, club window per column, blocks,
closed-calendar shade), `WeekBoard.calendars.test.tsx` (15: heads, cards in own column, click / drag / block target the column's calendar, closed calendar hatched and not
markable, drag across calendars refused, club windows per column, selector, one calendar, 3 vs 4 calendars, club planner untouched, month tile counts);
`PlannerPage.calendar.test.tsx` updated (two calendars there now split). Browser: `r24.mjs`, `r24b.mjs` (a click in column 0 / 1 of an empty Friday names *Ordinace 1* /
*Diagnostika* in the booking bubble).

---

## 2.5 Booking hover: contrast and popup position

**Reproduced.** *Contrast: yes.* In the dark theme the booking bubble drew its selected činnost card, the selected "Z databáze" mode card, the footer and the read-only
`Trvání` / `Čas do` fields with light-mode constants (`ACCENT_SOFT`, `DESIGN.head`), i.e. white text on a near-white fill (measured 1.02:1,
`before-2.1-c-desktop-690-b-activity.png` shows it). In light mode the orange and teal accents are 3.4-3.7:1 as text on white and a contained button
with dark ink went DARKER on hover (3.0:1). *Position:* measured with `r25-pos.mjs` at 1280x720, 1366x768, 1440x900, 1920x1080: the selection popover, the bubble and the hover cards
lie inside the screen and next to their anchor; **no "too low" popup reproduced for a normal slot**. The one real case is a tall marked range (a drag over hours): the
bubble was centred on the middle of the range, far down the screen.

**Fix.** The dark theme now defines `--sm-soft-bg` / `--sm-soft-line` (tinted glass) and panels use `headSurface(theme)`; `accentInk()` darkens an accent as TEXT only until it
reads (AA on white and on its own tint; only orange and teal change), text buttons / outlined buttons / the mode cards use it, a dark-ink accent fill goes lighter on hover;
the bell badge is 5.2:1. The bubble anchors a tall range at its start (`ANCHOR_HEAD`); hover cards flip instead of leaving the screen.

**Audit.** `scripts/reviewer-bugs/contrast.mjs` measures the real computed colours (composited through the ancestors, disabled controls exempt) at rest and under the pointer;
`r25-booking.mjs`, `r25-board.mjs`, `r25-surfaces.mjs` over the bubble (both steps), the stage, cards, the card summary, Den, Měsíc and the flyouts at three layouts in dark and light with
the forest, orange, teal and blue accents: 0 failing text elements after the fix. `theme.contrast.test.ts` pins the table (every accent x both modes). *Not audited:* club planning's own bubbles
(the činnost bubble) - the positions were not part of the recordings.

---

## 2.6 The colour of a činnost

**Reproduced: partly.** A per-činnost colour was already stored (`colorHex`, the server's `effectiveColorHex`) and could be set in two places (Nastavení -> *Barvy služeb*, and the činnost dialog
of Ceník), and every view of the planner drew the same colour (measured on the unchanged app: board card, agenda chip, mini calendar ring all `#09423B`). What the reviewer could not find was a
real setting: it was palette-only, had no custom colour, no preview, no guard, was named for služby, and a change reached the board only after the caches aged out (5 min).

**Fix, no backend change** (`PUT /api/activities/{id}` already validates and returns the effective colour; the new colour round-trips on the dev API: `colorHex` `#E9C46A` -> effective `#E9C46A`, reset -> `#09423B`).
* `src/colors/activityColor.ts`: the ONE answer to "which colour is this činnost" (effective -> own -> legacy -> služba -> neutral) and "what text goes on it"
  (`textOnColor`: ink / white / black, always >= AA) and the guard `guardActivityColor` (refuses a colour that vanishes on the dark calendar or the light page). Planner categories,
  the calendar model, the club activity catalogue, Ceník, the settings lists and `drawnColor` all call it; there is no second palette (the picker offers the clinic's own palette).
* `ActivityColorEditor` (Nastavení -> **Barvy služeb a činností**, and the činnost dialog of Ceník): palette, any `#RRGGBB` typed or picked, a live preview (pill with the text that reads on it and its
  contrast, a card on the dark calendar, a dot on the light page), *Použít odstín služby* to reset, the guard's sentence under the field.
* `invalidateColorCaches` refreshes every screen that draws a činnost the moment a colour is saved.

**Tests.** `activityColor.test.ts` (contrast table over the palette and awkward colours, the worst mid grey, guard, the order of sources, planner / model / catalogue agree),
`ActivityColorEditor.test.tsx` (10), `invalidateColors.test.ts` (3); the existing Settings / Ceník tests updated for the new labels. Browser: `r26.mjs` (after the save the board card, agenda chip,
mini ring and month tile all show the new colour, then reset).

---

## Verification

(see the end of this file)

## Open risks

* The calendar split needs room: with three calendars at 1440 px a day column is ~44 px per calendar; the lanes of a parallel činnost inside one are thin. More than three do not split on purpose.
* A club's overview shows the club's own windows in the left lists; bookings of other people are not listed there (they are on the board).
* "Zkusit přesně" books at a time the server's list does not contain and lets the server answer; the server's refusal sentence is shown as before.
* The dev database keeps cancelled `ZZ reviewer test (smazat)` bookings (nothing is ever deleted by the API) and the test club `ZZ test plánování`.
