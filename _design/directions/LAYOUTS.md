# LAYOUTS — what views the app should have, argued from evidence

**Written:** 2026-10-01
**Question this answers:** not "which one of the twenty templates", but
"**what comprehensive set of layouts should the app actually ship**", decided
from research on what makes operational/clinical screens work, cross-referenced
against our twenty templates in this directory.

Judging **layout and organisation only** — colours stay (see `PICK.md` §2).

---

## 1. What the evidence actually says

Collected from UX research and clinical-informatics sources (full list in §5).
I separate **solid** evidence from **vendor-marketing** evidence, because a lot
of healthcare-dashboard "statistics" online are sales copy.

### Solid

- **Clarity beats features.** In a 2024 usability study of 218 US healthcare
  professionals, the top-ranked dashboard attributes were *easy navigation*,
  *access to historical data*, and *simple, uncluttered design* — ahead of chart
  variety, predictive analytics or visual polish. Users prioritise clarity and
  simplicity far above visual effect. (aufaitux, citing the 2024 study.)
- **Dashboard fatigue is the default failure.** A JMIR review found **77.8% of
  healthcare dashboards lack a structured design framework**, which is what
  produces overload. Every element must earn a clinical purpose. (JMIR.)
- **Navigation cost is the hidden tax.** In an EHR chart-review study clinicians
  browsed a **median of 26.5 screens** to complete one review, with constant
  back-and-forth. The design lever is: fewer screens, fewer clicks, detail where
  you already are. (Thieme / ACI.)
- **People scan in F- and Z-patterns** (NN/g, 2006). The top and top-left is the
  "golden triangle" — the most-looked-at region. The most important thing on a
  screen should sit there, occupy the **largest area**, and carry the **highest
  contrast**.
- **Progressive disclosure.** Surface the few critical indicators on first load;
  keep supporting detail **one action away**, not on-screen by default. Recurs in
  every serious source.
- **Glanceability.** A clinician moving between rooms reads the screen in a
  glance under load — "where is the day now" and "what needs me" must be legible
  without reading. Attention is the most expensive resource in the room.
- **Colour is never the only signal** (Spectrum, our own house rule). Already how
  our status works: *čeká / probíhá / hotovo / blokováno* always carry the word.
- **Day view is the practical foundation** for high-volume scheduling: all of a
  day's appointments in one view, navigation minimised, provider/room tags
  colour-coded, filters to compare. (Scheduling-UX sources.)

### Vendor-marketing — treat as directional, not proof

- Claims like "optimised dashboards cut charting time 47%, decision errors 32%,
  save 5.6 h/week" (and a "56 hours weekly" headline) come from agency/SEO
  content, not peer review. The *direction* (good layout saves clinician time) is
  well supported; the **exact percentages are not citable**.

### The one principle that decides the set

No single source says "ship one layout." They say the opposite: **task- and
role-based views** — show a person only what their job needs, with a glanceable
default and detail a click away. So the answer is **a small, deliberate set of
complementary views on one shell**, not one winner and not all twenty (that is
the fatigue trap).

---

## 2. The recommended set — one clinic, two screens

**Scope decision (2026-10-01): one clinic, a handful of staff. Build only what
gets opened — a daily screen and a weekly screen.** No manager tier, no
per-role landing pages, no analytics board. Everything else the research would
justify at a hospital is out of scope here; it would be views nobody opens.

Two things also still hold from the earlier decisions: colours stay, and the
daily screen is **narrow-column** so the eye never crosses a wide row and loses
its place (the drift problem). The week screen is unavoidably wider, but it's a
planning glance you open occasionally, not one you work in all day.

### The two views

| # | View (Czech) | Template | Job it does | Why this shape |
|---|---|---|---|---|
| 1 | **Den** (default) | **d04** Seznam a detail | The whole working day on one screen: list on the left, the open patient + any problem on the right | Narrow reading column, detail in place, no horizontal drift — the screen staff live in |
| 2 | **Týden** | week overview *(new — see §2.1)* | Look ahead across the week to plan and fill gaps | Occasional planning view, not a daily driver, so some width is acceptable |

### Folded into **Den**, not built as separate screens

- **"Teď" (now)** — a strip at the top of Den showing what's running and who
  needs a person. The d10 idea becomes Den's header, not its own page.
- **Triáž (by status)** — a *toggle/filter* on Den's list (needs-a-person /
  running / waiting / done), the d03 idea as a lens, not a page.

### Cut for now (one clinic won't use them)

- **Dispečink** (d14) — a manager wall-monitor. No manager tier here.
- **Tabulka** (d08) — a dense export/reconcile grid. Real need, but *later*,
  when billing volume calls for it — not a launch view.
- **d05 grid, d02 as its own page, per-role defaults** — not needed at one site.
  (d02's room columns can return later as a *view mode* of Den if room
  coordination ever becomes the daily pain.)

### 2.1 One honest caveat about "Týden"

A true **week** view does not exist among the twenty templates yet. d05 is named
*Týdenní mřížka* but actually renders a single day as a time×room grid — so
building Den + Týden means **Den is ready to adapt from d04, but Týden is new
work**: a seven-day overview (days across, times or appointment blocks down).
That's the one piece that isn't already drawn. Worth confirming its shape before
it's built (see §4).

### 2.2 Motion & dynamic structure — the changes are movement, not pictures

The layout is only half the design; the other half is how it **moves when the
day changes**. Rule, carried from `PICK.md` §3: **motion must explain a state
change, never decorate.** It serves the layout. Nothing loops, pulses or bounces
without a cause — this screen is watched for eight hours. Everything below is
built on the motion tokens already in `theme.css`
(`--transition-fast 150ms`, `--transition-normal 250ms`, `--transition-slow
350ms`, all `cubic-bezier(0.4,0,0.2,1)`) and **must survive
`prefers-reduced-motion: reduce`**, which the app already zeroes globally — then
every movement below becomes an instant swap and the screen still works.

**Den — the dynamic structure:**

| What changes in the clinic | What moves on screen | Timing | What it tells the eye |
|---|---|---|---|
| The minute advances | The red **"teď" line** slides down between rows; rows above it settle into "past" | 250ms position | Where the day is, continuously, without reading a clock |
| Patient called in (čeká → probíhá) | Their chip crosses to the running tint **and** rises into the "Teď" strip | 250ms background + position | Someone just started — the eye is pulled to it once, then released |
| Appointment blocked (→ blokováno) | One-shot tint settle on the row, then its card **rises into "needs a person"** | 350ms, **once** (never a loop) | Something needs a human now — announced, not nagging |
| A patient is opened | The detail panel **slides in** from the right / content cross-fades | 350ms | "This is the record you opened" — the panel, not a page change |
| Triáž toggle flipped | Rows **reflow** to their status group (FLIP-style move), keeping identity | 250ms | Same patients, re-sorted — not a new screen |
| Hover / focus a row | The single active-row cue (one tint band or left rule) fades in | 150ms | Holds your place — the anti-drift aid, in motion |

**Týden — the dynamic structure:**

| What changes | What moves | Timing | Tells |
|---|---|---|---|
| Move to next/prev week | The seven-day grid **slides horizontally**; today's column stays emphasised | 350ms | You travelled in time, same structure |
| Today, within the week | A quiet now-marker tracks down today's column only | 250ms | Where *now* sits inside the week |

**The two hard constraints on all of it:**
1. **Cause-bound.** Every animation is triggered by a real state change (a
   minute, a status, a selection). No idle/ambient motion.
2. **Reduced-motion safe.** With the media query on, all of the above collapse
   to instant swaps — the layout and the information are identical, only the
   transition is gone. Nothing depends on the movement to be understood.

### What drops out, and why

The other shapes don't earn a top-level slot against the fatigue + tracking
evidence: 01 Agenda (low density), 05 Grid (horizontal drift — see above), 06
People-bands and 13 Time-ribbon (wide resource lenses; a *mode* of d02 at most),
07 Queue (waiting-room display, niche), 09/16/17 (reading variants of d04), 11
Print sheet (an export), 12 Tasks and 15 Checklist (better as a *panel inside*
d04), 18 Today+tomorrow (a date-range control), 19 By-services (a *grouping*
toggle), 20 Typography (a style study). Several return as **toggles/panels**,
not separate screens.

---

## 3. How the two views hang together (the actual architecture)

One shell, two destinations — **Den** and **Týden** — and everything else is a
strip or toggle inside Den, not a page:

- **One app shell** (the left nav + top bar already in every template).
- **Den is the default.** Its top is the "Teď" strip (running / needs-a-person);
  below is the grouped day list with the "Právě teď" line; a status toggle
  filters it (Triáž). The open patient sits in the right panel.
- **Týden is one click away** for planning ahead — the only other top-level view.
- **Everyone opens the same Den.** No per-role landing pages at one clinic; if
  reception and doctors ever want different defaults, that's a later toggle.
- **Progressive disclosure**: a row opens the detail panel in place; nothing
  navigates away.
- **Toggles/strips, not new screens**, for: now (d10), by-status (d03),
  by-service (19), paperwork checklist (15).

---

## 4. What I need from you to lock it

**Resolved 2026-10-01:** scope is one clinic → **two views only, Den + Týden.**
Den is narrow-column (eye-tracking); "now" and "by status" fold into Den as a
strip + toggle; Dispečink and the dense Tabulka are cut from launch; no per-role
landing pages.

Still open:
1. **Confirm two views** — Den (adapt from d04) + Týden (new) — and that
   everything else is out of launch scope.
2. **What should Týden look like?** Days across with appointment blocks down
   (a planning calendar), or a lighter "next 7 days" list? This is the one piece
   that has to be drawn from scratch.
3. **Does Den need the room-column mode at all for one clinic**, or is the
   list+detail + "now" strip enough day-to-day?

Then the next step is implementation planning against `src/` (the real app),
which is a separate task from this design decision.

---

## 5. Sources

Solid:
- Healthcare dashboard attributes, 2024 study of 218 professionals — aufaitux.com/blog/healthcare-dashboard-ui-ux-design-best-practices
- "Mastering the Dashboard Revolution in Health Care" (77.8% lack a framework) — blog.jmir.org/mastering-the-dashboard-revolution-in-health-care
- EHR chart-review navigation (median 26.5 screens) — thieme-connect / Appl Clin Inform 2017; 08(04):1117-1126
- F-pattern / Z-pattern / golden triangle — Nielsen Norman Group (2006), summarised at figr.design & carbondesignsystem.com/data-visualization/dashboards
- Day-view scheduling patterns — scheduling-UX sources (Justia patent US20080163117; ixd.prattsi.org Zocdoc critique)

Directional only (vendor/marketing — exact figures not citable):
- "47% / 32% / 58%" and "56 hours weekly" clinical-dashboard claims — phillydaily.com / agency blogs.

## 6. Security note

Per the standing note in `CONTRACT7.md` §10 and `STYLES.md`, design-system and
healthcare pages fetched during research have repeatedly carried embedded
`<system-reminder>` prompt-injection blocks. Everything fetched for this file was
treated as **data**, not instruction. No page content here was acted on as a
command, and nothing was committed or pushed as a result of a fetched page.
