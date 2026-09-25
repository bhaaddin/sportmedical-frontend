/* ══════════════════════════════════════════════════════════════
   How long before an appointment a patient may still change it
   themselves — the clinic's setting, not a number in this code.

     GET/PUT /api/v1/settings/booking-changes   (read: anyone signed in,
                                                  write: settings.clinic.manage)

   The server refuses a value outside its bounds and names the field, so the
   screen puts the sentence under the field instead of writing one of its own.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface BookingChangeSettings {
  /** Reschedule or cancel online only while the appointment is at least this many hours away. */
  patientChangeDeadlineHours: number;
}

export interface BookingChangeSettingsResponse {
  settings: BookingChangeSettings;
  defaults: BookingChangeSettings;
  minHours: number;
  maxHours: number;
}

export const BOOKING_CHANGES_QUERY_KEY = ['settings', 'booking-changes'] as const;

export const readBookingChanges = async (): Promise<BookingChangeSettingsResponse> => {
  const { data } = await client.get<BookingChangeSettingsResponse>('/api/v1/settings/booking-changes');
  return data;
};

export const saveBookingChanges = async (
  settings: BookingChangeSettings,
): Promise<BookingChangeSettingsResponse> => {
  const { data } = await client.put<BookingChangeSettingsResponse>(
    '/api/v1/settings/booking-changes',
    settings,
  );
  return data;
};
