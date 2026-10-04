/*
 * Pure helpers of the club-orders screens (Etapa 4, FE-O2): which terms an
 * order shows, the compact činnosti line, the status filter and its counts.
 * No price, no day count and no label that the server or the label maps do not own.
 */
import { ORDER_STATUSES } from '../../../api/clubOrders';
import type { ClubOrderStatus, ClubOrderView, ClubSummary, OrderRange } from '../../../api/clubOrders';
import { formatShortRange } from '../../../pages/clubs/clubOrders';

export type OrderStatusFilter = 'all' | ClubOrderStatus;

/** The terms an order stands on: the confirmed windows once it has them, otherwise what the club asked for. */
export function orderTerms(order: ClubOrderView): OrderRange[] {
  const live = order.blocks.filter((b) => b.status === 'Active');
  if ((order.status === 'Confirmed' || order.status === 'Completed') && live.length > 0) {
    return live.map((b) => ({ fromDate: b.fromDate, toDate: b.toDate, dailyFrom: b.dailyFrom, dailyTo: b.dailyTo }));
  }
  return order.requestedRanges;
}

export const rangeText = (r: OrderRange): string => {
  const days = r.fromDate === '' ? '—' : formatShortRange(r.fromDate, r.toDate === '' ? r.fromDate : r.toDate);
  return r.dailyFrom && r.dailyTo ? `${days}, ${r.dailyFrom}–${r.dailyTo}` : days;
};

/** The first term and how many more there are: "26. 10. 2026 +2". */
export function termsSummary(order: ClubOrderView): string {
  const terms = orderTerms(order);
  if (terms.length === 0) return '—';
  return terms.length === 1 ? rangeText(terms[0]) : `${rangeText(terms[0])} +${terms.length - 1}`;
}

/** "Prohlídka ×12 · Diagnostika ×60" */
export const activitiesLine = (order: ClubOrderView): string =>
  order.activitySeats.length === 0 ? '—' : order.activitySeats.map((a) => `${a.activityName} ×${a.seats}`).join(' · ');

export const seatPercent = (registered: number, seats: number): number => (seats > 0 ? Math.min(100, (registered / seats) * 100) : 0);

export function statusCounts(orders: readonly ClubOrderView[]): Record<OrderStatusFilter, number> {
  const counts = { all: orders.length } as Record<OrderStatusFilter, number>;
  for (const s of ORDER_STATUSES) counts[s] = orders.filter((o) => o.status === s).length;
  return counts;
}

/** Status and date-range filter (overlap with the order's terms); empty bounds do not filter. Newest first. */
export function filterOrders(orders: readonly ClubOrderView[], status: OrderStatusFilter, from: string, to: string): ClubOrderView[] {
  return orders
    .filter((o) => status === 'all' || o.status === status)
    .filter((o) => {
      if (from === '' && to === '') return true;
      const terms = orderTerms(o);
      if (terms.length === 0) return false;
      return terms.some((t) => (to === '' || t.fromDate <= to) && (from === '' || (t.toDate || t.fromDate) >= from));
    })
    .sort((a, b) => (b.createdAtUtc || '').localeCompare(a.createdAtUtc || ''));
}

export const STATUS_TONE: Record<ClubOrderStatus, 'beige' | 'blue' | 'green' | 'grey' | 'red'> = {
  Invited: 'beige',
  Requested: 'blue',
  Confirmed: 'green',
  Completed: 'grey',
  Cancelled: 'red',
};

export const minutesText = (n: number): string => `${Math.round(n).toLocaleString('cs-CZ')} min`;

/** What the summary needs even when the server leaves a field out. */
export function normalizeSummary(raw: ClubSummary): ClubSummary {
  const by = (raw.ordersByStatus ?? {}) as Partial<ClubSummary['ordersByStatus']>;
  const ordersByStatus = {} as ClubSummary['ordersByStatus'];
  for (const s of ORDER_STATUSES) ordersByStatus[s] = typeof by[s] === 'number' ? by[s] : 0;
  const totalSeats = raw.totalSeats ?? 0;
  const registered = raw.registered ?? 0;
  return {
    ...raw,
    totalSeats,
    registered,
    remaining: typeof raw.remaining === 'number' ? raw.remaining : Math.max(0, totalSeats - registered),
    byService: Array.isArray(raw.byService) ? raw.byService : [],
    byActivity: Array.isArray(raw.byActivity) ? raw.byActivity : [],
    ordersByStatus,
    bookedMinutes: raw.bookedMinutes ?? 0,
    usedMinutes: raw.usedMinutes ?? 0,
  };
}
