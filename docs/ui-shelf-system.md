# The shelf system

Owner's request (21. 10. 2026): the whole staff application - everything except the calendar (`/planovani`) and the club
planner (`/clubs/:clubId`), which keep their own fixed layout - gets the planner's dark glass look and becomes **one
connected product**: pages organised like a **shelf** (titled rows of cards, each a clear unit with its own header, count and
"zobrazit vše"), everything **linked** to what it relates to, **smart** suggestions, motion that answers actions.

This document is the guide for the people (and agents) who convert the other pages. Phase 1 built the foundation and proved it
on two pilot areas: **Přehled** (`/prehled`) and **Pacienti** (`/patients`, `/patients/:id`). Branch `ui/shelf`, not pushed.

> **Stage 4 (2026-10-22):** Přehled is no longer built from shelves - it is four calm blocks (`src/pages/overview/`, see `docs/stage4-2026-10.md`),
> and the labelled sidebar is gone (one slim icon rail + the top action bar). `PageFrame` no longer draws a Hledat button by default.
> The text below describes the shelf system as the other pages still use it; for Přehled read the Stage 4 document.

Everything lives in `src/ui/shelf/`. Read this file, then `src/pages/PatientList.tsx` - two
finished examples.

## 1. Anatomy

```
┌ shell (sidebar / rail / bottom bar) ──────────────────────────────────────────────────────────────────────────────────┐
│ #fit-region  ← the ONE scroller (the document never scrolls)                                                          │
│ ┌ PageFrame ───────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ [avatar] Title (h1)                                   [Hledat  Ctrl K] [secondary actions] [PRIMARY ACTION]      │ │
│ │          one line: what this page is for                                                                         │ │
│ │ (badges)  (entity chips: patient / club / appointment ... each opens the thing, with a peek)                     │ │
│ │                                                                                                                  │ │
│ │ ┌ Shelf: Vyžaduje pozornost ③ ──────────────────────────── controls ── Zobrazit vše → ┐                          │ │
│ │ │ [attention card] [attention card] [attention card] →                                 │   ← a row that swipes   │ │
│ │ └━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┘   ← the rail           │ │
│ │ ┌ Shelf: Objednaní ① ──────────┐ ┌ Shelf: Čekárna ⓪ ─────────────┐   ← list boards, two across from 1280        │ │
│ │ └──────────────────────────────┘ └───────────────────────────────┘                                              │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

* **PageFrame** - the header and the stack of shelves (one `h1`, one line of purpose, the primary action, the palette button,
  status badges, connected chips). It is a `FitPage`: on tablet and desktop `fit` makes the body take the window's height so a
  `grow` shelf can scroll inside it; otherwise the page simply continues down inside `#fit-region`.
* **Shelf** - a titled section: heading, count pill, optional hint, optional `controls` (filter / sort), "Zobrazit vše". Four
  states it owns (loading, error, empty, ready) and five layouts (`row`, `grid`, `list`, `board`, `free`). **The rail** - a
  hairline in the accent, fading out - runs under every `row` and `grid`: the cards stand on it. That hairline is the one
  signature of the look; everything else is quiet.
* **Cards** - `EntityCard`, `MetricCard`, `ActionCard`, `AttentionCard`. One surface (`cardSurface`), one radius (16 px).
* **EntityChip / EntityLink** - the connection between pages. Same icon and colour per kind everywhere; a click opens the thing;
  resting on it shows a **peek** (3-4 facts, fetched on first hover).
* **RelatedShelf** - "Související": what one thing is connected to, each relation a card of chips; an empty relation is the
  next action.
* **RecentAndPinned / PinButton** - the person's own shelf (browser storage, ids and display names only).
* **Attention** - "Vyžaduje pozornost": pure rules over lists the app already reads; every case is a link to the fix.
* **Command palette** - Ctrl/Cmd+K and the search buttons; one box that finds patients, clubs, orders, invoices, services,
  settings, pages and actions.

## 2. The files

| File | Holds |
|---|---|
| `entities.ts` | `EntityRef` (kind + id + display label), `entityTarget` (the ONE place that knows an address), `mayOpen` (permission per kind), `safeLabel` / `readRef` (never an identifier) |
| `entityMeta.tsx` | icon and tone per kind, `EntityBadge` |
| `shelfStyle.ts` | `cardSurface`, `railSx`, `toneOf`, `CARD_RADIUS`, `TARGET_SX` - styles as functions of the theme (the accent reaches all of it) |
| `Shelf.tsx`, `ShelfCard.tsx`, `PageFrame.tsx` | the three building blocks |
| `EntityLink.tsx`, `peek.ts`, `peekKeys.ts`, `words.ts` | chips, the lazy peek card and its pure fact builders, shared query keys, shared words |
| `related.ts`, `RelatedShelf.tsx`, `PatientRelated.tsx` | relation groups (pure), the shelf, the patient's ready-made one |
| `memory.ts`, `RecentAndPinned.tsx` | recents and pins: pure model + browser store, the shelf, `PinButton` |
| `attention.ts`, `AttentionShelf.tsx` | the rules (pure) and the shelf that feeds them |
| `palette/commandModel.ts`, `palette/useCommandSearch.ts`, `palette/CommandPalette.tsx` | ranking (pure), the sources and abort, the dialog |
| `index.ts` | the barrel: primitives only (see "Importing") |
| `components/UniversalSearch.tsx` | the shortcut and the loader of the palette (the only thing the shell imports) |

### Importing

```ts
import { PageFrame, Shelf, MetricCard, EntityCard, EntityChip, EntityLink, RecentAndPinned, RelatedShelf } from '../ui/shelf';
import { AttentionShelf, useAttention } from '../ui/shelf/AttentionShelf';   // reads invoices, orders, queue, health
import { PatientRelatedShelf } from '../ui/shelf/PatientRelated';             // reads invoices and clubs
```

The barrel never pulls an api module: the data shelves are imported by their own path, the peek's data is `import()`ed on
first hover, the palette is a lazy chunk. (Measured: the barrel alone adds ~10 kB brotli to a screen; `AttentionShelf` adds
what it reads.)

## 3. The components

### PageFrame

```tsx
<PageFrame
  title="Pacienti"                                   // the one h1
  purpose={`Kartotéka kliniky · ${total} záznamů`}    // one line
  primaryAction={{ label: 'Nový pacient', icon: <PersonAdd />, to: '/patients/register' }}   // or { onClick }
  actions={<Button ...>}                              // secondary, left of the primary one
  badges={<StatusChip tone="green">Aktivní</StatusChip>}
  entities={[{ kind: 'club', id, label: 'FC Sparta' }]}   // connected chips under the title
  leading={<Avatar />}                                // before the title
  breadcrumb={[{ label: 'Pacienti', to: '/patients' }, { label: 'Jana Marková' }]}  // only where the shell draws none
  search={false}                                      // hide the palette button (a page that is itself a search)
  fit                                                  // body = the window's height; use with a `grow` shelf
>
  <Shelf ...>...</Shelf>
</PageFrame>
```

* On tablet and desktop the header carries the palette button ("Hledat  Ctrl K"); a phone has the search button in its top bar.
* On a phone the primary action is pinned at the bottom (`PinnedActionBar`) - never drawn twice. Use `to` for navigation and
  `onClick` when the target needs a fresh value (the calendar reads `newAppointment` as a timestamp).
* The shell already draws a breadcrumb on tablet and desktop; pass `breadcrumb` only where it does not (a settings page).

### Shelf

```tsx
<Shelf
  id="booked"                      // data-shelf, tests and these docs call it by this
  title="Objednaní"                // the region's name (aria)
  hint="Dnešní termíny, které ještě stojí"
  count={booked.length}            // the pill; 0 is drawn (zero is an answer); undefined draws none
  countTone="primary|green|red|..." 
  layout="row|grid|list|board|free"
  loading={isLoading} error={isError} onRetry={refetch}
  empty={rows.length === 0}
  emptyState={{ text: 'Na dnešek nikdo objednaný.', action: { label: 'Objednat termín', to: '/planovani' } }}
  viewAll={{ to: '/dnes', label: 'Dnešní přehled' }}
  controls={<FilterChips .../>}    // a filter or a sort, right-aligned in the header
  minCardWidth={232} phoneWidth="min(84vw, 300px)" cardHeight={132} skeletons={3}
  fill                              // row: from tablet up the cards share the row's width
  grow                              // take the height the page has left (with PageFrame fit); children scroll inside
  maxHeight="min(46dvh, 440px)"     // list: scroll inside after this
>
  <EntityCard .../> ...
</Shelf>
```

| Layout | Use it for | Notes |
|---|---|---|
| `row` | cards of one kind, a handful | scrolls sideways with snap and an edge fade; on a phone the next card peeks in (84 % wide) |
| `grid` | a set of equal cards | wraps by `minCardWidth`; use `RelatedShelf` (it turns into a `row` on a phone) |
| `list` | dense rows (today's bookings) | one glass board, `role="list"`, scrolls inside after `maxHeight` |
| `board` | free content in a glass board | a search field, a form, label/value pairs - not announced as a list |
| `free` | something that is already its own card | a data table (`ResponsiveDataList fill`); child `.MuiPaper-root`s get the shelf radius |

States, in order of precedence: **loading** (skeletons of the card's size, `aria-busy`) > **error** (`role="alert"`, a sentence and
"Zkusit znovu") > **empty** (a sentence and the **next action**, never a bare "Žádná data") > **ready**.
A shelf whose source the person may not read is not drawn at all (hide it); never draw "žádné faktury" for a list nobody looked at.

### Cards

| Card | For | Notes |
|---|---|---|
| `EntityCard` | one thing of the clinic | badge + kind + name + two quiet lines + status; the title is a stretched link to `entityTarget`; `trailing` (a `PinButton`) stays clickable; `dense` = one line |
| `MetricCard` | one figure | counts up once (`CountUp`, money through `format`); `to` makes the whole card a link; `tone` colours the figure (`red` money owed, `green` waiting room) |
| `ActionCard` | something to do next | verb + sentence; `primary` fills it with the accent; link (`to`) or button (`onClick`) |
| `AttentionCard` | one attention group | count, urgency edge, up to five cases each a link, one button for the rest |

A card is `role="listitem"` and has **one** link (the stretched title) - no link inside a link; controls on the card sit above it
(`ABOVE_LINK`).

### EntityChip and EntityLink - the connections

```tsx
<EntityChip entity={{ kind: 'club', id: c.id, label: c.name }} />            // a pill: icon + label
<EntityLink entity={{ kind: 'patient', id: p.id, label: fullName }} />        // the label as an inline link
<EntityLink entity={...} onNavigate={(e) => e.stopPropagation()} />           // inside a clickable table row
<EntityChip entity={...} peek={false} />                                      // no hover card (a dense place)
```

Kinds: `patient`, `club`, `order`, `appointment`, `invoice`, `document`, `service`, `activity`. An appointment needs `calendarId`
and a document needs `patientId` to be opened exactly; without them they land on the list.

* **Never write `/patients/${id}` in a page** - `entityTarget(ref)` is the one place that knows an address (router `state` carries
  ids only: `invoiceId` for Fakturace, `openOrderId` for Objednávky klubů).
* The chip is plain text, not a dead link, for a person who may not open that kind (`mayOpen`: `patients.view`, `billing.manage`,
  `settings.clinic.manage`).
* The **peek** opens 350 ms after a *mouse* rests (150 ms for keyboard focus), closes on leaving or Esc, never opens on a touch. Its
  facts come from `peek.ts` (pure functions: a year not a date of birth; a phone the register already shows; dates, statuses,
  counts, money). It reads the app's own api modules through their shared query keys. **Adding a kind**: extend `EntityKind`,
  `ENTITY_*` in `entities.ts`/`entityMeta.tsx`, a `xPeek` function + a `case` in `loadPeek`, and a test.

### RelatedShelf - "Související"

```tsx
<PatientRelatedShelf patientId={id} upcoming={upcoming} documents={documentsKnown ? documents : null}>
  <ConsentCard />                      // anything that is not a relation group can be a child card
</PatientRelatedShelf>

// or build groups yourself (pure, tested) and draw them:
<RelatedShelf groups={invoiceRelatedGroups({ invoice })} />
```

A group has a `status` (`ready | loading | error | hidden`), a `total`, the first three `entities`, `viewAll`, an `empty` sentence and
an `emptyAction`. `hidden` (no permission) is not drawn. For a patient: termíny (the booking window), faktury, dokumenty, klub
(from the partner on the bookings, linked only when exactly one club has that name - see "Known limits"). For an invoice:
pacient, termín, klub, platby. **Adding a relation**: a field in the group builder in `related.ts` + a test; the card draws itself.

### RecentAndPinned and PinButton

```tsx
<RecentAndPinned />                                           // the home: teaches with its empty state
<RecentAndPinned kinds={['patient']} dense hideWhenEmpty />   // context on a register page: one line each, silent when empty
<PinButton entity={{ kind: 'patient', id, label }} />         // in a page header or on a card
rememberOpened({ kind: 'patient', id, label })                // call it once when a page for ONE entity has loaded it
```

* Storage: `localStorage['sm-shelf:<account id>']`, `{ v: 1, recents: [...12], pinned: [...12] }`, each `{ kind, id, label, at,
  calendarId?, patientId? }`. **Nothing else is ever written** (`readRef` rebuilds each entry from those fields; a label that
  looks like a birth number or, for people, a long run of digits is dropped). One slot per account; recents older than 30 days are
  forgotten; junk, another version or a throwing storage is an empty memory, never an error.
* Sign-out does not clear it (it is the person's, keyed by account) - say so if the clinic wants a shared-desk rule.

### Attention - "Vyžaduje pozornost"

`attention.ts` is a set of **pure rules** (`overdueInvoices`, `paperworkToday`, `expiringDocuments`, `clubInquiries`,
`intakeReviews`, `failedMessages`) over data the application already reads; `attentionGroups(input)` returns the groups that have
something in them, most urgent first. Each item carries `to` (+ `state`) - the place that fixes it. A rule whose input is `null`
(not asked yet / not permitted) produces **nothing**: it never claims "all clear".

| Rule | Reads | Permission | Severity | Fixed at |
|---|---|---|---|---|
| Faktury po splatnosti | invoices (the same `isOverdue` as Fakturace's filter) | `billing.manage` | high | `/billing` (opens the invoice) |
| Dnes bez podkladů | today's day list | - | high | the booking (questionnaire) or the patient's documents (report, consent) |
| Brzy skončí platnost dokladu | `checkRequired` of today's patients (max 10 calls) | `patients.view` | low | the patient's documents |
| Poptávky klubů | club orders with `status=Requested` | - | medium | `/clubs/objednavky` (opens the order) |
| Registrace ke kontrole | intake queue | `patients.register` | medium | `/intake-review` |
| Neodeslané zprávy | `GET /api/system/health` `outbox.failed` | `settings.clinic.manage` | medium | `/system-health` |

`useAttention(todayAppointments, patientNames)` runs the queries (a source that fails is **said**, never turned into an all-clear).
**Adding a rule**: a pure function `AttentionInput -> AttentionGroup | null` in `attention.ts`, an entry in `attentionGroups`, its
input in `AttentionInput`, the query in `useAttention`, a test for each branch (null, empty, ordering, deep link, permission).
**Expiring medical-fitness certificates**: there is no list of all documents, only `checkRequired` per patient, so the rule covers
the patients of today's bookings; a backend `GET /api/documents/expiring?days=` would make it clinic-wide.

### The command palette

* Opens with Ctrl/Cmd+K, `openUniversalSearch()` (any search button) or the `PageFrame` button. Arrows move (wrapping, Home/End), Enter
  opens, Esc closes, a click opens. `role="combobox"` with `aria-activedescendant`; rows are `role="option"` in labelled groups.
* Opening view: quick actions, pinned, recent, a few places. Typing: actions, pages, settings screens (the settings catalogue's own
  ranking), patients (server search, **aborted** on the next keystroke, debounced 200 ms), clubs, club orders, invoices, services and
  nearby appointments (lists cached under the query keys other screens use, ranked here).
* Ranking (`commandModel.ts`, pure, pinned by tests): exact label 100 > label prefix 80 > word prefix 65 > substring 50 > keyword 35 >
  hint 20; every word of a multi-word query must be found; pinned +12, recent +8; diacritics ignored.
* **Permissions hide**: a person who cannot open Fakturace is never offered it, nor an invoice, and invoices are never requested.
* **Privacy**: a query shaped like a birth number or a long run of digits is **not sent to any endpoint** (it would travel in a URL)
  and the palette says so; nothing is logged; a recent/pinned entry is an id and a name.
* **Adding an action**: a row in `ACTIONS` in `commandModel.ts` (`state: { x: NOW }` where the destination needs a timestamp), a test.
  **Adding a source**: a `jobs.push(ask(...))` in `useCommandSearch.ts` guarded by `mayOpen(kind, held)`.

## 4. Motion

Everything uses the motion kit (`docs/motion-kit.md`) and the **Animace** setting (`plné / omezené / vypnuto`, mirrored on
`<html data-motion>`); nothing here writes its own duration.

| Moment | What | Where |
|---|---|---|
| a shelf gets its first cards | cascade: first 14 cards, 22 ms apart, a 6 px nudge, **once** per mount - a refetch, filter or page never replays it | `useRowStagger` in `Shelf` (not for `list`/`board`/`free`) |
| a figure | counts up once, on first view | `CountUp` in `MetricCard` and `AttentionCard` |
| a press | the card dips (`scale: var(--sm-press)`, 1 when motion is off) | `cardSurface` |
| a card is hovered | lifts 2 px - **only** under `data-motion="full"` | `cardSurface` |
| the page changes | the shell's 6 px / 180 ms arrival | `usePageArrival` (shell) |

Rules: staff motion answers an action and is gone within 180 ms; the cascade never delays a card (they are in the DOM and
clickable from the first frame); `omezené` writes opacity only; `vypnuto` writes **no style at all** (the Playwright script asserts
no inline `transform`/`opacity` is left on a shelf in any of the three states). Never animate a size (no layout shift).

## 5. The rules every page keeps

1. **Czech, short.** Wording a clinic owns (names, prices, hours, texts) comes from settings/seed data - never a literal
   (`src/test/noHardcodedBusiness.test.ts` fails on a price with "Kč" or the clinic's data in source).
2. **Three layouts.** `useDevice()`: phone ≤ 767, tablet 768-1279, desktop ≥ 1280. Tests call `setViewport`. A shelf that is a grid
   on a desktop is a row that swipes on a phone; a table becomes cards (`ResponsiveDataList`).
3. **44 px targets** under 1280 (`TARGET_SX`; a chip's pill is 32 px inside a 44 px link). jsdom does not evaluate media queries - put
   an explicit `minHeight: phone ? 44 : undefined` where a test must see it; the Playwright script measures the real thing.
4. **The document never scrolls.** The shell is `100dvh` and `#fit-region` is the one scroller. A page may be longer than the window
   (the region scrolls); a long list uses `maxHeight` / `grow` and scrolls inside its shelf.
5. **Accent.** Colours come from the theme (`toneOf`, `darkOf(t)`, `palette.primary`) - a bare cyan literal fails
   `src/accent.guard.test.ts`. Light and dark both work.
6. **WCAG AA.** Text on glass uses the board's tones (all ≥ 4.5:1); every control has a name; focus is visible (2 px accent ring);
   a region is named by its heading; a decorative icon is `aria-hidden`.
7. **No layout shift.** Skeletons are the size of the cards; the count pill, rail and header never change size when data arrives.
8. **Privacy.** Birth and insurance numbers never reach a label, a URL, a log or storage. Router state carries ids, never names.

## 6. Converting a page - the checklist

1. Read the page and its tests. List what it **does** (filters, create, edit, permissions, deep links) - that must all survive.
2. Frame it: `<PageFrame title purpose primaryAction ...>`. Move the page's main action up (it is pinned on a phone for you). Delete the
   old `PageHeader`/`FitPage` (PageFrame is a `FitPage`).
3. Cut the page into **shelves**: each block that has its own title, count, filter or "see all" is one `Shelf`. Pick the layout
   (table the user scans -> `free` + `ResponsiveDataList fill` + `grow` + `fit`; a few cards -> `row`; label/value or a form -> `board`).
   Give each a stable `id`, a count, the four states, and the next action for the empty state.
4. **Connect.** Every name of a patient, club, invoice, appointment, document or service becomes an `EntityLink`/`EntityChip`
   (inside a clickable row pass `onNavigate={(e) => e.stopPropagation()}`). If the page is about ONE entity: `rememberOpened`, a
   `PinButton` in `actions`, `entities` for its neighbours, and a `RelatedShelf` (add a group builder to `related.ts` if the kind is new).
5. **Be smart without AI.** What would a person ask on this page? "What is wrong?" -> an attention rule or a card. "What next?" -> an
   `ActionCard`/empty-state action. "Who is this?" -> a peek. Only use data an api module already returns; null means "not looked", say it.
6. **Phone.** No wide table: `ResponsiveDataList` gives cards; a row of cards swipes; 44 px targets; filters scroll sideways.
7. **Motion.** Nothing to add: `Shelf`, `MetricCard`, `CountUp` and the card surface already follow the kit and the setting. Do not
   add a transition of your own.
8. **Tests.** Update tests that assert removed markup (`.MuiTypography-overline`, `closest('.MuiPaper-root')`, `data-panel`); find a
   shelf by `screen.getByRole('region', { name: 'Objednaní' })`, a card by `data-card`, a link by its accessible name. Keep every
   behaviour test. Add: the shelves exist, each empty state offers its action, a person without the permission sees no chip/no shelf and
   nothing was requested, the three layouts.
9. **Run** `npm run typecheck`, the page's tests, `node scripts/shelf-check.mjs` with your page added to `PAGES`/`PAGE_PATH`
   (it checks scroll, overflow, errors, 44 px, shelves' headings in four viewports), then look at the screenshots.

### Do / don't

| Do | Don't |
|---|---|
| import primitives from `ui/shelf`, data shelves by path | import `peek.ts` or an api module into a card (it lands in every first load) |
| link with `EntityLink` / `entityTarget` | build `/patients/${id}` or put a name in router state |
| say "Vše vyřízeno" only when every source answered | draw an all-clear for a list that failed or was not asked |
| give an empty shelf its next action | write "Žádná data" |
| use `row` for a handful of cards, `free` + `grow` for a register | wrap a card in a card, or a table in a glass board of its own |
| use `toneOf` / theme colours | type a hex, `rgba(0, 230, ...)` or `#fff` on `primary.main` |
| call `rememberOpened` once the entity has loaded | store anything but kind, id, label (+ calendarId / patientId) |
| let the shell's `#fit-region` scroll | add `overflow: auto` to a page root or a `100vh` |

## 7. Tests and checks

* `src/ui/shelf/*.test.ts(x)` - models (entities, memory incl. junk values, attention rules, command ranking, related groups, peek facts),
  components (Shelf states, cards, EntityLink peek with hover/keyboard/touch/permission, PageFrame, RecentAndPinned) and
  `palette/CommandPalette.test.tsx` (keyboard flow, permission hiding, abort, privacy). `src/components/UniversalSearch.test.tsx` the shortcut.
* Page tests: `Dashboard.test.tsx`, `PatientList.shelf.test.tsx`, `patients/PatientCard.shelf.test.tsx` (+ the existing layout tests, updated).
* `node scripts/shelf-check.mjs` - real Chromium (own, headless): four viewports x three pages, screenshots in `design/shelf/`, scroll,
  overflow, console, 44 px, headings, palette (open/type/arrows/Esc/button/Enter, timed), peek (timed, keyboard), accent swap, the three
  motion states, and a populated pass from mocks in a private context. `design/shelf/report.json` has the numbers.
* `npm run build:check` - bundle budget (see "Measured").

## 8. Known limits (so nobody pays twice)

* **A patient's club** is not a field anywhere: it is read from the `partnerName` of the bookings in the 61-day window and linked only
  when exactly one club has that name. A backend `GET /api/patients/{id}/clubs` would replace the guess.
* **Server patient search** matches only patients that have a search key; rows seeded without one (the dev database's first five)
  are never found by `/api/patients/search` or `/api/patients?query=` - a data fact, not a palette bug. The list still shows them.
* **Expiring certificates** cover today's patients only (one `checkRequired` each, at most 10).
* **Appointments in the palette** have no calendar id in `GET /api/scheduling/appointments`; a result opens the calendar on its day.
* **Recents** are per account but survive sign-out on a shared computer (names are stored). Add the key to the sign-out clean-up if
  the clinic wants them gone.
* Verified in headless Chromium only (not Safari, Firefox or a real phone). Under `prefers-reduced-motion` the kit's rules apply.

## 9. The 67 staff routes

`Area`: **A1** Den na recepci (today, availability), **A2** Pacienti (registration, card sections, intake, diagnostics, feedback),
**A3** Peníze (billing, till, export, prices, discounts), **A4** Kluby (club screens that are not the planner), **A5** Rozvrh a nabídka
(calendars, činnosti, služby, hours, exceptions, blocks, absences, reservations), **A6** Klinika - nastavení a dokumenty (the settings
hub and the clinic's own texts, rules, templates), **A7** Systém a bezpečnost (admin, health, team, audit, 2FA, integrations).
`Prio`: **P1** used all day, **P2** weekly, **P3** set up once. `Out` = out of scope (own fixed layout).

| # | Path | Screen | Current state | Target shelves | Connections it should expose | Area | Prio |
|---|---|---|---|---|---|---|---|
| 1 | `/prehled` | Přehled | **Redone in Stage 4** (no shelves) | Dnes, Vyžaduje pozornost, Tento týden, Kluby k vyřízení (was: Dnes, Vyžaduje pozornost, Najít pacienta, Objednaní, Čekárna, Připnuté a nedávné, Nově v kartotéce) | patients, bookings, invoices, club orders, intake | A1 | done |
| 2 | `/planner-lab` | Planner lab (dev, localhost only) | planner demo | **Out** - the planner's lab | - | - | out |
| 3 | `/patients` | Pacienti | **Done (pilot)** | Čeká na vás (intake), Naposledy otevření, Kartotéka (grow) | patient chips + peek, intake queue | A2 | done |
| 4 | `/patients/register` | Nový pacient (1576 lines) | **Done (S-2)** | PageFrame; Údaje pacienta (board), Souhlasy, Podobní pacienti (EntityCards of possible duplicates), Po uložení (ActionCards: objednat, karta) | duplicates -> patient chips; after save -> card, booking, quick link | A2 | done |
| 5 | `/patients/:id/edit` | Úprava karty (990) | **Done (S-2)** | PageFrame with the patient's chips; Osobní údaje, Kontakty, Pojištění, Poslední změny (author + reason) | patient card, audit log, recents | A2 | done |
| 6 | `/patients/:id` | Karta pacienta (layout) | **Done (pilot)** | header, banners, sticky tabs | - | A2 | done |
| 7 | `/patients/:id` index | Přehled karty | **Done (pilot)** | Související, Osobní údaje, Historie návštěv, Výsledky, Příští termín, Upozornění | termíny, faktury, dokumenty, klub, souhlasy | A2 | done |
| 8 | `/patients/:id/dokumenty` | Dokumenty karty (203) | **Done (S-2)** | Co chybí (attention cards from `checkRequired`), Dokumenty (EntityCards with status), Nahrát | appointment that asks for it, template (settings), signed-by | A2 | done |
| 9 | `/patients/:id/terminy` | Termíny karty (311) | **Done (S-2)** | Nadcházející (appointment cards), Minulé (list), Zrušené | booking detail, invoice per visit, činnost, club | A2 | done |
| 10 | `/patients/:id/historie` | Historie karty (129) | **Done (S-2)** | Změny karty (who, when, why), Přístupy | audit log, author | A2 | done |
| 11 | `/patients/:id/vysledky` | Výsledky karty (232) | **Done (S-2)** | Poslední sezení (metrics), Sezení (list), Ruční zápis | diagnostics form, PDF, trend | A2 | done |
| 12 | `/patients/:id/faktury` | Faktury karty (151) | ResponsiveDataList | K úhradě (attention), Všechny faktury (invoice cards) | invoice -> Fakturace, appointment | A3 | P2 |
| 13 | `/diagnostics/new` | Nové vyšetření (521) | **Done (S-2)** | PageFrame with the patient chip; Měření, Poznámky, Po uložení | patient card, results, PDF | A2 | done |
| 14 | `/billing` | Fakturace (493) | FitPage + KpiCard + table | metrics (Dnes, K úhradě, Po splatnosti, Ke schválení), Vyžaduje pozornost (overdue, approval), Faktury (grow); invoice detail -> `invoiceRelatedGroups` | patient, appointment, club, payments, PDF | A3 | P1 |
| 15 | `/cashier` | Pokladna (311) | FitPage + KpiCard + list | Dnešní tržba (metrics), K zaplacení dnes (list of today's open visits), Poslední platby | patient chips, invoice, appointment | A3 | P1 |
| 16 | `/accounting-export` | Účetní export (217) | FitPage + list | Období (board), Připraveno k exportu (metric), Poslední exporty | invoices in the range, billing | A3 | P3 |
| 17 | `/nastaveni/cenik` | Ceník (staff, 324) | FitPage + table | one shelf per kategorie (položky ceníku), Bez ceny (attention) | činnost that uses an item, discounts | A3 | P3 |
| 18 | `/nastaveni/slevy` | Slevy (196) | SettingsFrame | Slevy (cards), Kdo je používá | clubs, group discounts | A3 | P3 |
| 19 | `/nastaveni/skupinove-slevy` | Skupinové slevy (330) | SettingsFrame | Stupně (cards), Příklad výpočtu | clubs, orders | A3 | P3 |
| 20 | `/nastaveni/firma-a-faktury` | Firma a faktury (336) | SettingsFrame | Firma, Číslování faktur (preview), Bankovní účet | invoices | A3 | P3 |
| 21 | `/clubs` | Přehled klubů (382) | FitPage + SoftCard cards | Čeká na vás (inquiries), Kluby (club cards: seats, next term, owed), Připnuté kluby | club chips + peek, orders, invoices, planner (link, out of scope) | A4 | P1 |
| 22 | `/clubs/objednavky` | Objednávky klubů (264) | FitPage + list + detail | Poptávky (Requested), Potvrzené, Dokončené (status shelves), detail with RelatedShelf (club, invoice, players) | club, invoice, planner window | A4 | P1 |
| 23 | `/clubs/rezervace` | Rezervace (172) | ResponsiveDataList | Dnes, Tento týden (windows), Bez obsazení (attention) | club, order, calendar day | A4 | P2 |
| 24 | `/clubs/hraci` | Hráči (128) | ResponsiveDataList + filters | Hráči (grow table), Chybí termín (attention) | club, order, athlete status | A4 | P2 |
| 25 | `/clubs/statistiky` | Statistiky klubů (99) | SoftCard | metrics per club, Obsazenost (grid) | club chips | A4 | P3 |
| 26 | `/clubs/fakturace` | Fakturace klubů (162) | KpiCard + list | K vyfakturování (attention), Faktury klubů | club, invoice, order | A4 | P2 |
| 27 | `/clubs/:clubId/kalendar` | Plánovač klubu | planner stage | **Out** - fixed layout | - | - | out |
| 27a | `/clubs/:clubId` | Stránka klubu (Stage 5a) | shelf page: Statistiky, Objednávky, Nejbližší termíny, Poslední změny, Hráči, Odkazy | **In** - `pages/clubs/overview`, `docs/stage5a-2026-10.md` | - | - | done |
| 28 | `/nastaveni/kluby` | Nastavení klubů (302) | SettingsFrame | Výchozí hodnoty, Odkazy a platnost | clubs, orders | A4 | P3 |
| 29 | `/vyhrazeni` | Vyhrazení partnerů (735) | FitPage + SoftCard | Aktivní vyhrazení (cards), Končí brzy (attention) | partner/club, calendar, orders | A4 | P2 |
| 30 | `/intake-review` | Kontrola registrací (509) | **Done (S-2)** | Čeká (oldest first, cards), Možné shody (patient cards), Vyřízeno dnes | patient chips (match candidates), registration link settings | A2 | done |
| 31 | `/hodnoceni-pacientu` | Hodnocení pacientů (145) | **Done (S-2)** | metrics (průměr, počet), Nová hodnocení (cards), K vyřízení | patient, appointment | A2 | done |
| 32 | `/planovani` | Kalendář | planner stage | **Out** - fixed layout | - | - | out |
| 33 | `/dnes` | Dnešní přehled (715) | FitPage + KpiCard + StackTable | metrics, Vyžaduje pozornost (today only), per-calendar columns as shelves, Čekárna | patient, booking, činnost, invoice per visit | A1 | P1 |
| 34 | `/prehled-sluzeb` | Přehled podle služeb (625) | FitPage + filters + table | Filtr (board), per služba shelves (booked / free), Volná kapacita (metric) | služba, činnost, calendar, bookings | A1 | P2 |
| 35 | `/availability` | Dostupnost (204) | FitPage + KpiCard | Kdo je dnes k dispozici (cards), Nepřítomnosti (list) | worker, calendar, absences | A1 | P2 |
| 36 | `/kalendar/:calendarId/termin/:appointmentId` | Termín (notification landing, 64) | redirect/opener | PageFrame for one appointment: Související (patient, činnost, invoice, club, paperwork), Historie | appointment is an entity: this IS its page | A1 | P2 |
| 37 | `/blokovany-cas` | Blokovaný čas (387) | FitPage + StackTable | Aktivní bloky (cards), Končí brzy | calendar, worker | A5 | P2 |
| 38 | `/nastaveni/sluzby` | Služby (613) | SettingsFrame | Služby (cards: činností, kalendářů), Bez činnosti (attention) | činnosti, calendars, required documents | A5 | P2 |
| 39 | `/nastaveni/sluzby/:serviceId` | Služba (same screen, open) | SettingsFrame | Služba (board), Činnosti (cards), Kalendáře, Potřebné dokumenty | činnost, calendar, document template | A5 | P2 |
| 40 | `/calendars` | Kalendáře (800) | SettingsFrame + StackTable | Kalendáře (cards), Kdo vidí (board) | worker, služba, hours | A5 | P2 |
| 41 | `/activities` | Činnosti (930) | SettingsFrame + StackTable | Činnosti (grouped by služba), Bez ceny / bez kalendáře (attention) | služba, price item, documents, calendar | A5 | P2 |
| 42 | `/working-hours` | Otevírací doba (694) | SettingsFrame | Týdenní rozvrh (board), Období a cyklus | calendar, exceptions | A5 | P3 |
| 43 | `/exceptions` | Výjimky (446) | SettingsFrame | Nadcházející (cards), Minulé | calendar, holiday | A5 | P3 |
| 44 | `/nepritomnosti` | Nepřítomnosti (347) | SettingsFrame | Právě nepřítomní, Plánované | worker, availability | A5 | P3 |
| 45 | `/svatky` | Svátky a volno (414) | SettingsFrame | Nadcházející, Rok | calendar, exceptions | A5 | P3 |
| 46 | `/nastaveni/barvy-sluzeb` | Barvy služeb (240) | SettingsFrame | Služby s barvou (cards), Kontrast (attention) | služba, činnost | A5 | P3 |
| 47 | `/settings` | Nastavení - hub (473) | FitPage + SettingsFrame | one shelf per group (cards = settings screens with their current value), Naposledy změněno, Vyžaduje nastavení (attention: missing company data...) | every settings screen, change history | A6 | P1 |
| 48 | `/settings/:group` | Nastavení - skupina | same | the group's shelf | - | A6 | P1 |
| 49 | `/nastaveni/udaje-pacienta` | Údaje o pacientovi (217) | SettingsFrame | Karta, Seznam (two boards of fields) | patient card, register | A6 | P3 |
| 50 | `/nastaveni/rychla-registrace` | Rychlá registrace (226) | SettingsFrame | Pole, Platnost odkazu | intake, quick link | A6 | P3 |
| 51 | `/nastaveni/odkaz-registrace` | Odkaz pro registraci (306) | SettingsFrame | Odkaz (board), Kdo se zaregistroval | intake review, patients | A6 | P3 |
| 52 | `/dotaznik-nastaveni` | Dotazník (1163) | SettingsFrame | Otázky (cards by section), Náhled | činnost that asks it | A6 | P3 |
| 53 | `/nastaveni/souhlasy` | Souhlasy (158) | SettingsFrame | Zákonné (read-only), Volitelné | patient card, činnost | A6 | P3 |
| 54 | `/pravidla-dokumentu` | Pravidla dokumentů (554) | SettingsFrame | Pravidla (cards per služba), Bez pravidla | služba, template, patient documents | A6 | P3 |
| 55 | `/dokumenty-sablony` | Šablony dokumentů (262) | SettingsFrame | Šablony (cards), Nepoužité | rules that use it | A6 | P3 |
| 56 | `/nastaveni/sablony-emailu` | Šablony e-mailů (290) | SettingsFrame | Šablony (cards), Náhled | reminders, orders | A6 | P3 |
| 57 | `/nastaveni/pripominky` | Připomínky (156) | SettingsFrame | Pravidla, Fronta (failed count -> system health) | e-mail templates, outgoing queue | A6 | P3 |
| 58 | `/nastaveni/vzhled-kalendare` | Vzhled kalendáře (331) | SettingsFrame | Barvy, Svátky a pauzy (preview) | calendar | A6 | P3 |
| 59 | `/nastaveni/media-a-texty` | Média a texty webu (436) | SettingsFrame | Stránky (cards), Obrázky | public site | A6 | P3 |
| 60 | `/nastaveni/uloziste-medii` | Úložiště médií (219) | SettingsFrame | Stav úložiště (metrics), Nastavení | system health | A7 | P3 |
| 61 | `/nastaveni/integrace` | Integrace (240) | SettingsFrame | Připojení (cards with status), Poslední události | system health | A7 | P3 |
| 62 | `/nastaveni/historie-zmen` | Historie změn (284) | SettingsFrame + table | Změny (grow), Filtr podle autora a důvodu | the changed screen, audit log | A7 | P2 |
| 63 | `/nastaveni/zabezpeceni` | Zabezpečení / 2FA (192) | SettingsFrame | Dvoufázové ověření (board), Aktivní relace | account | A7 | P2 |
| 64 | `/admin` | Správa (264) | SettingsFrame | Správa účtu a kliniky (cards), Nebezpečné akce | staff, audit | A7 | P3 |
| 65 | `/system-health` | Zdraví systému (316) | SettingsFrame + KpiCard | metrics, Vyžaduje pozornost (failed queue, storage, migrations), Relace, Chyby | the attention card "Neodeslané zprávy" links here | A7 | P2 |
| 66 | `/staff-management` | Tým (608) | SettingsFrame + table | Tým (user cards: role, last sign-in), Oprávnění, Pozvánky | worker chips, audit | A7 | P2 |
| 67 | `/audit-log` | Audit (255) | SettingsFrame + table | Události (grow), Filtr; each row's subject is an entity chip | patient, invoice, user | A7 | P2 |
| - | `*` | Nenalezeno (42) | SoftCard | Kam dál: recents + pages (palette) | recents, command palette | A1 | P3 |

Not counted: the six retired paths (`/injuries`, `/rtp`, `/concussion`, `/training-load`, `/wellness`, `/statistiky`) redirect to `/prehled`.

### Recommended split for Phase 2 (one agent per area, disjoint files)

| Agent | Area | Rows | Notes |
|---|---|---|---|
| S-1 | A1 Den na recepci | 33, 34, 35, 36, `*` | `/dnes` is the second-most-used screen: reuse `TodayRow` from `Dashboard.tsx` (move it into `ui/shelf` when the second page needs it) |
| S-2 | A2 Pacienti | 4, 5, 8, 9, 10, 11, 13, 30, 31 | start with 8, 9 (daily use); `/intake-review` is the biggest win after them; `related.ts` grows `intake` and `appointment` groups |
| S-3 | A3 Peníze | 12, 14, 15, 16, 17, 18, 19, 20 | `/billing` first; the invoice detail gets `invoiceRelatedGroups` (already built and tested) |
| S-4 | A4 Kluby (not the planner) | 21, 22, 23, 24, 25, 26, 28, 29 | `/clubs/:clubId` stays out; chips to it are fine (`entityTarget` knows it) |
| S-5 | A5 Rozvrh a nabídka | 37-46 | all `SettingsFrame` pages: convert after S-7 has given `SettingsFrame` the shelf frame |
| S-6 | A6 Klinika | 47-59 | the hub (47, 48) first - it is the entry to every settings page |
| S-7 | A7 Systém a bezpečnost | 60-67 | **do `SettingsFrame` / `SettingsScreen` first** (one change converts ~35 screens' frame); 65 feeds the attention shelf |

Order that gives the owner the most for the least: S-1 and S-2 (daily screens), S-7's `SettingsFrame` (one change, 35 screens look
like one product), S-3 `/billing`, S-4 `/clubs`, then the setup-once screens.
Shared files that more than one agent will want: `related.ts`, `entities.ts` (a new kind), `attention.ts`, `commandModel.ts` (a new
action) - add to them, do not reorder; each has a test per branch.

## 10. Measured (Phase 1)

Branch `ui/shelf` from `claude/clean` 100c7fd, not pushed. Own headless Chromium against a Vite dev server on the dev API (the machine was
busy with other agents, so absolute times are an upper bound). Raw numbers: `design/shelf/report.json`.

**Bundle** (brotli, `npm run build:check`; before = 100c7fd, after = this branch; `PRERENDER_API_URL=off npm run build` passes)

| Group | Before | After | |
|---|---|---|---|
| application entry | 257.8 kB | 258.7 kB | +0.9 (the shortcut listener and a `lazy()`) |
| public entry | 317.6 kB | 318.4 kB | +0.8 |
| sign-in | 5.6 kB | 5.6 kB | - |
| staff portal (shell) | 64.2 kB | 63.2 kB | -1.0 (the old palette left the shell) |
| **Přehled** | 43.4 kB | **63.2 kB** | **+19.8, intended**: the shelf system (`shelf` chunk 10.6), recents/entities (2.7), what the attention shelf reads (club orders 2.3, invoice rules 1.5, ...) - every later page reuses these chunks. Baseline raised in `scripts/bundle-budget.json` (44 401 -> 64 683 B), the others pass on the old numbers |
| planner | 234.0 kB | 234.5 kB | +0.5 |
| command palette (lazy) | - | 5.6 kB | fetched in idle time after the first paint, never in a first load |
| peek card's data (lazy) | - | 1.8 kB | fetched on the first hover or focus of a chip |

Lesson that cost 31 kB in the entry before it was found: `@popperjs/core` had no vendor group, so the bundler put it in a shared chunk with the
API (`appointments`, zod ~100 kB raw) and the MUI vendor chunk imported that - **every** entry then downloaded zod. `vite.config.ts` now
puts `@popperjs` in the `mui` group. If `app-entry` jumps in a future change, `node scripts/chunk-report.mjs` shows who imports what.

**Interaction timing** (`scripts/shelf-check.mjs`; dev server, so the first open includes fetching the palette chunk from Vite)

| | 390x844 | 820x1180 | 1440x900 | 1920x1080 |
|---|---|---|---|---|
| Ctrl+K -> palette open, field focused | 349 ms | 371 ms | 368 ms | 368 ms |
| search button -> open (second open) | 88 ms | 89 ms | 95 ms | 92 ms |
| type "Test" -> first patient row (200 ms debounce + server) | 527 ms | 538 ms | 523 ms | 532 ms |
| ArrowDown -> selection moves | same frame | same frame | same frame | same frame |
| Enter on "Nová objednávka" -> calendar route | 34 ms | 31 ms | 32 ms | 34 ms |
| Esc -> palette gone (exit transition) | 233 ms | 223 ms | 226 ms | 227 ms |
| pointer arrives on a chip -> peek in the document | - | - | 384 ms | 379 ms |
| ... -> facts in the peek (one request) | - | - | 408 ms | 402 ms |

(The peek's designed pause is 350 ms; the rest is the render.) A figure counts up once (`CountUp`), the cascade is 22 ms per card for at most 14
cards, a press dips in one frame.

**Checks that ran green** (4 viewports x Přehled, Pacienti, a patient's card, plus a populated pass from mocks in a private context)
- the document never scrolls (vertically or sideways) - 12 of 12; nothing is clipped by the region's right edge;
- no console error, no page error, no failed request;
- every touch target in the page is 44 px at 390 and 820 (phone, tablet); at 1440 and 1920 nothing is under 32 px except the register's
  16 px-high name links (the whole row is the target there; listed as a NOTE, not a failure);
- one h1 per page, every shelf a region named by its heading;
- the palette: Ctrl+K, the button, type, arrows, Esc, Enter - on all four viewports; the peek: mouse and keyboard (Tab opens, Esc closes);
- one accent swap through Nastavení (Fialová): the rail, the count pill and the primary button all moved, then put back;
- the Animace setting: `vypnuto` leaves no inline transform/opacity on a shelf, `omezené` writes no transform, `plné` settles clean;
- populated: five attention cards (overdue invoice, no paperwork today, club inquiry, registrations, failed messages), the most urgent first,
  five rows of today's work, at 390, 820, 1440 and 1920.

**Tests**: `npm run typecheck` clean; the whole suite **7 771 passed, 7 skipped (as before), 423 files** (before: 7 654 / 414); the 16 files this work
added or changed hold 249 tests (`src/ui/shelf/*`, `UniversalSearch`, `Dashboard`, `PatientList.shelf`, `PatientCard.shelf`). `npm run build` and
`npm run build:check` pass.

**Screenshots** (`design/shelf/*.jpg`, JPEG q82): `prehled-`, `patients-`, `patient-` x 390x844, 820x1180, 1440x900, 1920x1080;
`palette-open-`, `palette-typed-` x 4; `peek-` x 2; `prehled-accent-default-` / `-purple-`; `prehled-populated-` x 4 (**mocked answers**, not the dev data).

**Not verified**: Safari, Firefox, a real phone or touch (the pointer rules are tested with a mouse and synthetic touch events); a production build
under load (the numbers are a dev server); the settings pages (Phase 2); a screen reader (the structure - regions, headings, `combobox` /
`option`, named controls - is asserted, but nobody listened to it).
