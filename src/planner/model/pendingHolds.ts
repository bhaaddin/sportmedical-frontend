/*
 * R22 - time that a club has been GIVEN but has not finished filling must show in the main calendar.
 *
 * Three states, three sources (owner: "we already gave them that day, so it has to show, even though they did not finish"):
 *   confirmed, players missing  a real club block exists; an older server sends no hold fields, so `enrichClubBlocks` completes them
 *                               from the club-order list (`blocks[].id` = the time block's `clubBlockId`) - flagged `holdDerived`.
 *   Requested                   the club chose days / ranges, no block: `pendingHoldBlocks` makes a stand-in block per open day.
 *   Invited                     the desk offered days: the same, lighter, and it only WARNS (the club may decline).
 * A staff draft (the unsaved planning of the club planner) is not an order and never a hold. A cancelled order never holds anything (R21).
 *
 * Pure, no DOM. The stand-ins are `kind: 'club'` TimeBlocks with `pendingHold` set, so every view that already draws club windows
 * (week / day board, month tile, phone agenda) draws them without a second code path.
 */
import type { TimeBlock } from '../../api/bookingContracts';
import type { ClubOrderView } from '../../api/clubOrders';
import { pragueWallClockToInstant } from '../../utils/time';
import { inquiryDaysOf } from './inquiries';

export type PendingKind = 'requested' | 'offered';

export interface PendingDay {
  day: string;
  kind: PendingKind;
  /** HH:mm the club asked for that day, or null = the whole opening time. */
  from: string | null;
  to: string | null;
}

const eachDay = (from: string, to: string): string[] => {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let i = 0; i < 62 && cursor <= end; i += 1) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
};

const minutes = (hhmm: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const clock = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** The days a Requested / Invited order holds, with the hours of a requested range when the club gave some. Cancelled and confirmed orders: none. */
export function pendingDaysOf(order: Pick<ClubOrderView, 'status' | 'offeredDates' | 'requestedDates' | 'requestedRanges'>): PendingDay[] {
  if (order.status !== 'Invited' && order.status !== 'Requested') return [];
  const kind: PendingKind = order.status === 'Invited' ? 'offered' : 'requested';
  const hours = new Map<string, { from: number; to: number } | 'all'>();
  if (kind === 'requested') {
    for (const d of order.requestedDates ?? []) hours.set(d, 'all');
    for (const r of order.requestedRanges ?? []) {
      if (!r.fromDate || r.toDate < r.fromDate) continue;
      const from = minutes(r.dailyFrom);
      const to = minutes(r.dailyTo);
      for (const d of eachDay(r.fromDate, r.toDate)) {
        const have = hours.get(d);
        if (from === null || to === null || to <= from || have === 'all') {
          hours.set(d, 'all');
        } else {
          hours.set(d, have ? { from: Math.min(have.from, from), to: Math.max(have.to, to) } : { from, to });
        }
      }
    }
  }
  return inquiryDaysOf(order).map((day) => {
    const h = hours.get(day);
    return { day, kind, from: h && h !== 'all' ? clock(h.from) : null, to: h && h !== 'all' ? clock(h.to) : null };
  });
}

export interface PendingCalendar {
  id: string;
  clinicServiceId: string | null;
}

export interface PendingInput {
  calendars: readonly PendingCalendar[];
  /** The opening hours of a calendar on a day, or null when it is closed. */
  hoursOf: (calendarId: string, day: string) => { from: string; to: string } | null;
  /** Only the days on screen. */
  days: readonly string[];
}

/** The stand-in blocks, by calendar, for the pending days of `orders` that fall on `input.days`. */
export function pendingHoldBlocks(orders: readonly ClubOrderView[], input: PendingInput): Map<string, TimeBlock[]> {
  const out = new Map<string, TimeBlock[]>();
  const onScreen = new Set(input.days);
  for (const order of orders) {
    for (const pending of pendingDaysOf(order)) {
      if (!onScreen.has(pending.day)) continue;
      for (const calendar of input.calendars) {
        if (order.serviceId && calendar.clinicServiceId !== order.serviceId) continue;
        const open = input.hoursOf(calendar.id, pending.day);
        if (!open) continue;
        const openFrom = minutes(open.from);
        const openTo = minutes(open.to);
        if (openFrom === null || openTo === null || openTo <= openFrom) continue;
        const asked = { from: minutes(pending.from), to: minutes(pending.to) };
        const start = Math.max(openFrom, asked.from ?? openFrom);
        const end = Math.min(openTo, asked.to ?? openTo);
        if (end <= start) continue;
        const list = out.get(calendar.id) ?? [];
        list.push({
          id: `hold:${order.id}:${pending.day}:${calendar.id}`,
          startUtc: pragueWallClockToInstant(pending.day, clock(start)).toISOString(),
          endUtc: pragueWallClockToInstant(pending.day, clock(end)).toISOString(),
          reason: order.clubName,
          kind: 'club',
          clubBlockId: `hold:${order.id}:${pending.day}`,
          clubId: order.clubId,
          clubName: order.clubName,
          colorHex: order.clubColorHex,
          clubOrderId: order.id,
          pendingHold: pending.kind,
        });
        out.set(calendar.id, list);
      }
    }
  }
  return out;
}

/**
 * Older servers send a club block with no order, seats or hold flags. The order list knows them: its `blocks[].id` is the block's
 * `clubBlockId`. Fills ONLY what is missing, and flags the result `holdDerived`. A block the list does not know is left as it came.
 */
export function enrichClubBlocks(blocks: readonly TimeBlock[], orders: readonly ClubOrderView[]): TimeBlock[] {
  if (orders.length === 0) return blocks as TimeBlock[];
  const byBlock = new Map<string, { order: ClubOrderView; seats: number; registered: number }>();
  for (const order of orders) {
    if (order.status === 'Cancelled') continue;
    for (const b of order.blocks ?? []) byBlock.set(b.id, { order, seats: b.seats, registered: b.registered });
  }
  return blocks.map((block) => {
    if (block.kind !== 'club' || !block.clubBlockId || block.pendingHold) return block;
    const hit = byBlock.get(block.clubBlockId);
    if (!hit) return block;
    const hasFlags = block.playersMissing != null || block.holdExpired != null || (typeof block.seats === 'number' && typeof block.registered === 'number');
    const next: TimeBlock = { ...block };
    if (!next.clubOrderId) next.clubOrderId = hit.order.id;
    if (!hasFlags && hit.seats > 0) {
      next.seats = hit.seats;
      next.registered = hit.registered;
      next.playersMissing = hit.registered < hit.seats;
      next.holdDerived = true;
    }
    return next;
  });
}
