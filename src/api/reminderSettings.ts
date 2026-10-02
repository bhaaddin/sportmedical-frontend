/* ══════════════════════════════════════════════════════════════
   Appointment reminders — how far ahead the patient is reminded (plan 13.05).

     GET/PUT /api/v1/settings/reminders   (read: anyone signed in)

   Writes need settings.clinic.manage; the server refuses a lead time outside
   its bounds and sends them back with its default, so this screen keeps no
   copy of the rule.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface ReminderSettings {
  /** The reminder goes out once the visit is at most this many hours away. */
  hoursBefore: number;
}

export interface ReminderSettingsResponse {
  settings: ReminderSettings;
  defaults: ReminderSettings;
  minHours: number;
  maxHours: number;
}

export const readReminderSettings = async (): Promise<ReminderSettingsResponse> => {
  const { data } = await client.get<ReminderSettingsResponse>('/api/v1/settings/reminders');
  return data;
};

export const saveReminderSettings = async (
  settings: ReminderSettings,
): Promise<ReminderSettingsResponse> => {
  const { data } = await client.put<ReminderSettingsResponse>('/api/v1/settings/reminders', settings);
  return data;
};

export const REMINDER_SETTINGS_QUERY_KEY = ['settings', 'reminders'] as const;
