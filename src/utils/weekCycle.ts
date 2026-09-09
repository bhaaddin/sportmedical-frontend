import { addDaysToDateOnly, parseDateOnly, type DateOnly } from './time';

/**
 * The week cycle of a working day, and the concrete dates it lands on.
 *
 * Contract 5.4 asks for a preview under the cycle picker - "Platí: 6. 10. ·
 * 20. 10. · 3. 11." - and is explicit that it is not decoration: without it
 * nobody can tell what they just set.
 *
 * This computes dates, never availability. It echoes the owner's own setting
 * back at them; it does not decide whether a slot is free. Rule 6.1 is about
 * free times and is untouched here.
 *
 * `weekOffset` is matched against the ISO week number, so "even" and "odd"
 * mean even and odd calendar weeks - what a Czech user means by "sudý tyden" -
 * and the answer does not move when the period's start date is edited.
 */

export type CycleMode = 'every' | 'even' | 'odd' | 'everyNth';

export interface WeekCycle {
  repeatEveryNWeeks: number;
  weekOffset: number;
}

/** ISO 8601 week number (1-53) of a `yyyy-MM-dd`. */
export function isoWeekNumber(date: DateOnly): number {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  // Thursday of the same ISO week decides which year and week it belongs to.
  const dayIndex = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayIndex + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayIndex = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayIndex + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Day of week as .NET spells it on the wire: 0 = Sunday. */
export function dayOfWeekOf(date: DateOnly): number {
  return parseDateOnly(date).getDay();
}

export function cycleToMode(cycle: WeekCycle): CycleMode {
  if (cycle.repeatEveryNWeeks <= 1) return 'every';
  if (cycle.repeatEveryNWeeks === 2) return cycle.weekOffset % 2 === 0 ? 'even' : 'odd';
  return 'everyNth';
}

export function modeToCycle(mode: CycleMode, everyNth = 3): WeekCycle {
  switch (mode) {
    case 'every':
      return { repeatEveryNWeeks: 1, weekOffset: 0 };
    case 'even':
      return { repeatEveryNWeeks: 2, weekOffset: 0 };
    case 'odd':
      return { repeatEveryNWeeks: 2, weekOffset: 1 };
    case 'everyNth':
      return { repeatEveryNWeeks: Math.max(2, everyNth), weekOffset: 0 };
  }
}

/** True when this cycle covers that particular date. */
export function cycleCoversDate(cycle: WeekCycle, date: DateOnly): boolean {
  const n = Math.max(1, cycle.repeatEveryNWeeks);
  if (n === 1) return true;
  return isoWeekNumber(date) % n === cycle.weekOffset % n;
}

/**
 * The next dates a working day actually falls on, for the preview in 5.4.
 *
 * Walks day by day from the later of the period start and today, so the owner
 * sees dates ahead of them rather than a period's long-past first weeks.
 */
export function previewCycleDates(
  dayOfWeek: number,
  cycle: WeekCycle,
  validFrom: DateOnly,
  validTo: DateOnly | null,
  today: DateOnly,
  limit = 5,
): DateOnly[] {
  const start = validFrom > today ? validFrom : today;
  const found: DateOnly[] = [];
  let cursor = start;

  // A year of days is a hard stop: an empty preview is a real answer, not a hang.
  for (let step = 0; step < 366 && found.length < limit; step += 1) {
    if (validTo !== null && cursor > validTo) break;
    if (dayOfWeekOf(cursor) === dayOfWeek && cycleCoversDate(cycle, cursor)) {
      found.push(cursor);
    }
    cursor = addDaysToDateOnly(cursor, 1);
  }

  return found;
}
