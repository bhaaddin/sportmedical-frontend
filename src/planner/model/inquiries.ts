/*
 * "Poptávka": a club ORDER that blocks no time yet - Invited with the days the desk offered, Requested with the
 * days the club chose. The calendar marks those days so nothing is ever invisible; once the desk confirms the
 * order its blocks take over. Day level only (the windows of a request are not drawn).
 *
 * Pure: the order list in, a map by day out. The query that reads the orders is `useInquiries`.
 */
import type { ClubOrderView } from '../../api/clubOrders';
import { addDaysToDateOnly } from '../../utils/time';
import { allowedNames } from '../../components/clubs/order/routing';
import { routedActivities } from '../../components/clubs/orders/orderWindows';
import { PLANNER_TEXT } from '../text';

export interface InquiryRef {
  orderId: string;
  clubName: string;
  /** Invited: the days the desk offered; Requested: the days the club asked for. */
  kind: 'offered' | 'requested';
  /** The order the desk is processing right now: its days read "Klub žádá" instead of "Poptávka · club". */
  current: boolean;
  /** The činnosti this day is asked for when the requested period is restricted ("Spiroergometrie"); null = all. */
  only?: string | null;
}

type InquiryOrder = Pick<ClubOrderView, 'status' | 'offeredDates' | 'requestedDates' | 'requestedRanges'>;

const MAX_RANGE_DAYS = 62;

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  let day = from;
  for (let i = 0; i < MAX_RANGE_DAYS && day <= to; i += 1) {
    out.push(day);
    day = addDaysToDateOnly(day, 1);
  }
  return out;
}

/** The days one order asks for or offers (sorted, unique). Orders that already block time have none. */
export function inquiryDaysOf(order: InquiryOrder): string[] {
  const days = new Set<string>();
  if (order.status === 'Invited') {
    for (const d of order.offeredDates ?? []) days.add(d);
  } else if (order.status === 'Requested') {
    for (const d of order.requestedDates ?? []) days.add(d);
    for (const r of order.requestedRanges ?? []) {
      if (!r.fromDate || r.toDate < r.fromDate) continue;
      for (const d of eachDay(r.fromDate, r.toDate)) days.add(d);
    }
  }
  return [...days].sort();
}

/** Per day of a Requested order: the činnosti its periods are restricted to, null when any period of the day allows all. */
function restrictionByDay(order: ClubOrderView): Map<string, string | null> {
  const out = new Map<string, string | null>();
  if (order.status !== 'Requested') return out;
  const activities = routedActivities(order);
  for (const d of order.requestedDates ?? []) out.set(d, null);
  for (const r of order.requestedRanges ?? []) {
    if (!r.fromDate || r.toDate < r.fromDate) continue;
    const only = allowedNames(r.activityIds, activities);
    for (const day of eachDay(r.fromDate, r.toDate)) {
      const have = out.get(day);
      out.set(day, have === undefined ? only : have === null || only === null ? null : have.includes(only) ? have : `${have} + ${only}`);
    }
  }
  return out;
}

/** Every inquiry by day; `currentOrderId` marks the order being processed. */
export function inquiriesByDay(orders: readonly ClubOrderView[], currentOrderId?: string | null): Map<string, InquiryRef[]> {
  const map = new Map<string, InquiryRef[]>();
  for (const order of orders) {
    const kind = order.status === 'Invited' ? 'offered' : 'requested';
    const restricted = restrictionByDay(order);
    for (const day of inquiryDaysOf(order)) {
      const list = map.get(day) ?? [];
      list.push({ orderId: order.id, clubName: order.clubName, kind, current: order.id === currentOrderId, only: restricted.get(day) ?? null });
      map.set(day, list);
    }
  }
  return map;
}

export const inquiryLabel = (inquiry: InquiryRef): string =>
  `${inquiry.current ? PLANNER_TEXT.inquiry.current : PLANNER_TEXT.inquiry.label(inquiry.clubName)}${inquiry.only != null ? ` · ${inquiry.only}` : ''}`;

export const inquiryTitle = (inquiry: InquiryRef): string =>
  inquiry.kind === 'offered' ? PLANNER_TEXT.inquiry.offeredTitle(inquiry.clubName) : PLANNER_TEXT.inquiry.requestedTitle(inquiry.clubName);

/** One line for a tile: the clubs of a day, each once ("Poptávka · Dukla, Slavia"). */
export function inquiryTileLabel(inquiries: readonly InquiryRef[]): string {
  const clubs = [...new Set(inquiries.map((i) => i.clubName))];
  return PLANNER_TEXT.inquiry.label(clubs.join(', '));
}
