/*
 * The pure part of the club-order flow: ranges <-> rows, the seat payloads, and which
 * range a server refusal belongs to. No React, no network, nothing about a clinic's services or prices.
 */
import type { ClubOrderView, OrderRange } from '../../../api/clubOrders';
import { ClubOrderError } from '../../../api/clubOrders';
import { windowRange } from '../orders/orderWindows';
import { parsePlayerCount } from '../blockLogic';
import type { RangeRow } from '../blockLogic';

let seq = 0;
export const newOrderRowKey = (): string => `order-row-${++seq}`;

export const emptyRow = (over: Partial<RangeRow> = {}): RangeRow => ({ key: newOrderRowKey(), fromDate: '', toDate: '', dailyFrom: '', dailyTo: '', ...over });

export const rowFromRange = (r: OrderRange): RangeRow =>
  emptyRow({ fromDate: r.fromDate, toDate: r.toDate || r.fromDate, dailyFrom: r.dailyFrom ?? '', dailyTo: r.dailyTo ?? '' });

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

/** "+1" / "-1" on the typed value (an empty or invalid field counts as 0); never below 0. */
export function stepSeats(text: string, delta: number): string {
  const current = parsePlayerCount(text) ?? 0;
  return String(Math.max(0, current + delta));
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
      out.push(windowRange(b, order));
    }
    return out;
  }
  return order.requestedRanges;
}

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

/** Server field keys are matched without case ("paymentMethod", "PaymentMethod"). */
export function fieldMessage(error: ClubOrderError | null, ...keys: string[]): string | undefined {
  if (error === null) return undefined;
  const wanted = keys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(error.fieldErrors)) {
    if (wanted.some((w) => k.toLowerCase() === w || k.toLowerCase().startsWith(`${w}[`) || k.toLowerCase().startsWith(`${w}.`)) && v.length > 0) return v.join(' ');
  }
  return undefined;
}
