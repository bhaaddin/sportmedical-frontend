/*
 * R23 - what a click on the board may not touch, for the gap question (`model/gaps.ts`).
 *
 * The same "what is taken" the booking dialog's free blocks use (`busyIntervals`: closed time, lunch, bookings, blocks - and a club's
 * hold is a block), plus the minutes already gone today, plus - when the shared-worker rule is on - what the same worker already has in the
 * other calendars of the day (a booking that is not cancelled, a club window). The moved place is offered only when it passes all of it.
 */
import { statusTally, type DayAppointment, type PreviewDay, type TimeBlock } from '../../../api/bookingContracts';
import { busyIntervals, withPastTime } from '../../../components/booking/calendar/pickLogic';
import { spanOnDay, touchesDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import type { RosterWorker } from './workerClash';

export interface GapContextInput {
  /** The calendar the click belongs to (the column's calendar) and the day. */
  calendarId: string;
  day: string;
  /** Every calendar id whose bookings are drawn in this column (the primary and the extras of its služba). */
  columnCalendarIds: readonly string[];
  appointments: readonly DayAppointment[];
  /** Blocks that refuse a booking (real blocks and requested-day holds), by calendar. */
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>;
  previewByCalendar: ReadonlyMap<string, ReadonlyMap<string, PreviewDay>>;
  workerRule?: { on: boolean; exceptions: ReadonlySet<string>; workerOf: (calendarId: string, day: string) => RosterWorker | null };
  /** Other calendars on screen (for the worker rule). */
  allCalendarIds?: readonly string[];
  /** The clinic's today and the current minute of it; the day's past time is taken when `day` is today. */
  today: string;
  nowMinute: number;
}

function mergeSpans(spans: readonly MinuteRange[]): MinuteRange[] {
  const merged: MinuteRange[] = [];
  for (const r of [...spans].filter((x) => x.end > x.start).sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

export function gapBusy(input: GapContextInput): MinuteRange[] {
  const { calendarId, day } = input;
  const own = new Set(input.columnCalendarIds.length ? input.columnCalendarIds : [calendarId]);
  const appointments = input.appointments.filter((a) => a.calendarId !== null && own.has(a.calendarId));
  const blocks: TimeBlock[] = [];
  for (const id of own) blocks.push(...(input.blocksByCalendar.get(id) ?? []));
  const row = input.previewByCalendar.get(calendarId)?.get(day);
  const base: Parameters<typeof busyIntervals>[0] = { dayKey: day, appointments, blocks, picks: [], ...(row ? { row } : {}) };
  let busy = busyIntervals(base);

  const rule = input.workerRule;
  if (rule?.on) {
    const worker = rule.workerOf(calendarId, day);
    if (worker && !rule.exceptions.has(worker.id)) {
      const extra: MinuteRange[] = [];
      for (const other of input.allCalendarIds ?? []) {
        if (own.has(other) || rule.workerOf(other, day)?.id !== worker.id) continue;
        for (const a of input.appointments) {
          if (a.calendarId === other && statusTally(a.status) !== 'cancelled' && touchesDay(a.startUtc, a.endUtc, day)) extra.push(spanOnDay(a.startUtc, a.endUtc, day));
        }
        for (const b of input.blocksByCalendar.get(other) ?? []) {
          if (b.kind === 'club' && touchesDay(b.startUtc, b.endUtc, day)) extra.push(spanOnDay(b.startUtc, b.endUtc, day));
        }
      }
      if (extra.length) busy = mergeSpans([...busy, ...extra]);
    }
  }
  return day === input.today ? withPastTime(busy, input.nowMinute) : busy;
}
