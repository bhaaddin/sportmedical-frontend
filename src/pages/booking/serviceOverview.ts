/*
 * Přehled podle služeb - the numbers behind the screen, without a browser.
 *
 * ── Where every number comes from ──
 *
 * Nothing here is computed from working hours or activity lengths (6.1). Each
 * column is one endpoint's answer, regrouped:
 *
 *   termíny   GET /api/day?from&to&calendarIds        (4.5)  the rows the grid draws
 *   kdo       GET …/preview?from&to                    (4.2)  whom the rota resolves
 *                                                             to on that calendar-day
 *   volno     GET …/availability?activityId&from&to    (4.4)  the starts the booking
 *                                                             dialog would offer
 *
 * An appointment row carries no worker (4.5). "Kdo" is therefore the rota's
 * answer for the calendar and the Prague date the appointment falls on - the
 * same answer the server uses when it decides whose day a booking takes.
 *
 * ── What "volno" is and is not ──
 *
 * It is the count of starts the server offers, and the days they fall on. It
 * is NOT a number of patients: a sixty-minute činnost in a free afternoon is
 * offered at every display step, and those starts overlap. The day summary
 * (4.6) refuses to turn minutes into places for the same reason, and this
 * screen does not divide anything either.
 */
import {
  statusTally,
  type Activity,
  type AvailabilitySlot,
  type DayAppointment,
  type PreviewDay,
} from '../../api/bookingContracts';
import type { ClinicService } from '../../api/clinicServices';
import { formatCzk } from '../../components/clubs/order/orderFormat';
import { dayOfWeekOf, pragueDateKey } from '../../utils/time';

export interface CalendarPreview {
  calendarId: string;
  days: readonly PreviewDay[];
}

export interface Worker {
  id: string;
  name: string;
}

/** `calendarId|yyyy-MM-dd` - one day of one calendar. */
const dayKey = (calendarId: string, date: string): string => `${calendarId}|${date}`;

const workerOf = (day: PreviewDay): Worker | null =>
  day.workerUserId
    ? { id: day.workerUserId, name: day.workerDisplayName ?? day.workerUserId }
    : null;

/** Who the rota puts on each calendar-day; `null` where the day names nobody. */
export type WorkerIndex = ReadonlyMap<string, Worker | null>;

export function workerIndex(previews: readonly CalendarPreview[]): WorkerIndex {
  const index = new Map<string, Worker | null>();

  for (const { calendarId, days } of previews) {
    for (const day of days) {
      index.set(dayKey(calendarId, day.date), workerOf(day));
    }
  }

  return index;
}

/**
 * Everybody the rota names on an open day of the range, once each, by name.
 *
 * This is the employee filter's list. It is not the account list: somebody
 * with a login and no day on any calendar in the range has nothing here to
 * be filtered to, and offering them would be a row that is always empty.
 */
export function workersInRange(previews: readonly CalendarPreview[]): Worker[] {
  const byId = new Map<string, Worker>();

  for (const { days } of previews) {
    for (const day of days) {
      const worker = day.isOpen ? workerOf(day) : null;
      if (worker && !byId.has(worker.id)) byId.set(worker.id, worker);
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

export interface OfferedPair {
  calendarId: string;
  activityId: string;
}

/**
 * Which činnost which calendar offers on at least one open day of the range -
 * exactly the pairs worth asking availability about, and no others. The
 * preview says it per day (`offeredActivityIds`), so no calendar-to-service
 * mapping is repeated here.
 */
export function offeredPairs(previews: readonly CalendarPreview[]): OfferedPair[] {
  const pairs: OfferedPair[] = [];
  const seen = new Set<string>();

  for (const { calendarId, days } of previews) {
    for (const day of days) {
      if (!day.isOpen) continue;
      for (const activityId of day.offeredActivityIds) {
        const key = dayKey(calendarId, activityId);
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ calendarId, activityId });
      }
    }
  }

  return pairs;
}

/** One availability answer, remembered with the question it answered. */
export interface OfferedStarts extends OfferedPair {
  slots: readonly AvailabilitySlot[];
}

export interface OverviewFilter {
  /** `null` is everybody. */
  workerId: string | null;
  /** `null` is every service. */
  serviceId: string | null;
}

export interface OverviewAppointment {
  id: string;
  calendarId: string | null;
  startUtc: string;
  endUtc: string;
  status: number;
  worker: Worker | null;
}

export interface OverviewRow {
  activityId: string;
  activityName: string;
  /** `null` for an činnost the catalogue no longer lists; its appointments still happened. */
  activity: Activity | null;
  service: ClinicService | null;
  /** Appointments that will happen or did: scheduled, confirmed, arrived, completed. */
  booked: number;
  cancelled: number;
  noShow: number;
  /** `booked`, by Prague weekday; index 0 is Sunday, as the API numbers it. */
  byWeekday: number[];
  byWorker: { worker: Worker | null; count: number }[];
  byCalendar: { calendarId: string; count: number }[];
  /** Starts the booking dialog would offer, and the distinct Prague dates they fall on. */
  freeStarts: number;
  freeDates: string[];
  freeByCalendar: { calendarId: string; starts: number; dates: string[] }[];
  /** Every appointment of the range, cancelled ones included (6.6), by time. */
  appointments: OverviewAppointment[];
}

export interface OverviewInput {
  activities: readonly Activity[];
  services: readonly ClinicService[];
  appointments: readonly DayAppointment[];
  previews: readonly CalendarPreview[];
  offered: readonly OfferedStarts[];
  filter: OverviewFilter;
}

const NOBODY = '';

export function buildOverview(input: OverviewInput): OverviewRow[] {
  const workers = workerIndex(input.previews);
  const serviceById = new Map(input.services.map((service) => [service.id, service]));
  const activityById = new Map(input.activities.map((activity) => [activity.id, activity]));
  const rows = new Map<string, OverviewRow>();

  const serviceOf = (activity: Activity | null): ClinicService | null =>
    activity?.clinicServiceId ? (serviceById.get(activity.clinicServiceId) ?? null) : null;

  const passesService = (activity: Activity | null): boolean =>
    input.filter.serviceId === null || activity?.clinicServiceId === input.filter.serviceId;

  const passesWorker = (worker: Worker | null): boolean =>
    input.filter.workerId === null || worker?.id === input.filter.workerId;

  const rowFor = (activityId: string, name: string): OverviewRow | null => {
    const activity = activityById.get(activityId) ?? null;
    if (!passesService(activity)) return null;

    let row = rows.get(activityId);
    if (!row) {
      row = {
        activityId,
        activityName: activity?.name ?? name,
        activity,
        service: serviceOf(activity),
        booked: 0,
        cancelled: 0,
        noShow: 0,
        byWeekday: [0, 0, 0, 0, 0, 0, 0],
        byWorker: [],
        byCalendar: [],
        freeStarts: 0,
        freeDates: [],
        freeByCalendar: [],
        appointments: [],
      };
      rows.set(activityId, row);
    }
    return row;
  };

  /* ── Termíny ── */

  const workerCounts = new Map<string, Map<string, { worker: Worker | null; count: number }>>();
  const calendarCounts = new Map<string, Map<string, number>>();

  for (const appointment of input.appointments) {
    const date = pragueDateKey(appointment.startUtc);
    const worker =
      appointment.calendarId === null
        ? null
        : (workers.get(dayKey(appointment.calendarId, date)) ?? null);
    if (!passesWorker(worker)) continue;

    const row = rowFor(appointment.activityId, appointment.activityName);
    if (!row) continue;

    row.appointments.push({
      id: appointment.id,
      calendarId: appointment.calendarId,
      startUtc: appointment.startUtc,
      endUtc: appointment.endUtc,
      status: appointment.status,
      worker,
    });

    switch (statusTally(appointment.status)) {
      case 'booked':
      case 'arrived': {
        row.booked += 1;
        row.byWeekday[dayOfWeekOf(date)] += 1;

        const perWorker = workerCounts.get(row.activityId) ?? new Map();
        workerCounts.set(row.activityId, perWorker);
        const workerKey = worker?.id ?? NOBODY;
        const tally = perWorker.get(workerKey) ?? { worker, count: 0 };
        tally.count += 1;
        perWorker.set(workerKey, tally);

        if (appointment.calendarId !== null) {
          const perCalendar = calendarCounts.get(row.activityId) ?? new Map();
          calendarCounts.set(row.activityId, perCalendar);
          perCalendar.set(
            appointment.calendarId,
            (perCalendar.get(appointment.calendarId) ?? 0) + 1,
          );
        }
        break;
      }
      case 'cancelled':
        row.cancelled += 1;
        break;
      case 'noShow':
        row.noShow += 1;
        break;
      default:
        // An unknown status counts towards nothing, and is still listed.
        break;
    }
  }

  /* ── Volno ── */

  for (const { calendarId, activityId, slots } of input.offered) {
    const dates = new Set<string>();
    let starts = 0;

    for (const slot of slots) {
      const date = pragueDateKey(slot.startUtc);
      if (!passesWorker(workers.get(dayKey(calendarId, date)) ?? null)) continue;
      starts += 1;
      dates.add(date);
    }

    if (starts === 0) continue;

    const activity = activityById.get(activityId) ?? null;
    const row = rowFor(activityId, activity?.name ?? activityId);
    if (!row) continue;

    row.freeStarts += starts;
    row.freeByCalendar.push({ calendarId, starts, dates: [...dates].sort() });
    for (const date of dates) {
      if (!row.freeDates.includes(date)) row.freeDates.push(date);
    }
  }

  /* ── Order and finish ── */

  const finished = [...rows.values()].map((row) => {
    const byWorker = [...(workerCounts.get(row.activityId)?.values() ?? [])].sort(
      (a, b) =>
        b.count - a.count ||
        (a.worker?.name ?? '').localeCompare(b.worker?.name ?? '', 'cs'),
    );
    const byCalendar = [...(calendarCounts.get(row.activityId)?.entries() ?? [])]
      .map(([calendarId, count]) => ({ calendarId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      ...row,
      byWorker,
      byCalendar,
      freeDates: [...row.freeDates].sort(),
      appointments: [...row.appointments].sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    };
  });

  return finished.sort(compareRows);
}

/** Services in the owner's order, an činnost without one last; then činnosti in theirs. */
function compareRows(a: OverviewRow, b: OverviewRow): number {
  const serviceA = a.service?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const serviceB = b.service?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (serviceA !== serviceB) return serviceA - serviceB;

  const serviceName = (a.service?.name ?? '').localeCompare(b.service?.name ?? '', 'cs');
  if (serviceName !== 0) return serviceName;

  const orderA = a.activity?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.activity?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) return orderA - orderB;

  return a.activityName.localeCompare(b.activityName, 'cs');
}

export interface OverviewTotals {
  booked: number;
  freeStarts: number;
  freeDays: number;
}

/** The line above the table. `freeDays` is a union, not a sum: two činnosti free on Tuesday is one Tuesday. */
export function overviewTotals(rows: readonly OverviewRow[]): OverviewTotals {
  const dates = new Set<string>();
  let booked = 0;
  let freeStarts = 0;

  for (const row of rows) {
    booked += row.booked;
    freeStarts += row.freeStarts;
    for (const date of row.freeDates) dates.add(date);
  }

  return { booked, freeStarts, freeDays: dates.size };
}

/* ── Prices beside a služba ──
 *
 * "Ceny doplnit všude" (10. 10. 2026): wherever a služba is named, its price
 * stands next to it. A služba has no price of its own; its činnosti do, each
 * through its price-list link (`priceCzk`, null when unlinked). So the služba
 * shows the lowest of them - "od 1 200 Kč" - or the one price when they all
 * agree, and "bez ceny" when none of its činnosti is priced. The figure is
 * read, never computed from anything else; nothing here knows a number.
 */

export const NO_PRICE_TEXT = 'bez ceny';

export interface ServicePriceLine {
  activityId: string;
  activityName: string;
  /** `null` when the činnost has no price-list link. */
  priceCzk: number | null;
}

export interface ServicePriceRange {
  /** The lowest price among the priced činnosti; `null` when none is priced. */
  min: number | null;
  /** The highest; equal to `min` when every priced činnost costs the same. */
  max: number | null;
  /** Every active činnost of the služba in the owner's order, priced or not. */
  lines: ServicePriceLine[];
}

type PricedActivity = Pick<Activity, 'id' | 'name' | 'clinicServiceId' | 'priceCzk' | 'sortOrder' | 'isActive'>;

/** The prices of one služba's active činnosti, in the owner's order. */
export function servicePriceRange(activities: readonly PricedActivity[], serviceId: string): ServicePriceRange {
  const lines = activities
    .filter((a) => a.isActive && a.clinicServiceId === serviceId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'))
    .map((a) => ({
      activityId: a.id,
      activityName: a.name,
      priceCzk: typeof a.priceCzk === 'number' && Number.isFinite(a.priceCzk) ? a.priceCzk : null,
    }));
  const prices = lines.map((l) => l.priceCzk).filter((p): p is number => p !== null);
  return {
    min: prices.length === 0 ? null : Math.min(...prices),
    max: prices.length === 0 ? null : Math.max(...prices),
    lines,
  };
}

/** "od 1 200 Kč" when the činnosti differ, "1 200 Kč" when they agree, "bez ceny" when none is priced. */
export function priceRangeText(range: Pick<ServicePriceRange, 'min' | 'max'>): string {
  if (range.min === null || range.max === null) return NO_PRICE_TEXT;
  return range.min === range.max ? formatCzk(range.min) : `od ${formatCzk(range.min)}`;
}

/** "Základní · 1 200 Kč" per činnost, one per line - the legend's tooltip; empty when the služba has no činnost. */
export function priceTooltip(range: Pick<ServicePriceRange, 'lines'>): string {
  return range.lines
    .map((l) => `${l.activityName} · ${l.priceCzk === null ? NO_PRICE_TEXT : formatCzk(l.priceCzk)}`)
    .join('\n');
}

/** Rows under their service heading, in row order; the heading is `null` for činnosti without one. */
export function groupByService(
  rows: readonly OverviewRow[],
): { service: ClinicService | null; rows: OverviewRow[] }[] {
  const groups: { service: ClinicService | null; rows: OverviewRow[] }[] = [];

  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && (last.service?.id ?? null) === (row.service?.id ?? null)) {
      last.rows.push(row);
    } else {
      groups.push({ service: row.service, rows: [row] });
    }
  }

  return groups;
}
