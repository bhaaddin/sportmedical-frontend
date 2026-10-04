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

export function toBookingSlots(raw: unknown): BookingSlotSettingsResponse {
  const r = rec(raw);
  return {
    settings: { examinationPauseMinutes: num(rec(r.settings).examinationPauseMinutes, 0) },
    defaults: { examinationPauseMinutes: num(rec(r.defaults).examinationPauseMinutes, 0) },
    minMinutes: num(r.minMinutes, 0),
    maxMinutes: num(r.maxMinutes, 240),
  };
}

export const readBookingSlots = async (): Promise<BookingSlotSettingsResponse> =>
  toBookingSlots((await client.get('/api/v1/settings/booking-slots')).data);

export const saveBookingSlots = async (settings: BookingSlotSettings): Promise<BookingSlotSettingsResponse> =>
  toBookingSlots((await client.put('/api/v1/settings/booking-slots', settings)).data);
