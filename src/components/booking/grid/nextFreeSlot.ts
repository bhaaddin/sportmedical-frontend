import type { MinuteRange } from './timeRange';
import { addDaysToDateOnly, type DateOnly } from '../../../utils/time';

/*
 * The sidebar's "Nová objednávka" lands on the calendar and opens the booking
 * drawer on the next free half hour - as if the receptionist had dragged it
 * herself. This picks that half hour: from now, rounded up to the grid step,
 * skipping anything already on the calendar, inside the day's working hours.
 *
 * It only chooses what to *prefill*. Whether the time can really be booked is
 * still the server's answer in the dialog (6.1); this never claims a slot is
 * free, it only avoids proposing one that is visibly taken.
 */
export function nextFreeSlot(
  nowMinute: number,
  step: number,
  busy: readonly MinuteRange[],
  duration = 30,
  bounds: MinuteRange = { start: 0, end: 24 * 60 },
): MinuteRange | null {
  const slot = step > 0 ? step : 30;
  const roundUp = (minute: number) => Math.ceil(minute / slot) * slot;
  let start = roundUp(Math.max(nowMinute, bounds.start));
  while (start + duration <= bounds.end) {
    const end = start + duration;
    const clash = busy.find((b) => b.start < end && b.end > start);
    if (!clash) return { start, end };
    start = Math.max(roundUp(clash.end), start + slot);
  }
  return null;
}

/*
 * The same question across days. Found on a Saturday, 3. 10. 2026: the
 * receptionist pressed "Nová objednávka", the drawer opened on today - a day
 * the clinic is shut - and said so, which helped nobody. The next free slot
 * is on the next day that is OPEN and OFFERS something, so the walk goes day
 * by day from now, up to `maxDays` ahead.
 */

/** What one calendar does on one day, reduced to what the walk needs. */
export interface DayFacts {
  /** Open and offering at least one činnost. A shut day, a holiday, a day with nothing assigned: false. */
  open: boolean;
  /** Working hours; null when unknown (the drag then proposes anything). */
  bounds: MinuteRange | null;
  /** Bookings, blocks and the lunch break. */
  busy: readonly MinuteRange[];
}

export type DayWalk =
  | { kind: 'found'; dayKey: DateOnly; slot: MinuteRange }
  /** The walk reached a day nobody has facts for yet - ask for them and walk again. */
  | { kind: 'unknown'; dayKey: DateOnly }
  /** Every day looked at is known and none has room. */
  | { kind: 'none' };

/** How far ahead "the next free slot" is looked for: a month, like the mini calendar. */
export const NEXT_FREE_HORIZON_DAYS = 31;

/**
 * From `start` (a day and the minute on it; the minute is 0 for every later
 * day), the first free slot on the first open day. `factsFor` answers with
 * `undefined` for a day it knows nothing about, and the walk stops there
 * rather than guessing - "unknown" is not "shut", and it is not "free" either.
 */
export function nextFreeSlotAcrossDays(
  start: { dayKey: DateOnly; minute: number },
  step: number,
  factsFor: (dayKey: DateOnly) => DayFacts | undefined,
  duration = 30,
  maxDays = NEXT_FREE_HORIZON_DAYS,
): DayWalk {
  let dayKey = start.dayKey;
  for (let i = 0; i < maxDays; i += 1) {
    const facts = factsFor(dayKey);
    if (facts === undefined) return { kind: 'unknown', dayKey };
    if (facts.open) {
      const slot = nextFreeSlot(
        i === 0 ? start.minute : 0,
        step,
        facts.busy,
        duration,
        facts.bounds ?? { start: 0, end: 24 * 60 },
      );
      if (slot) return { kind: 'found', dayKey, slot };
    }
    dayKey = addDaysToDateOnly(dayKey, 1);
  }
  return { kind: 'none' };
}
