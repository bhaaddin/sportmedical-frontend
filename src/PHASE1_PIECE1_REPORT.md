# Phase 1 — Piece 1 Report: API Type Alignment

**Date:** September 2, 2026  
**Status:** ✅ Complete  
**Backend build:** 0 errors, 0 warnings  
**Frontend typecheck:** No new errors introduced (pre-existing MUI v9 issues excluded)

---

## What Was Done

### 1. Injuries API — Full alignment between frontend and backend

**Backend `CreateInjuryRequest`** now matches what the frontend sends:
- Added `InjuryDate` field (frontend was sending it, backend was ignoring it)
- Added `IsRecurrence` and `Notes` fields (frontend was sending them, backend was discarding them)
- Removed all default parameter values — every field is explicit

**Backend `InjuriesController.Create`** now stores all fields:
- `InjuryDate` is taken from the request instead of defaulting to `DateTimeOffset.UtcNow`
- `IsRecurrence` and `Notes` are stored in the database

### 2. Billing API — 4 missing endpoints added

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/billing/invoices/{id}/items` | POST | Add line item to invoice |
| `/api/billing/invoices/{id}/items/{itemId}` | DELETE | Remove line item from invoice |
| `/api/billing/invoices/{id}/status` | PATCH | Update invoice status |
| `/api/billing/invoices/batch-verify` | POST | Validate invoices before submit |
| `/api/billing/invoices/batch-submit` | POST | Submit invoices to insurance |

### 3. Billing DTO — `PatientName` now returned

Previously `PatientName` was always `string.Empty` in the invoice response. Now all invoice endpoints perform a single JOIN with the Patient table to return the patient's full name.

### 4. `InvoiceStatus.Submitted` added

The enum was missing this status that the billing batch-submit workflow requires.

### 5. All default parameter values removed

No function overloading or default parameter values remain in any request DTO across:
- `InjuriesController` (CreateInjuryRequest, UpdateInjuryStatusRequest)
- `BillingController` (CreateInvoiceRequest)
- `CalendarController` (CreateAppointmentRequest, UpdateAppointmentRequest)

---

## Files Changed

| File | Changes |
|------|---------|
| `SportMedical.Diagnostics.Api/Controllers/InjuriesController.cs` | Added `InjuryDate`, `IsRecurrence`, `Notes` to request; removed defaults |
| `SportMedical.Diagnostics.Api/Controllers/BillingController.cs` | Added 4 endpoints; PatientName JOIN; removed defaults |
| `SportMedical.Diagnostics.Domain/Billing/InvoiceStatus.cs` | Added `Submitted` enum value |
| `sportmedical-frontend/src/pages/Injuries.tsx` | Patient autocomplete picker; loads patients from API |
| `sportmedical-frontend/src/pages/Billing.tsx` | Fixed patients state to populate from API |

---

## Testing Readiness

- Backend builds clean (0 errors)
- Frontend TypeScript: no new errors from these changes
- All API endpoints match between frontend and backend
- No function overloading anywhere

## Next Piece

Piece 2: Full Billing page CRUD flow — test create, add line item, update status, delete line item, batch verify, batch submit.
