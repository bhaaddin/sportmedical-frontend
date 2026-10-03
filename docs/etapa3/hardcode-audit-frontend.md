# Hard-coded business values — frontend audit (Etapa 3, FE-H)

Rule (Matko, final): every value somebody might want to change lives in Nastavení. This audit
covers the staff app and the patient-facing app pages (`/objednat`, `/dokonceni/:token`, `/klub/:token`,
`/rezervace/:token`, `/hodnoceni/:token`, `/portal`). The public site `src/web/**`, the public shell
`src/components/public/**` and the other slot files belong to other agents and are listed only where
they leak into my area.

Method: grep over `src/**/*.ts(x)` (no tests) for the clinic identifiers, `Kč`, percentages, day/hour/minute
counts, headcounts, phone/e-mail/URL/address patterns, `#RRGGBB`, option lists, consent / GDPR wording,
`DEFAULT_*`/`FALLBACK_*` constants and form default values; then read every hit in context.

Decisions: **setting** (reads an existing settings endpoint), **slot** (editable text in "Média a texty",
registry `src/site/slots/formulare.ts`, current wording = default), **removed**, **kept** (layout or technical,
reason given), **open** (needs a backend setting; listed again in the report's `notDone`).

A guard test (`src/test/noHardcodedBusiness.test.ts`) now fails on `fdcgvvp`, the clinic IČO, the clinic phone,
`recepce@sportmedical`, `Jihlavsk`, `GreenLine` and any `<number> Kč` literal in non-test, non-slot source.
It skips pure comment lines. Its allow-list is empty.

## 1. Clinic identity, contact, address, documents

| Where | Value | Decision |
|---|---|---|
| `src/pages/public/content.ts` (old line 26) | IČO of the clinic | **removed** (the whole `SITE.ico`) |
| `content.ts` (old 27) | registered office address | **removed** |
| `content.ts` (old 34) | opening-hours fallback line `Po–Pá 8:00–18:00 …` | **removed** (hours come from `GET /api/public/clinic` `openingHours`, set in Nastavení › Ordinace) |
| `content.ts` (old 36) | "how to get there" transport line | **removed** (public site slot `kontakt.*` owns it) |
| `content.ts` (old 37–43) | five links into the Shopify site, `website` | **removed** (unused) |
| `content.ts` (old 52–67) | `HERO`, `HOW_IT_WORKS`, 4 `DOCUMENTS` with Shopify PDF links, 3 `GUIDES`, `CLUB` offer text (incl. "výjezd od 30 sportovců"), 10 `PARTNERS` | **removed** (dead code; the live copies are slots, the documents page `dokumenty` slots, partners in the admin list). The "od 30 sportovců" player minimum is gone from code — it is `clubs.minimumPlayers` (nullable) |
| `content.ts` `SITE.brand/brandSuffix/legalName/policies` | product name, legal name "… s.r.o.", GDPR PDF link | **kept for now, open**: printed by `PublicHeader.tsx` / `PublicFooter.tsx` (not my files). Should move to company settings (legal name) and a `site.footer.*` slot / document upload (GDPR link) |
| `content.ts` `FAQ` (6 items, "platí zpravidla 12 měsíců", "2–3 hodiny před testem") | default FAQ | **kept**: it is only the default of the admin FAQ list (Nastavení › Média a texty › Časté otázky); the admin's list replaces it |
| `src/site/defaults.ts:46-47` | `DEFAULT_CONTACT` phone + e-mail of the clinic | **removed** (unused; contact comes from `GET /api/public/clinic`) |
| `src/pages/settings/CompanyInvoiceSettingsPage.tsx:74` | example phone in an error message = the clinic's own number | **removed** → neutral example `+420 123 456 789` |
| `src/pages/Admin.tsx:46` | comment quoting an old building name | comment reworded (guard test) |
| `src/components/booking/patient/quickRegisterErrors.ts:45`, `QuickPatientForm`/`PatientRegistration`/`IntakeQuestionnaire`/`ClubPicker` placeholders `filip@email.cz`, `jan@email.cz`, `klub@email.cz`, `+420 773 539 001` | input placeholders / examples, not the clinic's data | **kept**: format examples, no business meaning |
| `src/api/clinicSettings.ts`, `src/pages/public/*` | phone, e-mail, address, hours on the patient pages | already **setting** (`/api/public/clinic`); nothing typed |

## 2. Patient-facing texts the clinic words (now slots, group `Formuláře › …`)

All defaults equal the previous wording, so nothing changes visually until somebody edits. The forms read them
with `useSlotTexts` (`src/site/useSlotTexts.ts`) → `useSiteContent` → `GET /api/public/site-content`; `{placeholders}`
are filled by `fillText` (`src/site/fillText.ts`, an empty value removes its " na {email}" / "({service})" with it).
`useSiteContent` now falls back to a private QueryClient when a screen is rendered without a provider, so a form never
crashes over its texts (the app always has a provider).

| Where | Text | Slot key(s) |
|---|---|---|
| `IntakeQuestionnaire.tsx` ~1617 | box heading "CO DĚLÁME ZE ZÁKONA — NEPTÁME SE NA TO" | `formulare.consent.statutory.heading` |
| `IntakeQuestionnaire.tsx` ~1621 | statutory notice: dokumentace, vyhodnocení, **archivace 10 let**, zákon 372/2011 Sb., GDPR čl. 9(2)(h) | `formulare.consent.statutory.text` |
| `IntakeQuestionnaire.tsx` ~1624 | rights (přístup, oprava, výmaz, ÚOOÚ) + withdrawal at the clinic e-mail | `formulare.consent.rights.text` (`{email}`) |
| `IntakeQuestionnaire.tsx` ~1658 | consent to the examination: title + detail, with / without a held činnost | `formulare.consent.treatment.title.activity|generic`, `…detail.activity|generic` (`{activity}`, `{service}`), `…treatment.error` |
| `IntakeQuestionnaire.tsx` ~1669 | report by e-mail consent: title, required / optional detail, error | `formulare.consent.report.*` |
| `IntakeQuestionnaire.tsx` ~1687 | club sharing consent: title, required / optional detail, error | `formulare.consent.club.*` |
| `IntakeQuestionnaire.tsx` ~766 | questionnaire-required message | `formulare.form.questionnaire.error` |
| `IntakeQuestionnaire.tsx` ~1746 | "Údaje putují šifrovaně …" | `formulare.form.privacy-line` |
| `IntakeQuestionnaire.tsx` ~1045 | four "after sending" sentences (review / saved × e-mail expected or not) | `formulare.finish.review.*`, `formulare.finish.saved.*` |
| `intakeParts.tsx` `RequiredDocuments` | "Tyto dokumenty ordinace pro vaši činnost vyžaduje." | `formulare.finish.documents.intro` |
| `intakeParts.tsx` `LinkProblem` | expired link / invalid link explanations | `formulare.link.expired`, `formulare.link.invalid` |
| `PublicBooking.tsx` | "Online objednávání právě není otevřené", phone sentence, "Zkuste to prosím později", "Vyberte čas v kalendáři …", "V nejbližších {days} dnech nemáme volno", "Zavolejte nám prosím na" | `formulare.booking.*` |
| `ClubRegistration.tsx` | link expired / places full | `formulare.club.closed`, `formulare.club.full` |
| `FeedbackPage.tsx` | subtitle | `formulare.feedback.sub` |
| `PatientSignIn.tsx` | subtitle, "Nemáte heslo?", "Zapomněli jste heslo?" | `formulare.portal.signin.*` |
| `PatientPortal.tsx` `ClinicContactCard` | "Co tu nejde vyřídit …" | `formulare.portal.help` |

Legal consent: the wording is editable, the REQUIREMENT stays in code (`required` on the examination row, the
`consentTreatment` validation, the per-činnost `requiresReportByEmail` / `requiresClubSharing` flags; the marketing
consent is never required). Test `formTexts.test.tsx` proves it at 390 / 834 / 1440.

Kept in code, with reason:

| Where | Value | Reason |
|---|---|---|
| `IntakeQuestionnaire.tsx:668` | minor = under **18** | a statutory age (občanský zákoník), not a clinic choice; only offers a document |
| `IntakeQuestionnaire.tsx:227` `FALLBACK_PHONE_REGIONS` | 5 dialling regions | technical fallback when `GET …/phone-regions` is unreachable; the list is the server's |
| `ConsentSettings` `CONSENT_SETTINGS_OFFLINE` (`api/consentSettings.ts:41`) | marketing consent wording | already a **setting** (`/api/v1/settings/consent`); the constant is only the offline fallback |
| `PublicBooking.tsx:56` `HORIZON_DAYS = 60` | how far the public slot search looks | technical search window, printed in the "no free time" sentence through the `{days}` slot placeholder. **open**: should be calendar `publicHorizonDays` delivered by the public API |
| `PatientPortal.tsx:55` `MIN_PASSWORD = 8` | password length | security policy, validated by the server too |
| `PatientPortal`, `ManageBooking`, `intakeParts` labels, buttons, headings ("Přihlásit", "Zrušit termín", "Vybrat nový termín"…) | UI chrome | not a clinic rule |
| `ManageBooking.tsx`, `PatientPortal.tsx` cancellation rule | the deadline is read from the server (`publicCancellationHours` on the calendar); no number is typed in the page | nothing to do |

## 3. Staff app

| Where | Value | Decision |
|---|---|---|
| `components/booking/plan/QuickPlanDialog.tsx:116-117` | default day `08:00`–`18:00` | **setting**: calendar display `dayStartHour`/`dayEndHour` (`useCalendarDisplay`), typing overrides (`utils/dayHours.ts`) |
| `components/booking/NewPartnerOrderDialog.tsx:129,145,461` | default window `08:00`–`16:00` (3 places) | **setting**: same calendar day hours |
| `pages/booking/CalendarsPage.tsx:620,634` | helper text claimed "Prázdné = 15 minut" / "24 hodin" (a copy of the server default that would go stale) | **removed** the numbers: "Prázdné = výchozí délka/lhůta v ordinaci" |
| `components/booking/ColorSelect.tsx` + `utils/calendarPalette.ts:23-34` | 12 fixed colours offered for calendars and činnosti | **setting**: now offers the clinic's palette `GET /api/v1/settings/service-colors` (named by hex); the built-in 12 are only the offline fallback; a stored colour stays selectable; `readableTextOn` computes the legible text colour for any palette colour |
| `pages/booking/ClinicServicesPage.tsx:284` | service icon `#0D7377` | **setting**: the service's own `colorHex`, theme primary when it has none |
| `pages/pricing/ServiceDialog.tsx:155` | button `#0D7377` | design token → MUI `color="primary"` |
| `pages/settings/GroupDiscountsPage.tsx:78` | sample unit price **1 000** in the discount preview | **removed**: preview uses the dearest priced činnost; with none it computes on a base of 100 (percent reading), labelled as such — no price is typed |
| `pages/patients/requiredDocumentRow.ts:64` + `services/reportValidity.ts:158` | výpis valid 12 months, warn 30 days before | **setting wired**: `requiredRowState(…, rule)` and `validUntilFromIssued(…, months)` take the requirement rule's `validityMonths` / `warnDaysBefore` (0 = never); the constants are only the fallback when no rule is passed. The row is not on a screen yet — whoever mounts it passes the rule from `documentRequirementsApi.list()` |
| `api/displaySettings.ts:68-70` `CALENDAR_DISPLAY_OFFLINE` | now-line / holiday / lunch colours, 07–19, 30 min | **kept**: offline fallback of an existing setting, never shown on the settings screen (it reads the server's `defaults`) |
| `api/clubBlocks.ts:379` `#B3B9C0` | colour of an athlete row without a colour | **kept**: neutral grey fallback |
| `pages/StaffManagement.tsx:49-51` `ROLE_COLORS` | avatar colour per role (Owner/Administrator/Staff) | **kept**: role identity in the UI, not a clinic value |
| `components/clubs/blockLogic.ts:151-156`, `AppointmentDetail.tsx`, `TimeGrid.tsx`, `MonthView.tsx`, `MiniCalendar.tsx`, `DayOverviewPage.tsx` `#FFFFFF`/`#14181C` | text ink on a coloured chip / selected day | **kept**: design (contrast), not business |
| `components/booking/ClubScheduleReport.tsx:159-164` | print stylesheet colours | **kept**: print layout |
| `pages/settings/colors/*`, `CalendarDisplayPage.tsx` `#000000/#64748B/#E11D48` | placeholders of colour inputs when empty | **kept**: input fallback in the editor, not shown to patients |
| `components/booking/quick/quickBooking.ts:43` `URGENT_MS = 3 h` | the pending-registration chip turns red under 3 h | **kept**, **open**: proposed key `quickRegistration.urgentHours` (Nastavení › Rychlá registrace) |
| `components/booking/AppointmentDetail.tsx:124` `RESCHEDULE_WINDOW_DAYS = 13` | how far a move looks for free time | **kept**: technical look-ahead of the move panel (server cap 62) |
| `components/booking/grid/TimeGrid.tsx:77` `SLOT_MINUTES = 30`, `grid/resolution.ts` 10/30 min | grid zoom steps | **kept**: the view-zoom choices; the default row length is the calendar display setting |
| `pages/pricing/serviceForm.ts:29` `DEFAULT_DURATION_MINUTES = 30` | a new price-list line starts at 30 minutes | **kept**, **open**: proposed `catalogue.defaultDurationMinutes` in Ceník. Price field starts empty (no price typed) |
| `pages/booking/timetable.ts:38` `DEFAULT_PERIOD_NAME = 'Pracovní doba'` | default name of a working-hours period | **kept**: editable name, a label not a rule |
| `pages/settings/QuickRegistrationSettingsPage.tsx:69` | validation range 1–720 h | **kept**: validation bound of an existing setting (default 24 h is the server's) |
| `pages/patients/manualResults.ts:23` `MAX_TRAINING_ZONES = 10` | contract C-M (≤ 10 zones) | **kept**: API contract limit |
| `pages/statistics/aggregate.ts:32` "Posledních 90 dní" etc., `TrainingLoad.tsx` 7/28/30-day windows | analysis windows | **kept**: computation definitions (ACWR is defined by 7/28 days) |
| `pages/PatientList.tsx`, pickers, `*_DEBOUNCE_MS`, `*_STALE_MS`, `MAX_RANGE_DAYS`, `NEXT_FREE_HORIZON_DAYS`, `UPCOMING_WINDOW_DAYS`, `MAX_QUANTITY` | timings, caches, query windows, input caps | **kept**: technical |
| `components/ui/countryCodes.ts:68` `DEFAULT_COUNTRY_CODE = 'CZ'` | default phone country | **kept**, **open**: proposed `company.defaultCountry` |
| `pages/PatientRegistration`, `QuickPatientForm`, `IntakeQuestionnaire` insurer list | health insurers | already server-provided (`czechHealthInsurers`) |
| `components/booking/*`, `pages/billing/*` | money format `2 200 Kč` | only **comments / formatters**; every amount comes from the API |
| `pages/clubs/clubOrders.ts`, `invoiceView.ts`, `components/booking/grid/clubLine.ts` | "−10 %" strings | comments / formatters of a server value |

## 4. Found outside my files (for the owners)

| Where | Item |
|---|---|
| `src/components/public/PublicHeader.tsx:49-51` | `SERVICE_MENU` names and hints ("Základní · Komplexní · Spiroergometrie", "VO₂max · ForceDecks · HumanTrak") — service names/hints should come from the catalogue or slots |
| `src/components/public/PublicFooter.tsx:94-96` | footer "Zpracování osobních údajů" link text + `SITE.policies` GDPR PDF URL (Shopify CDN), `SITE.legalName` |
| `src/components/public/brand.ts:123` | comment only |
| `src/site/slots/kontakt.ts:31` | caption "budova GreenLine zvenku" (guard excludes slots; the brief asks for the building name to leave artboard-derived text) |
