/*
 * The date rules the calendar dialogs share (Q10), pure and in Europe/Prague.
 *
 *  - an explicit, real date is required (no dialog opens on "today" or "1. 1." and saves that);
 *  - a wall-clock time that does not exist on a clock-change day (02:30 on the last Sunday of March) is an ERROR,
 *    never quietly shifted to 03:30;
 *  - a wall-clock time that happens twice (02:30 on the last Sunday of October) is allowed but flagged so the dialog
 *    can say which one is meant (the first, summer time).
 */
import { addDaysToDateOnly, pragueDateKey, pragueWallClockToInstant, type DateOnly } from './time';

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(\d{2}):(\d{2})/;

/** True for a real calendar day written yyyy-MM-dd (not 2026-02-30). */
export function isRealDate(date: string): boolean {
  if (!DATE_ONLY.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** The Prague wall clock (HH:mm) an instant shows. */
function pragueClock(instant: Date): string {
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hour12: false }).format(instant).replace(/^24/, '00');
}

/** Whether `HH:mm` on that Prague date is a time the clock really shows (false inside the spring gap). */
export function wallTimeExists(date: DateOnly, time: string): boolean {
  const match = TIME.exec(time);
  if (!isRealDate(date) || match === null) return false;
  const wanted = `${match[1]}:${match[2]}`;
  return pragueClock(pragueWallClockToInstant(date, wanted)) === wanted && pragueDateKey(pragueWallClockToInstant(date, wanted)) === date;
}

/** Whether `HH:mm` on that Prague date happens twice (inside the autumn overlap). */
export function wallTimeRepeats(date: DateOnly, time: string): boolean {
  const match = TIME.exec(time);
  if (!wallTimeExists(date, time) || match === null) return false;
  const instant = pragueWallClockToInstant(date, `${match[1]}:${match[2]}`);
  /* The other reading is an hour away on either side; if the clock shows the same time there, it repeats. */
  const wanted = `${match[1]}:${match[2]}`;
  return [-3_600_000, 3_600_000].some((shift) => pragueClock(new Date(instant.getTime() + shift)) === wanted);
}

export const DAY_RULE_TEXT = {
  noDate: 'Vyberte datum.',
  badDate: 'Toto datum neexistuje.',
  timeGap: 'Tento čas ten den neexistuje (posun hodin). Zvolte jiný.',
} as const;

/** What is wrong with a date, in words, or null. */
export function dateProblem(date: string): string | null {
  if (date.trim() === '') return DAY_RULE_TEXT.noDate;
  return isRealDate(date) ? null : DAY_RULE_TEXT.badDate;
}

/** What is wrong with a time on a date (a missing clock-change hour), or null. Empty time is not this rule's concern. */
export function wallTimeProblem(date: DateOnly, time: string | null | undefined): string | null {
  if (time === null || time === undefined || time.trim() === '' || !isRealDate(date)) return null;
  return wallTimeExists(date, time) ? null : DAY_RULE_TEXT.timeGap;
}

/** A hint (not an error) when a time happens twice that day. */
export function repeatedTimeNote(date: DateOnly, time: string | null | undefined): string | null {
  return time && wallTimeRepeats(date, time) ? 'Tento čas se ten den opakuje (posun hodin); platí první výskyt, letní čas.' : null;
}

/**
 * The Prague days (yyyy-MM-dd) a UTC span touches, so a count of the appointments a closure affects can use
 * the same day boundaries as the calendar.
 */
export function daysBetween(from: DateOnly, to: DateOnly): DateOnly[] {
  const out: DateOnly[] = [];
  for (let day = from; day <= to && out.length < 400; day = addDaysToDateOnly(day, 1)) out.push(day);
  return out;
}
