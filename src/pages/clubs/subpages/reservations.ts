/* Rezervace: one row per club window (block), joined with its order and the calendar names. Pure. */
import type { ClubBlockStatus, ClubBlockView } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { lineValueCzk, orderTotalCzk } from '../../../components/clubs/orders/orderMoney';
import { overlaps, type DateRange } from './range';

export interface ReservationRow {
  block: ClubBlockView;
  orderId: string | null;
  serviceName: string;
  activities: string[];
  calendars: string[];
  seats: number;
  registered: number;
  /** Etapa 12: the order's quoted total; null without an order or a quote. */
  orderTotalCzk: number | null;
  /** This window's own worth: its seats per činnost × the order's unit prices; null when a price is missing or the window has no per-činnost seats. */
  windowValueCzk: number | null;
}

/** The window's seats priced with the order's unit prices; null unless every činnost of the window has one. */
export function windowValue(block: Pick<ClubBlockView, 'activitySeats'>, order: Pick<ClubOrderView, 'activitySeats'> | null): number | null {
  const seats = block.activitySeats ?? [];
  if (order === null || seats.length === 0) return null;
  const values = seats.map((s) => lineValueCzk(s.seats, order.activitySeats.find((a) => a.activityId === s.activityId)?.unitPriceCzk ?? null));
  return values.some((v) => v === null) ? null : values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

export interface ReservationFilters {
  clubId: string; // '' = all
  status: '' | ClubBlockStatus;
  range: DateRange;
}

export function buildReservationRows(
  blocks: readonly ClubBlockView[],
  orders: readonly ClubOrderView[],
  calendarNames: ReadonlyMap<string, string>,
): ReservationRow[] {
  const orderOfBlock = new Map<string, ClubOrderView>();
  for (const o of orders) for (const b of o.blocks) orderOfBlock.set(b.id, o);
  return blocks.map((block) => {
    const order = orderOfBlock.get(block.id) ?? null;
    const fromSeats = (block.activitySeats ?? []).map((s) => s.activityName).filter((n) => n !== '');
    const fromOrder = order ? order.activitySeats.map((s) => s.activityName).filter((n) => n !== '') : [];
    const activities = fromSeats.length > 0 ? fromSeats : fromOrder;
    return {
      block,
      orderId: order?.id ?? null,
      serviceName: order?.serviceName ?? '',
      activities,
      calendars: (block.calendarIds ?? []).map((id) => calendarNames.get(id) ?? '').filter((n) => n !== ''),
      seats: block.seats > 0 ? block.seats : block.playerCount,
      registered: block.registered,
      orderTotalCzk: order === null ? null : orderTotalCzk(order),
      windowValueCzk: windowValue(block, order),
    };
  });
}

export function filterReservations(rows: readonly ReservationRow[], f: ReservationFilters): ReservationRow[] {
  return rows
    .filter(
      (r) =>
        (f.clubId === '' || r.block.clubId === f.clubId) &&
        (f.status === '' || r.block.status === f.status) &&
        overlaps(f.range, r.block.fromDate, r.block.toDate),
    )
    .sort((a, b) => a.block.fromDate.localeCompare(b.block.fromDate) || a.block.clubName.localeCompare(b.block.clubName, 'cs'));
}

/** "08:00–12:00", or "Celý den" when the block has no daily window. */
export function dailyWindow(block: Pick<ClubBlockView, 'dailyFrom' | 'dailyTo'>): string {
  return block.dailyFrom && block.dailyTo ? `${block.dailyFrom}–${block.dailyTo}` : 'Celý den';
}
