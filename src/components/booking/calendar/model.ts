import type { Activity, Calendar, DayAppointment, PreviewDay } from "../../../api/bookingContracts";
import { statusTally } from "../../../api/bookingContracts";
import { addDaysToDateOnly, dayOfWeekOf, pragueDateKey, type DateOnly } from "../../../utils/time";
import { parseTimeOfDay, spanOnDay, type MinuteRange } from "../grid/timeRange";

/*
 * What the calendar knows about činnosti and services, and the pure
 * arithmetic that turns it into columns, lanes, counts and ranges.
 *
 * Nothing here draws. Everything the owner can change - which činnosti a
 * calendar offers, their colours, their services - arrives through the API
 * (contract C1) and is only arranged here; there is no colour, name or
 * capacity written into this file.
 */

/* ── The catalogue: činnosti and services with their colours ── */

export interface ActivityInfo {
  id: string;
  name: string;
  serviceId: string | null;
  /** C1 `effectiveColorHex`, then `colorHex`; `null` when the server sent neither. */
  colorHex: string | null;
  sortOrder: number;
  durationMinutes: number;
  /** How many bookings may run at the same time (C1 `parallelCapacity`, default 1). */
  parallelCapacity: number;
  isActive: boolean;
}

export interface ServiceInfo {
  id: string;
  name: string;
  /** C1 `colorHex` of the služba; `null` when the server did not send one. */
  colorHex: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Catalogue {
  activities: ReadonlyMap<string, ActivityInfo>;
  services: ReadonlyMap<string, ServiceInfo>;
}

export const EMPTY_CATALOGUE: Catalogue = { activities: new Map(), services: new Map() };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A `#RRGGBB` or `null` - anything else is treated as "no colour sent". */
export function cleanHex(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return HEX.test(v) ? v : null;
}

export function activityInfoOf(activity: Activity): ActivityInfo {
  return {
    id: activity.id,
    name: activity.name,
    serviceId: activity.clinicServiceId,
    colorHex: cleanHex(activity.effectiveColorHex) ?? cleanHex(activity.colorHex),
    sortOrder: activity.sortOrder,
    durationMinutes: activity.durationMinutes,
    parallelCapacity: activity.parallelCapacity && activity.parallelCapacity > 0 ? activity.parallelCapacity : 1,
    isActive: activity.isActive,
  };
}

/**
 * The colour a činnost is drawn in: its own effective colour, then its
 * service's, then whatever the caller falls back to (the calendar's colour).
 */
export function colourOfActivity(
  catalogue: Catalogue,
  activityId: string | null | undefined,
  fallback: string,
): string {
  const activity = activityId ? catalogue.activities.get(activityId) : undefined;
  if (activity?.colorHex) return activity.colorHex;
  const service = activity?.serviceId ? catalogue.services.get(activity.serviceId) : undefined;
  return service?.colorHex ?? cleanHex(fallback) ?? fallback;
}

/** The služba an appointment belongs to: through its činnost, else its calendar's. */
export function serviceIdOfAppointment(
  appointment: Pick<DayAppointment, "activityId">,
  calendar: Pick<Calendar, "clinicServiceId"> | undefined,
  catalogue: Catalogue,
): string | null {
  return catalogue.activities.get(appointment.activityId)?.serviceId ?? calendar?.clinicServiceId ?? null;
}

/** Whether a service passes the legend's filter (`null` = every service). */
export function passesService(serviceId: string | null, filter: ReadonlySet<string> | null): boolean {
  return filter === null || serviceId === null || filter.has(serviceId);
}

/* ── Columns: one per činnost, grouped by calendar ── */

export interface ColumnSpec {
  /** `calendarId` for a plain calendar column, `calendarId:activityId` for a činnost. */
  key: string;
  calendarId: string;
  activityId: string | null;
  title: string;
  colorHex: string;
  serviceId: string | null;
  /** How many bookings may run side by side in this column. */
  capacity: number;
}

export function buildColumns(input: {
  calendars: readonly Calendar[];
  catalogue: Catalogue;
  previewByCalendar: ReadonlyMap<string, ReadonlyMap<string, PreviewDay>>;
  days: readonly DateOnly[];
  appointments: readonly DayAppointment[];
  serviceFilter: ReadonlySet<string> | null;
}): ColumnSpec[] {
  const { calendars, catalogue, previewByCalendar, days, appointments, serviceFilter } = input;
  const columns: ColumnSpec[] = [];

  for (const calendar of calendars) {
    const ids = new Set<string>();
    for (const day of days) {
      for (const id of previewByCalendar.get(calendar.id)?.get(day)?.offeredActivityIds ?? []) {
        const info = catalogue.activities.get(id);
        if (info?.isActive) ids.add(id);
      }
    }
    /* A booking on a činnost the calendar no longer offers still needs its column. */
    const orphanNames = new Map<string, string>();
    for (const a of appointments) {
      if (a.calendarId !== calendar.id || statusTally(a.status) === "cancelled") continue;
      if (!ids.has(a.activityId)) {
        ids.add(a.activityId);
        if (!catalogue.activities.has(a.activityId)) orphanNames.set(a.activityId, a.activityName);
      }
    }

    if (ids.size === 0) {
      if (passesService(calendar.clinicServiceId, serviceFilter)) {
        columns.push({
          key: calendar.id,
          calendarId: calendar.id,
          activityId: null,
          title: calendar.name,
          colorHex: calendar.color,
          serviceId: calendar.clinicServiceId,
          capacity: 1,
        });
      }
      continue;
    }

    const ordered = [...ids].sort((a, b) => {
      const ia = catalogue.activities.get(a);
      const ib = catalogue.activities.get(b);
      return (
        (ia?.sortOrder ?? 9999) - (ib?.sortOrder ?? 9999) ||
        (ia?.name ?? orphanNames.get(a) ?? "").localeCompare(ib?.name ?? orphanNames.get(b) ?? "", "cs")
      );
    });
    for (const id of ordered) {
      const info = catalogue.activities.get(id);
      const serviceId = info?.serviceId ?? calendar.clinicServiceId;
      if (!passesService(serviceId, serviceFilter)) continue;
      columns.push({
        key: `${calendar.id}:${id}`,
        calendarId: calendar.id,
        activityId: id,
        title: info?.name ?? orphanNames.get(id) ?? calendar.name,
        colorHex: colourOfActivity(catalogue, id, calendar.color),
        serviceId,
        capacity: info?.parallelCapacity ?? 1,
      });
    }
  }
  return columns;
}

/** Whether a column carries a booking: by činnost for a činnost column, any for a calendar one. */
export function appointmentInColumn(column: ColumnSpec, appointment: Pick<DayAppointment, "calendarId" | "activityId">): boolean {
  if (appointment.calendarId !== column.calendarId) return false;
  return column.activityId === null || column.activityId === appointment.activityId;
}

/**
 * "odpoledne volno" under a činnost's header: it has bookings, the calendar
 * works into the afternoon, and none of those bookings reaches 12:00. A
 * reading of what is on the day, not a rule of the server (the preview names
 * the činnosti of a day, not of an hour).
 */
export function afternoonFree(input: {
  bookings: readonly { start: number }[];
  workEnd: number | null;
}): boolean {
  if (input.bookings.length === 0 || input.workEnd === null) return false;
  return input.workEnd > 13 * 60 && input.bookings.every((b) => b.start < 12 * 60);
}

export function workEndOf(rows: readonly (PreviewDay | undefined)[]): number | null {
  let end: number | null = null;
  for (const row of rows) {
    if (!row?.isOpen) continue;
    const e = parseTimeOfDay(row.endTime);
    if (e !== null) end = Math.max(end ?? 0, e);
  }
  return end;
}

/* ── Lanes: simultaneous bookings side by side, never on top of each other ── */

export interface LaneItem {
  id: string;
  start: number;
  end: number;
}

export interface LanePlacement {
  lane: number;
  /** How many lanes the cluster this item is in is drawn with. */
  lanes: number;
}

export interface LaneOverflow {
  key: string;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  ids: string[];
}

export interface LaneLayout {
  placed: Map<string, LanePlacement>;
  overflow: LaneOverflow[];
}

/**
 * Greedy interval colouring per cluster of overlapping bookings. Up to
 * `maxVisible` lanes are drawn side by side; past that the lanes beyond are
 * folded into one "+N" chip over the cluster, so a card is never narrower than
 * a readable strip however many run at once.
 */
export function layoutLanes(items: readonly LaneItem[], maxVisible = 3): LaneLayout {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id));
  const placed = new Map<string, LanePlacement>();
  const overflow: LaneOverflow[] = [];

  let cluster: { item: LaneItem; lane: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const lanes = Math.max(...cluster.map((c) => c.lane)) + 1;
    if (lanes <= maxVisible) {
      for (const c of cluster) placed.set(c.item.id, { lane: c.lane, lanes });
    } else {
      const folded = cluster.filter((c) => c.lane >= maxVisible - 1);
      for (const c of cluster) {
        if (c.lane < maxVisible - 1) placed.set(c.item.id, { lane: c.lane, lanes: maxVisible });
      }
      overflow.push({
        key: `overflow-${folded[0].item.id}`,
        start: Math.min(...folded.map((c) => c.item.start)),
        end: Math.max(...folded.map((c) => c.item.end)),
        lane: maxVisible - 1,
        lanes: maxVisible,
        ids: folded.map((c) => c.item.id),
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  const laneEnds: number[] = [];
  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      flush();
      laneEnds.length = 0;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ item, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return { placed, overflow };
}

/** The wall-clock span an appointment takes on a day, as a lane item. */
export function laneItemOf(appointment: DayAppointment, dayKey: DateOnly): LaneItem {
  const span: MinuteRange = spanOnDay(appointment.startUtc, appointment.endUtc, dayKey);
  return { id: appointment.id, start: span.start, end: Math.max(span.end, span.start + 1) };
}

/* ── Counts: people per service, for the month panel ── */

export interface ServiceCount {
  serviceId: string | null;
  name: string;
  colorHex: string | null;
  total: number;
  activities: { activityId: string; name: string; count: number }[];
}

export interface DayCounts {
  total: number;
  services: ServiceCount[];
}

/** Heads in one booking: the group's size when the server sends it, otherwise one. */
export function headsOf(appointment: Pick<DayAppointment, "headcount">): number {
  const n = appointment.headcount;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * People on a day, split by služba (and by činnost under each). A group or
 * club booking counts per head; cancelled bookings count for nothing.
 */
export function countByService(input: {
  appointments: readonly DayAppointment[];
  calendarById: ReadonlyMap<string, Pick<Calendar, "clinicServiceId">>;
  catalogue: Catalogue;
  otherLabel: string;
}): DayCounts {
  const { appointments, calendarById, catalogue, otherLabel } = input;
  const groups = new Map<string, ServiceCount>();
  let total = 0;
  for (const a of appointments) {
    if (statusTally(a.status) === "cancelled") continue;
    const heads = headsOf(a);
    const serviceId = serviceIdOfAppointment(a, a.calendarId ? calendarById.get(a.calendarId) : undefined, catalogue);
    const key = serviceId ?? "__other";
    const service = serviceId ? catalogue.services.get(serviceId) : undefined;
    let group = groups.get(key);
    if (!group) {
      group = {
        serviceId,
        name: service?.name ?? otherLabel,
        colorHex: service?.colorHex ?? null,
        total: 0,
        activities: [],
      };
      groups.set(key, group);
    }
    group.total += heads;
    total += heads;
    const name = catalogue.activities.get(a.activityId)?.name ?? a.activityName;
    const line = group.activities.find((x) => x.activityId === a.activityId);
    if (line) line.count += heads;
    else group.activities.push({ activityId: a.activityId, name, count: heads });
  }
  const order = (g: ServiceCount) => (g.serviceId ? (catalogue.services.get(g.serviceId)?.sortOrder ?? 9998) : 9999);
  const services = [...groups.values()].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, "cs"));
  for (const s of services) s.activities.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "cs"));
  return { total, services };
}

/** Czech plural for people: `1 osoba`, `2 osoby`, `9 osob`. */
export function peopleWord(count: number): string {
  if (count === 1) return "1 osoba";
  if (count >= 2 && count <= 4) return `${count} osoby`;
  return `${count} osob`;
}

/* ── Date ranges picked by dragging across days ── */

export interface DayRange {
  from: DateOnly;
  to: DateOnly;
}

/** The two days in order, whichever was pressed first. */
export function orderRange(a: DateOnly, b: DateOnly): DayRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/** Days from `from` to `to`, both counted. */
export function dayCount(range: DayRange): number {
  const [fy, fm, fd] = range.from.split("-").map(Number);
  const [ty, tm, td] = range.to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000) + 1;
}

export function inRange(day: DateOnly, range: DayRange | null): boolean {
  return range !== null && day >= range.from && day <= range.to;
}

/** Czech plural: `1 den`, `3 dny`, `14 dní`. */
export function daysWord(count: number): string {
  if (count === 1) return "1 den";
  if (count >= 2 && count <= 4) return `${count} dny`;
  return `${count} dní`;
}

const short = (day: DateOnly) => {
  const [, m, d] = day.split("-").map(Number);
  return `${d}. ${m}.`;
};

/** `26. 10. – 9. 11.` */
export function rangeDates(range: DayRange): string {
  return `${short(range.from)} – ${short(range.to)}`;
}

/** The pill while dragging across days: `26. 10. – 9. 11. · 14 dní`. */
export function rangePill(range: DayRange): string {
  return `${rangeDates(range)} · ${daysWord(dayCount(range))}`;
}

/** The days a range covers, in order (a 14-day pick is 14 entries). */
export function daysOf(range: DayRange): DateOnly[] {
  const out: DateOnly[] = [];
  for (let d = range.from; d <= range.to && out.length < 400; d = addDaysToDateOnly(d, 1)) out.push(d);
  return out;
}

/** Whether the day is a Saturday or Sunday. */
export function isWeekend(day: DateOnly): boolean {
  const w = dayOfWeekOf(day);
  return w === 0 || w === 6;
}

/* ── What the clubs screen is told (router state) ── */

export interface NewClubBlockState {
  newBlock: {
    calendarIds: string[];
    fromDate: DateOnly;
    toDate: DateOnly;
    dailyFrom?: string;
    dailyTo?: string;
  };
}

export function clubStateForRange(calendarIds: string[], range: DayRange): NewClubBlockState {
  return { newBlock: { calendarIds, fromDate: range.from, toDate: range.to } };
}

export function clubStateForSlot(
  calendarId: string,
  day: DateOnly,
  dailyFrom: string,
  dailyTo: string,
): NewClubBlockState {
  return { newBlock: { calendarIds: [calendarId], fromDate: day, toDate: day, dailyFrom, dailyTo } };
}

export interface OpenClubBlockState {
  clubId?: string;
  clubBlockId: string;
}

/** The dates a club block covers on one calendar: from its earliest piece to its latest. */
export function clubBlockDates(
  blocks: readonly { clubBlockId?: string | null; startUtc: string; endUtc: string }[],
  clubBlockId: string | null | undefined,
  self: { startUtc: string; endUtc: string },
): DayRange {
  const same = clubBlockId ? blocks.filter((b) => b.clubBlockId === clubBlockId) : [self];
  const pieces = same.length > 0 ? same : [self];
  const starts = pieces.map((b) => b.startUtc).sort();
  const ends = pieces.map((b) => b.endUtc).sort();
  /* A block that ends exactly at midnight belongs to the day before. */
  const lastEnd = new Date(new Date(ends[ends.length - 1]).getTime() - 60_000);
  return { from: pragueDateKey(starts[0]), to: pragueDateKey(lastEnd) };
}
