/* ══════════════════════════════════════════════════════════════
   Pauza mezi vyšetřeními (Etapa 5) — a clinic-wide setting.

     GET/PUT /api/v1/settings/booking-slots   (read: anyone signed in; write: settings.clinic.manage)

   `{ settings: { examinationPauseMinutes }, defaults, minMinutes, maxMinutes }`. A body that leaves the field out keeps the
   stored value; a value outside the range answers 400 `settings.invalid` with `errors.examinationPauseMinutes`.
   The reader is tolerant: an absent field reads as the default 0 and the range as 0–240.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface BookingSlotSettings {
  examinationPauseMinutes: number;
  /**
   * Stage 2, R4 (contract): "one person does one thing at a time". `undefined` = the server has no such setting (an older build) and
   * the settings card hides it. A PUT that leaves a field out keeps the stored value.
   */
  singleWorkerAtATime?: boolean;
  /** User ids exempt from the rule (they may hold two things at once). */
  workerExceptions?: string[];
}

export interface BookingSlotSettingsResponse {
  settings: BookingSlotSettings;
  defaults: BookingSlotSettings;
  minMinutes: number;
  maxMinutes: number;
}

export const BOOKING_SLOTS_QUERY_KEY = ['settings', 'booking-slots'] as const;

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' ? (v as Record<string, unknown>) : {});

const slotSettings = (raw: unknown): BookingSlotSettings => {
  const r = rec(raw);
  return {
    examinationPauseMinutes: num(r.examinationPauseMinutes, 0),
    ...(typeof r.singleWorkerAtATime === 'boolean' ? { singleWorkerAtATime: r.singleWorkerAtATime } : {}),
    ...(Array.isArray(r.workerExceptions) ? { workerExceptions: [...new Set(r.workerExceptions.filter((x): x is string => typeof x === 'string' && x !== ''))] } : {}),
  };
};

/** The server has the shared-worker setting (the field came back), so the screen offers it. */
export const hasSingleWorkerSetting = (s: BookingSlotSettings | undefined): boolean => s?.singleWorkerAtATime !== undefined;

export function toBookingSlots(raw: unknown): BookingSlotSettingsResponse {
  const r = rec(raw);
  return {
    settings: slotSettings(r.settings),
    defaults: slotSettings(r.defaults),
    minMinutes: num(r.minMinutes, 0),
    maxMinutes: num(r.maxMinutes, 240),
  };
}

export const readBookingSlots = async (): Promise<BookingSlotSettingsResponse> =>
  toBookingSlots((await client.get('/api/v1/settings/booking-slots')).data);

/** A save carries only what the caller names (the others stay as stored on the server). */
export const saveBookingSlots = async (settings: Partial<BookingSlotSettings>): Promise<BookingSlotSettingsResponse> =>
  toBookingSlots((await client.put('/api/v1/settings/booking-slots', settings)).data);
