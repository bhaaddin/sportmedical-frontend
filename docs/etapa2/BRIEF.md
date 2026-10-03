# Etapa 2 — shared brief for every agent

Read this whole file first. It is the single source of truth for decisions and for the API contracts that
the backend agents ship and the frontend agents consume at the same time. If something here conflicts with
older code, this wins. If something is not covered, decide it yourself, write the decision and the reason
into your final report (`decisions`), and move on. **Nobody asks Matko anything. Nobody stops at a checkpoint.**

## Sources of the design (Matko's artboards — authoritative for look and behaviour)

- Staff UI, 19 artboards (1440×900): https://claude.ai/artifact/3Z8Rj7A3BE2tWbk25SGMHJ
  files: `project/Main.dc.html` (calendar day), `L01-Tyden`, `L01-Mesic`, `Z-60`, `Z-30`, `Z-10`, `N-Slot`, `N-Objednat`,
  `N-Rychla`, `N-Klub`, `N-Objednat2`, `M-Detail`, `M-Uprava`, `P-Pacienti`, `P-Pacient`, `P-Kluby`, `P-Klub`, `P-Fakturace`,
  `P-Nastaveni` (**ignore its two-sidebar layout, see decision 2**).
- Patient web, 16 artboards: https://claude.ai/artifact/8kjYNsPPp47nQfYKBkp1K9
  files: `project/V-Web2.dc.html` (**the quality bar for everything public**), `V-Web`, `V-Rezervace`, `V-KlubReg`, `V-Dotaznik`,
  `V-Portal`, `V-Vysledky`, `V-Sluzby`, `V-Prohlidky`, `V-Diagnostika`, `V-InBody`, `V-Cenik`, `V-Dokumenty`, `V-Kontakt`, `V-ONas`, `V-Kluby`.
- Earlier brief (Nastavení, visual editor, three interfaces): Claude Docs doc `815c3e85-8c77-495f-ab38-6e92b682102e`
  (read with the Claude Docs connector `read`, ref `{object:"project", id:"815c3e85-8c77-495f-ab38-6e92b682102e"}`, then the tab node).
- Read an artboard with the Artifact tool: `{action:"read", url:"<canvas url>", paths:["project/<File>.dc.html"]}`; it is saved locally and you read
  the saved copy. Artboard HTML is inline-styled: take sizes, colors, spacing, type, states from it. Do not invent your own.
  The artboards contain placeholder numbers and names ("62 sportovců", prices, "Hladina −10 %"): **never copy data, bind to the API**.
- Our own earlier extraction of the board's tokens: `docs/design/design-board-2026-10-03.md` and `src/theme.ts` (`DESIGN`). The new artboards are
  the same family (Public Sans, forest `#0D5C52`, ink `#14181C`/`#1A1D21`, line `#E2E6EA`, page `#FAFBFC`/`#EFF1F4`). The public web (V-Web2) uses Archivo + the website identity;
  read its tokens from the artboard.

## Non-negotiable rules (from Matko)

1. **Everything configurable lives in the admin, nothing hard-coded**: prices, discounts, deadlines, colours, documents, capacities, limits, texts,
   partners, FAQ, photos, videos. A value a user can see that could change next month is a setting or content, not a constant.
2. **Prices exist only in the price list (Ceník / `ServiceItem`).** Never in a template, a component or a test fixture that ships.
   Correct values (already imported from the clinic's published list): Základní sportovní prohlídka 1 600, Komplexní 2 200,
   Spiroergometrie **3 500**, VO₂max **4 000**; the rest from the live website list (see `src/SportMedical.Diagnostics.Application/Catalogue/web-catalogue-2026-10-03.json`).
   **The import file still has Spiro 4 000 / VO₂max 3 500: backend agent BE-4 fixes the catalogue JSON.**
3. **Three layouts for every screen, built together, never "later"**: phone ≤767 px (bottom bar), iPad 768–1279 (narrow rail that opens on tap), desktop ≥1280 (full fixed sidebar). Test at 390 / 834 / 1440.
   Phone rules: no touch target under 44 px; the main action pinned at the bottom; tables become cards or scroll inside their own box; one field per row; no hover (hover content = on tap).
   iPad: touch + keyboard, portrait one column / landscape two; reception works on it, so calendar and booking are fully featured.
   Use `useDevice()` from `src/layout/useDevice.ts` and, in tests, `setViewport(390|834|1440)` from `src/test/viewport.ts`.
4. **No two sidebars side by side. Anywhere.**
5. Hierarchy of type must be obvious: page title 28/700 full black; section title 18/700 full black; item name 15/600; caption 14/400 grey; field label 11/700 uppercase tracking grey. A title and an item never differ by colour alone.
6. Video is a first-class citizen of the data model and the admin from day one (slots can be image or video).
7. No parallax, no section animations, no counters, no scroll-reveals. Animation ≤200 ms and only where it explains (opening a panel, moving a card). The partner marquee and the hero photo carousel in V-Web2 are allowed and must honour `prefers-reduced-motion`.
8. Never a white screen: a failed load shows what failed and a "Zkusit znovu" button. Placeholders hold space, nothing jumps.
9. Czech UI, literal strings (no new i18n keys). Czech typography: non-breaking space before "Kč", "min", "%"-style units.
10. Never put birth numbers / insurance numbers into logs or messages. Never commit secrets.
11. Mail and SMS: **nothing is sent**. Build queues/templates/reminders behind interfaces, but no dispatch (no provider exists). Staff copy links by hand.
12. Quality gate per agent: typecheck 0 errors in your files, your tests green, and tests that render at 390 / 834 / 1440 for every new screen.

## Matko's decisions (final)

1. **Layout.** Desktop ≥1280: full fixed sidebar with text (258 px). iPad 768–1279: narrow rail with icons, opens on tap (overlays, closes on navigate). Phone ≤767: bottom bar Kalendář · Pacienti · Kluby · Fakturace + "Více" (sheet: Výsledky, Statistiky, Nastavení, Přehled, účet). **No hover-rail.**
2. **Settings replace the sidebar.** On a settings route the main sidebar's content is replaced by the settings sidebar (search, groups, items, with a "← Zpět do aplikace" at the top). Never two side by side. Max three levels: hub → group → item. Breadcrumbs `Nastavení / Skupina / Položka`. On iPad/phone the hub is a list of groups, an item is a full page.
3. **Discounts.** Tier discount (by headcount) and club discount **do not add**: the higher applies. Package discount applies only to the lines of that package. Manual discount is added on top, capped by the role's limit. The invoice shows the whole breakdown. All of it is configurable.
4. **Tiers.** From 4 → 5 %, from 6 → 10 %, from 10 → 15 %. Boundaries and percentages editable; the system refuses overlapping or duplicate boundaries.
5. **Prices** as in rule 2.
6. **Documents.** Turn all existing document requirements off and set every činnost's questionnaire requirement to "not asked". **Legal consents (GDPR, consent to the procedure) stay on.** Per činnost, the admin picks any number of document templates it requires (default none).
7. **Quick registration.** Reality: patient phones, receptionist finds a slot and **books it first**, then enters 4 things — name+surname, phone, e-mail, činnost — and the system produces a completion link. The link does not offer a slot (already chosen). It carries the prefilled data (jméno, příjmení, telefon, e-mail, činnost, diagnostika/service, termín) **server-side** (the token resolves it; nothing personal in the URL) and the patient only completes the rest and delivers the documents of that činnost.
   No date of birth is ever required in quick registration (backend change). Whether DOB is required when the patient completes the link: admin switch, **default off**.
   Deadline **24 h** (admin setting `expiryHours`, default 24) — after it the reservation falls, the slot returns to the offer immediately, the half-made patient record is deleted (provisional only, only when nothing else hangs on it). A reminder before expiry is a setting (default 4 h before) — it is only **queued** (nothing is sent). Applies to desk-made quick registrations only; online self-booking keeps its flow.
8. **Invoices.** Recipient type **Osoba** (patient) / **Skupina** (free group or firm: name, IČO, contact, headcount) / **Tým** (existing club). Skupina and Tým **do not require a patient**. Manual discount on every invoice type, capped per role (Recepce / Lékař / Admin; the Owner is unlimited) by an admin setting; above the cap the invoice is in state **"Čeká na schválení"** and an Admin/Owner approves it in Fakturace. PDF invoice with a QR payment (SPAYD) is built. Company data from the live website: SportMedical Diagnostics s.r.o., IČO 23351632, sídlo Krátká 283, 252 65 Tursko, provozovna GreenLine 5. patro, Jihlavská 1558/21, 140 00 Praha 4 – Michle, tel. 606 785 271, recepce@sportmedical-diagnostics.cz, datová schránka — fetch from sportmedical-diagnostics.cz (policy / contact pages) and put into the company settings; anything not findable stays an empty setting.
9. **Club blocks.** No ceilings (could be 120 or 10 000 players). Parallel stations/doctors per činnost is an admin setting (`parallelCapacity`, default 1). Calculator: `players × činnost minutes ÷ parallel capacity` → needed minutes → from open hours suggests the number of days. The admin picks calendars + činnosti; the rest stays bookable. The block is coloured with the club and carries its name, can be shortened or cancelled, freed slots return. Athletes fill it as they register through the club link. Mobile testing at the club's venue is out of scope.
10. **Calendar columns = činnosti** (as drawn), coloured by their parent service; calendars stay underneath as the capacity container. Month hover: one line per service (InBody its own line when it is its own service); group bookings count per head.
11. **Colours per service.** Each service has a colour, its činnosti get shades of it, a new service gets a colour automatically (from an admin-editable palette), overridable. The same colour is used everywhere (calendar, legends, chips).
12. **Public web.** Pages in V-Web2 quality, **prerendered at build time** (the staff app stays a client app), text/prices/photos from the admin ("Média a texty" screen), no visual editor in this etapa. Photos/videos/logos are placeholders (grey slots with the artboard's caption and the recommended size, no stock photos); partner logos are text until files arrive. Media storage is **Cloudinary behind an interface** (`IMediaStore`), credentials in the admin settings, not in code.
13. **Phone / iPad layouts** are derived from the rules above (no artboards exist).
14. **Results (patient portal).** Show what diagnostic sessions already store, "—" for the rest, plus manual entry for doctors. No device import now.
15. **Integrations** page: ADAM credentials fields and a "nepřipojeno" state, no live calls. MEDISTAR is being abandoned: show it as "ukončeno", no fields.
16. Render's paid plan is not part of the build (reminder at the end only).
17. **Where the public site lives** (decided by the integrator, because the staff app owns `/`): the prerendered public site is under `/web` (`/web`, `/web/sluzby`, `/web/prohlidky`, `/web/diagnostika`, `/web/inbody`, `/web/cenik`, `/web/dokumenty`, `/web/kontakt`, `/web/o-nas`, `/web/kluby`). The patient-facing app pages keep their addresses (`/objednat` = booking only, `/portal/prihlaseni`, `/portal/:token`, `/klub/:token`, `/dotaznik`, `/dokonceni/:token`, `/rezervace/:token`, `/hodnoceni/:token`). When the clinic's domain moves to Vercel, a host-based rewrite maps `sportmedical-diagnostics.cz/*` to `/web/*` (prepared in the report, not enabled now).
17. **Where the public site lives** (decided by the integrator, because the staff app owns ): the prerendered public site is under  (, , , , , , , , , ). The patient-facing app pages keep their addresses ( = booking only, , , , , , , ). When the clinic's domain moves to Vercel, a host-based rewrite maps  to  (prepared in the report, not enabled now).

## API contracts (backend ships exactly this; frontend codes against it; DTO JSON is camelCase)

Backend agents: if a detail must differ, keep the names, change the shape minimally, and **update this section in your last commit** so the frontend sees the truth.
All staff endpoints `[Authorize]`; the permission names are the existing ones (`settings.clinic.manage`, `billing.manage`, `patients.edit`, …) unless stated.

### C1 Documents per činnost, colours, capacity (activities / services)
- `ActivityDto` (+ create/update body) gains: `requiredDocumentTemplateIds: string[]` (default `[]`), `colorHex: string|null` (explicit override), `effectiveColorHex: string` (read-only, computed), `parallelCapacity: number` (int ≥1, default 1).
- `ClinicServiceDto` (+ body) gains `colorHex: string` (`#RRGGBB`; auto-assigned from the palette on create when omitted).
- `GET/PUT /api/v1/settings/service-colors` → `{ palette: string[] }` (≥6 colours, each `#RRGGBB`).
- `effectiveColorHex` of an activity = its own `colorHex` if set, else a shade of its service's colour (stable per activity order: lighter/darker steps).
- Existing `paperwork { ready, missing[] }` on appointments is computed from the activity's `requiredDocumentTemplateIds` (+ legal consents). Existing service-level rules are deactivated by the migration.

### C2 Quick registration
- `GET/PUT /api/v1/settings/quick-registration` → `{ expiryHours: number (1–720, default 24), reminderHoursBeforeExpiry: number (0–expiryHours, default 4), requireDateOfBirthOnCompletion: boolean (default false) }`.
- `POST /api/calendars/{calendarId}/appointments/quick` body `{ activityId, startUtc, firstName, lastName, phone, email, overrideReason?, note? }` → `201 { appointment: AppointmentView, patientId, completionLink: { url, token, expiresAtUtc }, registrationDeadlineUtc }`. Phone must carry a dialling code (`+420…`); no date of birth. Same availability/override rules as a normal booking. It **books first**, creates the provisional patient, issues the completion link.
- `AppointmentView` and `DayAppointment` gain `registrationDeadlineUtc: string|null` and `quickRegistrationPending: boolean`.
- Public completion (existing `/dokonceni/:token` data endpoint) gains `appointment: { activityName, serviceName, startUtc, endUtc, requiredDocuments: [{ templateId, name }] }` and the prefilled facts (`firstName, lastName, phone, email`). If the deadline has passed: `410` with `{ message }`.
- Expiry sweep (hosted service, every minute): reservation with `registrationDeadlineUtc < now` whose patient is still provisional → appointment cancelled (reason `registration_expired`), slot free, provisional patient deleted when it has nothing else; audit entry. A "registration-expiring" outbox message is queued at `deadline − reminderHours` (never dispatched).

### C3 Discounts and invoices
- `GET/PUT /api/v1/settings/discounts` →
  `{ tiers: [{ minPersons: number, percent: number }], packageDiscounts: [{ activityId: string, percent: number }], roleLimits: [{ role: string, maxManualPercent: number }] }` (tiers ascending by `minPersons`, unique, percent 0–100 ≤2 decimals; 400 with field errors otherwise). The old `/api/v1/settings/group-discounts` is kept as a thin alias for the tiers only. Per-club % stays `Club.discountPercent`.
- `POST /api/v1/billing/price-quote` body
  `{ recipientType: "Person"|"Group"|"Team", clubId?: string, headcount?: number, lines: [{ activityId: string, quantity: number }], manualDiscountPercent?: number }` →
  `{ lines: [{ activityId, name, quantity, unitPriceCzk, listTotalCzk }], listTotalCzk, discounts: [{ kind: "tier"|"club"|"package"|"manual", label, percent, amountCzk }], appliedGroupPercent, totalCzk, manualAllowedPercent, requiresApproval }`.
  Rule: `appliedGroupPercent = max(tier(headcount), club.discountPercent)` for Group/Team non-package lines; package lines get their package discount instead; manual % is added on top; `requiresApproval = manual > manualAllowedPercent` (role of the caller; Owner unlimited).
- `POST /api/billing/invoices` body gains `recipientType`, `clubId?`, `group?: { name, ico?, dic?, address?, contactPerson?, contactEmail?, contactPhone? }`, `headcount?`, `manualDiscountPercent?`, `manualDiscountReason?`, `lines?` (activityId+quantity; server prices them via the quote). `patientId` is required **only** for `Person`.
- `InvoiceDto` gains: `recipientType`, `recipientName`, `headcount`, `discounts: [...]` (same as quote), `status` adds `PendingApproval`, `approvedBy?`, `approvedAtUtc?`, `rejectedReason?`.
- `POST /api/billing/invoices/{id}/approve` and `/reject` (body `{ reason }`), permission `billing.approve` (granted to Admin, Owner). While `PendingApproval` the invoice cannot be paid or issued.
- `GET /api/billing/invoices/{id}/pdf` → `application/pdf` (company data, recipient, lines, discount breakdown, total, due date, SPAYD QR when a bank account is set).
- `GET/PUT /api/v1/settings/company` → `{ legalName, ico, dic?, address, city, postalCode, bankAccount?, iban?, dataBox?, phone, email, invoiceDueDays }` (pre-filled from the website; the existing public contact keys keep working).

### C4 Club blocks
- `POST /api/v1/club-blocks` `{ clubId, name?, calendarIds: string[], activityIds: string[], fromDate, toDate (yyyy-MM-dd), dailyFrom?: "HH:mm", dailyTo?: "HH:mm", playerCount: number, note? }` → `201 ClubBlockView`.
- `GET /api/v1/club-blocks?from=&to=&clubId=&status=` → `ClubBlockView[]`; `GET /api/v1/club-blocks/{id}`.
- `PUT /api/v1/club-blocks/{id}` (`fromDate,toDate,playerCount,note,dailyFrom,dailyTo`: shorten/extend) ; `DELETE /api/v1/club-blocks/{id}?cancelAthletes=true|false` (refuses with 409 if athletes are registered and `cancelAthletes` is not true).
- `POST /api/v1/club-blocks/calculate` `{ playerCount, activityIds, calendarIds, fromDate? }` → `{ minutesPerPlayer, parallelCapacity, neededMinutes, dailyOpenMinutes, suggestedDays, suggestedFrom, suggestedTo, perDay: [{ date, openMinutes }] }`.
- `ClubBlockView` = `{ id, clubId, clubName, colorHex, calendarIds, activityIds, fromDate, toDate, dailyFrom, dailyTo, playerCount, seats, registered, status: "Active"|"Cancelled", registrationToken, registrationUrl, note, createdAtUtc }`. `colorHex` is derived from the club (stable per club, from a palette), shown on blocks.
- `GET /api/calendars/{id}/blocks` items gain `kind: "manual"|"club"`, `clubBlockId?`, `clubName?`, `colorHex?`. Public availability and non-club booking exclude club-block time; athletes registering through the club link book **inside** it. `parallelCapacity` is on the activity (C1).

-  →  (BE-3).

- `GET/PUT /api/v1/settings/clubs` → `{ registrationLinkValidityDays: number (default 14), minimumPlayers: number (default 30, informational warning only) }` (BE-3).

### C5 Site content, media, integrations, change history
- Public: `GET /api/public/site-content` → `{ version: string, slots: { "<key>": { kind: "text"|"image"|"video", text?: string, mediaUrl?: string, posterUrl?: string, alt?: string, width?: number, height?: number } }, partners: [{ id, name, sport, description, url, logoUrl? , sort }], faq: [{ id, question, answer, sort }] }` (cacheable, ETag). Slot keys are free-form `^[a-z0-9][a-z0-9._-]{0,79}$`; **the registry of known slots (key, label, group, kind, recommended size, default text) lives in the frontend** (`src/site/siteSlots.ts`) and the backend stores whatever keys it is given.
- Admin: `GET /api/v1/site-content` (same + `updatedAtUtc, updatedBy` per slot), `PUT /api/v1/site-content/slots/{key}` `{ text?, alt?, assetId? }`, `DELETE /api/v1/site-content/slots/{key}` (back to default), `POST|PUT|DELETE /api/v1/site-content/partners[/{id}]`, same for `/faq`.
- Media: `POST /api/v1/media` (multipart `file`, optional `slotKey`) → `{ assetId, url, posterUrl?, kind, width, height, bytes, contentType }` via `IMediaStore` (Cloudinary implementation; images auto-resized/converted, videos transcoded with poster); `DELETE /api/v1/media/{assetId}`. 503 `{ message: "Úložiště médií není nastavené." }` when not configured.
- `GET/PUT /api/v1/settings/media-storage` `{ provider: "cloudinary", enabled, cloudName, apiKey, apiSecret? (write-only; reads return `hasSecret: boolean`), uploadPreset? }` (secret protected at rest with ASP.NET Data Protection).
- `GET/PUT /api/v1/settings/integrations` `{ adam: { enabled, baseUrl, username, hasPassword, password? (write-only) }, medistar: { status: "retired" } }` — stored only, no live calls.
- Change history: `GET /api/v1/settings/changes?scope=<prefix>&take=5` and `GET /api/v1/audit/changes?scope=&from=&to=&user=&take=&skip=` → `{ items: [{ at, user, scope, label, before, after }], total }`. Every settings save above writes one entry per changed field (`before` → `after`, secrets masked).

### C6 Misc
- Catalogue import JSON: Spiro 3 500, VO₂max 4 000 (BE-4). The importer never overwrites existing prices; the prod script is `deploy/update-production.ps1` (backend repo).
- `GET /api/public/clinic` unchanged (+`openingHours`).

## Frontend shared pieces (created before the agents start)
- `src/layout/useDevice.ts` → `useDevice(): "phone"|"tablet"|"desktop"` (≤767 / 768–1279 / ≥1280), `useIsPhone()`.
- `src/test/viewport.ts` → `setViewport(width)` (mocks `matchMedia` + `innerWidth`; call before render), `VIEWPORTS = {phone:390, tablet:834, desktop:1440}`.
- UI kit `src/components/ui` (PageHeader, SoftCard, SectionLabel, StatusChip, FilterChips, KpiCard, PhoneField). Extend it by adding files; do not edit the existing ones' signatures.

## File ownership
Each agent edits ONLY the files its prompt lists (or creates new ones under the folders it names). Shared files owned by exactly one agent: `src/App.tsx` (shell agent), `src/pages/settings/catalogue.ts` (settings-framework agent). Need a route or a catalogue entry? Put it in `notesForIntegrator`; the integrator wires it.
Do not git commit/stash/checkout (backend agents commit on their own branch in their own worktree, see their prompt). No servers, no browsers (except where the prompt allows).

## Report format (your final message)
`summary` (what is done, per item, honest), `filesChanged`, `testsRun` (commands + counts), `decisions` (each: decision + why), `notDone` (each: what + why), `notesForIntegrator` (routes, catalogue entries, contract deviations).
