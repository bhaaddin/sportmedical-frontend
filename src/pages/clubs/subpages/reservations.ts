/* Rezervace: one row per club window (block), joined with its order and the calendar names. Pure. */
import type { ClubBlockStatus, ClubBlockView } from '../../../api/clubBlocks';
import type { ClubOrderView } from '../../../api/clubOrders';
import { overlaps, type DateRange } from './range';

export interface ReservationRow {
  block: ClubBlockView;
  orderId: string | null;
  serviceName: string;
  activities: string[];
  calendars: string[];
  seats: number;
  registered: number;
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
