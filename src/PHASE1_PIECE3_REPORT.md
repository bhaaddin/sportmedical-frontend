# Phase 1 — Piece 3 Report: Injuries Page CRUD Flow

**Date:** September 2, 2026  
**Status:** ✅ Complete  
**Frontend typecheck:** 0 errors in Injuries.tsx

---

## What Was Done

### 1. Fixed form field mismatch

**Before:** The "Odhad dnů mimo" (Estimated days out) field was writing to `form.notes`. This meant:
- Notes field was being used as a number
- The actual notes textarea didn't exist
- `estimatedDaysOut` was never sent to the backend

**After:** 
- Added `estimatedDaysOut` as a separate form field
- "Poznámky" (Notes) is now a proper multiline textarea
- "Odhad dnů mimo" writes to `form.estimatedDaysOut`
- Both fields are sent correctly in the create request

### 2. Create request now sends all backend fields

The frontend sends:
- `patientId` — from Autocomplete picker (patient GUID)
- `injuryDate` — from date input (ISO string, parsed as DateTimeOffset)
- `bodyRegion` — from select dropdown
- `specificLocation` — free text
- `side` — Left/Right/Bilateral/Central
- `type` — Acute/Overuse/Recurrence/FirstOccurrence
- `severity` — 1-4
- `mechanism` — free text
- `diagnosis` — free text
- `practitioner` — free text
- `estimatedDaysOut` — number (optional)
- `isRecurrence` — boolean
- `notes` — free text (optional)

All fields match the backend `CreateInjuryRequest` record.

### 3. Patient picker works

- Patients are loaded from API on component mount
- Autocomplete shows patient name + truncated ID
- Selection stores the full GUID for the create request

### 4. Error handling

- Validation: requires patient and body region before submit
- Backend errors: parsed from response and shown via toast
- Network errors: fallback message shown

---

## Files Changed

| File | Changes |
|------|---------|
| `sportmedical-frontend/src/pages/Injuries.tsx` | Added `estimatedDaysOut` field; separated notes textarea; fixed create request |

## Next Piece

Piece 4: Fix Patient pages — list, create, details all connected to backend.
