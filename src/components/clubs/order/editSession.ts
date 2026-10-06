/*
 * Pick mode on an EXISTING order (Etapa 10): the session that prefills the calendar with the order's windows, and
 * the merge that adds a new pick session into a club's live order of the same služba ("Přidat do té objednávky").
 * Pure: the catalogue of činnosti is passed in.
 */
import type { BlockableActivity } from '../../../api/clubBlocks';
import type { ClubOrderView, OrderActivitySeats } from '../../../api/clubOrders';
import { orderWindows, windowRange } from '../orders/orderWindows';
import type { CoverageActivity } from './coverage';
import type { EditBlockRef, PickSession } from './pickSession';

/** The order's live windows as the calendar knows them (one calendar each). */
export function editBlockRefs(order: Pick<ClubOrderView, 'blocks'> & Partial<Pick<ClubOrderView, 'activitySeats' | 'requestedRanges'>>): EditBlockRef[] {
  return orderWindows(order).flatMap((b) =>
    b.calendarIds[0] === undefined ? [] : [{ id: b.id, calendarId: b.calendarIds[0], range: windowRange(b, order) }],
  );
}

/** The first window that is not over, else the first one: where the calendar opens. */
export function firstWindowDate(blocks: readonly EditBlockRef[], today: string): string | null {
  const dates = blocks.map((b) => b.range.fromDate).filter((d) => d !== '').sort();
  return dates.find((d) => d >= today) ?? dates[0] ?? null;
}

/** One činnost of an order as the calculator reads it (its minutes and parallel capacity come from the catalogue). */
export function coverageActivity(
  seat: Pick<OrderActivitySeats, 'activityId' | 'activityName' | 'durationMinutes'> & { seats: number },
  catalogue: readonly BlockableActivity[],
): CoverageActivity {
  const known = catalogue.find((a) => a.id === seat.activityId);
  return {
    activityId: seat.activityId,
    name: seat.activityName,
    seats: seat.seats,
    minutesPerSeat: seat.durationMinutes > 0 ? seat.durationMinutes : (known?.durationMinutes ?? 0),
    parallelCapacity: Math.max(1, known?.parallelCapacity ?? 1),
  };
}

/** The calendar in pick mode, prefilled with every current window of the order. `activities` default to the order's own. */
export function editSessionFor(
  order: ClubOrderView,
  catalogue: readonly BlockableActivity[],
  today: string,
  activities?: CoverageActivity[],
): PickSession {
  const blocks = editBlockRefs(order);
  const saved = order.activitySeats.map((s) => coverageActivity(s, catalogue));
  const changed = activities !== undefined && JSON.stringify(activities.map((a) => [a.activityId, a.seats])) !== JSON.stringify(saved.map((a) => [a.activityId, a.seats]));
  return {
    clubId: order.clubId,
    clubName: order.clubName,
    serviceId: order.serviceId ?? '',
    serviceName: order.serviceName,
    activities: activities ?? order.activitySeats.map((s) => coverageActivity(s, catalogue)),
    paymentMethod: order.paymentMethod ?? 'ClubInvoice',
    note: order.note,
    editOrder: {
      mode: 'edit', orderId: order.id, dirty: false, requested: [], blocks, firstDate: firstWindowDate(blocks, today),
      ...(changed ? { baseline: saved } : {}),
    },
  };
}

/**
 * The new picks join the order that already exists: its činnosti stay, the new players are added on top (the same
 * činnost sums up). The result is an edit session of that order; the caller adds the new picks to its windows.
 */
export function mergeSessionInto(order: ClubOrderView, added: PickSession, catalogue: readonly BlockableActivity[], today: string): PickSession {
  const merged = new Map<string, CoverageActivity>();
  for (const s of order.activitySeats) merged.set(s.activityId, coverageActivity(s, catalogue));
  for (const a of added.activities) {
    const have = merged.get(a.activityId);
    merged.set(a.activityId, have === undefined ? a : { ...have, seats: have.seats + a.seats });
  }
  const base = editSessionFor(order, catalogue, today, [...merged.values()]);
  return base.editOrder === undefined ? base : { ...base, editOrder: { ...base.editOrder, dirty: true } };
}
