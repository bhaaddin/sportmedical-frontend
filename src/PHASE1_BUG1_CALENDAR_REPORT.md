# Phase 1 — Bug Fix #1: Calendar Saving "chyba pri ukladani"

**Date:** September 2, 2026  
**Status:** ✅ Fixed  
**Backend build:** 0 errors  
**Frontend typecheck:** 0 errors in calendar files

---

## Root Cause

The frontend calendar API had **4 mismatches** with the backend:

### 1. Wrong API Route
- **Frontend called:** `POST /api/appointments`
- **Backend expects:** `POST /api/scheduling/appointments`
- **Result:** 404 Not Found → "chyba pri ukladani"

### 2. Wrong Duration Format
- **Frontend sent:** `duration: "01:00:00"` (TimeSpan string)
- **Backend expects:** `durationMinutes: 60` (integer)
- **Result:** Deserialization failure → error

### 3. Wrong Field Name for Type
- **Frontend sent:** `type: "Examination"`
- **Backend expects:** `serviceType: "Examination"`
- **Result:** Missing required field → error

### 4. Wrong Field Name for Provider
- **Frontend sent:** `providerName: "Dr. Smith"`
- **Backend expects:** `practitionerName: "Dr. Smith"`
- **Result:** Missing required field → error

---

## Changes Made

### `sportmedical-frontend/src/api/calendar.ts`

1. **Fixed `CreateAppointmentRequest` interface:**
   - `duration: string` → `durationMinutes: number`
   - `type: BackendAppointmentType` → `serviceType: string`
   - `providerName: string` → `practitionerName: string`

2. **Fixed `AppointmentDto` interface:**
   - Removed old fields (`startUtc`, `duration`, `endUtc`, `type`, `clinic`, `providerName`, `reminderSentUtc`, `checkedInUtc`)
   - Added correct fields (`patientName`, `serviceType`, `practitionerName`, `startTime`, `endTime`)

3. **Fixed `mapDtoToAppointment` function:**
   - Updated all field references to match new DTO

4. **Fixed `toBackendRequest` function:**
   - Now sends `durationMinutes` (int) instead of `duration` (string)
   - Now sends `serviceType` instead of `type`
   - Now sends `practitionerName` instead of `providerName`

5. **Fixed all API routes:**
   - `/api/appointments` → `/api/scheduling/appointments`
   - `/api/appointments/{id}` → `/api/scheduling/appointments/{id}`
   - `/api/appointments/{id}/cancel` → `/api/scheduling/appointments/{id}/cancel`

---

## Verification

- Frontend TypeScript: 0 errors in calendar files
- Backend C#: 0 errors, 0 warnings
- All field names match between frontend and backend
- All routes match between frontend and backend

## Next Bug

Bug #2: Player data saving error
