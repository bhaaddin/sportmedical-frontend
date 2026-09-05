# Phase 1 — Piece 2 Report: Billing Page CRUD Flow

**Date:** September 2, 2026  
**Status:** ✅ Complete  
**Backend build:** 0 errors, 0 warnings

---

## What Was Done

### Frontend `billing.ts` API — Verified full alignment

Every frontend API call now maps to a working backend endpoint:

| Frontend Call | Backend Endpoint | Status |
|---------------|-----------------|--------|
| `billingApi.getInvoices()` | `GET /api/billing/invoices` | ✅ Returns `InvoiceDto[]` with `PatientName` |
| `billingApi.getInvoiceById(id)` | `GET /api/billing/invoices/{id}` | ✅ Returns `InvoiceDto` |
| `billingApi.createInvoice(data)` | `POST /api/billing/invoices` | ✅ Creates with first line item |
| `billingApi.addLineItem(invoiceId, serviceId)` | `POST /api/billing/invoices/{id}/items` | ✅ Adds line item, recalculates total |
| `billingApi.removeLineItem(invoiceId, itemId)` | `DELETE /api/billing/invoices/{id}/items/{itemId}` | ✅ Removes line item, recalculates total |
| `billingApi.updateInvoiceStatus(id, status)` | `PATCH /api/billing/invoices/{id}/status` | ✅ Updates status with audit trail |
| `billingApi.batchVerify(claimIds)` | `POST /api/billing/invoices/batch-verify` | ✅ Validates each invoice |
| `billingApi.batchSubmit(claimIds)` | `POST /api/billing/invoices/batch-submit` | ✅ Submits Draft/Issued invoices |
| `billingApi.getServices()` | `GET /api/services` | ✅ Returns active service items |

### Type Alignment Verified

Frontend `InvoiceLineItem` matches backend `InvoiceLineItemDto`:
- `id`, `description`, `vzpProcedureCode`, `quantity`, `unitPriceCzk`, `amountCzk` — all match

Frontend `Invoice` matches backend `InvoiceDto`:
- `id`, `patientId`, `patientName`, `invoiceNumber`, `status`, `totalCzk`, `paidCzk`, `remainingCzk`, `currency`, `issueDateUtc`, `dueDateUtc`, `items` — all match
- `insuranceProvider` and `diagnosisCode` are frontend-only optional fields (not in backend DTO) — harmless

### Billing Page — `patients` state now populated

The `useEffect` now properly destructures and stores patients from the API call, so the "Create Invoice" dialog actually shows patients to select.

### Create Invoice Flow — Multi-service support

1. Doctor selects a patient from the dropdown
2. Doctor clicks multiple services (chips toggle on/off)
3. Price auto-calculates from selected services
4. On submit: first service creates the invoice, additional services added as line items
5. Total is computed server-side from line item amounts

---

## Production Readiness

- All error handling in place (try/catch with toast notifications)
- Optimistic UI for batch operations with rollback on failure
- Batch verify shows validation results before submit
- No function overloading or default parameter values

## Next Piece

Piece 3: Fix Injuries page full CRUD flow — verify create, status update, and listing all work end-to-end.
