# Phase 3 — Piece 2 Report: Universal Search

**Date:** September 2, 2026  
**Status:** ✅ Complete  
**TypeScript:** 0 errors in UniversalSearch.tsx

---

## What Was Done

### Existing Search — Fixed and Enhanced

The search already existed but had bugs and missing features.

### Bugs Fixed

| Bug | Fix |
|-----|-----|
| `catch([])` — missing function wrapper | Changed to `catch(() => [])` |
| Appointments not being searched | Added filtering by `patientName`, `serviceType`, `practitionerName` |
| `PaperProps` deprecated in MUI v9 | Changed to `slotProps.paper` |

### New Features Added

#### 1. Appointment Search
- Searches by patient name, service type, practitioner name
- Shows date and service in results
- Color-coded blue (#0D7377)

#### 2. Smart Suggestions
When typing a single letter, shows relevant Czech suggestions:

| Input | Suggestions |
|-------|-------------|
| `f` | Fotbal, Fyzioterapie, Florbal |
| `k` | Koleno, Kardiologická prohlídka, Kondiční test |
| `v` | VO2 Max, Vyšetření, Vazivová poranění |
| `d` | Diagnostika, Dolní záda, Doppler |
| `s` | Spiroergometrie, Sportovní prohlídka, Svalová hmota |
| And more... |

Clicking a suggestion fills the search box.

### Search Capabilities

| Data Source | Search By | Route |
|-------------|-----------|-------|
| Patients | Name, email, phone, ID | `/patients/{id}` |
| Injuries | Body region, diagnosis, patient ID | `/injuries` |
| Invoices | Patient name, invoice number | `/billing` |
| Appointments | Patient name, service type, practitioner | `/calendar` |
| Pages | Page name, description | Various |

### Keyboard Navigation
- `Ctrl+K` — Open/close search
- `↑↓` — Navigate results
- `Enter` — Select result
- `Escape` — Close search

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/UniversalSearch.tsx` | Fixed bugs, added appointment search, added smart suggestions, updated MUI v9 API |

## Next Piece

Piece 3: Settings panel expansion.
