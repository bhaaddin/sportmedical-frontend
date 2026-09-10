/**
 * Single place where UTC from the API meets Europe/Prague on screen.
 *
 * Booking contract 3.3: the backend sends and accepts UTC only; the UI shows
 * Prague time; date-only values (period validity, day exceptions) never make
 * the UTC round trip or they lose a day.
 *
 * The conversion runs on `Intl`, not on a date library. `date-fns` v4 has no
 * time-zone support without the separate `@date-fns/tz` package, which is not
 * installed, and contract 10 forbids adding a date library. `Intl` carries the
 * IANA database the runtime already ships, so DST is correct for free.
 */

export const PRAGUE_TZ = 'Europe/Prague';

/** Calendar date with no time and no zone, as the API spells it: `yyyy-MM-dd`. */
export type DateOnly = string;

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PRAGUE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pragueParts(instant: Date): ZonedParts {
  const parts = partsFormatter.formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some engines render midnight as hour 24.
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** Offset of Europe/Prague at a given instant, in milliseconds. */
function pragueOffsetMs(instant: Date): number {
  const p = pragueParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The `yyyy-MM-dd` a UTC instant falls on in Prague. */
export function pragueDateKey(instant: Date | string): DateOnly {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const p = pragueParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * The UTC instant at which a Prague calendar day begins.
 *
 * Solved by guessing, measuring the offset at the guess and correcting — two
 * passes settle it even on the days the offset itself changes.
 */
export function startOfPragueDay(date: DateOnly): Date {
  const [year, month, day] = date.split('-').map(Number);
  let guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  for (let i = 0; i < 2; i += 1) {
    guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - pragueOffsetMs(guess));
  }
  return guess;
}

/**
 * A Prague wall-clock time on a Prague date, as the instant it really is.
 *
 * Not `startOfPragueDay(date) + hours * 3600000`. That adds elapsed hours to a
 * day whose wall clock may not have 24 of them, so on the two clock-change
 * days it lands an hour out. Caught by measuring rather than by reasoning:
 * blocking 13:00 on 25. 10. 2026 through that arithmetic stored 11:00Z and
 * came back on screen as 12:00 - an hour earlier than the operator typed, on
 * the one day of the year nobody would think to check.
 *
 * Same two-pass guess-and-correct as `startOfPragueDay`, for the same reason:
 * the offset has to be read at the answer, not at the guess.
 */
export function pragueWallClockToInstant(date: DateOnly, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let guess = new Date(wall);
  for (let i = 0; i < 2; i += 1) {
    guess = new Date(wall - pragueOffsetMs(guess));
  }
  return guess;
}

/**
 * How many hours that Prague day actually has: 23, 24 or 25.
 *
 * Contract 3.3: the day and week grids must not compute their height as
 * `24 x hourHeight`, or the two clock-change days render an hour short or long.
 */
export function hoursInPragueDay(date: DateOnly): number {
  const start = startOfPragueDay(date);
  const next = startOfPragueDay(addDaysToDateOnly(date, 1));
  return Math.round((next.getTime() - start.getTime()) / 3_600_000);
}

/** Shifts a `yyyy-MM-dd` by whole days without ever touching a time zone. */
export function addDaysToDateOnly(date: DateOnly, days: number): DateOnly {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** `yyyy-MM-dd` for a Date taken as the user's own calendar day, not as UTC. */
export function toDateOnly(date: Date): DateOnly {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Day of week of a date-only value, 0 = Sunday as .NET spells it on the wire. */
export function dayOfWeekOf(date: DateOnly): number {
  return parseDateOnly(date).getDay();
}

/** Parses `yyyy-MM-dd` to local midnight — never through `new Date(string)`. */
export function parseDateOnly(date: DateOnly): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const timeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: PRAGUE_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: PRAGUE_TZ,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

/** `8:30` — a UTC instant as Prague wall-clock time. */
export function formatPragueTime(instant: Date | string): string {
  return timeFormatter.format(typeof instant === 'string' ? new Date(instant) : instant);
}

/** `14. 10. 2026` — a UTC instant as a Prague date. */
export function formatPragueDate(instant: Date | string): string {
  return dateFormatter.format(typeof instant === 'string' ? new Date(instant) : instant);
}

/** `14. 10. 2026 8:30`. */
export function formatPragueDateTime(instant: Date | string): string {
  return `${formatPragueDate(instant)} ${formatPragueTime(instant)}`;
}

/** `14. 10. 2026` for a date-only value, with no zone conversion at all. */
export function formatDateOnly(date: DateOnly): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day}. ${month}. ${year}`;
}

/**
 * Contract 6.2: "late" is never a stored state and is never sent back. It is
 * recomputed here so the number moves without a reload.
 *
 * 4.5 writes the rule as a formula and this is it: an appointment still
 * expected - Scheduled or Confirmed - whose time has passed. The status is the
 * numeric code from the API; `isLateStatus` in the contracts module owns which
 * codes those are, so this file never repeats the mapping.
 */
export function isLate(
  startUtc: string,
  statusIsStillExpected: boolean,
  now: Date = new Date(),
): boolean {
  return statusIsStillExpected && new Date(startUtc).getTime() < now.getTime();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
