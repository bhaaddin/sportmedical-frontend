/* ══════════════════════════════════════════════════════════════
   Two small clinic rules, each one number with bounds (NET-10).

     GET/PUT /api/v1/settings/booking-changes   { patientChangeDeadlineHours }
     GET/PUT /api/v1/settings/attendance        { noShowAfterMinutes }  (the PUT sends only the minutes)

   Read: anyone signed in. Write: settings.clinic.manage. The server refuses a value outside its bounds and sends them
   back with its default, so nothing here keeps a copy of the rule. The attendance route lives on a newer server than
   the booking-changes one; a 404 is answered by the screen with a calm note, never a crash.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface NumberRuleResponse {
  value: number;
  defaultValue: number;
  min: number;
  max: number;
}

type Loose = Record<string, Record<string, unknown> | number | undefined>;

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const inner = (r: Loose, key: string): Record<string, unknown> => (typeof r[key] === 'object' && r[key] !== null ? (r[key] as Record<string, unknown>) : {});

/** `{ settings:{patientChangeDeadlineHours}, defaults:{…}, minHours, maxHours }` -> one rule. */
export function parseBookingChanges(raw: unknown): NumberRuleResponse {
  const r = (raw ?? {}) as Loose;
  const value = num(inner(r, 'settings').patientChangeDeadlineHours, NaN);
  if (!Number.isFinite(value)) throw new Error('Neočekávaná odpověď serveru.');
  return { value, defaultValue: num(inner(r, 'defaults').patientChangeDeadlineHours, value), min: num(r.minHours, 0), max: num(r.maxHours, 24 * 365) };
}

/** `{ settings:{noShowAfterMinutes}, minimumNoShowAfterMinutes, maximumNoShowAfterMinutes, defaults:{…} }` -> one rule. */
export function parseAttendance(raw: unknown): NumberRuleResponse {
  const r = (raw ?? {}) as Loose;
  const value = num(inner(r, 'settings').noShowAfterMinutes, NaN);
  if (!Number.isFinite(value)) throw new Error('Neočekávaná odpověď serveru.');
  return {
    value,
    defaultValue: num(inner(r, 'defaults').noShowAfterMinutes, value),
    min: num(r.minimumNoShowAfterMinutes, 0),
    max: num(r.maximumNoShowAfterMinutes, 24 * 60),
  };
}

export const bookingRulesApi = {
  getBookingChanges: async (): Promise<NumberRuleResponse> =>
    parseBookingChanges((await client.get('/api/v1/settings/booking-changes')).data),
  saveBookingChanges: async (hours: number): Promise<NumberRuleResponse> =>
    parseBookingChanges((await client.put('/api/v1/settings/booking-changes', { patientChangeDeadlineHours: hours })).data),
  getAttendance: async (): Promise<NumberRuleResponse> =>
    parseAttendance((await client.get('/api/v1/settings/attendance')).data),
  saveAttendance: async (minutes: number): Promise<NumberRuleResponse> =>
    parseAttendance((await client.put('/api/v1/settings/attendance', { noShowAfterMinutes: minutes })).data),
};

export const BOOKING_CHANGES_KEY = ['settings', 'booking-changes'] as const;
export const ATTENDANCE_KEY = ['settings', 'attendance'] as const;
