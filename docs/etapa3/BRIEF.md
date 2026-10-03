# SportMedical — Etapa 3 shared brief (binding for every agent)

Matko's words, final, never to be asked again: **everything is in the admin; nothing is hard-coded.**
Every value somebody might want to change — prices, discounts, texts, deadlines, colours, capacities, limits,
minimum counts, documents, company data, public-site content — is changed in Nastavení. Writing a number or a
sentence into code is a bug: turn it into a setting. "Na nic dalšího se neptej": decide, record the decision with a
reason in your report, and finish.

## What Etapa 3 is (Matko's list)
1. **Routing.** The public patient website is the DEFAULT page of the domain: `/` is the landing page. The staff
   portal (calendar, patients, clubs, billing, settings) sits behind the sign-in at `/login`. Public pages move from
   `/web/*` to the root (`/sluzby`, `/prohlidky`, `/diagnostika`, `/inbody`, `/cenik`, `/dokumenty`, `/kontakt`,
   `/o-nas`, `/kluby` + any page found on the live Shopify site). Old `/web/*` URLs redirect (308) to the new ones.
   Staff-only paths must not collide with public ones: the staff price list moves from `/cenik` to
   `/nastaveni/cenik`; the staff overview moves from `/` to `/prehled`; the staff clubs page stays `/clubs`.
   Patient-facing app pages stay where they are (`/objednat`, `/dotaznik`, `/dokonceni/:token`, `/klub/:token`,
   `/rezervace/:token`, `/hodnoceni/:token`, `/portal`, `/portal/prihlaseni`).
2. **Content from the live Shopify site** https://sportmedical-diagnostics.cz (everything: pages, texts, packages,
   descriptions, prices) belongs to our site. Prices only in the price list (Ceník = single source of truth). The
   three combined-package prices come from the LIVE site, not from old values left in code. All hard-coded prices and
   business texts leave the backend; they live in the database and are edited in Nastavení; public-site texts are
   edited in "Média a texty".
3. **Measured values get real columns** (no more `[Ruční zápis]` block in the doctor's notes).
4. **Minimum players for mobile testing** is a setting (nullable, default none), no number anywhere in code.
5. **Club block athlete list**: the backend sends the athletes assigned to a block, the panel shows them.
6. Quick-registration expiry: keep as it is (24 h default setting, archive not delete, slot freed at once).
7. Photos, videos, logos: grey placeholders with caption and size until Matko sends files; replaceable by upload in
   Nastavení. No stock photos.
8. Company data: DIČ, bank account, datová schránka stay EMPTY and fillable in Nastavení. Do not seed or print
   `fdcgvvp` anywhere (remove it from slot defaults and artboard-derived text).

## Contracts (backend ships exactly this; frontend codes against it; JSON camelCase)

### C-M Measurements (DiagnosticSession)
New nullable columns/fields on a diagnostic session (existing required numbers stay as they are):
- `measuredOn` date (yyyy-MM-dd; defaults to the date of saving when omitted)
- `thresholdPercentVo2Max` number 0–100 (anaerobic threshold as % of VO₂max)
- `maxPowerWatts` integer ≥ 0
- `weightKg` number > 0
- `powerPerKg` read-only, computed = maxPowerWatts / weightKg (null unless both present), 2 decimals
- `trainingZones` array of `{ name: string (≤60), fromBpm?: number, toBpm?: number, note?: string (≤200) }` (≤ 10 items)
- `device` string ≤ 100, `protocolType` string ≤ 100 (both nullable, free text)
Endpoints (all under `/api/v1`, same permission as the existing create):
- `POST diagnostics/sessions` accepts the new fields (all optional).
- `PUT diagnostics/sessions/{id}` replaces the editable fields (same body shape as create, without patientId); 404 if unknown; 422/400 field errors like create.
- `GET diagnostics/sessions/{id}` and `GET diagnostics/patients/{patientId}/sessions` return the new fields.
- The patient portal dashboard `results[]` carries the same fields; it NEVER carries the doctor's notes
  (`rawPractitionerNotes` is removed from the portal result).
- `rawPractitionerNotes` stays a plain free-text note for the doctor; the app no longer writes a labelled block into it.

### C-C Clubs
- `ClubBlockView` (detail `GET /api/v1/club-blocks/{id}` and the list) gains `athletes: [{ id, name, activityName, startUtc, endUtc, status: "Booked"|"Attended"|"NoShow"|"Cancelled", phone? }]` (athletes registered through the block's link, newest registration last; names as the athlete entered them; no birth numbers ever).
- `GET/PUT /api/v1/settings/clubs` → `{ registrationLinkValidityDays, minimumPlayers: number|null, blockPalette }`. `minimumPlayers` null = no minimum (default). Calculator `belowMinimum` is false when null.
- `GET /api/public/club-terms` (anonymous) → `{ minimumPlayers: number|null }`. The public Kluby page shows a minimum ONLY when it is not null; no number in code or in slot defaults.

### C-S Seed data (nothing business-related in code)
- `deploy/seed/*.json` (backend repo, copied to the build output under `seed/`) hold the starting values (catalogue with prices and packages from the live site, company data that is public on the site, public contact card + opening hours, discount tiers 4→5 %, 6→10 %, 10→15 %, role limits Staff 10 / Administrator 30). They are DATA, not code.
- CLI verbs: `import-catalogue [--file path] [--dry-run]`, `import-seed [--file path] [--dry-run]` (writes `SystemSettings` keys only when absent, prints each key). `deploy/update-production.ps1` runs both. Code constants for these values are removed; an unset setting reads as empty/none.
- Empty states: company DIČ, bank account/IBAN, datová schránka are empty until the admin fills them.

## File ownership
Each agent edits ONLY the files its prompt lists (or creates new ones under folders it names). Frontend agents share one
working tree: no git commit/stash/checkout; no servers; no browser tools unless allowed. Backend agents work in their own
git worktree, commit on their own branch, never create EF migrations (the integrator makes ONE consolidated migration),
never run the shared dev DB with an unmigrated schema (use the test suites). Shared files owned by exactly one agent:
`src/App.tsx`, `src/main.tsx`, `vercel.json`, `vite.config.ts`, `scripts/**`, `src/web/routes.ts`, shell components —
the routing agent. Need a change in a file you do not own? Put it in `notesForIntegrator`.

## Report format (your final message)
`summary` (per item, honest), `filesChanged`, `testsRun` (commands + counts), `decisions` (decision + why),
`notDone` (what + why), `notesForIntegrator`.
