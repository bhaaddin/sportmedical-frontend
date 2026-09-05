# Phase 1 — Bug Checksum

**Date:** September 2, 2026  
**Status:** Phase 1 bug fixes complete

---

## Bug Status

| # | Bug | Status | Root Cause | Fix |
|---|-----|--------|-----------|-----|
| 1 | Calendar saving "chyba pri ukladani" | ✅ Fixed | Wrong API route (`/api/appointments` vs `/api/scheduling/appointments`), wrong field names (`duration` vs `durationMinutes`, `type` vs `serviceType`, `providerName` vs `practitionerName`) | Fixed all routes and field names in `calendar.ts` |
| 2 | Player data saving error | ✅ Fixed | `ContactEmail`/`ContactPhone` nullable mismatch, `PlayerCount` not incremented, plain text patient ID field | Made contact fields nullable, added PlayerCount increment, added patient picker |
| 3 | Injury record saving error | ✅ Fixed (Piece 3) | Missing `InjuryDate`, `IsRecurrence`, `Notes` in `CreateInjuryRequest`; form used wrong field for `estimatedDaysOut` | Added fields to backend request, fixed form field mapping |
| 4 | Invoicing broken | ✅ Fixed (Piece 1) | Missing endpoints (addLineItem, removeLineItem, updateStatus, batchVerify, batchSubmit), `PatientName` always empty | Added 5 endpoints, added PatientName JOIN, added `Submitted` status |
| 5 | Vite dev server dying | ⏳ Not investigated | Need to check for memory leaks, infinite re-renders | Deferred — requires running the app to reproduce |
| 6 | Report saving error | ✅ Verified connected | Diagnostics endpoints correctly aligned (`/api/v1/diagnostics/sessions`) | No code change needed — endpoints match |

---

## Files Changed in Phase 1

### Backend (.NET)
| File | Changes |
|------|---------|
| `InjuriesController.cs` | Added InjuryDate, IsRecurrence, Notes to CreateInjuryRequest; removed defaults |
| `BillingController.cs` | Added PatientName JOIN; 5 new endpoints; removed defaults |
| `InvoiceStatus.cs` | Added Submitted enum value |
| `CalendarController.cs` | Removed default parameter values |
| `TeamsController.cs` | Made contact fields nullable; added PlayerCount increment; team existence check |

### Frontend (React/TypeScript)
| File | Changes |
|------|---------|
| `api/calendar.ts` | Fixed routes, field names, DTO interface, mapping function |
| `api/billing.ts` | Verified aligned (no changes needed) |
| `api/injuries.ts` | Verified aligned (no changes needed) |
| `api/documents.ts` | Added optional templateName field |
| `pages/Injuries.tsx` | Patient picker, estimatedDaysOut field, notes textarea |
| `pages/Billing.tsx` | Populated patients state from API |
| `pages/PatientDetails.tsx` | Fixed missing docs check |
| `pages/Teams.tsx` | Patient picker for Add Member |

---

## Build Status
- Backend: 0 errors, 0 warnings ✅
- Frontend: 0 new errors ✅
