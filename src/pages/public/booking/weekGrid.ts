/*
 * Week arithmetic for the booking calendar (V-Rezervace). Dates are plain
 * yyyy-MM-dd strings in the clinic's calendar, read at local noon so a DST
 * change can never nudge a day.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

export const isoOf = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parse = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

/** Monday of the week the date falls in. */
export function mondayOf(iso: string): string {
  const date = parse(iso);
  const back = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - back);
  return isoOf(date);
}

export function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setDate(date.getDate() + days);
  return isoOf(date);
}

/** The seven days of the week starting at a Monday. */
export function weekOf(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "Pondělí" for a date. */
export function weekdayName(iso: string): string {
  const name = parse(iso).toLocaleDateString('cs-CZ', { weekday: 'long' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** "26. 10." for a date. */
export function dayMonth(iso: string): string {
  const date = parse(iso);
  return `${date.getDate()}. ${date.getMonth() + 1}.`;
}

/** "Říjen 2026", or "Říjen – listopad 2026" for a week across a month end. */
export function weekTitle(monday: string): string {
  const first = parse(monday);
  const last = parse(addDays(monday, 6));
  const month = (d: Date) => d.toLocaleDateString('cs-CZ', { month: 'long' });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (first.getMonth() === last.getMonth()) return `${cap(month(first))} ${first.getFullYear()}`;
  const years = first.getFullYear() === last.getFullYear() ? `${last.getFullYear()}` : `${first.getFullYear()} / ${last.getFullYear()}`;
  return `${cap(month(first))} – ${month(last)} ${years}`;
}
