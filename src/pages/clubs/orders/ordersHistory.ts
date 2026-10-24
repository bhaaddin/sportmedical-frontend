/*
 * Kluby > Objednávky > Historie (R21): the pure part of the special view of CANCELLED club orders - which orders it lists
 * and how the search, the club and the cancelled-date filters narrow them. No fetching here; the page hands in the
 * orders and what it knows about when each was cancelled.
 */
import type { ClubOrderView } from '../../../api/clubOrders';
import { orderCode } from '../../../components/clubs/order/orderFormat';
import { onlyCancelled } from '../../../components/clubs/orders/orderLogic';

export interface HistoryFilters {
  /** Club name or order code, accent-insensitive. */
  search: string;
  clubId: string;
  /** Cancelled on or after / on or before (yyyy-MM-dd, Prague day); '' = no bound. */
  from: string;
  to: string;
}

/** What is known about one cancellation: when (an instant, or null when the order's history says nothing) and the entry's words. */
export interface CancellationInfo {
  atUtc: string | null;
  text: string | null;
}

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * The cancelled orders that pass the filters, the most recently cancelled first (an order whose date is unknown after the
 * ones that have one, newest created first). A date filter keeps only orders whose cancelled day is known and inside it.
 * `dayKey` turns an instant into its Prague day (yyyy-MM-dd).
 */
export function historyRows(
  orders: readonly ClubOrderView[],
  filters: HistoryFilters,
  info: ReadonlyMap<string, CancellationInfo>,
  dayKey: (instant: string) => string,
): ClubOrderView[] {
  const q = fold(filters.search);
  const dated = filters.from !== '' || filters.to !== '';
  return onlyCancelled(orders)
    .filter((o) => filters.clubId === '' || o.clubId === filters.clubId)
    .filter((o) => q === '' || fold(o.clubName).includes(q) || fold(orderCode(o.id)).includes(q) || fold(orderCode(o.groupId || o.id)).includes(q))
    .filter((o) => {
      if (!dated) return true;
      const at = info.get(o.id)?.atUtc ?? null;
      if (at === null) return false;
      const day = dayKey(at);
      return (filters.from === '' || day >= filters.from) && (filters.to === '' || day <= filters.to);
    })
    .sort((a, b) => {
      const ta = info.get(a.id)?.atUtc ?? '';
      const tb = info.get(b.id)?.atUtc ?? '';
      return tb.localeCompare(ta) || (b.createdAtUtc || '').localeCompare(a.createdAtUtc || '') || a.id.localeCompare(b.id);
    });
}
