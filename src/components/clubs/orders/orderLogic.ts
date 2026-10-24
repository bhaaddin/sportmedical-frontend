/*
 * Pure helpers of the club-orders screens (Etapa 4, FE-O2): which terms an
 * order shows, the compact činnosti line, the status filter and its counts.
 * No price, no day count and no label that the server or the label maps do not own.
 */
import { ORDER_STATUSES } from '../../../api/clubOrders';
import type { ClubOrderStatus, ClubOrderView, ClubSummary, OrderRange } from '../../../api/clubOrders';
import { formatShortRange } from '../../../pages/clubs/clubOrders';
import { formatSeats, formatSeatsWithTotal } from '../panel/seats';
import { allowedNames } from '../order/routing';
import { routedActivities, type RoutedOrder } from './orderWindows';

export type OrderStatusFilter = 'all' | ClubOrderStatus;

/*
 * R21 (stage 7): the normal lists show LIVE orders only - Invited, Requested, Confirmed and Completed. A cancelled order
 * lives in the special "Historie" view (/clubs/objednavky/historie) and is still readable there and by a deep link.
 * These three are the ONE place that says which is which; every list and count that must not show a cancelled order
 * as live goes through them.
 */
export const isCancelledOrder = (order: Pick<ClubOrderView, 'status'>): boolean => order.status === 'Cancelled';

/** Everything but the cancelled orders. */
export const withoutCancelled = <T extends Pick<ClubOrderView, 'status'>>(orders: readonly T[]): T[] => orders.filter((o) => !isCancelledOrder(o));

/** Only the cancelled orders. */
export const onlyCancelled = <T extends Pick<ClubOrderView, 'status'>>(orders: readonly T[]): T[] => orders.filter(isCancelledOrder);

/**
 * When and why an order was cancelled, read from its own history (the list answers carry none): the newest entry that
 * speaks of a cancellation, else null. `text` is that entry's wording - the reason when the desk gave one.
 */
export function cancellationOf(history: readonly { atUtc: string; user: string; text: string }[] | undefined): { atUtc: string; user: string; text: string } | null {
  const entries = (history ?? []).filter((h) => /zru[sš]/i.test(h.text));
  if (entries.length === 0) return null;
  return [...entries].sort((a, b) => b.atUtc.localeCompare(a.atUtc))[0] ?? null;
}

/** The terms an order stands on: the confirmed windows once it has them, otherwise what the club asked for. */
export function orderTerms(order: ClubOrderView): OrderRange[] {
  const live = order.blocks.filter((b) => b.status === 'Active');
  if ((order.status === 'Confirmed' || order.status === 'Completed') && live.length > 0) {
    return live.map((b) => ({ fromDate: b.fromDate, toDate: b.toDate, dailyFrom: b.dailyFrom, dailyTo: b.dailyTo }));
  }
  return order.requestedRanges;
}

/** "26. 10. 2026, 08:00–12:00", and " · Spiroergometrie" when the period allows only some činnosti of `order`. */
export const rangeText = (r: OrderRange, order?: RoutedOrder): string => {
  const days = r.fromDate === '' ? '—' : formatShortRange(r.fromDate, r.toDate === '' ? r.fromDate : r.toDate);
  const base = r.dailyFrom && r.dailyTo ? `${days}, ${r.dailyFrom}–${r.dailyTo}` : days;
  const only = order === undefined ? null : allowedNames(r.activityIds, routedActivities(order));
  return only === null ? base : `${base} · ${only}`;
};

/** The first term and how many more there are: "26. 10. 2026 +2". */
export function termsSummary(order: ClubOrderView): string {
  const terms = orderTerms(order);
  if (terms.length === 0) return '—';
  return terms.length === 1 ? rangeText(terms[0]) : `${rangeText(terms[0])} +${terms.length - 1}`;
}

/** "Základní 10 · Komplexní 10" */
export const activitiesLine = (order: ClubOrderView): string => formatSeats(order.activitySeats);

/** "Základní 4/10 · Komplexní 0/10" - the same with the registrations. */
export const registeredLine = (order: ClubOrderView): string => formatSeats(order.activitySeats.map((a) => ({ activityName: a.activityName, seats: a.seats, registered: a.registered })));

/** "Základní 10 · Komplexní 10 (20 hráčů)" */
export const seatsWithTotal = (order: ClubOrderView): string => formatSeatsWithTotal(order.activitySeats);

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
  /* The server counts under camelCase keys (`confirmed`); the client's statuses are capitalised (`Confirmed`): read both. */
  const by = (raw.ordersByStatus ?? {}) as Partial<ClubSummary['ordersByStatus']> & Record<string, number | undefined>;
  const ordersByStatus = {} as ClubSummary['ordersByStatus'];
  for (const s of ORDER_STATUSES) {
    const n = by[s] ?? by[s.charAt(0).toLowerCase() + s.slice(1)];
    ordersByStatus[s] = typeof n === 'number' ? n : 0;
  }
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

/** "+1 dodatek" / "+2 dodatky" / "+5 dodatků": the small chip on a group's root in the lists; '' when there is none. */
export function addendaLabel(count: number): string {
  if (count <= 0) return '';
  return `+${count} ${count === 1 ? 'dodatek' : count < 5 ? 'dodatky' : 'dodatků'}`;
}

/** The chip an order row carries: its addenda count on a root, "Dodatek" on an addendum, '' on a lone order. */
export const groupChip = (o: ClubOrderView): string => (o.parentOrderId !== null ? 'Dodatek' : addendaLabel(o.addenda.length));

const playersWord = (n: number): string => (n === 1 ? 'hráč' : n >= 2 && n <= 4 ? 'hráči' : 'hráčů');

/**
 * R10 (S-4): the one sentence the order's detail opens with - what the desk does next with this order. `null` when nothing
 * waits on the desk (a cancelled order, a finished and billed one, one paid per person). Short Czech, one idea.
 */
export function nextStepOf(order: Pick<ClubOrderView, 'status' | 'registered' | 'totalSeats' | 'paymentMethod' | 'invoiceId'>): string | null {
  const unbilled = order.paymentMethod === 'ClubInvoice' && order.invoiceId === null;
  switch (order.status) {
    case 'Invited':
      return 'Čeká se na klub. Pošlete mu odkaz na formulář (Odkazy pro klub).';
    case 'Requested':
      return 'Klub poslal poptávku. Zpracujte ji a potvrďte termíny.';
    case 'Confirmed': {
      const missing = Math.max(0, order.totalSeats - order.registered);
      if (missing > 0) return `Chybí ${missing} ${playersWord(missing)}. Pošlete klubu odkaz pro hráče.`;
      return unbilled ? 'Všichni jsou zapsaní. Vystavte fakturu klubu.' : null;
    }
    case 'Completed':
      return unbilled ? 'Hotovo. Zbývá vystavit fakturu klubu.' : null;
    default:
      return null;
  }
}
