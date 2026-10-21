/*
 * Pure mappers: the application's API shapes -> the planner's model, and back.
 *
 * Nothing here calls the network and nothing is a clinic's data: every name, price, colour, duration, hour
 * and capacity arrives as an argument. The only literals are neutral fallbacks (`NEUTRAL_COLOR`,
 * `DEFAULT_ICON`) used when the clinic has configured nothing.
 *
 * The decisions (also listed in the PL-F report):
 *   - slot length of a činnost = its `durationMinutes`; its parallel capacity and its price come with it;
 *   - colour = the činnost's own effective colour -> the služba's colour -> a neutral grey;
 *   - a standard term = bookings of one činnost with the same start and end, over all selected calendars;
 *     booked = people (heads), capacity = max(booked, parallel capacity x calendars in the group);
 *   - a club window of the order being planned is laid out per činnost by the SAME calculator the calendar's
 *     pick mode uses (`pickCoverage`), so planned numbers equal what the desk sees there;
 *   - a window of another club is a busy `origin: 'public'` term (not counted into this order) marked `foreign`.
 */
import type { Activity, DayAppointment, PreviewDay, TimeBlock } from '../../api/bookingContracts';
import { statusTally } from '../../api/bookingContracts';
import type { ClinicService } from '../../api/clinicServices';
import type { ClubBlockAthlete, ClubBlockView } from '../../api/clubBlocks';
import type { ClubOrderView, OrderRange } from '../../api/clubOrders';
import type { Club, ClubManager } from '../../api/clubs';
import type { ClinicHoliday } from '../../api/holidays';
import { dayMark as gridDayMark } from '../../components/booking/grid/dayMarks';
import { activityColor } from '../../colors/activityColor';
import { shownPrice } from '../../components/booking/grid/appointmentPrice';
import { drawnBlocksOfDay } from '../../components/booking/grid/clubWindows';
import {
  formatMinutes,
  pragueMinuteOfDay,
  parseTimeOfDay,
  touchesDay,
  type MinuteRange,
} from '../../components/booking/grid/timeRange';
import type { PickedTime } from '../../components/booking/calendar/multiSelect';
import { pickCoverage, type PlanWindow } from '../../components/booking/calendar/pickPlan';
import { ordersRangesOf } from '../../components/booking/calendar/pickLogic';
import type { CoverageActivity } from '../../components/clubs/order/coverage';
import { normalizeAllowed } from '../../components/clubs/order/routing';
import { orderWindows, windowRange } from '../../components/clubs/orders/orderWindows';
import { addDaysToDateOnly, pragueDateKey } from '../../utils/time';
import { DEFAULT_WINDOW, timeAsMinutes } from '../model';
import type {
  ClockTime,
  ClubProfile,
  DayBudget,
  DayMark,
  IsoDate,
  OrderDemand,
  PlannerCategory,
  PlannerOrder,
  PlannerOrderRange,
  PlannerSession,
  PlanningWindow,
  SessionAppointment,
  SessionPrice,
} from '../model';

/* -------------------------------------------------------------------------- */
/* Neutral fallbacks                                                           */
/* -------------------------------------------------------------------------- */

/** Colour of a činnost that has none anywhere (neutral, not tied to any činnost). */
export const NEUTRAL_COLOR = '#6e91a5';
/** Icon of a činnost - the API has no icon setting, so every činnost gets the neutral one. */
export const DEFAULT_ICON = 'heart';

const HEX = /^#[0-9a-fA-F]{6}$/;
export const cleanHex = (value: string | null | undefined): string | null => {
  const v = (value ?? '').trim();
  return HEX.test(v) ? v : null;
};

/** `HH:mm` Prague wall clock of an instant. */
export const clockOf = (instant: string): ClockTime => formatMinutes(pragueMinuteOfDay(instant));
const msOf = (instant: string): number => new Date(instant).getTime();
const minutesOf = (time: string | null | undefined): number | null => parseTimeOfDay(time);

export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) out.push(d);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                   */
/* -------------------------------------------------------------------------- */

export function categoryOf(activity: Activity, service: ClinicService | undefined): PlannerCategory {
  /* the one colour of a činnost (src/colors/activityColor.ts) - the same the board's cards, windows and lists draw */
  const color = activityColor(activity, service?.colorHex, NEUTRAL_COLOR);
  return {
    id: activity.id,
    name: activity.name,
    iconKey: DEFAULT_ICON,
    color,
    ...(service ? { subtitle: service.name, serviceId: service.id, serviceName: service.name } : {}),
    slotMinutes: activity.durationMinutes,
    parallelCapacity: activity.parallelCapacity && activity.parallelCapacity > 0 ? activity.parallelCapacity : 1,
    priceCzk: activity.priceCzk ?? null,
  };
}

/**
 * The činnosti the board offers: active ones of the služby the selected calendars run (every active one when
 * the calendars name no služba), plus any the order needs. Sorted like the settings screen (sortOrder, name).
 */
export function categoriesOf(
  activities: readonly Activity[],
  services: readonly ClinicService[],
  scopeServiceIds: ReadonlySet<string>,
  alwaysIds: ReadonlySet<string>,
): PlannerCategory[] {
  const byService = new Map(services.map((s) => [s.id, s]));
  return activities
    .filter((a) => a.isActive || alwaysIds.has(a.id))
    .filter((a) => alwaysIds.has(a.id) || scopeServiceIds.size === 0 || (a.clinicServiceId !== null && scopeServiceIds.has(a.clinicServiceId)))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'))
    .map((a) => categoryOf(a, a.clinicServiceId ? byService.get(a.clinicServiceId) : undefined));
}

/** The grid's hours (display settings) widened to the opening hours of the selected calendars, in minutes. */
export function planningWindowOf(
  display: { dayStartHour: number; dayEndHour: number },
  opening: { start: number; end: number } | null,
): PlanningWindow {
  let start = display.dayStartHour;
  let end = display.dayEndHour;
  if (opening) {
    start = Math.min(start, Math.floor(opening.start / 60));
    end = Math.max(end, Math.ceil(opening.end / 60));
  }
  start = Math.max(0, start);
  end = Math.min(24, Math.max(end, start + 1));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return { ...DEFAULT_WINDOW };
  return { startMinutes: start * 60, endMinutes: end * 60 };
}

/* -------------------------------------------------------------------------- */
/* Day marks and day budget                                                    */
/* -------------------------------------------------------------------------- */

type Previews = ReadonlyMap<string, ReadonlyMap<string, PreviewDay>>;

const rowsOf = (previews: Previews, date: IsoDate): PreviewDay[] => {
  const rows: PreviewDay[] = [];
  for (const byDate of previews.values()) {
    const row = byDate.get(date);
    if (row) rows.push(row);
  }
  return rows;
};

/** Minutes a calendar works on a day: end - start - break (0 for a closed day / unknown hours). */
export function openMinutesOf(row: PreviewDay | undefined): number {
  if (!row || !row.isOpen) return 0;
  const s = minutesOf(row.startTime);
  const e = minutesOf(row.endTime);
  if (s === null || e === null || e <= s) return 0;
  const bs = minutesOf(row.breakStart);
  const be = minutesOf(row.breakEnd);
  const lunch = bs !== null && be !== null && be > bs ? Math.max(0, Math.min(be, e) - Math.max(bs, s)) : 0;
  return e - s - lunch;
}

/**
 * One day, whatever the calendars say together: closed when every selected calendar is shut (or the clinic keeps
 * it as a holiday), hours = the earliest opening .. the latest closing of the open calendars, lunch = the break
 * ALL open calendars share. The words come from the calendar grid's own `dayMark`.
 */
export function dayMarkOf(date: IsoDate, previews: Previews, holiday: ClinicHoliday | undefined): DayMark {
  const rows = rowsOf(previews, date);
  const mark = gridDayMark(holiday, rows);
  const open = rows.filter((r) => r.isOpen && openMinutesOf(r) > 0);
  let hours: DayMark['hours'] = null;
  if (open.length > 0 && !mark.closed) {
    const start = Math.min(...open.map((r) => minutesOf(r.startTime) ?? Number.POSITIVE_INFINITY));
    const end = Math.max(...open.map((r) => minutesOf(r.endTime) ?? 0));
    if (Number.isFinite(start) && end > start) hours = { from: formatMinutes(start), to: formatMinutes(end) };
  }
  let lunch: DayMark['lunch'] = null;
  if (open.length > 0 && !mark.closed) {
    const breaks = open.map((r) => ({ s: minutesOf(r.breakStart), e: minutesOf(r.breakEnd) }));
    if (breaks.every((b) => b.s !== null && b.e !== null && (b.e as number) > (b.s as number))) {
      const s = Math.max(...breaks.map((b) => b.s as number));
      const e = Math.min(...breaks.map((b) => b.e as number));
      if (e > s) lunch = { from: formatMinutes(s), to: formatMinutes(e) };
    }
  }
  const label = mark.closed ? (mark.detail || mark.label || null) : null;
  return { date, closed: mark.closed, label, hours, lunch };
}

/**
 * The reference day of the mini-calendar: the longest working day (open minutes) any single selected calendar has
 * in the looked-at days - the board plans on one lane. 0 when nothing is known (the caller keeps its fallback).
 */
export function dayBudgetOf(previews: Previews, days: readonly IsoDate[]): { defaultMinutes: number; byDate: Record<IsoDate, number> } {
  const byDate: Record<IsoDate, number> = {};
  let max = 0;
  for (const date of days) {
    let day = 0;
    for (const byCalendar of previews.values()) day = Math.max(day, openMinutesOf(byCalendar.get(date)));
    if (day > 0) byDate[date] = day;
    max = Math.max(max, day);
  }
  return { defaultMinutes: max, byDate };
}

/** Opening hours of the open days of the previews, for widening the board's window. */
export function openingOf(previews: Previews): { start: number; end: number } | null {
  let start = Number.POSITIVE_INFINITY;
  let end = 0;
  for (const byCalendar of previews.values()) {
    for (const row of byCalendar.values()) {
      if (openMinutesOf(row) <= 0) continue;
      start = Math.min(start, minutesOf(row.startTime) ?? Number.POSITIVE_INFINITY);
      end = Math.max(end, minutesOf(row.endTime) ?? 0);
    }
  }
  return Number.isFinite(start) && end > start ? { start, end } : null;
}

export const budgetOf = (b: { defaultMinutes: number; byDate: Record<IsoDate, number> }, fallback: number): DayBudget => ({
  defaultMinutes: b.defaultMinutes > 0 ? b.defaultMinutes : fallback,
  byDate: b.byDate,
});

/* -------------------------------------------------------------------------- */
/* Standard terms (appointments)                                               */
/* -------------------------------------------------------------------------- */

export const isLive = (row: Pick<DayAppointment, 'status'>): boolean => {
  const tally = statusTally(row.status);
  return tally !== 'cancelled' && tally !== 'noShow';
};

export const headsOf = (row: Pick<DayAppointment, 'headcount'>): number =>
  row.headcount && row.headcount > 0 ? row.headcount : 1;

/** The row version of a standard term: what a move re-checks before it writes. */
export function fingerprintOf(rows: ReadonlyArray<Pick<DayAppointment, 'id' | 'startUtc' | 'endUtc' | 'status'>>): string {
  return rows
    .map((r) => `${r.id}@${msOf(r.startUtc)}-${msOf(r.endUtc)}#${r.status}`)
    .sort()
    .join(',');
}

export interface StandardSessionsInput {
  appointments: readonly DayAppointment[];
  activities: ReadonlyMap<string, Activity>;
  /** Time blocks per calendar; a club-athlete appointment inside a club window belongs to the window. */
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>;
  range: { from: IsoDate; to: IsoDate };
}

function insideClubWindow(row: DayAppointment, blocks: readonly TimeBlock[] | undefined): boolean {
  if (!blocks) return false;
  const s = msOf(row.startUtc);
  const e = msOf(row.endUtc);
  return blocks.some((b) => b.kind === 'club' && msOf(b.startUtc) <= s && e <= msOf(b.endUtc));
}

/**
 * Bookings grouped by (činnost, start, end) over all calendars. Cancelled and no-show rows are left out; a club
 * athlete's visit that lies inside a club window is part of that window (its `booked`), not a term of its own.
 */
export function standardSessionsOf(input: StandardSessionsInput): PlannerSession[] {
  const groups = new Map<string, DayAppointment[]>();
  for (const row of input.appointments) {
    if (!isLive(row)) continue;
    if (!row.calendarId) continue;
    const date = pragueDateKey(row.startUtc);
    if (date < input.range.from || date > input.range.to) continue;
    if ((row.partnerName ?? '').trim() !== '' && insideClubWindow(row, input.blocksByCalendar.get(row.calendarId))) continue;
    const key = `${row.activityId}|${msOf(row.startUtc)}|${msOf(row.endUtc)}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  const sessions: PlannerSession[] = [];
  for (const [key, rows] of groups) {
    const first = rows[0]!;
    const activity = input.activities.get(first.activityId);
    const booked = rows.reduce((n, r) => n + headsOf(r), 0);
    const calendars = [...new Set(rows.map((r) => r.calendarId as string))];
    const parallel = activity?.parallelCapacity && activity.parallelCapacity > 0 ? activity.parallelCapacity : 1;
    const capacity = Math.max(booked, parallel * calendars.length);
    const people: SessionAppointment[] = rows.map((r) => ({
      id: r.id,
      calendarId: r.calendarId as string,
      patientName: r.patientName?.trim() ? r.patientName.trim() : null,
      status: r.status,
      heads: headsOf(r),
      priceCzk: shownPrice(r, activity?.priceCzk ?? null).amountCzk,
    }));
    const priced = people.filter((p) => p.priceCzk !== null);
    const price: SessionPrice = {
      totalCzk: priced.reduce((n, p) => n + (p.priceCzk ?? 0), 0),
      priced: priced.length,
      unpriced: people.length - priced.length,
      adjusted: rows.some((r) => shownPrice(r, activity?.priceCzk ?? null).adjusted),
    };
    sessions.push({
      id: `appt:${key}`,
      date: pragueDateKey(first.startUtc),
      start: clockOf(first.startUtc),
      end: clockOf(first.endUtc),
      categoryId: first.activityId,
      capacity,
      booked,
      origin: 'public',
      showInList: true,
      publicBooked: booked,
      clubBooked: 0,
      version: fingerprintOf(rows),
      appointmentIds: rows.map((r) => r.id),
      appointments: people,
      calendarIds: calendars,
      price,
    });
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/* -------------------------------------------------------------------------- */
/* Windows of OTHER clubs (busy time, read-only)                               */
/* -------------------------------------------------------------------------- */

export interface ForeignWindowsInput {
  /** Club time blocks per calendar (manual blocks are ignored). */
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>;
  /** The lunch break of a calendar on a day, to draw one window across it. */
  lunchOf: (calendarId: string, date: IsoDate) => MinuteRange | null;
  details: ReadonlyMap<string, ClubBlockView>;
  activities: ReadonlyMap<string, Activity>;
  range: { from: IsoDate; to: IsoDate };
  /** The club block ids that belong to the order being planned (drawn from the draft, not from here). */
  ownBlockIds: ReadonlySet<string>;
  /** `false` while no order is planned: club windows are then ordinary `club` terms. */
  planning: boolean;
}

export function foreignWindowSessionsOf(input: ForeignWindowsInput): PlannerSession[] {
  type Drawn = { clubBlockId: string; date: IsoDate; span: MinuteRange; calendarIds: string[]; blocks: TimeBlock[] };
  const grouped = new Map<string, Drawn>();
  for (const [calendarId, blocks] of input.blocksByCalendar) {
    for (const date of eachDay(input.range.from, input.range.to)) {
      /* spanOnDay cuts a block to the day it is asked about, so only the blocks that touch the day may be asked. */
      const clubBlocks = blocks.filter((b) => b.kind === 'club' && b.clubBlockId && touchesDay(b.startUtc, b.endUtc, date));
      for (const drawn of drawnBlocksOfDay(clubBlocks as TimeBlock[], date, input.lunchOf(calendarId, date))) {
        if (drawn.span.end <= drawn.span.start) continue;
        const clubBlockId = drawn.block.clubBlockId as string;
        if (input.ownBlockIds.has(clubBlockId)) continue;
        const key = `${clubBlockId}|${date}|${drawn.span.start}|${drawn.span.end}`;
        const have = grouped.get(key);
        if (have) {
          have.calendarIds.push(calendarId);
          have.blocks.push(...drawn.parts);
        } else grouped.set(key, { clubBlockId, date, span: drawn.span, calendarIds: [calendarId], blocks: [...drawn.parts] });
      }
    }
  }
  const sessions: PlannerSession[] = [];
  for (const g of grouped.values()) {
    const detail = input.details.get(g.clubBlockId);
    const first = g.blocks[0]!;
    const categoryId = detail?.activityIds[0] ?? detail?.activitySeats?.[0]?.activityId ?? '';
    const activity = input.activities.get(categoryId);
    const minutes = g.span.end - g.span.start;
    const parallel = activity?.parallelCapacity && activity.parallelCapacity > 0 ? activity.parallelCapacity : 1;
    const slots = activity && activity.durationMinutes > 0 ? Math.floor(minutes / activity.durationMinutes) * parallel * g.calendarIds.length : 0;
    const start = formatMinutes(g.span.start);
    const end = formatMinutes(g.span.end);
    const athletes = (detail?.athletes ?? []).filter(
      (a) =>
        a.status !== 'Cancelled' &&
        a.startUtc !== null &&
        pragueDateKey(a.startUtc) === g.date &&
        pragueMinuteOfDay(a.startUtc) >= g.span.start &&
        pragueMinuteOfDay(a.startUtc) < g.span.end,
    );
    const booked = athletes.length;
    const capacity = Math.max(booked, slots);
    const asClub = !input.planning;
    sessions.push({
      id: `club:${g.clubBlockId}:${g.date}:${start}`,
      date: g.date,
      start,
      end,
      categoryId,
      capacity,
      booked,
      origin: asClub ? 'club' : 'public',
      showInList: true,
      clubBooked: asClub ? booked : 0,
      publicBooked: asClub ? 0 : booked,
      blockIds: g.blocks.map((b) => b.id),
      calendarIds: g.calendarIds,
      clubBlockId: g.clubBlockId,
      clubOrderId: detail?.clubOrderId ?? null,
      clubId: first.clubId ?? detail?.clubId ?? null,
      orderId: detail?.clubOrderId ?? null,
      clubName: first.clubName ?? detail?.clubName ?? null,
      clubColorHex: cleanHex(first.colorHex) ?? cleanHex(detail?.colorHex) ?? null,
      foreign: true,
    });
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/* -------------------------------------------------------------------------- */
/* The windows of the order being planned                                      */
/* -------------------------------------------------------------------------- */

/** One live window of the order: its dates / daily hours, calendars and the athletes registered in it. */
export interface OrderWindow {
  id: string;
  calendarIds: string[];
  range: OrderRange;
  athletes: readonly ClubBlockAthlete[];
}

export function windowsOfOrder(order: ClubOrderView): OrderWindow[] {
  return orderWindows(order).map((b) => ({ id: b.id, calendarIds: b.calendarIds, range: windowRange(b, order), athletes: b.athletes ?? [] }));
}

const DAY_END = 24 * 60;

/** The daily hours of a window in minutes; a whole-day range (no hours) is the whole day 00:00-24:00. */
export function dailyRangeOf(range: OrderRange): MinuteRange | null {
  const from = minutesOf(range.dailyFrom ?? '00:00');
  const rawTo = range.dailyTo ?? null;
  const to = rawTo === null || rawTo === '23:59' ? DAY_END : minutesOf(rawTo);
  if (from === null || to === null || to <= from) return null;
  return { start: from, end: to };
}

/** What the server blocks of one day: the open hours without the lunch break. [] = closed; null = no row for the day. */
export function openPiecesOfDay(row: PreviewDay | undefined): MinuteRange[] | null {
  if (!row) return null;
  if (!row.isOpen) return [];
  const s = minutesOf(row.startTime);
  const e = minutesOf(row.endTime);
  if (s === null || e === null || e <= s) return null;
  const bs = minutesOf(row.breakStart);
  const be = minutesOf(row.breakEnd);
  if (bs !== null && be !== null && be > bs && bs > s && be < e) return [{ start: s, end: bs }, { start: be, end: e }];
  return [{ start: s, end: e }];
}

export interface OwnSessionsInput {
  orderId: string;
  windows: readonly OrderWindow[];
  /** The order's činnosti as the pick calculator reads them (seats = the order's players). */
  activities: readonly CoverageActivity[];
  /** The grid step of a window's first calendar (the calculator rounds its parts to it). */
  stepOf: (calendarIds: readonly string[]) => number;
  /**
   * What the server really blocks of a day: the calendar's open hours without the lunch break, as pieces
   * ([] = closed day). The server clips every window to them - a whole-day window (no hours) or 08:00-18:00 both
   * become "08:00-12:00 + 12:30-18:00" - so the planner lays out those pieces, not the raw range.
   * null = unknown (no hours read): an explicit window is laid out as it is, a whole-day one is skipped.
   */
  openPiecesOf?: (calendarIds: readonly string[], date: IsoDate) => MinuteRange[] | null;
  clubName?: string | null;
  clubColorHex?: string | null;
  clubId?: string | null;
}

export interface OwnSessions {
  sessions: PlannerSession[];
  /** window id -> the days it exists on (as laid out) and the ids of its sessions. */
  index: Map<string, { days: IsoDate[]; sessionIds: string[] }>;
}

/**
 * The order's windows as planner terms. Every day of a window is one `PlanWindow`; `pickCoverage` (the
 * calendar's pick-mode calculator) hands each its činnosti in order, so a window for several činnosti becomes
 * one term per činnost, one after the other. The unused rest of a window is NOT dropped: it joins the last
 * term (whole spare slots become capacity), so loading and saving an untouched window never shortens it.
 */
export function ownSessionsOf(input: OwnSessionsInput): OwnSessions {
  const routableIds = input.activities.filter((a) => a.seats > 0).map((a) => a.activityId);
  const planWindows: PlanWindow[] = [];
  const meta = new Map<string, { window: OrderWindow; date: IsoDate }>();
  const index: OwnSessions['index'] = new Map();
  for (const w of input.windows) {
    const daily = dailyRangeOf(w.range);
    index.set(w.id, { days: [], sessionIds: [] });
    if (!daily) continue;
    const wholeDay = !w.range.dailyFrom && !w.range.dailyTo;
    const to = w.range.toDate || w.range.fromDate;
    for (const date of eachDay(w.range.fromDate, to)) {
      const open = input.openPiecesOf ? input.openPiecesOf(w.calendarIds, date) : null;
      const pieces: MinuteRange[] =
        open === null
          ? wholeDay ? [] : [daily]
          : open.map((p) => ({ start: Math.max(p.start, daily.start), end: Math.min(p.end, daily.end) })).filter((p) => p.end > p.start);
      pieces.forEach((range, i) => {
        const id = `${w.id}|${date}|${i}`;
        planWindows.push({
          id,
          range,
          dayKey: date,
          activityIds: normalizeAllowed(w.range.activityIds, routableIds),
          calendars: Math.max(1, w.calendarIds.length),
          step: input.stepOf(w.calendarIds),
        });
        meta.set(id, { window: w, date });
      });
      if (pieces.length > 0) index.get(w.id)!.days.push(date);
    }
  }
  const coverage = pickCoverage(input.activities, planWindows);
  const byId = new Map(input.activities.map((a) => [a.activityId, a]));
  const sessions: PlannerSession[] = [];
  for (const report of coverage.windows) {
    const m = meta.get(report.id ?? '');
    if (!m) continue;
    const { window: w, date } = m;
    const parts = report.parts;
    type Piece = { activityId: string; start: number; end: number; seats: number };
    let pieces: Piece[] = parts.map((p) => ({ activityId: p.activityId, start: p.range.start, end: p.range.end, seats: p.seats }));
    if (pieces.length === 0) {
      const charged = report.spare?.activityId ?? (report.activityIds?.[0] ?? input.activities.find((a) => a.minutesPerSeat > 0)?.activityId);
      if (!charged) continue;
      pieces = [{ activityId: charged, start: report.range.start, end: report.range.end, seats: report.spare?.seats ?? 0 }];
    } else if (report.unusedMinutes > 0) {
      const last = pieces[pieces.length - 1]!;
      last.end = report.range.end;
      if (report.spare && report.spare.activityId === last.activityId) last.seats += report.spare.seats;
    }
    for (const piece of pieces) {
      const activity = byId.get(piece.activityId);
      const booked = w.athletes.filter(
        (a) =>
          a.status !== 'Cancelled' &&
          a.startUtc !== null &&
          a.activityId === piece.activityId &&
          pragueDateKey(a.startUtc) === date &&
          pragueMinuteOfDay(a.startUtc) >= piece.start &&
          pragueMinuteOfDay(a.startUtc) < piece.end,
      ).length;
      const start = formatMinutes(piece.start);
      const id = `own:${w.id}:${date}:${piece.activityId}:${start}`;
      sessions.push({
        id,
        date,
        start,
        end: formatMinutes(piece.end),
        categoryId: piece.activityId,
        capacity: Math.max(piece.seats, booked),
        booked,
        origin: 'club',
        showInList: true,
        clubBooked: booked,
        publicBooked: 0,
        createdByPlanner: booked === 0,
        slotDuration: activity?.minutesPerSeat,
        clubBlockId: w.id,
        clubOrderId: input.orderId,
        orderId: input.orderId,
        clubId: input.clubId ?? null,
        calendarIds: w.calendarIds,
        clubName: input.clubName ?? null,
        clubColorHex: input.clubColorHex ?? null,
      });
      index.get(w.id)!.sessionIds.push(id);
    }
  }
  return { sessions: sessions.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id)), index };
}

/* -------------------------------------------------------------------------- */
/* The draft -> the order's ranges (finishPlan)                                */
/* -------------------------------------------------------------------------- */

export interface SessionSnapshot {
  date: IsoDate;
  start: ClockTime;
  end: ClockTime;
  categoryId: string;
  capacity: number;
}

export interface DraftOrigin {
  windows: readonly OrderWindow[];
  index: ReadonlyMap<string, { days: IsoDate[]; sessionIds: string[] }>;
  snapshot: ReadonlyMap<string, SessionSnapshot>;
}

export const snapshotOf = (s: PlannerSession): SessionSnapshot => ({
  date: s.date,
  start: s.start,
  end: s.end,
  categoryId: s.categoryId,
  capacity: s.capacity,
});

const sameSnapshot = (a: SessionSnapshot, b: SessionSnapshot): boolean =>
  a.date === b.date && a.start === b.start && a.end === b.end && a.categoryId === b.categoryId && a.capacity === b.capacity;

export interface DraftRanges {
  ranges: OrderRange[];
  /** Every calendar the order's windows run on (the existing ones and the one new terms go to). */
  calendarIds: string[];
  /** Windows of the order that were left exactly as the server has them. */
  untouchedWindows: number;
}

/**
 * The draft as the order's `ranges`, by the rules of the calendar's pick mode (`ordersRangesOf`: past days dropped,
 * same-day windows joined, identical daily windows on consecutive days merged). An original window whose terms are
 * all still exactly as loaded keeps its range and routing untouched; every other term becomes a window of its own
 * činnost (`activityIds` only when the order has more than one činnost with players).
 */
export function rangesOfDraft(args: {
  draft: readonly PlannerSession[];
  origin: DraftOrigin;
  routableIds: readonly string[];
  today: IsoDate;
  /** The calendars new terms are created on. */
  newCalendarIds: readonly string[];
}): DraftRanges {
  const { draft, origin, routableIds, today } = args;
  const byId = new Map(draft.map((s) => [s.id, s]));
  const picks: PickedTime[] = [];
  const calendars: string[] = [];
  let seq = 0;
  const add = (calendarId: string, dayKey: IsoDate, range: MinuteRange, activityIds: string[] | null) => {
    if (!calendars.includes(calendarId)) calendars.push(calendarId);
    picks.push({
      id: `d${seq++}`,
      kind: 'time',
      columnKey: calendarId,
      calendarId,
      activityId: null,
      dayKey,
      range,
      ...(activityIds !== null ? { activityIds } : {}),
    });
  };

  const kept = new Set<string>();
  const verbatim: OrderRange[] = [];
  let untouched = 0;
  for (const w of origin.windows) {
    for (const id of w.calendarIds) if (!calendars.includes(id)) calendars.push(id);
    const idx = origin.index.get(w.id);
    const intact =
      idx === undefined ||
      idx.sessionIds.every((id) => {
        const now = byId.get(id);
        const was = origin.snapshot.get(id);
        return now !== undefined && was !== undefined && sameSnapshot(snapshotOf(now), was);
      });
    if (!intact) continue;
    untouched += 1;
    idx?.sessionIds.forEach((id) => kept.add(id));
    /* The window the server has, exactly as it has it (a whole-day window stays whole-day). Past windows are not
       sent, as in the calendar's pick mode. */
    if ((w.range.toDate || w.range.fromDate) < today) continue;
    const allowed = normalizeAllowed(w.range.activityIds, routableIds);
    verbatim.push({
      fromDate: w.range.fromDate,
      toDate: w.range.toDate || w.range.fromDate,
      dailyFrom: w.range.dailyFrom ?? null,
      dailyTo: w.range.dailyTo ?? null,
      ...(allowed !== null ? { activityIds: allowed } : {}),
    });
  }

  const newCalendar = args.newCalendarIds[0] ?? calendars[0] ?? '';
  for (const s of draft) {
    if (kept.has(s.id) || s.foreign) continue;
    if (s.origin !== 'club') continue;
    const start = timeAsMinutes(s.start);
    const end = timeAsMinutes(s.end);
    if (!(end > start)) continue;
    const allowed = routableIds.length > 1 ? normalizeAllowed([s.categoryId], routableIds) : null;
    add(s.calendarIds?.[0] ?? newCalendar, s.date, { start, end }, allowed);
  }
  for (const id of args.newCalendarIds) if (!calendars.includes(id)) calendars.push(id);

  const byStart = (x: OrderRange, y: OrderRange) =>
    x.fromDate.localeCompare(y.fromDate) || (x.dailyFrom ?? '').localeCompare(y.dailyFrom ?? '') || x.toDate.localeCompare(y.toDate);
  const ranges = [...verbatim, ...ordersRangesOf(picks, today)].sort(byStart);
  return { ranges, calendarIds: calendars.filter((c) => c !== ''), untouchedWindows: untouched };
}

/** An `OrderRange` as the model's order shows it. */
export const plannerRangeOf = (r: OrderRange): PlannerOrderRange => ({
  fromDate: r.fromDate,
  toDate: r.toDate || r.fromDate,
  dailyFrom: r.dailyFrom ?? null,
  dailyTo: r.dailyTo ?? null,
  activityIds: r.activityIds ?? null,
});

/* -------------------------------------------------------------------------- */
/* The order                                                                    */
/* -------------------------------------------------------------------------- */

export function demandsOf(activities: readonly CoverageActivity[]): OrderDemand[] {
  return activities.filter((a) => a.seats > 0).map((a) => ({ categoryId: a.activityId, requested: a.seats, baselinePlanned: 0 }));
}

export const noOrder = (): PlannerOrder => ({ id: '', clubId: '', demands: [], baselineSessions: [], club: false });

/* -------------------------------------------------------------------------- */
/* The club                                                                     */
/* -------------------------------------------------------------------------- */

/* "předseda" / "předsedkyně" / "jednatel" at the start of a word - not "místopředseda". */
const LEADER_ROLE = /(^|[^\p{L}])(předsed|jednatel)/iu;

/** The leader of the club: the first member of the management whose role says předseda / jednatel, else the first. */
export function leaderOf(management: readonly ClubManager[] | undefined): ClubManager | null {
  const list = management ?? [];
  return list.find((m) => LEADER_ROLE.test(m.role)) ?? list[0] ?? null;
}

const joinNonEmpty = (parts: ReadonlyArray<string | null | undefined>, sep: string): string =>
  parts.map((p) => (p ?? '').trim()).filter(Boolean).join(sep);

/** The address as one line: street, then "PSČ město". */
export const addressLine = (club: Pick<Club, 'address' | 'postalCode' | 'city'>): string =>
  joinNonEmpty([club.address, joinNonEmpty([club.postalCode, club.city], ' ')], ', ');

export function profileOf(club: Club): ClubProfile {
  const leader = leaderOf(club.management);
  return {
    clubId: club.id,
    colorHex: cleanHex(club.colorHex),
    clubName: club.name ?? '',
    ico: club.ico ?? '',
    dic: club.dic ?? '',
    address: addressLine(club),
    leaderName: leader?.fullName ?? '',
    leaderEmail: leader?.email ?? '',
    leaderPhone: leader?.phone ?? '',
    contactName: club.contactPerson ?? '',
    contactEmail: club.contactEmail ?? '',
    contactPhone: club.contactPhone ?? '',
    logoUrl: null,
  };
}

/**
 * The club card after a header edit: the whole card goes back (`PUT` replaces it), `management` replace-all as the
 * club form does. An edited leader changes the person `leaderOf` finds, or adds one as a hand-made member when the
 * club has no management. An edited address overwrites the street and clears the town / postal code it contained
 * (the header holds ONE address line); a header that was not touched leaves the structured fields alone.
 */
export function clubUpdateOf(club: Club, patch: Partial<Omit<ClubProfile, 'logoUrl'>>): Partial<Club> {
  const text = (v: string | undefined, current: string | null | undefined): string | null => (v === undefined ? (current ?? null) : v.trim() === '' ? null : v.trim());
  const body: Partial<Club> = {
    name: patch.clubName !== undefined && patch.clubName.trim() !== '' ? patch.clubName.trim() : club.name,
    ico: patch.ico !== undefined ? patch.ico.trim() : club.ico,
    dic: text(patch.dic, club.dic),
    contactPerson: text(patch.contactName, club.contactPerson),
    contactEmail: text(patch.contactEmail, club.contactEmail),
    contactPhone: text(patch.contactPhone, club.contactPhone),
    bankAccount: club.bankAccount ?? null,
    bankCode: club.bankCode ?? null,
    iban: club.iban ?? null,
    paymentTermsDays: club.paymentTermsDays,
    discountPercent: club.discountPercent ?? null,
    isActive: club.isActive,
  };
  if (patch.address !== undefined) {
    body.address = patch.address.trim() === '' ? null : patch.address.trim();
    body.city = null;
    body.postalCode = null;
  } else {
    body.address = club.address ?? null;
    body.city = club.city ?? null;
    body.postalCode = club.postalCode ?? null;
  }
  const management = (club.management ?? []).map((m) => ({ ...m }));
  const touchesLeader = patch.leaderName !== undefined || patch.leaderEmail !== undefined || patch.leaderPhone !== undefined;
  if (touchesLeader) {
    const leader = leaderOf(management);
    const name = patch.leaderName?.trim();
    if (leader) {
      if (name) leader.fullName = name;
      if (patch.leaderEmail !== undefined) leader.email = patch.leaderEmail.trim() === '' ? null : patch.leaderEmail.trim();
      if (patch.leaderPhone !== undefined) leader.phone = patch.leaderPhone.trim() === '' ? null : patch.leaderPhone.trim();
    } else if (name) {
      management.push({
        fullName: name,
        role: '',
        phone: patch.leaderPhone?.trim() ? patch.leaderPhone.trim() : null,
        email: patch.leaderEmail?.trim() ? patch.leaderEmail.trim() : null,
        source: 'manual',
      });
    }
  }
  body.management = management;
  return body;
}
