import { pragueWallClockToInstant } from '../../utils/time';
import type { DateOnly } from '../../utils/time';

/**
 * The time arithmetic of the booking dialog.
 *
 * The grid hands the dialog a range as local clinic time - `2026-09-24T09:00`
 * to `2026-09-24T10:00` - because that is what a person dragged across. The
 * server takes a UTC instant and an activity, and the appointment's end is the
 * activity's length, not the drag. Everything between those two shapes is here,
 * so it can be tested on its own - including the day the clocks change, where
 * "09:00 in Prague" is a different UTC hour than the day before.
 *
 * Nothing here works out whether a time is free. That is `availability`'s
 * answer (contract 6.1); `isStartOffered` only reads it.
 */

/** A clinic wall-clock moment: `yyyy-MM-dd` and `HH:mm`. */
export interface LocalMoment {
  date: DateOnly;
  time: string;
}

const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^(\d{2}):(\d{2})$/;

/** `2026-09-24T09:00` -> `{ date, time }`, or null for anything else. */
export function parseLocalDateTime(value: string | undefined | null): LocalMoment | null {
  if (!value) return null;
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, date, hours, minutes] = match;
  if (Number(hours) > 23 || Number(minutes) > 59) return null;
  return { date, time: `${hours}:${minutes}` };
}

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

/** `HH:mm`, 00:00 to 23:59. What `<input type="time">` gives, trimmed of seconds. */
export function normalizeTime(value: string): string {
  const cut = value.slice(0, 5);
  const match = TIME_OF_DAY.exec(cut);
  if (!match) return '';
  return Number(match[1]) > 23 || Number(match[2]) > 59 ? '' : cut;
}

export function isCompleteMoment(moment: LocalMoment): boolean {
  return isDateOnly(moment.date) && normalizeTime(moment.time) !== '';
}

/** The UTC instant a clinic wall-clock moment is, as the API wants it. */
export function toStartUtc(moment: LocalMoment): string {
  return pragueWallClockToInstant(moment.date, moment.time).toISOString();
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * How long the dragged selection is, in minutes - or null when there is no
 * end, the end is on another day, or it is not after the start.
 */
export function selectionMinutes(start: LocalMoment, end: LocalMoment | null): number | null {
  if (!end || end.date !== start.date) return null;
  const length = minutesOfDay(end.time) - minutesOfDay(start.time);
  return length > 0 ? length : null;
}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `09:05` - a UTC instant as clinic wall-clock time, always two digits. */
export function pragueClock(instant: string | Date): string {
  return clock.format(typeof instant === 'string' ? new Date(instant) : instant);
}

/**
 * When an appointment of `durationMinutes` starting at `start` ends, on the
 * clinic's wall clock. Counted on the instant, not on the clock face, so a
 * clock change inside the appointment is honoured.
 */
export function endClock(start: LocalMoment, durationMinutes: number): string {
  const startMs = Date.parse(toStartUtc(start));
  return pragueClock(new Date(startMs + durationMinutes * 60_000));
}

/** `od 09:00 do 10:00` - the words the owner asked to see. */
export function rangeLabel(from: string, to: string): string {
  return `od ${from} do ${to}`;
}

/** Whether the server offered exactly this start. Compared as instants. */
export function isStartOffered(
  slots: readonly { startUtc: string }[] | undefined,
  startUtc: string | null,
): boolean {
  if (!slots || !startUtc) return false;
  const wanted = Date.parse(startUtc);
  return slots.some((s) => Date.parse(s.startUtc) === wanted);
}
