/* ══════════════════════════════════════════════════════════════
   When the calendar says "asi nepřišel", and how long a patient may still
   change a booking through their own link.

     GET /api/v1/settings/attendance   (read: anyone signed in)
     PUT /api/v1/settings/attendance   { noShowAfterMinutes }  (settings.clinic.manage)

   The deadline hours are read here and written by the booking rules; this
   route never saves them.
   ══════════════════════════════════════════════════════════════ */
import { useQuery } from '@tanstack/react-query';
import { client } from './client';

export interface AttendanceSettings {
  /** A booking still "Objednán" this many minutes after its start is flagged. */
  noShowAfterMinutes: number;
  /** A patient may change a booking through their link while the start is at least this far away. */
  patientChangeDeadlineHours: number;
}

export interface AttendanceSettingsResponse {
  settings: AttendanceSettings;
  minimumNoShowAfterMinutes: number;
  maximumNoShowAfterMinutes: number;
  defaults: AttendanceSettings;
}

/**
 * The contract's defaults, used only while the server has not answered - the
 * same numbers it answers with for a clinic that never opened the setting.
 */
export const ATTENDANCE_OFFLINE: AttendanceSettings = {
  noShowAfterMinutes: 30,
  patientChangeDeadlineHours: 24,
};

export const readAttendanceSettings = async (): Promise<AttendanceSettingsResponse> => {
  const { data } = await client.get<AttendanceSettingsResponse>('/api/v1/settings/attendance');
  return data;
};

export const saveAttendanceSettings = async (
  noShowAfterMinutes: number,
): Promise<AttendanceSettingsResponse> => {
  const { data } = await client.put<AttendanceSettingsResponse>('/api/v1/settings/attendance', {
    noShowAfterMinutes,
  });
  return data;
};

export const ATTENDANCE_QUERY_KEY = ['settings', 'attendance'] as const;

/** The attendance rules, or the offline values until (or unless) they arrive. */
export function useAttendanceSettings(): { settings: AttendanceSettings; loaded: boolean } {
  const query = useQuery({
    queryKey: ATTENDANCE_QUERY_KEY,
    queryFn: readAttendanceSettings,
    staleTime: 5 * 60 * 1000,
  });

  return {
    settings: query.data?.settings ?? ATTENDANCE_OFFLINE,
    loaded: query.data !== undefined,
  };
}
