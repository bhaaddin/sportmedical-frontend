/*
 * R15c (b) - "Nejbližší volný termín" for ONE činnost: the first start the server's availability offers after a moment.
 * Free times come from `getAvailability` and nowhere else (rule 6.1); this only picks the earliest later one from its answer.
 */
import type { AvailabilitySlot } from '../../../api/bookingContracts';
import { pragueClock } from '../NewAppointmentDialog.logic';
import { pragueDateKey } from '../../../utils/time';

export interface NearestFree {
  /** `yyyy-MM-dd` clinic day. */
  date: string;
  /** `HH:mm` clinic time. */
  time: string;
  startUtc: string;
}

/** The earliest offered start strictly after `afterMs`, or null. Slots are not assumed to be sorted. */
export function firstFreeAfter(slots: readonly Pick<AvailabilitySlot, 'startUtc'>[], afterMs: number): NearestFree | null {
  let best: string | null = null;
  let bestMs = Infinity;
  for (const s of slots) {
    const at = Date.parse(s.startUtc);
    if (Number.isFinite(at) && at > afterMs && at < bestMs) {
      best = s.startUtc;
      bestMs = at;
    }
  }
  return best === null ? null : { date: pragueDateKey(best), time: pragueClock(best), startUtc: best };
}

/** How far ahead the search looks, in windows of `WINDOW_DAYS` (four calls at most). */
export const WINDOW_DAYS = 14;
export const MAX_WINDOWS = 4;
