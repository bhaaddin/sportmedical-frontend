import { statusTally } from "../../../api/bookingContracts";
import type { OrderRange } from "../../../api/clubOrders";
import { addDaysToDateOnly, type DateOnly } from "../../../utils/time";
import { parseTimeOfDay, spanOnDay, type MinuteRange } from "../grid/timeRange";
import { clubRanges } from "./multiSelect";
import type { PickedRange, PickedTime } from "./multiSelect";

/*
 * "Výběr termínů": the pure rules of picking time for a club order straight in the calendar.
 *
 * What a painted range may be (trimmed at the first booking, block, break or edge of the working hours; refused
 * when it starts on something taken; stopped when the picked time already covers every player), how a picked range
 * is resized or moved, and how the picks become the order's ranges. Nothing here draws or calls the server; the
 * coverage arithmetic itself is the one shared function in `clubs/order/coverage.ts`.
 */

/* ── What is taken ── */

export interface BusyInput {
  dayKey: DateOnly;
  /** The calendar's working-hours row for the day; absent = the hours are unknown, nothing is restricted. */
  row?: {
    isOpen: boolean;
    startTime: string | null;
    endTime: string | null;
    breakStart: string | null;
    breakEnd: string | null;
  };
  appointments: readonly { startUtc: string; endUtc: string; status: number }[];
  blocks: readonly { startUtc: string; endUtc: string }[];
  /** The picks already in this column and day. */
  picks: readonly PickedTime[];
  /** A pick being moved or resized does not collide with itself. */
  ignoreId?: string;
}

const DAY = 24 * 60;

/** Everything of the day a new pick may not touch, sorted and merged. */
export function busyIntervals(input: BusyInput): MinuteRange[] {
  const out: MinuteRange[] = [];
  const row = input.row;
  if (row !== undefined) {
    if (!row.isOpen) {
      out.push({ start: 0, end: DAY });
    } else {
      const open = parseTimeOfDay(row.startTime);
      const close = parseTimeOfDay(row.endTime);
      if (open !== null) out.push({ start: 0, end: open });
      if (close !== null) out.push({ start: close, end: DAY });
      const breakStart = parseTimeOfDay(row.breakStart);
      const breakEnd = parseTimeOfDay(row.breakEnd);
      if (breakStart !== null && breakEnd !== null && breakEnd > breakStart) out.push({ start: breakStart, end: breakEnd });
    }
  }
  for (const a of input.appointments) {
    if (statusTally(a.status) === "cancelled") continue;
    out.push(spanOnDay(a.startUtc, a.endUtc, input.dayKey));
  }
  for (const b of input.blocks) out.push(spanOnDay(b.startUtc, b.endUtc, input.dayKey));
  for (const p of input.picks) {
    if (p.id !== input.ignoreId) out.push(p.range);
  }
  const sorted = out.filter((r) => r.end > r.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteRange[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/** Today's time already gone (0 to `nowMinute`) added to the taken intervals, kept sorted and merged. */
export function withPastTime(busy: readonly MinuteRange[], nowMinute: number): MinuteRange[] {
  if (!(nowMinute > 0)) return [...busy];
  const merged: MinuteRange[] = [];
  for (const r of [{ start: 0, end: nowMinute }, ...busy].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

const takenAt = (busy: readonly MinuteRange[], minute: number): boolean => busy.some((b) => b.start <= minute && minute < b.end);

/* ── Painting ── */

export type PickRefusal = "busy" | "covered" | "past" | "service";

export interface ClampResult {
  /** The range that will be picked; null = refused (see `refused`). */
  range: MinuteRange | null;
  refused?: PickRefusal;
  /** The painted range was cut short at something taken. */
  trimmedBusy: boolean;
  /** The painted range was cut short because everybody is covered. */
  trimmedNeed: boolean;
}

/**
 * A painted range: it holds where the press began (`direction` down = the start is fixed, up = the end is fixed),
 * grows from there, and stops at the first thing taken and at the minutes still needed.
 */
export function clampPainted(input: {
  range: MinuteRange;
  direction: "down" | "up";
  busy: readonly MinuteRange[];
  /** How many more minutes may be picked (Infinity = no limit). */
  allowance: number;
}): ClampResult {
  const { range, direction, busy, allowance } = input;
  const fixed = direction === "down" ? range.start : range.end - 1;
  if (takenAt(busy, fixed)) return { range: null, refused: "busy", trimmedBusy: false, trimmedNeed: false };
  if (!(allowance > 0)) return { range: null, refused: "covered", trimmedBusy: false, trimmedNeed: false };

  let { start, end } = range;
  let trimmedBusy = false;
  let trimmedNeed = false;
  if (direction === "down") {
    for (const b of busy) {
      if (b.start > start && b.start < end) {
        end = b.start;
        trimmedBusy = true;
        break;
      }
    }
    if (Number.isFinite(allowance) && end - start > allowance) {
      end = start + Math.floor(allowance);
      trimmedNeed = true;
    }
  } else {
    for (let i = busy.length - 1; i >= 0; i -= 1) {
      const b = busy[i];
      if (b.end < end && b.end > start) {
        start = b.end;
        trimmedBusy = true;
        break;
      }
    }
    if (Number.isFinite(allowance) && end - start > allowance) {
      start = end - Math.floor(allowance);
      trimmedNeed = true;
    }
  }
  if (end - start < 1) return { range: null, refused: trimmedNeed ? "covered" : "busy", trimmedBusy, trimmedNeed };
  return { range: { start, end }, trimmedBusy, trimmedNeed };
}

/** The sentence under a trimmed or refused paint, or null when it went through whole. */
export function paintNote(result: ClampResult): string | null {
  if (result.range === null) {
    switch (result.refused) {
      case "busy":
        return "Tady je už obsazeno — vyberte volné místo.";
      case "covered":
        return "Všichni hráči jsou už pokryti — další čas nelze vybrat. Zapněte „Přidat rezervu“.";
      case "past":
        return "Termín v minulosti nelze objednat.";
      case "service":
        return "Tento kalendář nepatří k vybrané službě.";
      default:
        return null;
    }
  }
  if (result.trimmedBusy && result.trimmedNeed) return "Výběr zkrácen: narazil na obsazený čas a hráči jsou pokryti.";
  if (result.trimmedBusy) return "Výběr zkrácen — dál je obsazeno.";
  if (result.trimmedNeed) return "Výběr zastaven — hráči jsou pokryti.";
  return null;
}

/* ── Resizing and moving a picked range ── */

export type AdjustMode = "start" | "end" | "move";

/**
 * A picked range dragged by `delta` minutes (already snapped to the grid): the new range, or the original
 * when the change is not allowed. `allowance` is what may be ADDED to the original length (Infinity = no limit);
 * `busy` must not include the range itself.
 */
export function adjustPicked(input: {
  original: MinuteRange;
  mode: AdjustMode;
  delta: number;
  step: number;
  bounds: MinuteRange;
  busy: readonly MinuteRange[];
  allowance: number;
}): MinuteRange {
  const { original, mode, delta, step, bounds, busy, allowance } = input;
  const minLength = Math.max(1, step);
  const length = original.end - original.start;
  const grow = Number.isFinite(allowance) ? Math.max(0, Math.floor(allowance)) : Number.POSITIVE_INFINITY;

  if (mode === "move") {
    const start = Math.min(Math.max(bounds.start, original.start + delta), Math.max(bounds.start, bounds.end - length));
    const next = { start, end: start + length };
    return busy.some((b) => b.start < next.end && next.start < b.end) ? original : next;
  }
  if (mode === "start") {
    let start = Math.min(original.start + delta, original.end - minLength);
    start = Math.max(start, bounds.start);
    const wall = Math.max(-1, ...busy.filter((b) => b.end <= original.start).map((b) => b.end));
    if (wall >= 0) start = Math.max(start, wall);
    if (Number.isFinite(grow)) start = Math.max(start, original.start - grow);
    return { start, end: original.end };
  }
  let end = Math.max(original.end + delta, original.start + minLength);
  end = Math.min(end, bounds.end);
  const wall = Math.min(Number.POSITIVE_INFINITY, ...busy.filter((b) => b.start >= original.end).map((b) => b.start));
  if (Number.isFinite(wall)) end = Math.min(end, wall);
  if (Number.isFinite(grow)) end = Math.min(end, original.end + grow);
  return { start: original.start, end };
}

/* ── Picks to ranges, ranges to picks ── */

export const timePicks = (items: readonly PickedRange[]): PickedTime[] =>
  items.filter((i): i is PickedTime => i.kind === "time");

/** The time picks without their ids - a snapshot that can be put back with `replace`. */
export const withoutIds = (items: readonly PickedRange[]): Omit<PickedTime, "id">[] =>
  timePicks(items).map(({ id: _id, ...rest }) => {
    void _id;
    return rest;
  });

export const pickedMinutesOf = (items: readonly PickedRange[]): number =>
  timePicks(items).reduce((n, p) => n + (p.range.end - p.range.start), 0);

/** The order's ranges: past picks dropped, same-day windows joined, identical daily windows on consecutive days merged. */
export function ordersRangesOf(items: readonly PickedRange[], today: DateOnly): OrderRange[] {
  return clubRanges(timePicks(items), today).map((r) => ({
    fromDate: r.fromDate,
    toDate: r.toDate,
    dailyFrom: r.dailyFrom ?? null,
    dailyTo: r.dailyTo ?? null,
  }));
}

/** The calendars the picks lie in, in the order they were first picked. */
export function pickedCalendarIds(items: readonly PickedRange[]): string[] {
  return [...new Set(timePicks(items).map((p) => p.calendarId))];
}


/** The server's proposal as picks on one calendar: a pick per day of every range, inside its daily window. */
export function picksFromRanges(
  ranges: readonly OrderRange[],
  calendarId: string,
  keyOf: (calendarId: string) => string,
): Omit<PickedTime, "id">[] {
  const out: Omit<PickedTime, "id">[] = [];
  for (const r of ranges) {
    const from = parseTimeOfDay(r.dailyFrom ?? "00:00");
    const rawTo = r.dailyTo === null || r.dailyTo === undefined ? null : r.dailyTo;
    const to = rawTo === null ? DAY : rawTo === "23:59" ? DAY : parseTimeOfDay(rawTo);
    if (from === null || to === null || to <= from || r.fromDate === "" || r.toDate < r.fromDate) continue;
    for (let day = r.fromDate; day <= r.toDate; day = addDaysToDateOnly(day, 1)) {
      out.push({ kind: "time", columnKey: keyOf(calendarId), calendarId, activityId: null, dayKey: day, range: { start: from, end: to } });
    }
  }
  return out;
}

/** Whether a pick falls inside a range (a day within its dates, a time inside its daily window). */
export function pickInRange(pick: PickedTime, range: OrderRange): boolean {
  if (pick.dayKey < range.fromDate || pick.dayKey > range.toDate) return false;
  const from = parseTimeOfDay(range.dailyFrom ?? "00:00") ?? 0;
  const to = range.dailyTo === null || range.dailyTo === undefined ? DAY : range.dailyTo === "23:59" ? DAY : (parseTimeOfDay(range.dailyTo) ?? DAY);
  return pick.range.start < to && from < pick.range.end;
}
