# Phase 1 — Bug Fix #2: Player Data Saving

**Date:** September 2, 2026  
**Status:** ✅ Fixed  
**Backend build:** 0 errors  
**Frontend typecheck:** 0 errors in teams files

---

## Root Cause

### 1. ContactEmail/ContactPhone null handling
- **Frontend sent:** `contactEmail: undefined` (optional field)
- **Backend expected:** `string ContactEmail` (non-nullable)
- **Result:** Null reference assignment error → save fails

### 2. PlayerCount not incremented
- When adding a team member, `PlayerCount` was not incremented
- The stored integer stayed at 0 even after members were added

### 3. Plain text field for Patient ID
- "Add Member" dialog used a plain text field for patient ID
- User had to manually type a GUID — error-prone and unfriendly

---

## Changes Made

### Backend: `TeamsController.cs`
1. Made `CreateTeamRequest.ContactEmail` and `ContactPhone` nullable (`string?`)
2. Added null coalescing (`?? string.Empty`) when assigning to Team entity
3. Added `team.PlayerCount++` when adding a member
4. Added team existence check before adding member

### Frontend: `Teams.tsx`
1. Added `patientsApi.getAll()` call to load patients on mount
2. Replaced plain text "ID pacienta" field with `Autocomplete` patient picker
3. Patient picker shows name + truncated ID for easy selection
4. Reset `selectedPatient` when dialog closes

---

## Files Changed

| File | Changes |
|------|---------|
| `SportMedical.Diagnostics.Api/Controllers/TeamsController.cs` | Nullable contact fields, PlayerCount increment, team existence check |
| `sportmedical-frontend/src/pages/Teams.tsx` | Patient Autocomplete picker, load patients from API |

## Next Bug

Bug #3: Injury record saving error (already fixed in Phase 1 Piece 3)
