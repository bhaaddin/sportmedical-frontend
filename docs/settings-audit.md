# Settings audit (20. 10. 2026)

"All the settings must work." Every control of Nastavení (`src/pages/Settings.tsx`, the screens its catalogue routes to,
`src/api/*`) was traced from the control to the API (or the browser), to what reads the value back after a reload, and to the
place where it must take effect. Branch `claude/clean`, dev stack (frontend :3000, API :5092, throwaway database).

Three people worked on it: the lead (Osobní -> Vzhled: the accent and the mode, section A), and two audits of the rest
(section B = Provoz, Služby a ceny, Kluby; section C = Komunikace, Dokumenty, Vzhled webu, Systém and the hub).
The tables are one row per control; `OK` works as it should, `BUG-fixed` was a frontend defect fixed here and pinned by a test,
`BUG-backend` cannot be fixed from the frontend (exact request/response below), `BUG-open` is a frontend gap that needs a decision.

## Summary

| | |
|---|---|
| Screens audited | 33 catalogue items (every route in `catalogue.ts`) + the group alias `/nastaveni/skupinove-slevy` + the hub + Osobní; one screen was missing and is new (`/nastaveni/odkaz-registrace`) |
| Frontend bugs fixed | 1 root cause for "the colours do not change" + 18 defects (section C) + about 22 groups of fixes (section B) + 1 missing screen + "Výchozí pohled" had no effect |
| Backend defects documented, not edited | 10 (section B, B1-B10) + 6 (section C) |
| Frontend gaps left open (need a decision) | 8: "Délka řádku" unused, hover facts the row does not carry, two screens for one setting, a table that scrolls sideways on portrait tablets, a worker without a name, three screens open to every signed-in user, the page still called "SMS a e-maily", switching a template drops unsaved edits |
| New test cases | 2 282 (accent, theme and appearance 789; settings audits 1 493) |
| Real-API round trips | GET -> PUT -> GET -> restore for every settings endpoint (listed per section), originals restored |

Backend defects and open items are listed in full in sections B and C ("Backend defects", "BUG-open"); the one-line version:

- B1 `scheduling.*` codes arrive in `message`; B2 `sort_order_negative` for 0; B3 `/api/holidays/{date}` 500 for an empty/over-300 name; B4 `/api/services` validates nothing;
  B5 partner orders accept duplicate činnosti (500), bad deadlines, bad e-mail; B6 `/api/settings/bulk` stores an invalid e-mail and `javascript:` as the site URL;
  B7 činnost `questionnaireRequirement: 5` and `durationMinutes: 100000` accepted; B8 overlapping absences accepted; B9 PUTs are whole-entity; B10 day-activities GET returns a bare array.
- C: questionnaire draft discard `DELETE …/versions/{id}` returns 500; the question endpoint accepts an empty or non-ASCII key; test-send cannot test unsaved wording;
  single-brace placeholders are saved silently; change history does not record five screens; date-only `from`/`to` are read as midnight.

---

## A. Osobní -> Vzhled (the lead): accent and mode

Root cause of "I click a colour and nothing changes": `src/theme.ts` built the dark theme with `primary = D.cyan` whatever the accent was, and dark is the
default of the whole staff app; the planner's CSS (generated from the prototype) and a dozen components drew hundreds of fixed cyan/aqua colours.
The pick is now a shift of the prototype's cyan family (`src/accent.ts`, pure and tested), applied to the MUI theme in TypeScript and to every stylesheet
through one custom property, `--sm-hsl`. The default accent (forest green) is the identity: a computed-style diff of 7 routes x 3 layouts x 2 modes between the
code before this work (5a7d11a) and now found **0 differing values** in 1 000+ elements per page.

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Swatch "Lesní zelená" (default) | `Settings.tsx` PersonalSection; `AccountMenu.tsx` AppearanceControls | `localStorage sm-theme-accent` = `#0D5C52` | the prototype's own colours (identity shift), nothing set on the root | computed-style diff old vs new build; `Settings.appearance.test.tsx`, `theme.default.test.ts` (theme equals a committed picture of the old one) | OK |
| Swatches "Břidlicová", "Tyrkysová", "Modrá", "Fialová", "Oranžová" | same | `sm-theme-accent` = the swatch's hex | MUI palette + overrides (buttons, tabs, chips, progress, inputs, menus, dialogs, paper edges, tooltips); `--sm-hsl` / `--sm-accent*` on the document root for `planner.css`, the planner's own CSS, `theme.css`; the planner's popovers (`PlanDarkTheme`); light tints (`--sm-soft-bg`...) | `accent-check.mjs` in real Chromium: a contained button, the active menu entry, a keyboard focus ring, the planner header border and selected segment each have 6 different computed values, in dark and light, at 390x844 and 1440x900; `--cyan` in the browser equals `src/accent.ts` (+-2/255); 789 unit cases incl. AA contrast for all six on every dark surface | BUG-fixed (dark ignored the accent) |
| "Světlý" / "Tmavý" buttons | `Settings.tsx` | `sm-theme-mode-v2` (`light`/`dark`); the legacy `sm-theme-mode` is dropped, never obeyed | whole app palette; light draws in the pick, dark in the shifted cyan | `Settings.appearance.test.tsx` (click, persist, reload), `accent-check.mjs` | OK |
| "Tmavý režim / Světlý režim" and the swatches in the account menu and the phone's "Více" sheet | `AccountMenu.tsx` | same two keys | same | `AppearanceControls.test.tsx`; the swatches were hidden in dark ("would do nothing there") | BUG-fixed |
| A stored accent that is junk | `themePrefs.readStoredAccent` | – | falls back to the default (not hex, alpha, `rgb()`, white/near-white, scripts, 5 000 characters...) | `themePrefs.test.ts` (20 cases) | OK |
| A browser that refuses storage | `ThemePrefsProvider` | – | the choice applies for the visit | `Settings.appearance.test.tsx` | OK |
| Two tabs | `ThemePrefsProvider` (`storage` event) | – | a choice in one tab moves the other | `Settings.appearance.test.tsx` | OK (new) |
| Public site, patient/club portals, booking pages | `AccentRootVars` is mounted only inside the signed-in staff route; they draw `publicTheme` / `intakeTheme` | – | must not change | `accent.guard.test.ts` (mount point, no imports in `src/web`), `accent-check.mjs` (`/objednat` carries no `--sm-*`) | OK |

Known limits of the owner's palette, not bugs of the mechanism: in dark the **teal** swatch (#0D9488) is only 4 degrees of hue and 16% saturation away from the
default forest green's cyan, so choosing it after the default is a small change (it is measurably different: 6 different values per measurement); in light the **orange**
and **teal** swatches carry dark ink on buttons (white fails AA on them: 3.6:1 and 3.7:1) and as text on white they are 3.6-3.7:1 (AA only for large text).

---

## B. Provoz, Služby a ceny, Kluby (audit part 1)

Scope: the 16 screens `/working-hours`, `/blokovany-cas`, `/svatky`, `/nepritomnosti`, `/exceptions`,
`/nastaveni/vzhled-kalendare`, `/calendars`, `/admin`, `/nastaveni/sluzby`, `/activities`, `/nastaveni/cenik`,
`/nastaveni/slevy` + `/nastaveni/skupinove-slevy`, `/nastaveni/barvy-sluzeb`, `/vyhrazeni`, `/nastaveni/kluby`.
Section C holds the other settings screens.

How each row was checked (column "Verified how"):

- **API** - a real HTTP round trip against the dev API on :5092 (GET, then PUT/POST with the body the screen builds, then GET), the original value
  restored afterwards (scratch scripts, credentials read inside the script only).
- **BR** - real headless Chromium against the dev stack (:3000 + :5092): the screen was driven, the API read afterwards, the value restored through the screen.
- **T** - a vitest case that fails without the fix / pins the behaviour (the file is named).
- **READ** - read only, not run.

Status: **OK**, **BUG-fixed** (frontend, fixed in this pass, test named), **BUG-backend** (not fixable from the frontend, see section 3), **BUG-open** (frontend or
cross-lane, not fixed here, see section 3).

Line numbers are those of the files at the end of the audit.

### 1. Controls

#### Provoz

##### Otevírací doba - `/working-hours` (`src/pages/booking/WorkingHoursPage.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Kalendář (select) | WorkingHoursPage.tsx:205 | nowhere (page state); reads `GET /api/calendars`, `…/periods`, `…/working-hours` | picks which calendar's rows are shown and saved | T `WorkingHoursPage.audit` (switches calendar, rereads periods + access) | OK |
| Pracuje (switch per day / per week A, B) | WorkingHoursPage.tsx:613 | row exists/absent: `POST` / `DELETE /api/calendars/{id}/periods/{pid}/working-hours` (a row makes the day work; the server sends no `isActive`) | `GET …/preview` (open, hours), `GET …/availability`, the planner board | API (create/list/update/delete on a throw-away calendar, `preview` showed 07:30-15:45 after the update) + T `WorkingHoursPage.audit`, `timetable.audit` | OK |
| Od / Do (day hours) | WorkingHoursPage.tsx:621 | `startTime`/`endTime`, sent `HH:mm`, read back `HH:mm:ss` | preview hours, availability slots | API (`end<start` -> 422 `end_before_start`, caught in front by `shiftProblem`) + T | OK |
| Pauza Od / Do (lunch of that day) | WorkingHoursPage.tsx:650 | `breakStart`/`breakEnd`; cleared as `null` | preview break, availability | API (outside the day -> 422 `break_outside`, one end only -> 422) + T (all caught in front) | OK |
| Pracovník (select) | WorkingHoursPage.tsx:674 | `workerUserId` | preview worker; an absence of that worker closes the day (`workerAbsent`, API) | T `WorkingHoursPage.audit` (list = accounts with `hasAccess`) | BUG-fixed: offered every account, including `hasAccess:false` |
| Jiná pracovní doba v lichém a sudém týdnu (switch) | WorkingHoursPage.tsx:472 | rows with `repeatEveryNWeeks 2`, `weekOffset 0/1`; equal days collapse to one every-week row | `GET …/cycle` dates under the switch; preview | API (A/B rows created, cycle `2026-10-26, 11-09 …`; every-week + A on the same day -> 409, so the screen never sends that) + T | OK |
| Uložit / Vrátit změny | WorkingHoursPage.tsx:522 / 534 | deletes, then updates, then creates (avoids the 409 for overlapping rows) | the list is refetched; "Uloženo." | T (order of operations, error keeps what is really stored, double click = one request) | OK |
| Platit bez konce | WorkingHoursPage.tsx:248 | `PUT …/periods/{pid}` with `validTo:null` | the timetable no longer ends | T | OK |
| Smazat (starý plán) | WorkingHoursPage.tsx:275 | `DELETE …/periods/{pid}` after a confirmation | the plan stops applying | T | OK |
| Rychlý plán (dialog) | WorkingHoursPage.tsx:184, `components/booking/plan/QuickPlanDialog.tsx` | period or exception per scope | reads Kalendář a mřížka `dayStartHour/dayEndHour` as its defaults | READ + the existing 30 cases (`QuickPlanDialog.test`, `quickPlan.test`) - not audited line by line | OK (not deeply verified) |
| Činnosti podle dnů (cell, column, row, "Kopírovat z jiného dne", Uložit) | `components/booking/DayActivityGrid.tsx:287/329/360/400/422` | `PUT …/periods/{pid}/day-activities { days }` = FULL replacement; windows (`from`/`to`) carried | preview `offeredActivityIds`, availability | API (PUT 200; a day with nothing offers nothing) + T `DayActivityGrid.audit` (all 7 days sent, windows kept, no save from a grid that did not load) | OK |

##### Pauzy a přestávky - `/blokovany-cas` (`BlockedTimePage.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Kalendář (select) | BlockedTimePage.tsx:231 | page state | which calendar's blocks | T | OK |
| Zablokovat čas -> Datum, Od, Do | BlockedTimePage.tsx:318/329 | `POST /api/calendars/{id}/blocks { startUtc, endUtc, reason }`; Prague wall clock -> UTC instants | `GET …/availability` drops the slot (17 -> 15 slots, API), planner draws the block | API + T `BlockedTimePage.audit` (13:00 on 25. 10. 2026 -> 12:00Z) | OK |
| Datum column of the list | BlockedTimePage.tsx:281 | - | - | T (run in `America/New_York`) | BUG-fixed: used the browser's calendar day while the time was Prague's |
| Důvod | BlockedTimePage.tsx:266 | `reason` (max 300) | list, planner | API (301 -> 422 `text.too_long`) + T (maxlength 300) | BUG-fixed: no limit |
| Uvolnit čas | BlockedTimePage.tsx:289 | `DELETE …/blocks/{id}` | slot is offered again | API + T | OK |
| "Zablokovaný čas zatím nezmizí…" notice | BlockedTimePage.tsx:~215 | - | - | API (the blocked slot IS taken off availability) + T | BUG-fixed: stale, untrue warning removed |

##### Svátky a dovolené - `/svatky` (`settings/HolidaysPage.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Rok (‹ ›) | HolidaysPage.tsx:221 | page state; `GET /api/holidays/{year}` | list | API (1999 / 2200 -> 400 "Rok musí být mezi 2000 a 2100") + T | BUG-fixed: walked off the supported years |
| Pracujeme v tento den (switch) | HolidaysPage.tsx (row) | `PUT /api/holidays/{date} {isHoliday:false,name}`; switching a statutory day back = `DELETE` | preview: `closedBecause:"holiday"` <-> open with the day's own hours, slots 0 <-> 17 (API) | API + BR (own day) + T `HolidaysPage.test`, `.audit` | OK |
| Online objednávky vypnuty (switch) | HolidaysPage.tsx (row) | one `isClosedToPublic` exception per active calendar (`POST/DELETE …/exceptions`) | the web does not offer the day; staff slots unchanged (API, `isChangedByOverride:true`) | API + T | OK |
| Upravit (rename) | HolidaysPage.tsx:~334 | `PUT /api/holidays/{date}` | list | API + T | BUG-fixed: the date field was editable and wrote a SECOND amendment; a refusal showed behind the modal |
| Přidat vlastní volno | HolidaysPage.tsx:209 | `PUT /api/holidays/{date} {isHoliday:true,name}` | preview `holiday` (API: slots 17 -> 0) | API + BR + T | OK |
| Název (max length) | HolidaysPage.tsx:386 | `name` | list, calendar | API (301+ chars and an empty name -> bare 500) + T (maxlength 300) | BUG-fixed in front / BUG-backend (500) |
| Vrátit | HolidaysPage.tsx:357 | `DELETE /api/holidays/{date}` | back to the statutory calendar | API + T | OK |

##### Nepřítomnost zaměstnanců - `/nepritomnosti` (`booking/EmployeeAbsencesPage.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Zaměstnanec (filter) | EmployeeAbsencesPage.tsx:165 | `?userId=` in the address; `GET /api/employee-absences?userId=` | list | T | OK |
| Zapsat nepřítomnost -> Zaměstnanec, Od, Do (včetně) | EmployeeAbsencesPage.tsx:262 | `POST /api/employee-absences {userId,fromDate,toDate,reason}` | preview `closedBecause:"workerAbsent"` on a day whose row names that worker (API); the grid/day overview keys are refreshed | API + T `EmployeeAbsencesPage.audit` | OK |
| Defaults of Od/Do ("today") | EmployeeAbsencesPage.tsx:66 | - | - | T (run in `America/Los_Angeles`) | BUG-fixed: browser day, not Prague's |
| "Konec nemůže být před začátkem" | EmployeeAbsencesPage.tsx (end field) | - | - | T | BUG-fixed: shown only after a worker was chosen |
| Důvod | EmployeeAbsencesPage.tsx:202 | `reason` (max 300) | list | API + T (maxlength 300) | BUG-fixed: no limit |
| Smazat | EmployeeAbsencesPage.tsx:339 | `DELETE /api/employee-absences/{id}` after a confirmation | the day is offered again (API) | API + T | OK |

##### Výjimky - `/exceptions` (`booking/ExceptionsPage.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Kalendář (select) | ExceptionsPage.tsx | page state | list | T | OK |
| Nová výjimka -> Datum | ExceptionsPage.tsx:326 | `POST /api/calendars/{id}/exceptions {date,…}` (second one the same day -> 409) | preview/availability | API (closed: open false, slots 0; different hours: 10-12, 3 slots; online-off: staff slots unchanged) + T | OK |
| Typ (Zavřeno / Jiný čas / Jiný pracovník / Online objednávky vypnuty) | ExceptionsPage.tsx:335 | `isClosed`, `startTime/endTime`, `workerUserId`, `isClosedToPublic` | as above | API + T (switching kind starts the body over) | OK |
| Jiný čas Od / Do | ExceptionsPage.tsx:368 | `startTime`,`endTime` | preview hours | API (empty -> 422 `hours_required`; end<start -> 422) + T `ExceptionsPage.audit`, `exceptionForm` | BUG-fixed: saveable empty / backwards |
| Jiný pracovník | ExceptionsPage.tsx:397 | `workerUserId` (list = accounts with `hasAccess`) | preview worker | T | BUG-fixed: offered accounts without access |
| Důvod | ExceptionsPage.tsx:235 | `reason` (max 300) | list | API + T | BUG-fixed: no limit |
| Smazat (row) | ExceptionsPage.tsx:293 | `DELETE …/exceptions/{id}` | day back to normal | API + T | OK |
| list window (-90 / +365 days) | ExceptionsPage.tsx:~96 | `GET …/exceptions?from&to` (no range -> 400) | list | API + T | OK |

##### Kalendář a mřížka - `/nastaveni/vzhled-kalendare` (`settings/CalendarDisplayPage.tsx`, `BookingSlotsCard.tsx`)

Everything here is ONE `PUT /api/v1/settings/calendar-display` (whole object); history scope on the server is `calendar`.

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Výchozí pohled | CalendarDisplayPage.tsx:106 | `defaultView` | **nothing reads it** (no consumer in `src/`; the planner's initial view is fixed) | API + BR + T | BUG-open: stored and read back, has no effect |
| Délka řádku | CalendarDisplayPage.tsx:119 | `slotMinutes` (10/15/20/30/60 from the server) | **nothing reads it** (the planner rows come from each calendar's `displayStepMinutes`) | API + T | BUG-open: no effect |
| Den začíná v / Den končí v | CalendarDisplayPage.tsx:134/147 | `dayStartHour`/`dayEndHour` (end > start, 24 allowed) | `planningWindowOf` in the planner catalogue, Rychlý plán and Nová hromadná objednávka defaults | API + T | OK |
| Barva čáry „teď" | CalendarDisplayPage.tsx:164 | `nowLineColor` (#RRGGBB, stored upper case) | `BoardSurface` now line | API + BR (refusal of `#abc` shown at the field) + T | OK |
| Barva volných dnů a svátků | CalendarDisplayPage.tsx:184 | `holidayColor` | `ApiDataSource` -> `dayMarkColors.holiday` | API + T | OK |
| Barva obědové pauzy | CalendarDisplayPage.tsx:204 | `lunchColor` | `dayMarkColors.lunch` | API + T | OK |
| Výchozí oběd od / do (NEW box) | CalendarDisplayPage.tsx (after the day span) | `lunchFrom`/`lunchTo` (`HH:mm`; both empty = none; one only / end<=start -> 400) | the break of every day whose row names none: preview break moved 12:00-12:30 -> 11:00-11:45 -> none (API) | API + T | BUG-fixed: had no box; a PUT without the two wrote `""` over both |
| Bublina: údaje (checkboxes) | CalendarDisplayPage.tsx:233 | `hoverFields` (ordered) | `AppointmentHoverCard` (draws patientName, phone, email, birthDate, activity, service, status, paperwork + the price always) | API + BR + T `CalendarDisplayPage.audit`, `AppointmentHoverCard.audit` | BUG-fixed: offered "Cena" and "Stav registrace" (server 400 "karta neumí zobrazit"), hid 3 it can draw; note/insurer/history are in the server catalogue but the card cannot draw them (BUG-open) |
| Vrátit výchozí hodnoty | CalendarDisplayPage.tsx:279 | form <- `defaults`; still needs Uložit | - | T | OK |
| Uložit / Zahodit | CalendarDisplayPage.tsx:94 | the PUT; history under scope `calendar` | - | BR (saved, reread after reload, restored) + T (double click = one request) | BUG-fixed: history panel asked scope `vzhled-kalendare` and always showed "nikdo nic neměnil" |
| Pauza mezi vyšetřeními (min) + Uložit pauzu | BookingSlotsCard.tsx:51/73 | `PUT /api/v1/settings/booking-slots {examinationPauseMinutes}` 0-240 (range from the server); history scope `booking` | availability offers the next start after the pause | API (read/PUT earlier, restored) + T `BookingSlotsCard.audit` | OK |

##### Kalendáře - `/calendars` (`booking/CalendarsPage.tsx`, `components/booking/CalendarAccessDialog.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Název | CalendarsPage.tsx:524 | `name` (max 100) | everywhere a calendar is named | API (101 -> 422) + T `CalendarsPage.audit`, `calendarForm` | BUG-fixed: no limit/validation |
| Barva (ColorSelect) | CalendarsPage.tsx:48 (component) | `color` #RRGGBB; choices = the service-colour palette | calendar column/legend | API (`red` -> 422) + T | OK |
| Místo | CalendarsPage.tsx:357 | `location` (max 200) | list | API + T | BUG-fixed: no limit |
| Služba | CalendarsPage.tsx:556 | `clinicServiceId` (required; null -> 400) | what the calendar offers | API + T | OK |
| Krok zobrazení | CalendarsPage.tsx:358 | `displayStepMinutes` (>=1; 0/-5 -> 422) | planner rows (`ApiDataSource` stepMinutes), pick days | API + T | BUG-fixed: 0 could be sent |
| Pořadí | CalendarsPage.tsx:598 | `sortOrder` (>=0) | order of columns | API + T | BUG-fixed: negative could be sent |
| Nejdřív za (minut) | CalendarsPage.tsx:638 | `publicMinimumNoticeMinutes` (null or >=0) | public booking | API + T | BUG-fixed: negative could be sent |
| Nejpozději za (dnů) | CalendarsPage.tsx:654 | `publicHorizonDays` (null or >=1; 0 -> 422 with a wrong code) | public booking | API + T | BUG-fixed + BUG-backend (wrong error code) |
| Držení termínu (minut) | CalendarsPage.tsx:670 | `publicHoldMinutes` (null or >=1) | public hold | API + T | BUG-fixed / BUG-backend (same) |
| Zrušení nejpozději (hodin) | CalendarsPage.tsx:686 | `publicCancellationHours` (null or >=1) | patient self-cancel | API + T | BUG-fixed / BUG-backend (same) |
| Uložit (create/update) | CalendarsPage.tsx | `POST/PUT /api/calendars`; the PUT carries all four public numbers and `isActive` | - | API (round trip, nulls kept, a PUT without them clears them) + T | OK |
| Zneaktivnit / Znovu aktivovat | CalendarsPage.tsx:477 | `POST …/deactivate` / `…/activate` | not offered for new bookings | API + T | OK |
| Smazat (+ offer to deactivate after a 409) | CalendarsPage.tsx:784 | `DELETE /api/calendars/{id}` (409 with the count when it holds orders/bookings) | - | API + T | OK |
| Přístupy (dialog) | CalendarsPage.tsx:449, CalendarAccessDialog.tsx:82 | `PUT /api/calendars/{id}/access { userIds }` (locked rows never sent) | who sees the calendar; worker pickers (`calendar-access` key refreshed) | API (owner locked, `[]` and unknown id answer 200, no body -> 400) + T `CalendarAccessDialog.audit` | OK (only ONE account exists on the dev DB, so multi-person access is verified in jsdom only) |

##### Údaje ordinace - `/admin` (`pages/Admin.tsx`)

History scope on the server is `pub`; the company card (IČO, bank) is in section C.

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Název webu | Admin.tsx:203 | `PUT /api/settings/bulk {"pub.siteName"}` | `GET /api/public/clinic` (API, read back) and the public pages | API + BR (read) + T `Admin.audit` | OK |
| Email | Admin.tsx:207 | `pub.contactEmail` | public clinic | API (`not-an-email` was accepted by the server) + T | BUG-fixed: any text could be saved |
| Telefon / Adresa | Admin.tsx:214/219 | `pub.contactPhone`, `pub.contactAddress` | public clinic | API + T | OK |
| Otevírací doba (text pro web) | Admin.tsx:224 | `pub.openingHours` (max 200; 201 -> 400) | public clinic, footer | API + T | OK |
| Veřejná adresa webu | Admin.tsx:122 | `pub.siteUrl` (reduced to an origin; the server stores `javascript:…`) | links in club mails | API + T | BUG-fixed: `ftp://x` became `https://ftp` (normalizeBase) |
| Rezervace online (switch) | Admin.tsx:246 | `pub.bookingEnabled` "true"/"false" | `bookingEnabled` of the public clinic (API: false read back, then restored) | API + T | OK |
| Uložit kontakty a rezervace | Admin.tsx:182 | one bulk PUT, trimmed | - | API + BR (read) + T (never "uloženo" on failure; disabled until the stored values were read) | OK |
| "Poslední změny" | Admin.tsx (`scope`) | - | - | T | BUG-fixed: scope was `verejny-web`, server files it under `pub` |

#### Služby a ceny

##### Služby - `/nastaveni/sluzby` (`booking/ClinicServicesPage.tsx`, `settings/services/*`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Nová služba / Upravit: Název | ClinicServicesPage.tsx:395 | `POST/PUT /api/clinic-services` (name max 100; duplicate -> 409 `service.duplicate`) | služba list, činnosti, calendars | API + T `ClinicServicesPage.audit` | BUG-fixed: no limit |
| Popis | ClinicServicesPage.tsx:405 | `description` (max 500) | detail | API + T | BUG-fixed: no limit |
| Pořadí | ClinicServicesPage.tsx:415 | `sortOrder` (>=0) | list order | API + T | BUG-fixed: negative could be sent |
| Činnosti / Kalendáře (multi-select in the dialog) | ClinicServicesPage.tsx:434/479 | one PUT per moved činnost / calendar | which služba they belong to | API (PUT of a činnost WITHOUT `colorHex` cleared its own colour: `#AA0000` -> null) + T `ClinicServicesPage.handoff` | BUG-fixed: moving a činnost lost its own colour (body now `activityToInput`) |
| Archivovat / Obnovit / Smazat trvale | ClinicServicesPage.tsx:596/328, DeleteFlow | `DELETE` (archive), `POST …/activate`, `DELETE ?permanent=true` (409 when referenced) | not offered for new orders | API (archive, permanent delete of a throw-away one) + T | OK |
| Detail: Délka, Souběžná kapacita, Cena z ceníku, Dotazník, Objednat může i pacient, Aktivní, Posunout výš/níž | ActivitiesSection.tsx:161/169/179/201/222/232/143 | whole `PUT /api/activities/{id}` per change (`activityToInput`) | calendar, public booking, price | API (a PUT without `colorHex` clears it; with the whole body it does not) + T `ActivitiesSection.audit` | OK |
| Detail: Pravidla (Dotazník, 2 souhlasy) | `RulesSection.tsx` | same whole PUT | patient registration | T `RulesCalendarsSections.audit` | OK |
| Detail: Kalendáře (pracovní dny chips) | `CalendarsSection.tsx` | read from the period in force | - | T | OK |
| Detail: Ceník line, Upravit cenu | `PriceSection.tsx` | `PUT /api/services/{id}` | - | T | OK |

##### Činnosti - `/activities` (`booking/ActivitiesPage.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Název | ActivitiesPage.tsx:406 | `name` (max 120; empty -> 422) | everywhere | API + T `ActivitiesPage.audit` | BUG-fixed: no limit |
| Délka | ActivitiesPage.tsx:407 | `durationMinutes` (>=1; 0 -> 422; no upper bound) | slot length | API + T | OK / BUG-backend (100000 min accepted) |
| Barva (ColorSelect) | ActivitiesPage.tsx:55 | `color` (a palette colour) | list chip | API (the same rule on a calendar: `red` -> 422) + T | OK |
| Služba | ActivitiesPage.tsx:646 | `clinicServiceId` (required) | document rules, calendar | API (empty -> 400) + T | OK |
| Položka ceníku | ActivitiesPage.tsx:668 | `serviceItemId` (null clears) | price shown everywhere | API + T (an archived link stays selectable) | OK |
| Poznámka pro pacienta | ActivitiesPage.tsx:409 | `publicNote` (max 500) | public booking | API + T | BUG-fixed: no limit |
| Pořadí | ActivitiesPage.tsx:721 | `sortOrder` (>=0) | order | API + T | BUG-fixed |
| Lze objednat z webu | ActivitiesPage.tsx:742 | `isPubliclyBookable` | public booking | API + T | OK |
| Souhlasy (e-mail zpráva, sdílení s klubem) | ActivitiesPage.tsx:769/780 | `requiresReportByEmail`, `requiresClubSharing` | registration | API + T | OK |
| Zdravotní dotazník / Který dotazník | ActivitiesPage.tsx:800/827 | `questionnaireRequirement` (wire 0/1/2; the server accepts 5 - BUG-backend), `questionnaireDefinitionId` | questionnaire | API + T (the id is kept when switched to "Neptáme se"; locked without `questionnaires.manage`) | OK |
| (not in the form) colorHex, parallelCapacity, requiredDocumentTemplateIds | carried by `activityToInput` | - | - | API (docs round trip; omitting colorHex clears it) + T | OK |
| Archivovat / Obnovit / Smazat | ActivitiesPage.tsx:911/227 | `DELETE` / `POST …/restore` / `?permanent=true` | - | API + T | OK |

##### Ceník - `/nastaveni/cenik` (`pages/Cenik.tsx`, `pricing/ServiceDialog.tsx`, `pricing/serviceForm.ts`, `cenik/*`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Hledat v ceníku | Cenik.tsx:236 | page state | list | T `Cenik.audit` | OK |
| Nová položka / Upravit: Kód | ServiceDialog.tsx | `POST/PUT /api/services` (the server checks NOTHING: empty/duplicate code, name, price -5, 3 decimals, 999999999999999 all 200; code > 30, name > 200, description > 1000 -> 400 with an EF text) | the price everywhere (calendar, invoices, public list) | API + T `serviceForm.audit` | BUG-fixed: lengths, decimals, `1.500` -> 1.5 Kč; BUG-backend (no validation) |
| Cena | ServiceDialog.tsx:132 | `priceCzk` | public price list | API + T (`1.500` and `1.500,50` are 1500) | BUG-fixed |
| Původní (přeškrtnutá) cena | ServiceDialog.tsx:144 | `listPriceCzk`: omitted KEEPS, `null` clears (API) | crossed-out price | API + T | OK |
| Popis | ServiceDialog.tsx:107 | `description` (max 1000) | card | T | BUG-fixed: error was not shown on the field |
| Vyřadit | Cenik.tsx:107 | `DELETE /api/services/{id}` (one way) after a confirmation | gone from every list | API + T | OK |
| Činnost: Barva a dokumenty | `cenik/ActivityExtrasDialog.tsx` | whole `PUT /api/activities/{id}` (`requiredDocumentTemplateIds`, `colorHex`, `parallelCapacity`) | registration, calendars | API (docs round trip, unknown id -> 422, `[]` clears) + existing `Cenik.activities.test` | OK |
| Permission: Nová položka / Upravit / Vyřadit hidden without `settings.clinic.manage` | Cenik.tsx | - | - | T | OK |

##### Slevy - `/nastaveni/slevy`, `/nastaveni/skupinove-slevy` (`settings/DiscountsPage.tsx`, `discounts/*`, `GroupDiscountsPage.tsx`)

Both screens write the SAME tiers (`/api/v1/settings/group-discounts` is an alias over `/api/v1/settings/discounts` on the server; verified: bands 3-5/6+ read back as tiers {3,4},{6,9} and on `/api/public/discount-tiers`). History scope on the server is `pricing`.

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Hladiny: Od kolika osob / Sleva / Odebrat / Přidat | DiscountsPage.tsx:29 -> TierEditor | `tiers [{minPersons,percent}]` (percent 0-100, 2 decimals; 2.5 % accepted) | price quote, public Kluby page (`/api/public/discount-tiers`) | API (dup/0/101 -> 400 with the row key) + T `DiscountsPage.audit` | OK |
| Balíčkové slevy | PackageEditor | `packageDiscounts [{activityId,percent}]` | package lines | T | OK |
| Ruční sleva - limit podle role | RoleLimitEditor | `roleLimits [{role,maxManualPercent}]`; the server also sends `label` | invoice approval | API (unknown role -> 400) + T | BUG-fixed: called `Staff` "Personál" while the server says "Recepce" (label now carried) |
| Uložit / Zahodit | DiscountsPage.tsx:126 | PUT | - | T (double click = one request, row-level server errors) | OK |
| History panel | DiscountsPage.tsx | - | - | T | BUG-fixed: scope `discounts` (server: `pricing`) |
| Skupinové slevy (older screen): Od / Do / Sleva / Přidat / Obnovit výchozí / Uložit | GroupDiscountsPage.tsx:162/259 | `PUT /api/v1/settings/group-discounts {tiers:[{minHeadcount,maxHeadcount,percent}]}` (overlap -> 400 `errors.tiers`; a gap is filled with a 0 % band) | the same data as above | API + T `GroupDiscountsPage.audit` | OK (two editors for one setting with different wording: BUG-open, section 3) |

##### Barvy služeb - `/nastaveni/barvy-sluzeb` (`settings/ServiceColorsPage.tsx`, `colors/*`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Paleta (colour boxes, picker, Přidat, Odebrat) | ServiceColorsPage.tsx:108, PaletteEditor | `PUT /api/v1/settings/service-colors {palette}`: 6-24 distinct `#RRGGBB`, stored upper case; history scope `calendar` | new službas take the next colour; `ColorSelect` offers it for calendars and činnosti | API (5, 40, repeated, `#12` -> 400) + T `ServiceColorsPage.audit` | BUG-fixed: no upper bound (25th colour came back 400); history scope |
| Barva služby (swatch) | ServiceColorsPage.tsx:138 | `PUT /api/clinic-services/{id}` `{name,description,sortOrder,colorHex}` (the colour is kept when omitted, API) | calendar legend, chips | API + T | OK |
| Barva činnosti / Použít odstín služby | ServiceColorsPage.tsx:144 | whole `PUT /api/activities/{id}` with `colorHex` (or `null`) | činnost shade | API + T | OK |

#### Kluby

##### Hromadné objednávky a blokace - `/vyhrazeni` (`booking/PartnerOrdersPage.tsx`, `components/booking/NewPartnerOrderDialog.tsx`, `ReleaseWindowDialog.tsx`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Kalendář (active only) | PartnerOrdersPage.tsx:240 | page state | which orders | T `PartnerOrdersPage.audit` | OK |
| Nová hromadná objednávka: Název partnera | NewPartnerOrderDialog.tsx | `POST …/partner-orders {partnerName (max 100), partnerType, contactEmail (max 128), note, clubId}` | club link, calendar | API + T `NewPartnerOrderDialog.audit` | BUG-fixed: no limits |
| … Kontaktní e-mail | NewPartnerOrderDialog.tsx | `contactEmail` (server stores any text) | club mail | API + T | BUG-fixed: no format check |
| … Požadavek: činnost + počet | NewPartnerOrderDialog.tsx | `PUT …/items` (the same činnost twice -> bare 500; count 0 -> 422) | required minutes | API + T | BUG-fixed: the same činnost could be chosen twice |
| … Okna: den, od, do; Přidat dny (range) | NewPartnerOrderDialog.tsx | `POST …/windows` (end==start -> 422 AFTER the order exists) | coverage = open hours minus lunch (matches `preview`) | API + T | BUG-fixed: a backwards window was saveable; defaults come from Kalendář a mřížka |
| … after a part-way failure | NewPartnerOrderDialog.tsx | - | - | T | BUG-fixed: Uložit stayed on and made a second order while the text said "nezakládejte znovu" |
| Rozpis / tisk | PartnerOrdersPage.tsx:538 | read only | - | existing tests | OK |
| Prodloužit lhůtu -> Nová lhůta | PartnerOrdersPage.tsx:381 | `PUT …/deadlines {releaseDate}` (the server takes past dates, dates after the window and even garbage) | release date of every window | API + T | BUG-fixed: past dates; BUG-backend (no validation) |
| Zrušit odkaz | PartnerOrdersPage.tsx:465/368 | `POST …/revoke` (permanent, idempotent) | the club link dies | API + T | BUG-fixed: revoked with one click and no confirmation |
| Uvolnit (window) -> veřejnost / partneři | ReleaseWindowDialog.tsx | `POST …/windows/{id}/release {toPublic,partnerOrderIds}` | freed capacity | T | BUG-fixed: a revoked order was offered as a recipient |
| Notices ("splatné dnes") | PartnerOrdersPage.tsx | `GET …/notices?date=` (Prague date) | banner | T | BUG-fixed: browser date |

##### Nastavení klubů - `/nastaveni/kluby` (`settings/ClubSettingsPage.tsx`)

History scope `clubs` (verified: the server files these changes there).

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Platnost odkazu (dní) | ClubSettingsPage.tsx:192 | `registrationLinkValidityDays` 1-1095 | club registration links | API (0, 1096, 3650 -> 400) + BR + T `ClubSettingsPage.audit` | BUG-fixed: the screen allowed 3650 |
| Minimální počet sportovců | ClubSettingsPage.tsx:209 | `minimumPlayers` null or >=1 | block calculator warning, public Kluby page | API + T | OK |
| Otevřít nevyužitou kapacitu veřejnosti X dní před | ClubSettingsPage.tsx:227 | `releaseUnusedDaysBefore` null (never) or >=0 | planner catalogue `releaseDaysBefore` | API + T | OK |
| Povolit v jedné objednávce více služeb | ClubSettingsPage.tsx:250 | `allowMultiServiceOrders` | order flow | API + T | OK |
| Když platí klub fakturou / Když platí každý rodič sám (NEW) | ClubSettingsPage.tsx:264/276 | `payerTextClubInvoice`, `payerTextPerPerson` (max 500; `""` clears, `null` keeps) | the sentence parents read on the club page (`InfoPanel`) | API + BR (typed, saved, reread after reload, cleared) + T | BUG-fixed: the server has the setting, the screen had no editor |
| Uložit / Zahodit | ClubSettingsPage.tsx | whole PUT incl. `blockPalette` carried | - | BR + T | OK |

### 2. Fixes made (by file)

Source: `src/api/schedulingMessages.ts` (new), `src/api/apiError.ts`, `src/api/fieldLimits.ts` (new), `src/api/displaySettings.ts`, `src/api/discounts.ts`,
`src/api/clubs.ts`, `src/pages/booking/{calendarForm.ts (new), exceptionForm.ts (new), CalendarsPage, ClinicServicesPage, ActivitiesPage, BlockedTimePage,
EmployeeAbsencesPage, ExceptionsPage, WorkingHoursPage, PartnerOrdersPage}.tsx`, `src/pages/settings/{CalendarDisplayPage, HolidaysPage, DiscountsPage,
GroupDiscountsPage, ServiceColorsPage, ClubSettingsPage}.tsx`, `src/pages/settings/colors/{PaletteEditor, colorLogic}`, `src/pages/settings/discounts/{discountLogic, DiscountEditors}`,
`src/pages/Admin.tsx`, `src/pages/pricing/{serviceForm.ts, ServiceDialog.tsx}`, `src/components/booking/NewPartnerOrderDialog.tsx`, `src/components/clubs/orders/absoluteLink.ts`.
Tests: `src/test/auditHarness.tsx` (new, shared) and 28 `*.audit.test.*` files with 748 cases (section 4).

### 3. Bugs and gaps

#### Bugs fixed (with the test that pins each)

1. **Raw `scheduling.*` codes shown to staff.** Every 422 of the booking endpoints answers `message:"scheduling.working_hours.end_before_start"`; `toBookingError` showed it as it was.
   Fix: a Czech sentence per code (80 codes, from the backend source) in `schedulingMessages.ts`, used by `apiError.readServerMessage`; an unknown code falls back to the fixed domain-rule sentence.
   Pin: `schedulingMessages.audit.test.ts` ("has a Czech sentence for every code", "a 422 carrying a code shows the Czech sentence").
2. **Kalendář a mřížka offered facts the server refuses.** "Cena" and "Stav registrace" -> `400 "Tyto údaje karta neumí zobrazit: price, registrationStatus"`; three drawable facts were missing. Fix: the checkboxes come from the server's `hoverFieldCatalogue` narrowed to what the card draws.
   Pin: `CalendarDisplayPage.audit` ("does not offer Cena / Stav registrace …", "offers the server catalogue …"), `displaySettings.audit` (`hoverChoices`), `AppointmentHoverCard.audit`.
3. **`lunchFrom`/`lunchTo` lost.** A PUT without them wrote `""` over both; they also had no box. Fix: kept in the type, carried by every save, two boxes added with the server's validation.
   Pin: `CalendarDisplayPage.audit` ("never loses the lunch break…", "the default lunch break…"), `displaySettings.audit`.
4. **Moving a činnost to another služba cleared its own colour** (`ClinicServicesPage.applyLinks` built a hand-written body without `colorHex`; API: `#AA0000` -> `null`). Fix: `activityToInput(a, { clinicServiceId })`.
   Pin: `ClinicServicesPage.handoff.test` ("carries the činnost's own colour, capacity and documents through a move").
5. **Change history always empty** on five screens: they asked scopes (`vzhled-kalendare`, `discounts`, `service-colors`, `verejny-web`) the server never writes. Real scopes: `calendar`, `pricing`, `pub`, `clubs`, `booking`.
   Pin: the "Poslední změny" cases of `CalendarDisplayPage`, `ServiceColorsPage`, `DiscountsPage`, `GroupDiscountsPage`, `ClubSettingsPage`, `Admin` audits.
   (Part 2 note: `media-storage` and `quick-registration` scopes in the sibling's pages look wrong too - the server writes `media` and `registration`.)
6. **Club settings**: link validity allowed up to 3650 (server: 1095) and the two payer sentences had no editor. Pin: `ClubSettingsPage.audit`, `clubs.settings.audit`, BR.
7. **Calendars / činnosti / služby / exceptions / blocks / absences / holidays / price list / partner orders: no limits.** Texts longer than the server keeps (calendar name 100, location 200, služba name 100, description 500, činnost name 120, note 500, reasons 300, holiday name 300 - longer is a bare 500, price-list name 200, code 30, description 1000, partner name 100, e-mail 128),
   negative order, step 0, public numbers out of range, 3 decimals in a price. Fix: `maxLength` + validation in front (`fieldLimits.ts`, `calendarForm.ts`, `serviceForm.ts`). Pin: the "stops the typing at…" cases of each audit file.
8. **Výjimky "Jiný čas" saveable without hours or backwards** (server 422 after the trip). Fix: `exceptionForm.ts`. Pin: `ExceptionsPage.audit`.
9. **Price parsing**: `parseCzechNumber("1.500")` was 1.5 (the header promised 1500). Pin: `serviceForm.audit`.
10. **Dates in the browser's zone** (Pauzy, Nepřítomnost, Výjimky, Hromadné objednávky notices): now Prague's. Pin: `BlockedTimePage.audit` (runs in New York), `EmployeeAbsencesPage.audit`, `PartnerOrdersPage.audit` (Los Angeles).
11. **Pracovník / zástup lists** offered accounts without access to the calendar. Pin: `WorkingHoursPage.audit`, `ExceptionsPage.audit`.
12. **Holidays**: a day already listed had an editable date (wrote a second amendment); refusal of the dialog was drawn behind the modal; year buttons walked past 2000-2100. Pin: `HolidaysPage.audit`.
13. **Pauzy**: a stale warning "Zablokovaný čas zatím nezmizí…" (the server does take the slot off, 17 -> 15). Pin: `BlockedTimePage.audit`.
14. **Hromadné objednávky**: revoke without confirmation, deadline into the past, duplicate činnost, backwards window, second order after a part-way failure, revoked order offered as recipient, invalid e-mail. Pin: `PartnerOrdersPage.audit`, `NewPartnerOrderDialog.audit`.
15. **Slevy**: role names ignored the server's `label` ("Personál" vs "Recepce"); at 768-1023 the tier table scrolled sideways beside the preview (now one column below 1024). Pin: `DiscountsPage.audit`; BR (`/nastaveni/slevy` clean at 768, 820, 1024, 1180, 1279).
16. **Barvy služeb**: no upper bound of 24 colours. Pin: `ServiceColorsPage.audit`.
17. **Údaje ordinace**: invalid e-mail saved; `ftp://x` -> `https://ftp`. Pin: `Admin.audit`.
18. **Working hours table** 913 px wide at 1024 (now 849). `WorkingHoursPage.tsx` (field widths); BR.
19. Smaller: the end-before-start hint on absences was shown only after a worker had been chosen.

#### Backend defects (exact endpoint, request, response)

All against the dev API on :5092 (build of `SMClean-int`, `app/integrate`).

- **B1 - raw codes in `message`.** `PUT /api/calendars/{id}` with `displayStepMinutes:0` -> `422 {"success":false,"message":"scheduling.calendar.display_step_positive"}` (80 codes exist, none localised). Expected: a Czech sentence (the frontend now words them, but any other client sees codes).
- **B2 - wrong code for out-of-range numbers.** `PUT /api/calendars/{id}` with `publicHorizonDays:0` (also `publicHoldMinutes:0`, `publicCancellationHours:0`, `-1`) -> `422 "scheduling.sort_order_negative"`. Expected a code that names the field. (The screen cannot tell the owner that 0 is refused for these three but allowed for `publicMinimumNoticeMinutes`, so it says so itself.)
- **B3 - holidays: 500 instead of 400.** `PUT /api/holidays/2027-06-17 {"isHoliday":true,"name":""}` and with a 500-character name -> `500 {"code":"server.error","message":"Požadavek se nepodařilo bezpečně dokončit."}`. Expected `400` with a sentence (longest accepted name: 300).
- **B4 - `/api/services` validates nothing.** `PUT /api/services/{id} {"code":"","name":"","priceCzk":-5,…}` -> `200`; duplicate `code` -> `200`; `priceCzk:1234.567` and `99999999999` -> `200`; `name` > 200 / `code` > 30 / `description` > 1000 -> `400 {"message":"An error occurred while saving the entity changes. See the inner exception for details."}` (an EF text).
- **B5 - partner orders.** `PUT …/partner-orders/{id}/items` with the same `activityId` twice -> `500`; `PUT …/deadlines {"releaseDate":"not-a-date"}` -> `200` (silently ignored), a date in the past or after the window -> `200`; `POST …/partner-orders {"partnerType":9}` -> `201`; `contactEmail:"not-an-email"` -> `201`; `POST …/windows` with a date in 2020 -> `201`; `count 100001` -> `200`.
- **B6 - `/api/settings/bulk`**: `pub.contactEmail:"not-an-email"`, `pub.siteUrl:"javascript:alert(1)"`, `pub.bookingEnabled:"maybe"` -> `200` and stored.
- **B7 - activities.** `questionnaireRequirement:5` -> `200` (not 0/1/2); `durationMinutes:100000` and `parallelCapacity:500` -> `200`.
- **B8 - employee absences.** Two overlapping absences of the same person are both accepted (`201`); `DELETE` of an id that does not exist -> `204`.
- **B9 - calendar PUT is "whole entity"**: the four `public*` fields left out are cleared (documented, the frontend always sends them); same for `colorHex` on `PUT /api/activities` and `lunchFrom/lunchTo` on `PUT /api/v1/settings/calendar-display`.
- **B10 - day-activities GET** answers a bare array, so the object shape with `warnings` (the 5.7 "day offers nothing" server warnings) can never arrive; the screen computes the warning itself.

#### Bugs found and NOT fixed (BUG-open)

- **O1 - Výchozí pohled (FIXED by the lead after the audit: `ApplyDefaultView`, the standard calendar opens in it, applied once and never over a view the person already picked; `ApplyDefaultView.test.tsx`) and Délka řádku (still open) have no effect.** `defaultView` and `slotMinutes` are stored and read back but nothing in `src/` reads them (the old `CalendarGridPage` is gone; the planner opens on its own view and its rows come from each calendar's `displayStepMinutes`). Needs a decision by the planner owner: either consume them in `src/planner/**` or remove the two controls. `CALENDAR_DISPLAY_OFFLINE.slotMinutes` is 30 while the server's default is 15.
- **O2 - hover facts `note`, `insurer`, `history`** are in the server catalogue but a calendar row (`dayAppointmentSchema`) carries none of them, so the card cannot draw them; the screen hides them. The backend should not list them, or the row should carry them.
- **O3 - two screens, one setting.** `/nastaveni/skupinove-slevy` ("Doporučené hladiny slev", tiers are "recommendations") and `/nastaveni/slevy` ("the higher applies", the discount is applied) edit the same tiers with contradicting wording; the older one is a catalogue alias "until the new one replaces it".
- **O4 - tablet 768-1023 on Otevírací doba**: the 7-column timetable (913 px needed) and the činnosti grid (801 px) scroll sideways inside their box (`StackTable` only stacks below 768). Needs a stacked layout for portrait tablets.
- **O5 - stored worker without a name** shows "Pracovník - jméno se nenačetlo" although the row carries `workerDisplayName`.
- **O6 - Blokovaný čas / Hromadné objednávky / Ceník are open to every signed-in user** in the router (no `RequirePermission`); only the Ceník hides its editing buttons. Whether the server refuses their writes for a receptionist could not be tried (one account).

### 4. Tests

New audit files (final run of exactly these files: `Test Files 28 passed (28)`, `Tests 748 passed (748)`): `src/api/{schedulingMessages,displaySettings,clubs.settings}.audit.test.ts`,
`src/components/booking/{CalendarAccessDialog,DayActivityGrid,NewPartnerOrderDialog}.audit.test.tsx`, `src/components/booking/grid/AppointmentHoverCard.audit.test.tsx`,
`src/pages/{Admin,Cenik}.audit.test.tsx`, `src/pages/booking/{Activities,BlockedTime,Calendars,ClinicServices,EmployeeAbsences,Exceptions,PartnerOrders,WorkingHours}Page.audit.test.tsx`,
`src/pages/booking/timetable.audit.test.ts`, `src/pages/pricing/serviceForm.audit.test.ts`, `src/pages/settings/{BookingSlotsCard,CalendarDisplayPage,ClubSettingsPage,GroupDiscountsPage,HolidaysPage}.audit.test.tsx`,
`src/pages/settings/colors/ServiceColorsPage.audit.test.tsx`, `src/pages/settings/discounts/DiscountsPage.audit.test.tsx`, `src/pages/settings/services/{ActivitiesSection,RulesCalendarsSections}.audit.test.tsx`.
Existing tests adapted to the changed behaviour: `ClinicServicesPage.handoff.test` (real `activityToInput` + a new case), `ClubSettingsPage.test` (the limit sentence, the draft shape).

### 5. Not verified and why

- **Multi-person permissions.** The dev database holds ONE account (the owner). Calendar access with several people, `settings.clinic.manage` missing, and whether the server refuses a receptionist's writes on Blokovaný čas, Hromadné objednávky and Ceník are covered in jsdom only.
- **Rychlý plán** (`QuickPlanDialog`, 764 lines) - only its existing 30 tests were run; no line-by-line audit and no API round trip.
- **Production** behaviour (Render) - nothing was run against it; the dev API is a different build from Render's `main`.
- **Real e-mails / SMS** that a reminder or club link would trigger - not sent (none of these screens sends).
- **Periods with an "impact" token** (`PUT …/periods/{id}?acknowledgedToken`): only POST/DELETE of periods and rows were exercised on the API.
- **Sub-pixel layout** of every dialog at 360 px and 2560 px: only the three main widths (390 / 820 / 1440) plus 768, 1024, 1180, 1279 for the screens flagged; no overflow, no failed request and no console error besides the deliberate 400 of a refused colour.
- Throw-away data left in the dev DB: calendar "ZZ audit partner" (deactivated, 1 + about 4 partner orders that cannot be deleted - the server refuses to delete a calendar that holds orders). Everything else created was deleted or restored.

---

## C. Komunikace, Dokumenty, Vzhled webu, Systém, the hub (audit part 2)

Audited 2026-10-20 against the dev API (`http://localhost:5092`, throwaway DB `sportmedical_dev`), branch `claude/clean`.
Scope: every control of the screens listed in "Where" below, plus the Settings hub (search, group pages, permission-filtered tiles,
"Osobní" with Můj účet and sign-out; the Vzhled card is the lead's and was not touched or tested).

How each row was checked:

* **HTTP** — a real `GET → PUT → GET → restore` against the dev API with the body the frontend builds (script run from the session scratchpad, credentials read inside the script only), plus the refusals (out of range, empty, wrong shape).
* **jsdom** — a render test with the API module or the HTTP client mocked, asserting what is shown, what is sent and what is read back.
* **unit** — a table-driven test of a pure function.
* **read** — code read only, not run.
* **browser** — headless Chromium, logged in, route opened at 390 / 834 / 1440; console errors, failed requests, horizontal overflow, "undefined/NaN" in the text, controls under 44 px (touch layouts).

Status: `OK` · `BUG-fixed` (frontend bug, fixed here, pinned by a test) · `BUG-backend` (cannot be fixed from the frontend, see "Backend defects") · `BUG-open` (frontend, not fixed, reason given).

New tests live next to the code as `*.audit.test.*` (and `IntakeLinkSettingsPage.test.tsx`); the count is in the final section.

### Control table

#### Settings hub (`src/pages/Settings.tsx`, `src/pages/settings/catalogue.ts`)

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Search box ("Hledat v nastavení") | Settings.tsx:139 → `catalogue.searchSettingsItems` | not stored (shared state with the nav search) | narrows to rows the person may open; every word must match label/keywords/description/group | unit: 26 query→first-hit cases, diacritics, narrowing, gibberish, permission-limited (catalogue.audit.test.ts, Settings.audit.test.tsx) | OK |
| Group tiles (Komunikace, Dokumenty, Vzhled webu, Systém) | Settings.tsx `GroupTile` | – | link to `/settings/:group` | jsdom at 390/834/1440 + browser | OK |
| Group page rows | Settings.tsx `GroupPage` | – | one link per row the permission list allows | jsdom: 8 role/permission combinations | OK |
| Permission filter (menu vs router) | catalogue.ts `visibleSections`; `requires` per item | server's effective permission list in `localStorage.permissions` | the menu hides what the route would refuse | unit: for all 19 items the `requires` equals the `RequirePermission of=` in StaffApp.tsx (regex over the route table) | OK |
| "Poslední změny" panel under each screen / history scope | catalogue.ts `scope`, `scopeOf` | server: `GET /api/v1/settings/changes?scope=` | panel under each screen and the "Oblast" filter | HTTP + unit + jsdom (see Bug 1) | BUG-fixed |
| Můj účet card | Settings.tsx `PersonalSection` | `localStorage.user` (read-only, set at sign-in) | none — honest read-only; says the admin changes name/e-mail | jsdom: name, e-mail, no textbox, damaged storage | OK |
| Odhlásit se | Settings.tsx:343 | `DELETE /api/v1/session`, then local session cleared | ends the session on the server | jsdom: calls `signOut` once (the routine itself: read) | OK |

#### Komunikace

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Template list (click to edit) | EmailTemplatesPage.tsx:131 | `GET /api/email-templates` (6 templates: intake-confirmation, booking-confirmation, booking-rescheduled, booking-cancelled, booking-reminder, intake-link) | picks the template into the editor | HTTP + jsdom | OK |
| Předmět | EmailTemplatesPage.tsx:171 | `PUT /api/email-templates/{code}` `{subject, bodyHtml}` | the server's outbox sends it with `{{…}}` replaced; nothing is delivered on this install (`smtp.configured:false`, 164 queued) | HTTP: save→get, unknown placeholder 400, empty subject/body 400, version bump; jsdom: save payload, double click = 1 request, empty blocked | OK |
| Text e-mailu (HTML) | EmailTemplatesPage.tsx:178 | same | same | HTTP + jsdom | OK |
| Single-brace placeholder `{pacient.jmeno}` | emailTemplateText.ts; EmailTemplatesPage `braceWarning` | server stores it | **not substituted** — patient would get the literal text | HTTP: save 200, preview unchanged; unit + jsdom: warning, Save blocked, chip inserts `{{…}}` always | BUG-fixed (Bug 2) |
| Placeholder chips | EmailTemplatesPage.tsx:202 | editor state | insert `{{key}}` at the caret | jsdom: caret position, with a stray `{` in the body | BUG-fixed (Bug 2) |
| Uložit | EmailTemplatesPage.tsx:220 | as above | list invalidated (`['email-templates']`) | jsdom | OK |
| Náhled | EmailTemplatesPage.tsx:228 | `POST …/preview` with the on-screen text | sample values substituted (HTTP-verified); shown in a sandboxed iframe | HTTP + jsdom (`sandbox=""`) | OK |
| Poslat test sobě | EmailTemplatesPage.tsx:239 | `POST …/test-send {}` — **no wording is sent**, the server sends the SAVED template | one e-mail to the signed-in employee | read (backend `SendTest`), jsdom: disabled while dirty with the reason; not run against the API (would queue a real mail) | BUG-fixed (Bug 3; the server limit is a BUG-backend) |
| Vrátit původní znění | EmailTemplatesPage.tsx:252 | `POST …/reset` | back to shipped wording, `isCustomized:false` | HTTP: reset restores subject and body byte for byte; jsdom | OK |
| Switching template with unsaved edits | EmailTemplatesPage `select` | – | the edit is dropped silently | jsdom pins it | BUG-open (no confirm dialog; low) |
| "SMS" in the name | catalogue + page title | – | only e-mail templates exist on the server (no SMS category) | HTTP list | BUG-open (naming; there is nothing SMS to edit) |
| Předstih (hodin) | RemindersPage.tsx:120 | `PUT /api/v1/settings/reminders {hoursBefore}` (key `booking.reminderHoursBefore`) | `AppointmentReminderService` reads it (`ReminderRules.ReadHoursBeforeAsync`, read); no mail is sent on this install | HTTP: 36→get, 0/745/-3/12.5/"abc"/null → 400, edges 1 and 744, restored 24; jsdom 22 cases | BUG-fixed (Bug 4: decimals/exponent truncated by `parseInt`; Save enabled with no change) |
| Vrátit výchozí hodnotu | RemindersPage.tsx:149 | field only | the server's `defaults.hoursBefore` | jsdom | OK |
| Hodnocení pacientů list / KPIs | FeedbackReviewPage.tsx | `GET /api/v1/feedback` (submitted answers only) | read-only; row click opens the patient card | HTTP (empty list) + jsdom, 3 widths | BUG-fixed (Bug 5: average counted a missing rating as 0) |

#### Dokumenty

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Dotazník: Nový dotazník / Přejmenovat / Vypnout / Zapnout / Nastavit jako výchozí | QuestionnairePage.tsx:~330–410 | `POST/PUT /api/questionnaires/definitions…`, `PUT /api/questionnaires/default` | which questionnaire the public intake form asks | the existing questionnaire tests + jsdom (name trimmed, empty blocked); HTTP: definitions + default read | OK |
| Otevřít koncept / Publikovat / Zahodit koncept | QuestionnairePage.tsx | `POST …/draft`, `POST …/publish`, `DELETE …/versions/{id}` | published version is what patients answer | HTTP: draft start 200; **discard 500** | BUG-backend (Backend 1) |
| Přidat otázku: Typ, Otázka, Klíč, Sekce, Nápověda, Možnosti, Zobrazit jen po, Povinná | QuestionnairePage.tsx:858 `QuestionDialog` | `POST …/versions/{v}/questions` | question appears in the intake form after publish | HTTP + jsdom 26 cases | BUG-fixed (Bug 6: Enter swallowed in Možnosti; Bug 7: empty / non-ASCII key accepted; BUG-backend 2) |
| Upravit znění (Možnosti keep keys) | QuestionnairePage.tsx:1053 `RewordDialog`; questionnaireEditor.ts `toOptions` | `PUT …/questions/{id}` | stored answers name option keys | unit + jsdom | BUG-fixed (Bug 8: options re-keyed by position) |
| Odebrat z konceptu / Posunout / Přejmenovat sekci | QuestionnairePage.tsx | `DELETE/PUT …/questions…`, `PUT …/sections` | draft only | existing tests; HTTP: question delete 200 | OK |
| Marketing consent switch | ConsentSettingsPage.tsx:~115 | `PUT /api/v1/settings/consent` (read: public `GET /api/v1/public/consent-settings`) | `IntakeQuestionnaire.tsx:1712` shows/hides the row | HTTP: put→public get, hide, empty-while-visible 400, 121/1001 chars 400, restore; jsdom | OK |
| Nadpis / Text souhlasu | ConsentSettingsPage.tsx:122,133 | same (server trims) | same row's wording | HTTP + jsdom (maxlength 120/1000 = server's) | OK (Save enabled with no change → BUG-fixed, Bug 4b) |
| Dokumenty, šablony: Upravit (Název, Popis, Používá se) | DocumentTemplatesPage.tsx:167 | `PUT /api/documents/templates/{id}`; list with `?includeInactive=true` | inactive hidden from every picker | HTTP: put→both lists, blank name 400, restore; jsdom | BUG-fixed (Bug 9: a refused save was shown behind the modal) |
| Pravidla: Dokument, Služba, Přidat pravidlo | DocumentRequirementsPage.tsx:237 | `POST /api/documents/requirements` | document checklist of each appointment (`GET /api/documents/patient/{id}/check`) | HTTP: add, duplicate returns the same rule (idempotent), delete | OK |
| Pravidla: Platnost / Upozornit předem / Kdy žádat / Když chybí | DocumentRequirementsPage.tsx:357 | `PUT /api/documents/requirements/{id}` | same checklist | HTTP: update→list, -1 400, 1.5 400; jsdom 25 cases | BUG-fixed (Bug 10: an emptied field became 0 = "never expires", fractions went out) |
| Pravidla: Smazat pravidlo (trash icon) | DocumentRequirementsPage.tsx | `DELETE /api/documents/requirements/{id}` | rule gone | HTTP | OK (no confirm; deliberate in the code comments, noted) |
| Údaje pacienta: Posunout výš/níž, Skrýt, Zobrazit, Zobrazit vše | PatientFieldsPage.tsx:138–211 | `PUT /api/v1/settings/patient-fields {visible}` | `PatientDetails.tsx:73` card and `PatientList.tsx:86` register columns | HTTP: reverse order round trip, empty list accepted, unknown key 400, restore; jsdom 12 cases | OK (BUG-fixed: Save enabled after a no-op; unknown key stripped, Bug 4b) |
| Rychlá registrace: Platnost odkazu / Připomínka / datum narození | QuickRegistrationSettingsPage.tsx:185,195,215 | `PUT /api/v1/settings/quick-registration` | `QuickRegistrationService` / `RegistrationExpiryService` / `PatientIntakeCompletionService` read it (read) | HTTP: put→get, 0/721/reminder>expiry/-1/1.5 refused, reminder 0 ok, restore; unit 12 + existing 17 | OK |
| **Odkaz k dokončení registrace** (new screen) | IntakeLinkSettingsPage.tsx | `PUT /api/v1/settings/intake-link` (lifetime, e-mail subject/body, web address) | `IntakeLinkService` reads all four on every link | HTTP: put→get, 11 refusals, restore; jsdom 54 cases | BUG-fixed (Bug 11: no screen existed) |

#### Vzhled webu

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Page nav, search, filter, text slot Uložit / Zahodit / Vrátit výchozí, alt text, Nahrát / Odstranit | SiteContentAdminPage.tsx:123 + `siteContent/*` | `PUT/DELETE /api/v1/site-content/slots/{key}` | `GET /api/public/site-content` for the public site | HTTP: text put→get, empty 400, 4001 chars 400, alt 301 400, bad key 400, delete→default; unit: draft/dirty/limit/count/search tables (helpers.audit.test.ts); the existing `siteContent/*` and `SiteContentAdminPage` tests | OK |
| Partneři / Časté otázky add, edit, delete, order | `siteContent/PartnersSection.tsx`, `FaqSection.tsx` | `POST/PUT/DELETE /api/v1/site-content/{partners,faq}` | public site | HTTP: create, update, `javascript:` url 400, delete | OK |
| Úložiště médií: switch, Cloud name, API key, API secret (Změnit / Ponechat), Upload preset | MediaStorageSettingsPage.tsx:135–178 | `PUT /api/v1/settings/media-storage` (secret write-only; read says `hasSecret`) | uploads in Média a texty (503 "Úložiště médií není nastavené" otherwise) | HTTP (no real keys): put→get, enable without secret/cloud 400, restore; jsdom (secret never shown, sent only when typed, validation, refusal at the field) | OK |

#### Systém

| Control | Where | Stored where | Effect where | Verified how | Status |
|---|---|---|---|---|---|
| Přidat zaměstnance | StaffManagement.tsx:271 | `POST /api/v1/users` | new login + one-time password | jsdom (not run on the API: it would leave an account) | OK |
| Upravit (jméno, e-mail) / Změnit roli / Vypnout, Zapnout přístup | StaffManagement.tsx | `PUT /api/v1/users/{id}`, `…/role`, `…/active` | sign-in, permissions, sessions ended | jsdom 22 cases incl. Czech refusals (last owner, e-mail taken) | OK |
| Resetovat heslo (lock icon) | StaffManagement.tsx:391 | `POST /api/v1/users/{id}/reset-password` | old password stops working | jsdom | BUG-fixed (Bug 12: no confirmation, double click issued two passwords) |
| Co smí (per-permission Ne / Podle role / Ano) | `components/admin/UserPermissionsDialog.tsx`; labels `api/userPermissions.ts` | `PUT /api/v1/users/{id}/permissions/{p}` `{granted}` | next sign-in / account refresh | existing 6 tests; **not run on the API (no non-owner account in the dev DB)** | BUG-fixed (Bug 13: wrong/missing labels) |
| Kde pracuje | `components/admin/WhereSomebodyWorksDialog.tsx` | – | – | opens (jsdom); screen content is the sibling's (calendars) | OK |
| Zabezpečení: Zapnout / kód / Potvrdit / Zrušit / Mám uloženo / Vypnout | TwoFactorPage.tsx:183,163,126 | `POST /api/v1/account/two-factor/{setup,confirm,disable}` | login asks for the code (`auth.ts`) | HTTP: status read; confirm and disable without a setup → 409 with a Czech sentence (nothing changed); jsdom 11 cases | BUG-fixed (Bug 14: every refusal showed the generic server error) |
| Firma a faktury: fields, ARES, Spočítat IBAN | CompanyInvoiceSettingsPage.tsx:285–326 | `PUT /api/v1/settings/company` (printed on invoice PDFs; QR when the account is set) | `planner/…/headerData.ts` header; invoice PDF is server-side (read) | HTTP: put→get, 9 refusals, clear optional → null, spaced IBAN normalised by the server, restore; unit: field-by-field validation table + the existing company page tests | OK |
| Číselné řady (number series) | `services/numberSeriesApi.ts`, `NumberSeriesPreview.tsx` | none | read-only "next number" preview in NewInvoiceFlow | read; there is no settings control for it anywhere in the frontend | OK (nothing to configure) |
| Integrace: switch, Adresa, Uživatel, Heslo | IntegrationsPage.tsx:175–217 | `PUT /api/v1/settings/integrations {adam}` (password write-only) | stored only; the screen says nothing is verified or sent | HTTP: put→get, enable without address/password 400, bad url 400, restore (no real keys); jsdom +7 beside the existing 11 | BUG-fixed (Bug 15: password requirement only came back from the server) |
| Historie změn: Oblast, Od, Do, Uživatel, Filtrovat, Zrušit filtr, paging | ChangeHistoryPage.tsx:134,183 | `GET /api/v1/audit/changes` | read-only | HTTP: scope/date/user filters; jsdom | BUG-fixed (Bug 1 scope keys; Bug 16: "do data" excluded its whole day; from>to) |
| Auditní log: search, Obnovit, expand a row | AuditLog.tsx:179 | `GET /api/audit?take=100` | read-only | HTTP shape; jsdom 8 | BUG-fixed (Bug 17: reads `beforeState/afterState`, the API sends `oldValue/newValue`; no row could expand; counters never drew) |
| Zdraví systému | SystemHealth.tsx:137 | `GET /api/system/{health,sessions,errors}` | read-only | HTTP shape; jsdom 14 | BUG-fixed (Bug 18: latency read from the wrong field → "undefined ms") |

### Bugs fixed (with the test that pins each)

1. **Change-history scope matched nothing for 5 of 7 recording screens.** The catalogue filed screens under their id; the server files a setting under the first words of its key. Measured: `consent` 9, `booking.reminderHoursBefore` 4, `registration.quick` 7, `media` 8, `patients` 3, `intake` 6, `company` 5, `integrations` 5 — but `souhlasy`, `pripominky`, `quick-registration`, `media-storage`, `udaje-pacienta` returned 0, so "Poslední změny" under those screens and the "Oblast" filter of Historie změn always said nothing happened. Screens whose saves are never written there (e-mail templates, document kinds and rules, questionnaire, site content, accounts, 2FA, feedback, and the three read-only screens) now have `scope: null`: no panel (it claimed "nikdo nic neměnil" under a screen somebody had just changed) and no filter entry. Files: `catalogue.ts` (`scope?: string | null`, `scopeOf`), `ChangeHistoryPage.tsx`. Tests: `catalogue.audit.test.ts` "where each screen files its changes", `SettingsFrame.audit.test.tsx`, `SystemScreens.audit.test.tsx` "Oblast".
2. **E-mail editor could send a patient a literal `{pacient.jmeno}`.** The chip inserted single braces whenever the body contained a stray `{x`; the server saves a single-brace token without complaint and does not substitute it (HTTP: preview of `{pacient.jmeno}` came back unchanged). Now always `{{key}}`, and a typed single-brace token shows a warning and blocks Save. Files: `emailTemplateText.ts`, `EmailTemplatesPage.tsx`. Tests: `helpers.audit.test.ts` (placeholders), `EmailTemplatesPage.audit.test.tsx` ("inserts double braces even when…", "warns about a single-brace token…").
3. **"Poslat test sobě" tested the old wording while unsaved edits were on screen.** The server sends the saved template. The button is off while the form is dirty (with the reason), and the subtitle no longer promises a test "než uložíte". Test: `EmailTemplatesPage.audit.test.tsx` "sends a test only from what is saved…".
4. **Připomínky: `parseInt` saved "12.5" as 12 and "1e1" as 1; Save was live with nothing changed.** `wholeHours()` accepts whole numbers only, the field says so and shows the server's bounds. Same "Save live without a change" fixed in Souhlasy (4b), Údaje pacienta. Tests: `RemindersPage.audit.test.tsx` (22), `helpers.audit.test.ts` ("reminder lead time input"), `ConsentAndFields.audit.test.tsx`.
5. **Hodnocení: average counted a missing rating as 0 stars.** `averageRating()`. Tests: `helpers.audit.test.ts`, `SystemScreens.audit.test.tsx` "does not count an answer without stars as a zero".
6. **Vstupní dotazník, new question: Enter in "Možnosti" vanished**, so a second choice could only be pasted (the textarea was re-derived from the parsed options, which drop empty lines). The dialog now keeps the typed text. Test: `QuestionnairePage.audit.test.tsx` "lets a second choice be typed" and "keeps a trailing Enter".
7. **A question could be added with an empty or non-ASCII key** (server accepts both — Backend 2). The dialog now requires `^[a-z0-9][a-z0-9_]*$` (every shipped key has this shape, HTTP-checked), says why at the field and blocks Add; the choices are re-numbered from the final key. Tests: same file (key cases), `settingsApis.audit.test.ts` (`isValidQuestionKey`).
8. **Rewording a choice question renumbered every option key by position** — removing the first choice made stored answers point at the wrong wording. `toOptions(key, text, existing)` keeps a choice's key by exact wording, or by position for a fixed typo; new choices get the smallest unused number. Tests: `settingsApis.audit.test.ts` (6 rows), `QuestionnairePage.audit.test.tsx` "rewording".
9. **Dokumenty, šablony: a refused save showed its error behind the modal** (the alert sat above the list), and survived after Zrušit. Moved into the dialog. Test: `DocumentScreens.audit.test.tsx` "shows the server's refusal and keeps the dialog".
10. **Pravidla dokumentů: an emptied number field became 0** ("never expires" / "no warning") and fractions were sent to the server (HTTP: 400 with a bare message). `NaN` while empty, new problems `validity-not-whole` / `warn-not-whole`, summary hidden while invalid. Tests: `helpers.audit.test.ts` (12 rows), `DocumentScreens.audit.test.tsx`.
11. **Odkaz k dokončení registrace had no screen.** The server's `IntakeLinkService` reads lifetime, subject, text and the web address on every link, and tells the desk "v Nastavení chybí adresa webu" — there was nowhere to set it, and the "Veřejná adresa webu" in Údaje ordinace writes `pub.siteUrl`, which the link service does not read (it reads `public.site.baseUrl`; verified by grep in the backend). New screen `/nastaveni/odkaz-registrace` (Dokumenty), client `api/intakeLinkSettings.ts`, route in `StaffApp.tsx`, catalogue item. Tests: `IntakeLinkSettingsPage.test.tsx` (54).
12. **Resetovat heslo needed one click on a small icon.** Confirmation dialog, one request at a time. Test: `StaffManagement.audit.test.tsx` "resetting a password" (5).
13. **Permission labels:** `communication.manage` said "nic neotvírá" although the e-mail template screen requires it; `billing.approve` and `patients.export` (sent to the owner at sign-in) had no wording and showed as dotted ids. Test: `settingsApis.audit.test.ts` "per-employee permissions".
14. **Two-factor refusals always read "server error".** `twoFactorApi` threw raw axios errors, `errorText` only shows a server sentence for `BookingApiError`. Wrapped with `toBookingError`. Test: `MediaTwoFactorIntegrations.audit.test.tsx` ("shows the server's sentence for a wrong code…", "…switches it off… refusal").
15. **Integrace: enabling without a stored or typed password** was only refused by the server. Checked first. Test: same file ("will not switch it on without a password…").
16. **Historie změn: "Do data" excluded its whole day** (`to=2026-10-20` found 1 change, `to=2026-10-20T23:59:59.999Z` found 148; from = to found 0) and an end before the start silently answered "Žádné změny". Dates are sent as the first/last instant of the clinic's day; a backwards range is flagged and not applied. Tests: `settingsApis.audit.test.ts` ("change history client"), `SystemScreens.audit.test.tsx` ("the dates"), `ChangeHistoryPage.test.tsx` (updated expectation).
17. **Auditní log: could not expand any row and showed no counters.** Reads `oldValue/newValue` (JSON text parsed), keeps the old names as a fallback, colours dotted action names, counts the six most frequent real actions. New `auditLogModel.ts`. Tests: `helpers.audit.test.ts` ("audit log entries"), `SystemScreens.audit.test.tsx` ("Auditní log").
18. **Zdraví systému: "Odezva databáze: undefined ms".** The server nests it as `database.latencyMs`. Reads the real shape (flat name kept as a fallback) and now also shows what the answer carries and the screen never did: status, message queue (164 waiting, oldest 16 days), whether an e-mail server is set up, free document-store space. New `systemHealthModel.ts`. Tests: `helpers.audit.test.ts`, `SystemScreens.audit.test.tsx` ("Zdraví systému", 10).

### Backend defects (exact endpoint, request, response)

1. **Discarding a questionnaire draft returns 500.** `DELETE /api/questionnaires/definitions/01a0f719-0417-791e-8758-6a14a851cb73/versions/01a1588d-0b70-7a7c-9b6c-500f09b9a482` (no body, bearer token of the Owner) → `500 {"code":"server.error","message":"Požadavek se nepodařilo bezpečně dokončit.","errors":null}`. Expected `204/200` and the draft gone (`QuestionnaireDefinition.DiscardDraft` just removes it from `_versions`). **Left in the dev DB: "Zdravotní dotazník" has a Draft v2 (an identical copy of Published v1, 77 questions — my three test questions were removed first).** Publishing it would be harmless but it cannot be discarded.
2. **`POST …/versions/{draft}/questions` accepts an empty `questionKey` and a non-ASCII one.** Bodies `{…,"questionKey":"", …}` and `{…,"questionKey":"Špatný klíč", …}` → `200 {"ok":true}` (the question was stored; removed again with `DELETE …/questions/{id}` → 200). Expected 400 `questionnaires.question.key_invalid`. The dialog now refuses both.
3. **Test-send cannot test unsaved wording.** `POST /api/email-templates/{code}/test-send` takes no body (`SendTest(string code)`), so it can only send the saved template. Expected: optional `{subject, bodyHtml}` like `/preview`.
4. **Single-brace placeholders are saved silently.** `PUT /api/email-templates/booking-confirmation {"subject":"S {klinika.nazev}","bodyHtml":"<p>{pacient.jmeno}</p>"}` → 200; `POST …/preview` returns them unchanged. Expected 400 `email_template.unknown_placeholder` like `{{neexistuje}}`. (The editor now prevents it.)
5. **Settings history does not record several screens' saves.** `GET /api/v1/audit/changes` only lists `SystemSetting` + company entries; e-mail template edits (`email_template.*`), document kinds/rules, questionnaire edits, site content, accounts and 2FA go only to the audit log. Not a defect by itself, but "Historie změn" cannot show them; the UI now says nothing instead of "nobody changed anything".
6. **Date-only `to`/`from` on `/api/v1/audit/changes` is read as midnight** (see Bug 16); the frontend works around it, other clients would not.
7. **`/admin` "Veřejná adresa webu" (`pub.siteUrl`) is not read by the registration-link service** (reads `public.site.baseUrl`). The new screen sets the right one; `/admin` is the sibling's.
8. **Server is more lenient than the screens:** `PUT /api/documents/requirements/{id}` accepts `validityMonths: 241`, `warnDaysBefore: 366` and a warning window longer than the validity (200); the screen's guard rails (240 / 365 / window) are the frontend's own. Not a defect, recorded so nobody removes the client check believing the server covers it.
9. **Dev data:** `booking-rescheduled` was already customised before the audit (left as found); the outbox holds 164 messages queued since 2026-10-04 with no mail server configured.

### Same history-scope mismatch in the other half (for the sibling / lead)

Measured with `GET /api/v1/settings/changes?scope=`: `discounts` → 0 (the server files it as `pricing`, 7), `service-colors` → 0 (`calendar`, 25), `working-hours` → 0, and `pracovni-doba` (used in the existing tests) → 0; `clubs` 15, `clinic` 4, `pub` 24, `calendar` 25 do answer. I changed only my items in `catalogue.ts`.

### Not verified and why

* **Per-employee permission overrides on the API** (`PUT /api/v1/users/{id}/permissions/{p}`), role change, account create / reset / switch-off: the dev DB has only the Owner; creating an account would leave data that cannot be deleted. Covered by jsdom against the documented contract.
* **Two-factor setup / confirm / disable with real codes:** would change the owner's 2FA. Verified only the status read and the 409 answers of confirm/disable when nothing is pending (state unchanged).
* **E-mail test-send:** would queue a real message to the owner's address. Read only.
* **Whether a reminder or an intake e-mail is actually delivered:** no mail server is configured (`smtp.configured:false`); the settings' consumers (`AppointmentReminderService`, `IntakeLinkService`, quick-registration services) were verified by reading the backend, not by observing a delivery.
* **Media upload to Cloudinary, ADAM connection:** no real keys entered by rule; the screens say themselves that nothing is verified.
* **Invoice PDF using the company profile / number series:** server-side; only the frontend consumers (planner header) and the settings round trip were checked.
* **Quick-registration dialog:** it does not read these numbers; they act on the server. Observed only through the settings round trip.
* **Chromium pass:** see the last section for what was run.

### Run results

* **New vitest cases: 745 in 14 files**, all passing (`catalogue.audit.test.ts`, `settingsApis.audit.test.ts`, `helpers.audit.test.ts`, `RemindersPage.audit`, `EmailTemplatesPage.audit`, `ConsentAndFields.audit`, `MediaTwoFactorIntegrations.audit`, `DocumentScreens.audit`, `QuestionnairePage.audit`, `StaffManagement.audit`, `SystemScreens.audit`, `Settings.audit`, `SettingsFrame.audit`, `IntakeLinkSettingsPage.test`). Many are table rows; each row asserts a different input or role.
* Wider run (all of `src/pages/settings`, `src/components/settings`, `src/components/admin`, `src/api`, Settings and StaffManagement tests, the new files): 2084 passed, 1 failed — the failure is the sibling's new `colors/ServiceColorsPage.audit.test.tsx` (expects the history scope `calendar` for Barvy služeb, the catalogue still has `service-colors`); not mine.
* `npm run typecheck`: clean (exit 0) at the end of the run.
* Chromium (headless, logged in as the dev owner, dev server :3000): every route of this half + the 5 hub/group pages at 390 / 834 / 1440 = 69 visits — no console error, no failed request, no horizontal overflow, no "undefined / NaN / Invalid Date" in the text; the only "controls under 44 px" flags were hidden native inputs (MUI Select input, hidden file inputs). The new route `/nastaveni/odkaz-registrace` clean at the three widths. A scripted flow against the real API at 1440 and 390: intake-link screen loads the real values and sends no PUT for an invalid draft; Připomínky blocks a decimal; Zdraví systému shows a real latency and the queue / mail-server cards; Auditní log expands a row to two JSON blocks; the e-mail chip inserts `{{pacient.jmeno}}` next to a stray `{`; the test-send button is off while dirty; the history filter offers Připomínky and not "SMS a e-maily".
* Real-API round trips (all restored; see the table): reminders, quick registration, consent (staff PUT / public GET), patient fields, company, media storage, integrations, intake-link, e-mail templates (save / preview / reset), document kinds, document rules (add / update / delete), site content (slot, FAQ, partner), questionnaire draft (start / add / remove question), change-history filters. Left behind: the Draft v2 of "Zdravotní dotazník" (Backend 1).
