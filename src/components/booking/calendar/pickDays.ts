import type { DateOnly } from "../../../utils/time";
import { addDaysToDateOnly } from "../../../utils/time";
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from "../../../api/bookingContracts";
import { parseTimeOfDay, touchesDay, type MinuteRange } from "../grid/timeRange";
import type { PickedRange } from "./multiSelect";
import { busyIntervals, timePicks, type BusyInput } from "./pickLogic";

/*
 * "Výběr termínů" by whole days and free blocks: the pure rules behind the month view, the "celý den" pick,
 * the list of free blocks of a day (phone) and the jump to the first day that can still be booked.
 *
 * Everything is derived from `busyIntervals` - the one place that knows what is taken - plus the clock: a day
 * before today is closed, and today is closed up to the current minute.
 */

export interface FreeInput extends BusyInput {
  /** The clinic's today, and the current minute of it. */
  today: DateOnly;
  nowMinute: number;
  /** Shorter gaps are not offered (the calendar's own step). */
  minLength: number;
}

/** The free blocks of one calendar on one day (past time, breaks, bookings, blocks and picks left out). Unknown hours = none. */
export function freeBlocksOfCalendar(input: FreeInput): MinuteRange[] {
  const { row, dayKey, today, nowMinute, minLength } = input;
  if (dayKey < today) return [];
  if (row === undefined || !row.isOpen) return [];
  const open = parseTimeOfDay(row.startTime);
  const close = parseTimeOfDay(row.endTime);
  if (open === null || close === null || close <= open) return [];
  const busy = busyIntervals(input);
  if (dayKey === today) busy.push({ start: 0, end: Math.max(0, ceilToStep(nowMinute, minLength)) });
  busy.sort((a, b) => a.start - b.start || a.end - b.end);
  const out: MinuteRange[] = [];
  let cursor = open;
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, close) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= close) break;
  }
  if (cursor < close) out.push({ start: cursor, end: close });
  return out.filter((r) => r.end - r.start >= Math.max(1, minLength));
}

/** Rounds a clock minute up to the next step (the first start that can be aimed at today). */
export const ceilToStep = (minute: number, step: number): number => (step > 0 ? Math.ceil(minute / step) * step : minute);

export interface FreeBlock {
  calendarId: string;
  range: MinuteRange;
}

export const minutesOfBlocks = (blocks: readonly FreeBlock[]): number => blocks.reduce((n, b) => n + (b.range.end - b.range.start), 0);

/**
 * The first day from `from` (up to `maxDays` ahead) with some free time, or null when there is none.
 * `freeMinutesOf` is asked for every day in order.
 */
export function firstBookableDay(from: DateOnly, maxDays: number, freeMinutesOf: (day: DateOnly) => number): DateOnly | null {
  for (let i = 0; i < maxDays; i += 1) {
    const day = addDaysToDateOnly(from, i);
    if (freeMinutesOf(day) > 0) return day;
  }
  return null;
}

/** "5 h", "1 h 30 min", "45 min" - the free time of a month cell. */
export function formatFree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface DayData {
  /** The calendars of the order's služba. */
  calendars: readonly Calendar[];
  previewByCalendar: ReadonlyMap<string, ReadonlyMap<string, PreviewDay>>;
  appointmentsByDay: ReadonlyMap<string, readonly DayAppointment[]>;
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>;
  picks: readonly PickedRange[];
  today: DateOnly;
  nowMinute: number;
}

/** The free blocks of a day over the služba's calendars, calendar after calendar, early to late. Picks already made count as taken. */
export function freeBlocksOfDay(day: DateOnly, data: DayData): FreeBlock[] {
  const picks = timePicks(data.picks);
  const out: FreeBlock[] = [];
  for (const calendar of data.calendars) {
    const row = data.previewByCalendar.get(calendar.id)?.get(day);
    const blocks = freeBlocksOfCalendar({
      dayKey: day,
      ...(row !== undefined
        ? { row: { isOpen: row.isOpen, startTime: row.startTime, endTime: row.endTime, breakStart: row.breakStart, breakEnd: row.breakEnd } }
        : {}),
      appointments: (data.appointmentsByDay.get(day) ?? []).filter((a) => a.calendarId === calendar.id),
      blocks: (data.blocksByCalendar.get(calendar.id) ?? []).filter((b) => touchesDay(b.startUtc, b.endUtc, day)),
      picks: picks.filter((p) => p.calendarId === calendar.id && p.dayKey === day),
      today: data.today,
      nowMinute: data.nowMinute,
      minLength: calendar.displayStepMinutes > 0 ? calendar.displayStepMinutes : 30,
    });
    for (const range of blocks) out.push({ calendarId: calendar.id, range });
  }
  return out;
}
