# Club planning: what the owner said, what was true in the real app, what was fixed

Owner (21. 10. 2026, Czech, verbatim): *"vybrat víc na jedno musí být možné zároveň klub, infrastruktura musí být
rychlejší, to znamená vše musí být propojené, chci si vybrat sloty neboli dny v kalendáři na měsíc, musí fungovat
kalkulačka, musí zastavit tehdy když je vše splněno, nesmí dovolit natáhnout víc než by mělo, dynamická tam chybí"*.

Four more owner bugs arrived while this was being worked on and are part of the same story (points A-D below).

Method: every point was reproduced first in the real app (frontend :3000, API :5092, database `sportmedical_dev`) with our
own headless Chromium (`scripts/club-planning/*.mjs`, club `ZZ test plánování`; nothing was saved as an order). Evidence is
in `design/club-planning/` (screenshots named after the step). "Before" = `claude/clean` at 11a6dc9.

## The seven points

| # | Owner's words, my reading | Real app BEFORE | Fixed |
|---|---|---|---|
| 1 | pick many at once (days, činnosti) | **Several činnosti in one window: worked** (the bubble "Činnosti termínu", `x-past-1.png`). **Several days at once: only in the standard calendar's month** (drag + "Přidat do objednávky klubu"); in club planning one slot / one day at a time. | Month in club planning: click = whole day, drag = several days, Ctrl / Cmd / Shift add places, tray button "Naplánovat vybrané dny", one undo for the whole pick (`dayPick.ts`, `useDayPick.ts`, `createIntervals`). Week: a click on a day's heading takes that day, Shift = a range. Phone: a tap on a row of the month list. |
| 2 | choose whole days in the month | **Broken**: `BoardSurface.maySelectDays` required `config.mode === 'standard'`, so in club planning the month selection (drag, Ctrl, tray) was off, and a click on a day only opened the day view. That is why *"když jsem chtěl kliknout na celý den, nedovolilo mi to"*. | see 1; `month-*.png`, `e2e-*-2-day-picked.png`, `e2e-*-3-multi.png`. |
| 3 | the calculator must work and be live everywhere | Cards, summary, drag HUD, dialogs all read `orderFigures` (one calculation) - **already one source**. Three real faults: (a) the left panel's KPI used the model's second sum (slots counted as players: wrong for 2 lanes); (b) terms on past days counted although the save drops them (bug C below); (c) a block over the lunch break counted the break as slots (bug A). | (a) `agendaView` reads the figures; (b) `isUnsavedPast` is part of the one definition; (c) slots are laid only in open time. Table below + `figures.agree.test.tsx`. |
| 4 | stop when fulfilled, never exceed | The drag, "Přidat další den" and the činnosti bubble were clamped. **Not clamped**: "Vytvořit termín", the smart editor and the merge of adjacent blocks only checked the model's one-pool sum (slots, not players: lenient for lanes > 1); nothing checked a past day; the standard calendar's "Přidat do objednávky klubu" has no need check at all. | `planGuard` is the one gate of every draft write (drop, month pick, add day, bubble, resize, move, smart edit, create term) and refuses spare slots beyond the need unless the desk chose "Přidat termín navíc" (111 property cases in `planGuard.test.ts`). The add-to-order dialog: see "not fixed". |
| 5 | everything connected, one truth, instant | Writes already go through `invalidateClubWorld` and `plannerKeys`; after a save the saved order is the one being edited. One gap: `ApiDataSource.finishPlan` computed "ready" with a context whose `today` was the model's default (2026-11-20), not the real day. | fixed (`today` passed); `hasUnsavedChanges` added so the finish dialog knows whether anything is left to write. |
| 6 | club screen speed (6-level chain) | measured by the speed agent - see `docs/club-screen-speed.md` | see that file |
| 7 | dynamic: no motion in the planning area | none | `planFx` + `planner.fx.css`: slots land where placed, a pick ripples across its days, refusal shakes, views slide; plné / omezené / vypnuto honoured (contract tests); cards: see the deck notes |

## The bugs that arrived on the way

* **A. The planner ate the lunch break.** A drop from 08:30 over the clinic's lunch (12:00-12:30 on that day) became ONE
  term "9 slotů 08:30-13:00": the break was counted as slots and, on save, the server clipped the window (it works the
  open pieces only), so the saved order was shorter than the plan. Now `openTime.ts` lays slots through the day's open
  pieces (hours minus lunch, both from the clinic's settings via the day marks): the drop is two terms (08:30-11:50 and
  12:30-13:50 in `x-lunch-after.png`), the preview carves the break out of its frame (`x-lunch-drag.png`), figures / prices /
  need count only real slots, merge never bridges the break, and move / edge pull / smart editor / "Vytvořit termín"
  refuse a term that touches the break or the closing time with a sentence naming them. Saved windows were already laid
  out by the server's pieces.
* **B. A click on a whole day in the month did nothing for a club order** - see point 2.
* **C. 12 / 12 with green ticks next to "Nejsou naplánované žádné budoucí termíny".** (`x-past-2.png`, `x-finish-2.png`).
  The board accepted terms on days before today and the cards counted them; the save (`ordersRangesOf`) drops past days.
  ONE definition now: `isUnsavedPast` (a never-saved term before today counts for nothing). A past day is refused where
  the term is placed (drag, move, pull, edit, dialog, `planGuard`) with "Termín v minulosti nelze naplánovat…". The finish
  dialog gets `savableTerms` / `pastIgnored` from the same figures: 100 % can never sit next to "nothing to save"; with
  nothing to write the save button is disabled and says why; a plan that is complete and already saved says "Vše je
  naplánováno a uloženo" with nothing to press. A saved window of the past still counts (it was delivered).
* **D. Spiroergometrické vyšetření could not be picked** (the strip showed two cards; compact layouts hid the rest). Fixed
  by the card-strip work (branch `claude/deck`, merged): every činnost reachable on every layout, edge fades and "ještě N",
  escalator with smooth scroll (instant when the motion setting is reduced), "NOVÁ" marker, keyboard, `deck.test.ts`,
  `scripts/club-planning/deck-check.mjs`.

## Every place that shows a figure (one state, one answer)

All of these read `orderFigures(ctx, …)` (`components/plan/orderFigures.ts`, which reads `pickCoverage`) through
`usePlanFigures()` - `base` at rest, `live` while a gesture is under way:

| Place | Shows | Source |
|---|---|---|
| činnost card (`PlanningCarousel`) | planned / requested, ring %, "Zbývá N osob", min / osoba · time left | `base` / `live` |
| order summary card + `OrderCommandPanel` | total planned / requested, per-činnost bars, remaining persons and time, terms and slots | `base` / `live` |
| compact dock (phone / tablet) | the same total | `base` |
| drag HUD and the hint strip | "+N slotů", planned → after / requested, "MAXIMUM" | `planOverlay` over `previewFigures` |
| completion callout | N / M osob, "Celá objednávka naplánována" | `base` |
| left panel KPI, footer "Zbývá N" | planned / requested slotů | **was the model's second sum; now `figures.live`** |
| order overview, finish, publish dialogs, summary sheet | per-činnost rows, percent, pending time, `savableTerms` | `orderFigures` |
| shortfall / spare bubble | missing players, spare places and the money they lose | `orderFigures` |
| month tile "N termínů", mini calendar rings | count of terms; share of the day budget | sessions (counts of terms, not need) |
| club page cards, orders list | the SAVED order's numbers from the server | refreshed by `invalidateClubWorld` after a save |

The model's own `plannedOf` / `totals` (one pool of seats) is still used for validation and for the demo source; it is never
stricter than the figures and `planGuard` covers the difference for činnosti with more than one lane.
`figures.agree.test.tsx` mounts one state (including a past, unsaved term and a two-lane činnost) and asserts card, summary,
left panel and overview say the same.

## Stop when fulfilled - every path

| Path | Cap |
|---|---|
| drag a činnost | `planSelection`: whole remaining slots, `isLimit` / "MAXIMUM" |
| extend a term by its edge | `guardResize` + `validateTermExpansion` + `planGuard` |
| move a term | cannot add slots; refuses past / break / closed |
| "Přidat další den" | `planNextDay` takes only the missing slots; `planGuard` |
| činnosti bubble (several činnosti in one window) | `pickCoverage` seats; `planGuard` |
| month pick (click / drag / Ctrl / tray / heading / phone row) | `planDays`: stops at the need, later days say "Potřeba klubu je už naplněna" |
| merge of adjacent blocks | the cap is checked once for the whole drop, before merging |
| smart editor, "Vytvořit termín" | model check + `planGuard` |
| "Přidat termín navíc" | the one explicit way past the need (`allowExtra`) |
| undo | restores a snapshot |
| paste | there is no paste in the planner |

## Not fixed / open

* The standard calendar's **"Přidat do objednávky klubu"** (`AddToClubOrderDialog`) attaches whole days to an existing
  order with one `update`; it has no need check (it never touches seats and has no open-hours data). It cannot exceed
  the need on a fulfilled order *silently*, but it also does not warn. A warning needs the day's open hours; the
  planner's club mode now does all of this, so the recommended route is to open the club in the planner.
* Week board: no horizontal multi-day drag (several days in one gesture there is the heading click / Shift-click).
* The strip's completion escalator has no component test (model tests and a browser run only).
* The dev database keeps inactive test clubs (`DELETE` only deactivates a club).
