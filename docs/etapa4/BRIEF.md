# SportMedical — Etapa 4 shared brief: klubové objednávky (club orders) — binding for every agent

Source: Matko's spec "Úprava rezervačního systému" (21 points, 4. 10. 2026). Standing rules (never ask again): everything configurable in
Nastavení, nothing hard-coded; decide yourself, record each decision with a reason in your report; Czech UI; three layouts (phone ≤767,
tablet 768–1279, desktop ≥1280; `src/layout/useDevice.ts`, tests with `setViewport` from `src/test/viewport.ts`); GitHub only under `bhaaddin`.

## Decisions made (so nobody re-asks)
- **D1 Club order = one aggregate.** A **ClubOrder** ("klubová objednávka") is the one thing a club books: club, ONE service, činnosti with
  seats, payment method, price, status, terms (windows). It owns 0..n existing **ClubBlocks** (the confirmed calendar windows; each block
  gets `clubOrderId`). Athletes of an order register through ONE link (the order's `registrationToken`) and get the earliest fitting slot
  across all of the order's windows. Legacy blocks (no order) keep working with their own link.
- **D2 One service per order/block.** An order has exactly one `serviceId`; its činnosti must belong to that service and its blocks may
  use only that service's calendars. Mixing services in one order is refused unless the admin setting `allowMultiServiceOrders` is true
  (default false). Different services at the same time live in different orders and calendars.
- **D3 Status flow.** `Invited` (staff created the order and copied the form link) → `Requested` (club submitted the form) → `Confirmed`
  (staff processed it: windows exist in the calendar) → `Completed` (after the last window, automatic) or `Cancelled`. Staff may also create an
  order directly as `Confirmed` (phone order through the calendar "chytrá zkratka") or `Requested`.
- **D4 Release of unused capacity.** Setting `releaseUnusedDaysBefore` (integer ≥ 0 or null = never; per-order override `releaseDaysBefore`).
  A daily sweep, N days before a window starts, shortens or removes the part of the order's windows that is not needed for the order's
  still-unfilled seats (allocate the needed minutes chronologically, earliest first; surplus tail minutes and whole surplus days go back to the
  public offer; already booked athlete slots are never touched). Idempotent; every release is written to the order history.
- **D5 Payment.** `paymentMethod`: `ClubInvoice` (invoice to the club) or `PerPerson` (each athlete pays). Part of the order; `ClubInvoice`
  prefills a Tým invoice in Fakturace (existing price-quote and billing flow).
- **D6 Price** is visible in the form and computed server-side by the existing `PriceQuoteService` as recipient type `Team` (club discount,
  tiers, packages); a snapshot is stored on the order when it is submitted or confirmed.
- **D7 No club-created reservations without the form.** Clubs only ever (a) fill the order form, (b) register athletes through the order link.
- **D8 Patient booking drawer:** "Objednat pacienta → Rezervovat pacienta" has ONLY patient search (database) and quick registration; the
  "Klub" mode and club search are removed from it (club work lives in the Kluby section and the calendar's "chytrá zkratka").
- **D9 Archiving, not deleting** services and činnosti; duplicate service names are refused (case and diacritics insensitive, 409 `service.duplicate`).
- **D10 Contextual sidebar** (Kluby / Pacienti / Kalendář get their own children) and a **collapsible Provoz** group in Settings.

## Backend contract C-O (JSON camelCase; staff endpoints `[Authorize]`, public ones anonymous and rate limited)
`Range = { fromDate, toDate, dailyFrom?: "HH:mm", dailyTo?: "HH:mm" }` (dates `yyyy-MM-dd`).

`ClubOrderView = { id, clubId, clubName, clubColorHex, serviceId, serviceName,
status: "Invited"|"Requested"|"Confirmed"|"Completed"|"Cancelled",
paymentMethod: null|"ClubInvoice"|"PerPerson",
activitySeats: [{ activityId, activityName, durationMinutes, seats, registered, unitPriceCzk }],
totalSeats, registered,
priceQuote: null|{ listTotalCzk, discounts: [{ kind, label, percent, amountCzk }], totalCzk },
requestedRanges: [Range], blocks: [ClubBlockView], note,
contact: null|{ name, phone, email },
formToken, formUrl, registrationToken, registrationUrl,
releaseDaysBefore: number|null, effectiveReleaseDaysBefore: number|null,
createdBy: "Staff"|"Club", createdAtUtc, submittedAtUtc, confirmedAtUtc,
history: [{ atUtc, user, text }] }`

Staff, base `/api/v1/club-orders`:
- `POST /` body `{ clubId, serviceId?, note? }` → 201 order `Invited` with `formUrl` (the desk copies it; nothing is sent by e-mail).
- `POST /staff` body `{ clubId, serviceId, activitySeats: [{activityId,seats}], paymentMethod, ranges: [Range], calendarIds: [], status: "Confirmed"|"Requested", note?, releaseDaysBefore? }` → 201. `Confirmed` creates the blocks atomically (all or none; 409 naming the conflicting range when the time is taken).
- `GET /?clubId=&status=&from=&to=` list; `GET /{id}` detail; `GET /{id}/history`.
- `PUT /{id}` body `{ activitySeats?, paymentMethod?, ranges?, calendarIds?, note?, releaseDaysBefore? }` edits a Requested or Confirmed order: add or remove players, add or remove a činnost, extend, shorten, move, add or remove windows. Blocks are diffed (kept, extended, shortened, created, cancelled). Lowering seats below `registered`, or removing windows that hold athletes, answers 409 `{ code, message, affectedAthletes[] }` as blocks do; `?cancelAffectedAthletes=true` proceeds.
- `POST /{id}/confirm` body `{ calendarIds, ranges }` (the final, user-adjusted windows) for a Requested order: creates the blocks, status `Confirmed`.
- `POST /{id}/cancel?cancelAthletes=false|true`.
- `POST /proposal` body `{ serviceId, activitySeats, calendarIds, startDate, startTime?, daysOfWeek?: number[], weeks?: number }` → `{ ranges: [Range], analysis }`. The AUTOMATIC suggestion: needed minutes (Σ seats × duration ÷ the činnost's parallelCapacity, spread over the chosen calendars) laid out from `startDate`/`startTime` over as many days as needed inside open hours (only on `daysOfWeek` when given, repeated for `weeks` weeks). It is only a suggestion; the user edits the ranges afterwards. `analysis` is the existing club-block analysis shape.
- `GET /api/v1/clubs/{id}/summary` (club as one whole) → `{ clubId, totalSeats, registered, remaining, byService: [{ serviceId, serviceName, seats, registered }], byActivity: [{ activityId, activityName, serviceName, seats, registered, remaining }], ordersByStatus: { Invited, Requested, Confirmed, Completed, Cancelled }, bookedMinutes, usedMinutes }`.
- `GET /api/v1/club-orders/stats?from=&to=` → `{ totals: <summary fields over all clubs>, byClub: [{ clubId, clubName, ...summary fields }], byService, byActivity }`.

Public, base `/api/public/club-order/{token}` (token = the order's `formToken`; 404 unknown, 410 cancelled):
- `GET` → `{ clubName, status, services: [{ serviceId, serviceName, activities: [{ activityId, name, durationMinutes, unitPriceCzk }] }], paymentMethods: ["ClubInvoice","PerPerson"], draft: null|{ serviceId, activitySeats, ranges, paymentMethod, contact, note }, minimumPlayers: number|null }` (only active, publicly bookable činnosti with a price; prices come from the price list).
- `POST /quote` body `{ serviceId, activitySeats }` → `{ listTotalCzk, discounts, totalCzk, totalSeats, neededMinutes }`.
- `POST /submit` body `{ serviceId, activitySeats, ranges, paymentMethod, contact: { name, phone, email }, note? }` → 200 `{ status: "Requested", reference }`; 400 `{ errors: { field: [...] } }`; 409 when already submitted or processed (the club cannot change a processed order and is told to phone the clinic).

Athletes' link: `GET /api/public/club/{token}` and `POST …/claim` accept the order's `registrationToken` (and legacy block tokens); the offer's `activities[]` carry order-level `seats/registered/remaining`.
Settings `GET/PUT /api/v1/settings/clubs` gain `releaseUnusedDaysBefore: number|null` (default null) and `allowMultiServiceOrders: boolean` (default false).
Services: `DELETE /api/clinic-services/{id}` and `DELETE /api/activities/{id}` ARCHIVE (`isActive=false`) and never remove rows that appointments, blocks or orders reference; creating or renaming a service to an existing name answers 409 `{ code: "service.duplicate", message }` (same for a činnost name inside one service).

## Routes (frontend)
Staff: `/clubs` (přehled klubů), `/clubs/objednavky` (orders list + detail), `/clubs/rezervace` (blocks and windows), `/clubs/hraci` (athletes), `/clubs/statistiky` (club analysis), `/clubs/fakturace` (Tým invoices); public order form `/klub-objednavka/:token`; athletes' link `/klub/:token` (existing).

## File ownership
Each agent edits only the files its prompt lists. Shared files owned by exactly one agent: `src/App.tsx`, `src/components/shell/**`, `src/pages/settings/catalogue.ts` and the settings nav (the sidebar agent). Frontend agents share one working tree: no git commit/stash/checkout, no servers, no browser unless allowed. Backend agents work in their own worktree, commit on their branch, never create an EF migration (the integrator makes it), never push.

## Report format (final message)
Summary per item, filesChanged, testsRun (commands and counts), decisions (each with reason), notDone, contractDeviations (exact JSON), notesForIntegrator.
