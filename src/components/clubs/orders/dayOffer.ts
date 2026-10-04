/*
 * Etapa 8: pure helpers for "days the desk offers a club" and "days the club picked".
 * Dates are yyyy-MM-dd strings everywhere (no Date objects leave this file, so no time zone can shift a day).
 */

export const MAX_OFFERED_DAYS = 120;

export const WEEKDAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;
export const MONTHS_CS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'] as const;
/** Genitive, for "12. října". */
const MONTHS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');
export const isoOf = (y: number, m: number, d: number): string => `${y}-${pad(m)}-${pad(d)}`;

export function splitIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

/** Today in the clinic's calendar. */
export const todayIso = (): string => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' });

export function addDays(iso: string, n: number): string {
  const [y, m, d] = splitIso(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = splitIso(iso);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const isWeekend = (iso: string): boolean => weekdayIndex(iso) >= 5;

export const monthStart = (iso: string): string => `${iso.slice(0, 7)}-01`;

export function addMonths(iso: string, n: number): string {
  const [y, m] = splitIso(iso);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, 1);
}

export function monthTitle(iso: string): string {
  const [y, m] = splitIso(iso);
  return `${MONTHS_CS[m - 1]} ${y}`;
}

/** The weeks (Mon–Sun) of the month holding `iso`; days outside the month are null. */
export function monthGrid(iso: string): (string | null)[][] {
  const [y, m] = splitIso(iso);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = weekdayIndex(isoOf(y, m, 1));
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => isoOf(y, m, i + 1))];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Monday..Sunday of the week containing `iso`. */
export function weekOf(iso: string): string[] {
  const monday = addDays(iso, -weekdayIndex(iso));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Every day from..to inclusive (empty when from > to, capped so a typo cannot freeze the page). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

export const sortedUnique = (dates: string[]): string[] => [...new Set(dates)].sort();

/** Adds the given days (skipping past ones) to a selection; keeps it sorted and within the server's cap. */
export function addDates(current: string[], extra: string[], today: string): string[] {
  return sortedUnique([...current, ...extra.filter((d) => d >= today)]).slice(0, MAX_OFFERED_DAYS);
}

export function toggleDate(current: string[], date: string): string[] {
  return current.includes(date) ? current.filter((d) => d !== date) : sortedUnique([...current, date]);
}

/** "12. října", for one date; the year is added when it is not `year`. */
export function dayText(iso: string, year?: number): string {
  const [y, m, d] = splitIso(iso);
  return `${d}. ${MONTHS_GEN[m - 1]}${year !== undefined && y !== year ? ` ${y}` : ''}`;
}

/** "12., 13., 15. října" - days grouped by month, groups joined by " · "; the year only when it is not the current one. */
export function daysText(dates: string[], year = new Date().getFullYear()): string {
  const groups: { key: string; days: number[]; y: number; m: number }[] = [];
  for (const iso of sortedUnique(dates)) {
    const [y, m, d] = splitIso(iso);
    const key = `${y}-${m}`;
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) last.days.push(d);
    else groups.push({ key, days: [d], y, m });
  }
  return groups.map((g) => `${g.days.map((d) => `${d}.`).join(', ')} ${MONTHS_GEN[g.m - 1]}${g.y !== year ? ` ${g.y}` : ''}`).join(' · ');
}

/** Consecutive calendar days become one range; a single day is a one-day range. */
export function daysToRanges(dates: string[]): { fromDate: string; toDate: string }[] {
  const out: { fromDate: string; toDate: string }[] = [];
  for (const iso of sortedUnique(dates)) {
    const last = out[out.length - 1];
    if (last !== undefined && addDays(last.toDate, 1) === iso) last.toDate = iso;
    else out.push({ fromDate: iso, toDate: iso });
  }
  return out;
}
