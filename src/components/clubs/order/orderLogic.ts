/*
 * The pure part of the club-order dialog: rows <-> ranges, the payloads, what blocks a save and which
 * row a server refusal belongs to. No React, no network, nothing about a clinic's services or prices.
 */
import type { ClubOrderView, OrderRange, PaymentMethod } from '../../../api/clubOrders';
import { ClubOrderError } from '../../../api/clubOrders';
import { addDaysToDateOnly } from '../../../utils/time';
import { parsePlayerCount, validateRow } from '../blockLogic';
import type { RangeRow, RowErrors } from '../blockLogic';

let seq = 0;
export const newOrderRowKey = (): string => `order-row-${++seq}`;

export const emptyRow = (over: Partial<RangeRow> = {}): RangeRow => ({ key: newOrderRowKey(), fromDate: '', toDate: '', dailyFrom: '', dailyTo: '', ...over });

export const rowFromRange = (r: OrderRange): RangeRow =>
  emptyRow({ fromDate: r.fromDate, toDate: r.toDate || r.fromDate, dailyFrom: r.dailyFrom ?? '', dailyTo: r.dailyTo ?? '' });

export const rangeFromRow = (r: RangeRow): OrderRange => ({
  fromDate: r.fromDate,
  toDate: r.toDate,
  dailyFrom: r.dailyFrom.trim() === '' ? null : r.dailyFrom.trim(),
  dailyTo: r.dailyTo.trim() === '' ? null : r.dailyTo.trim(),
});

/** A row nobody has touched; it is dropped silently rather than reported. */
export const isBlankRow = (r: RangeRow): boolean => r.fromDate === '' && r.toDate === '' && r.dailyFrom.trim() === '' && r.dailyTo.trim() === '';

/** The same row one week later (days and daily window kept). */
export function repeatNextWeek(row: RangeRow): RangeRow {
  const shift = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? addDaysToDateOnly(d, 7) : d);
  return emptyRow({ fromDate: shift(row.fromDate), toDate: shift(row.toDate), dailyFrom: row.dailyFrom, dailyTo: row.dailyTo });
}

/** Weekday chips, Monday first. `value` is the .NET DayOfWeek the wire uses (0 = Sunday). */
export const WEEKDAYS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Po' }, { value: 2, label: 'Út' }, { value: 3, label: 'St' }, { value: 4, label: 'Čt' },
  { value: 5, label: 'Pá' }, { value: 6, label: 'So' }, { value: 0, label: 'Ne' },
];

export type SeatsText = Record<string, string>;

/** The ticked činnosti with their typed seats, in the order of `ids`; only valid numbers. */
export function seatPayload(ids: readonly string[], text: SeatsText): { activityId: string; seats: number }[] {
  return ids.flatMap((activityId) => {
    const seats = parsePlayerCount(text[activityId] ?? '');
    return seats === null ? [] : [{ activityId, seats }];
  });
}

export const totalSeatsOf = (ids: readonly string[], text: SeatsText): number =>
  ids.reduce((n, id) => n + (parsePlayerCount(text[id] ?? '') ?? 0), 0);

/** "+10" / "-10" on the typed value (an empty or invalid field counts as 0); never below 1. */
export function stepSeats(text: string, delta: number): string {
  const current = parsePlayerCount(text) ?? 0;
  return String(Math.max(1, current + delta));
}

/** The windows of an order for the editor: a confirmed order lives in its blocks, a request in `requestedRanges`. */
export function orderRanges(order: ClubOrderView, preferRequested: boolean): OrderRange[] {
  const live = order.blocks.filter((b) => b.status !== 'Cancelled');
  if (!preferRequested && live.length > 0) {
    const seen = new Set<string>();
    const out: OrderRange[] = [];
    for (const b of live) {
      const key = `${b.fromDate}|${b.toDate}|${b.dailyFrom ?? ''}|${b.dailyTo ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ fromDate: b.fromDate, toDate: b.toDate, dailyFrom: b.dailyFrom, dailyTo: b.dailyTo });
    }
    return out;
  }
  return order.requestedRanges;
}

export function orderCalendarIds(order: ClubOrderView): string[] {
  return [...new Set(order.blocks.filter((b) => b.status !== 'Cancelled').flatMap((b) => b.calendarIds))];
}

export interface RowIssue {
  errors: RowErrors;
}

export interface OrderValidation {
  club?: string;
  service?: string;
  seats?: string;
  payment?: string;
  calendars?: string;
  terms?: string;
}

export interface ValidationInput {
  mode: 'new' | 'edit' | 'process';
  /** What the primary action creates: a confirmed reservation or only a request. */
  confirming: boolean;
  clubReady: boolean;
  serviceId: string;
  activityIds: string[];
  seatsText: SeatsText;
  paymentMethod: PaymentMethod | null;
  calendarIds: string[];
  rows: readonly RangeRow[];
  rowErrors: readonly RowErrors[];
}

export function validateOrder(v: ValidationInput): OrderValidation {
  const out: OrderValidation = {};
  if (v.mode === 'new' && !v.clubReady) out.club = 'Vyberte klub nebo založte nový.';
  if (v.serviceId === '') out.service = 'Vyberte službu.';
  if (v.activityIds.length === 0) out.seats = 'Vyberte aspoň jednu činnost a zadejte počet hráčů.';
  else if (v.activityIds.some((id) => parsePlayerCount(v.seatsText[id] ?? '') === null)) out.seats = 'Zadejte počet hráčů (celé číslo od 1) u každé vybrané činnosti.';
  if (v.confirming) {
    if (v.paymentMethod === null) out.payment = 'Vyberte způsob platby.';
    if (v.calendarIds.length === 0) out.calendars = 'Vyberte aspoň jeden kalendář.';
    if (!v.rows.some((r) => !isBlankRow(r))) out.terms = 'Zadejte aspoň jeden termín.';
  }
  return out;
}

export const hasIssues = (o: OrderValidation): boolean => Object.values(o).some((x) => x !== undefined);

export const rowHasError = (e: RowErrors | undefined): boolean => e !== undefined && Object.values(e).some((x) => x !== undefined);

export { validateRow };

const pad = (n: number) => String(n).padStart(2, '0');

/** Which row a 409/400 names: by a `ranges[i]` field key, or by a date that appears in the message. */
export function rowIndexForError(error: ClubOrderError, rows: readonly RangeRow[]): number | null {
  for (const key of Object.keys(error.fieldErrors)) {
    const m = /ranges\D*(\d+)/i.exec(key);
    if (m !== null && Number(m[1]) < rows.length) return Number(m[1]);
  }
  const text = [error.message, ...Object.values(error.fieldErrors).flat()].join(' ');
  const hit = rows.findIndex((r) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fromDate)) return false;
    const [y, m, d] = r.fromDate.split('-').map(Number);
    return text.includes(r.fromDate) || new RegExp(String.raw`(^|\D)${d}\.\s?${m}\.\s?${y}(\D|$)`).test(text) || text.includes(`${pad(d)}.${pad(m)}.${y}`);
  });
  return hit === -1 ? null : hit;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function windowOf(r: Pick<RangeRow, 'dailyFrom' | 'dailyTo'>): [number, number] | null {
  const f = r.dailyFrom.trim();
  const t = r.dailyTo.trim();
  return TIME.test(f) && TIME.test(t) && t > f ? [minutes(f), minutes(t)] : null;
}

/**
 * Per row: the first other row that takes the same time. Unlike a plain day overlap, two rows on the same
 * day with different daily windows (09:00-10:00 and 13:00-14:00) are fine; a row without a window holds the
 * whole day and overlaps any row on those days.
 */
export function orderOverlapErrors(rows: readonly RangeRow[]): (string | undefined)[] {
  const valid = (r: RangeRow) => DATE.test(r.fromDate) && DATE.test(r.toDate) && r.toDate >= r.fromDate;
  return rows.map((a, i) => {
    if (!valid(a)) return undefined;
    const wa = windowOf(a);
    const j = rows.findIndex((b, k) => {
      if (k === i || !valid(b) || !(a.fromDate <= b.toDate && b.fromDate <= a.toDate)) return false;
      const wb = windowOf(b);
      return wa === null || wb === null || (wa[0] < wb[1] && wb[0] < wa[1]);
    });
    return j === -1 ? undefined : `Tento termín se překrývá s termínem ${j + 1}`;
  });
}

/** Server field keys are matched without case ("paymentMethod", "PaymentMethod"). */
export function fieldMessage(error: ClubOrderError | null, ...keys: string[]): string | undefined {
  if (error === null) return undefined;
  const wanted = keys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(error.fieldErrors)) {
    if (wanted.some((w) => k.toLowerCase() === w || k.toLowerCase().startsWith(`${w}[`) || k.toLowerCase().startsWith(`${w}.`)) && v.length > 0) return v.join(' ');
  }
  return undefined;
}
