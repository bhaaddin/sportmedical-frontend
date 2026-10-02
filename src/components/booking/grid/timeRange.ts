import { pragueDateKey, pragueWallClockToInstant, PRAGUE_TZ, type DateOnly } from '../../../utils/time';

/*
 * Time on the grid is Prague wall-clock minutes since midnight.
 *
 * The rows are labelled 08:00, 09:00, ... and a receptionist reads a position
 * against those labels. Placing things by elapsed time since midnight instead
 * put every appointment an hour off its label on the two clock-change days,
 * because 08:00 on 25. 10. is nine elapsed hours after midnight. So everything
 * the grid draws or reads back - appointments, blocks, the now-line and a drag
 * - goes through the wall clock, and only the final booking or block is turned
 * into an instant, by `pragueWallClockToInstant`.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** A stretch of one day in wall-clock minutes, `end` exclusive. */
export interface MinuteRange {
  start: number;
  end: number;
}

const wallClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: PRAGUE_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Prague wall-clock minutes since midnight of an instant. */
export function pragueMinuteOfDay(instant: Date | string): number {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = wallClock.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** `08:30` from wall-clock minutes; the end of the day is `24:00`. */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/** `HH:mm` or `HH:mm:ss` as the working-hours API spells it, in minutes. */
export function parseTimeOfDay(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Where an instant range falls on one day of the grid.
 *
 * An appointment or a block that started the evening before, or runs past
 * midnight, is cut to the day rather than drawn at a wrapped-around minute.
 */
export function spanOnDay(startUtc: string, endUtc: string, dayKey: DateOnly): MinuteRange {
  const start = pragueDateKey(startUtc) === dayKey ? pragueMinuteOfDay(startUtc) : 0;
  const end = pragueDateKey(endUtc) === dayKey ? pragueMinuteOfDay(endUtc) : MINUTES_PER_DAY;
  return { start, end: Math.max(start, end) };
}

/** Whether an instant range touches a day at all. */
export function touchesDay(startUtc: string, endUtc: string, dayKey: DateOnly): boolean {
  const startKey = pragueDateKey(startUtc);
  const endKey = pragueDateKey(endUtc);
  if (startKey === dayKey) return true;
  if (startKey > dayKey) return false;
  /* Started on an earlier day: it reaches this one unless it ends at its midnight. */
  return endKey > dayKey || (endKey === dayKey && pragueMinuteOfDay(endUtc) > 0);
}

/** The wall-clock minute under a pointer, `offsetPx` from the top of the column. */
export function minuteAt(offsetPx: number, pixelsPerMinute: number, topMinute: number): number {
  return topMinute + Math.max(0, offsetPx) / pixelsPerMinute;
}

/**
 * The slots a drag has covered, from the slot it started in to the slot the
 * pointer is in now - in either direction, and always at least one slot.
 *
 * `bounds` is the part of the day the column draws; a drag past its bottom
 * edge stops at it rather than asking for time nobody can see.
 */
export function dragRange(
  anchorMinute: number,
  currentMinute: number,
  step: number,
  bounds: MinuteRange,
): MinuteRange {
  const slot = step > 0 ? step : 30;
  const clamp = (minute: number) => Math.min(Math.max(minute, bounds.start), bounds.end - 1);
  const from = Math.floor(clamp(anchorMinute) / slot) * slot;
  const to = Math.floor(clamp(currentMinute) / slot) * slot;
  const start = Math.max(bounds.start, Math.min(from, to));
  const end = Math.min(bounds.end, Math.max(from, to) + slot);
  return { start, end: Math.max(end, Math.min(bounds.end, start + slot)) };
}

/**
 * Which whole hours the grid draws: the working hours with an hour either
 * side, widened to anything booked or blocked outside them - an override at
 * 06:30 is still an appointment and must not fall off the top of the grid.
 * With nothing at all to go by, 07:00 to 19:00.
 */
export function visibleHours(
  working: readonly MinuteRange[],
  items: readonly MinuteRange[],
): { start: number; end: number } {
  let start = working.length > 0 ? Math.min(...working.map((w) => Math.floor(w.start / 60) - 1)) : 7;
  let end = working.length > 0 ? Math.max(...working.map((w) => Math.ceil(w.end / 60) + 1)) : 19;
  for (const item of items) {
    start = Math.min(start, Math.floor(item.start / 60));
    end = Math.max(end, Math.ceil(item.end / 60));
  }
  start = Math.max(0, start);
  end = Math.min(24, end);
  return end > start ? { start, end } : { start: 7, end: 19 };
}

/** The live label while dragging: `od 08:00 – do 09:30`. */
export function rangeLabel(range: MinuteRange): string {
  return `od ${formatMinutes(range.start)} – do ${formatMinutes(range.end)}`;
}

/**
 * `2026-09-23T08:30` - clinic local time, the shape the booking dialog takes.
 * The end of the day is written as the next day's midnight, never `24:00`.
 */
export function localDateTime(dayKey: DateOnly, minute: number): string {
  if (minute >= MINUTES_PER_DAY) {
    const [year, month, day] = dayKey.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    const key = next.toISOString().slice(0, 10);
    return `${key}T${formatMinutes(minute - MINUTES_PER_DAY)}`;
  }
  return `${dayKey}T${formatMinutes(minute)}`;
}

/** The instants a range on a day really is, clock changes included. */
export function rangeToInstants(dayKey: DateOnly, range: MinuteRange): { startUtc: Date; endUtc: Date } {
  const [startDay, startTime] = localDateTime(dayKey, range.start).split('T');
  const [endDay, endTime] = localDateTime(dayKey, range.end).split('T');
  return {
    startUtc: pragueWallClockToInstant(startDay, startTime),
    endUtc: pragueWallClockToInstant(endDay, endTime),
  };
}
