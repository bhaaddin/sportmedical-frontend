/*
 * Dates, clock times and Czech labels.
 *
 * A faithful port of the prototype's helpers (`iso`, `dateOf`, `shift`,
 * `timeAsMinutes`, `minutesAsTime`, `timeLeft`, `clockDuration`, `agendaHours`,
 * `weekdayFull`, `detailedDate`, `isoWeek` …). Dates travel as `yyyy-MM-dd`
 * strings; a `Date` is only created at local noon so a DST shift never moves a
 * day (that is why the prototype uses `T12:00:00`).
 */
import type { ClockTime, IsoDate } from './types';

export const weekNames = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;
export const monthNames = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
] as const;
export const monthGenitives = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
] as const;
export const weekdayNamesFull = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle'] as const;

const pad = (n: number): string => String(n).padStart(2, '0');

/** `Date` -> `yyyy-MM-dd` (local fields). */
export const iso = (dt: Date): IsoDate => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

/** `yyyy-MM-dd` -> local noon of that day. */
export const dateOf = (str: IsoDate): Date => new Date(`${str}T12:00:00`);

/** A copy of `date` moved by `n` days. */
export const shift = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

/** String flavour of `shift`: `addDays('2026-11-16', 7) === '2026-11-23'`. */
export const addDays = (day: IsoDate, n: number): IsoDate => iso(shift(dateOf(day), n));

/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (d: Date): number => (d.getDay() + 6) % 7;

export const sameMonth = (d: Date, m: Date): boolean =>
  d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();

/** "18. 11." */
export const printable = (d: Date): string => `${d.getDate()}. ${d.getMonth() + 1}.`;

/** "Po" … "Ne" for an ISO day. */
export const dayCode = (s: IsoDate): string => weekNames[weekdayIndex(dateOf(s))]!;

/** "07:30" -> 7.5 (hours). */
export const startHour = (t: ClockTime): number => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) + (m ?? 0) / 60;
};

/** `NaN` for anything that is not exactly `HH:mm`. */
export function timeAsMinutes(t: string | null | undefined): number {
  if (!/^\d\d:\d\d$/.test(t || '')) return NaN;
  const [h, m] = (t as string).split(':').map(Number);
  return (h as number) * 60 + (m as number);
}

export function minutesAsTime(t: number): ClockTime {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** "2 h 30 min", "45 min", "0 min". */
export function timeLeft(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h ? h + ' h' : ''}${m ? ' ' + m + ' min' : ''}`.trim() || '0 min';
}

/** Same format as `timeLeft`; the prototype keeps two names for it. */
export function clockDuration(n: number): string {
  const hrs = Math.floor(n / 60);
  const mins = n % 60;
  return `${hrs ? hrs + ' h' : ''}${mins ? ` ${mins} min` : ''}`.trim() || '0 min';
}

/** Agenda flavour: "2 h 30 min", "2 h", "45 min", "0 min". */
export function agendaHours(t: number): string {
  const n = Math.max(0, Number(t) || 0);
  const h = Math.floor(n / 60);
  const m = n % 60;
  return (h ? `${h} h ` : '') + (m ? `${m} min` : h ? '' : '0 min');
}

/** Czech plural of "vytvořený termín". */
export function agendaTermLabel(n: number): string {
  return n === 1 ? 'vytvořený termín' : n >= 2 && n <= 4 ? 'vytvořené termíny' : 'vytvořených termínů';
}

/** Czech plural of "slot". */
export function agendaSlotLabel(n: number): string {
  return n === 1 ? 'slot' : n >= 2 && n <= 4 ? 'sloty' : 'slotů';
}

/** "termín / termíny / termínů" (no adjective). */
export function termWord(n: number): string {
  return n === 1 ? 'termín' : n >= 2 && n <= 4 ? 'termíny' : 'termínů';
}

export function weekdayFull(date: IsoDate): string {
  return weekdayNamesFull[weekdayIndex(dateOf(date))]!;
}

/** "Pátek 20. listopadu 2026" */
export function detailedDate(date: IsoDate): string {
  const d = dateOf(date);
  return `${weekdayFull(date)} ${d.getDate()}. ${monthGenitives[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO 8601 week number of a date (prototype `isoWeek`). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

/** The Monday of the week that contains `day`. */
export function mondayOf(day: IsoDate): IsoDate {
  const d = dateOf(day);
  return iso(shift(d, -weekdayIndex(d)));
}

/** First day of the month of `day`, as `yyyy-MM-01`. */
export function monthStartOf(day: IsoDate): IsoDate {
  const d = dateOf(day);
  return iso(new Date(d.getFullYear(), d.getMonth(), 1, 12));
}

/** `monthStart` moved by `delta` months (always the first of a month). */
export function addMonths(monthStart: IsoDate, delta: number): IsoDate {
  const d = dateOf(monthStart);
  return iso(new Date(d.getFullYear(), d.getMonth() + delta, 1, 12));
}

/** Local today as an ISO day (the only place that reads the clock). */
export function todayIso(now: Date = new Date()): IsoDate {
  return iso(now);
}

/** The 42 cells (6 weeks, Monday first) of the mini-calendar / month view for a month. */
export function monthCells(monthStart: IsoDate): IsoDate[] {
  const m = dateOf(monthStart);
  const first = new Date(m.getFullYear(), m.getMonth(), 1, 12);
  const firstCell = shift(first, -weekdayIndex(first));
  return Array.from({ length: 42 }, (_, i) => iso(shift(firstCell, i)));
}

/** "Listopad 2026" */
export function monthTitle(monthStart: IsoDate): string {
  const m = dateOf(monthStart);
  return `${monthNames[m.getMonth()]} ${m.getFullYear()}`;
}

/** "18. – 24. listopadu 2026" / "30. 11. – 6. 12. 2026" — the week heading. */
export function weekRangeLabel(weekStart: IsoDate): string {
  const first = dateOf(weekStart);
  const last = shift(first, 6);
  return first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
    ? `${first.getDate()}. – ${last.getDate()}. ${monthGenitives[first.getMonth()]} ${first.getFullYear()}`
    : `${printable(first)} – ${printable(last)} ${last.getFullYear()}`;
}

/** "47. týden" */
export function weekNumberLabel(weekStart: IsoDate): string {
  return `${isoWeek(dateOf(weekStart))}. týden`;
}

/** "Pá 20. 11. 2026" (event dialogs). */
export function shortDateWithYear(date: IsoDate): string {
  const d = dateOf(date);
  return `${dayCode(date)} ${printable(d)} ${d.getFullYear()}`;
}

/** Clamp helper shared by the geometry code. */
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
