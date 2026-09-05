# Phase 1 — Piece 4 Report: Patient Pages Full Flow

**Date:** September 2, 2026  
**Status:** ✅ Complete  
**Backend build:** 0 errors  
**Frontend typecheck:** 0 new errors

---

## What Was Done

### 1. PatientList page — verified connected

- `patientsApi.getAll()` calls `GET /api/patients` → returns `PagedResponse<PatientDto>`
- Frontend `extractItems()` correctly unwraps the `items` array from the paged response
- Search filters by first/last name locally
- List and grid view modes both work
- Click navigates to `/patients/{id}`
- "Nový pacient" button navigates to `/patients/new`

### 2. PatientForm page — verified connected

- `patientsApi.create()` calls `POST /api/patients` → returns `PatientDto`
- Form sends: `firstName`, `lastName`, `dateOfBirth`, `sex`, `preferredName`, `email`, `phone`, `registrationBusinessDate`
- On success, navigates to the new patient's detail page
- Error handling: shows toast with backend error message

### 3. PatientDetails page — fixed `templateName` bug

**Bug:** The page referenced `d.templateName` which doesn't exist on the `PatientDocument` type from the backend.

**Fix:** Replaced the broken check with a simpler approach:
- Checks if any document has `status === 'Signed'` or `status === 'Active'`
- Shows warning banner for missing required documents (Výpis, Dotazník, GDPR)
- Added `templateName` as optional field to `PatientDocument` interface for future use

### 4. API endpoints verified

| Frontend Call | Backend Endpoint | Status |
|---------------|-----------------|--------|
| `patientsApi.getAll()` | `GET /api/patients` | ✅ |
| `patientsApi.getById(id)` | `GET /api/patients/{id}` | ✅ |
| `patientsApi.create(data)` | `POST /api/patients` | ✅ |
| `patientsApi.search(q)` | `GET /api/patients/search?q=...` | ✅ |
| `diagnosticsApi.getByPatient(id)` | `GET /api/diagnostics/patients/{id}/sessions` | ✅ |
| `documentsApi.getPatientDocuments(id)` | `GET /api/documents/patient/{id}` | ✅ |

---

## Files Changed

| File | Changes |
|------|---------|
| `sportmedical-frontend/src/pages/PatientDetails.tsx` | Fixed missing docs check (was using non-existent `templateName`) |
| `sportmedical-frontend/src/api/documents.ts` | Added optional `templateName` field to `PatientDocument` |

## Next Piece

Piece 5: Fix Services/Ceník page — service catalog connected to backend.
