import type { MinuteRange } from "../grid/timeRange";
import { parseTimeOfDay } from "../grid/timeRange";
import {
  activityNeed,
  activitySlots,
  capacityOf,
  type ActivityCoverage,
  type Coverage,
  type CoverageActivity,
} from "../../clubs/order/coverage";
import type { FreeBlock } from "./pickDays";
import { formatFree } from "./pickDays";

/*
 * Etapa 12: the arithmetic of "výběr termínů", counted INDIVIDUALLY per činnost (the owner's defect of 10. 10. 2026:
 * a pool of minutes said "zbývá 1 slot" for 50 spiro players).
 *
 *   - A window holds whole slots of ONE činnost: floor(minutes / duration) × parallel capacity × calendars players.
 *     The rest of the window is "nevyužito" and is said so.
 *   - A window for several činnosti ("Vše", or two of three) is laid out by the SEQUENTIAL PLAN: one činnost after
 *     another in the order's listed order - the whole komplexní prohlídka for everybody, then spiroergometrie -
 *     each part as long as its remaining players need (rounded up to the grid step); what does not fit is reported.
 *   - Everything the panel and the bubble show comes from `pickCoverage` here. One function, no second copy.
 *
 * Pure: no React, no network.
 */

const EPS = 1e-9;

/** One picked window as the calculator reads it. `id` ties the report back to the pick. */
export interface PlanWindow {
  id?: string;
  range: MinuteRange;
  /** For the chronological order of the windows; absent windows sort last. */
  dayKey?: string;
  /** The činnosti this window allows; null / absent / empty = all of the order. */
  activityIds?: readonly string[] | null;
  /** Calendars this window runs on at the same time (the same range picked on two calendars); at least 1. */
  calendars?: number;
  /** The grid step the plan's part boundaries are rounded up to (minutes); defaults to 5. */
  step?: number;
}

export const windowMinutes = (w: PlanWindow): number => Math.max(0, w.range.end - w.range.start);

/** One part of a window's plan: a činnost, where it runs, how many players and slots fit there. */
export interface PlanPart {
  activityId: string;
  name: string;
  range: MinuteRange;
  seats: number;
  slots: number;
}

export interface PlanOverflow {
  activityId: string;
  name: string;
  /** Players that did not fit in the window. */
  seats: number;
}

export interface SequentialPlan {
  parts: PlanPart[];
  overflow: PlanOverflow[];
  /** The tail of the window no part uses (null when the plan fills it). */
  unused: MinuteRange | null;
}

export const roundUpTo = (minutes: number, step: number): number => (step > 1 ? Math.ceil(minutes / step - EPS) * step : Math.ceil(minutes - EPS));

const lanesOf = (a: Pick<CoverageActivity, "parallelCapacity">, calendars: number): number => capacityOf(a) * Math.max(1, Math.floor(calendars));

/**
 * The sequential plan of one window: the činnosti IN THE ORDER GIVEN (their `seats` are the players still missing),
 * each from where the previous one ends, as long as its players need: ceil(seats / (capacity × calendars)) slots of
 * its duration, rounded up to the step. A činnost that does not fit whole gets the slots that do fit; the players
 * left over are the overflow. Shorter činnosti after it still get a go at the remaining room.
 */
export function sequentialPlan(window: PlanWindow, activities: readonly CoverageActivity[]): SequentialPlan {
  const { range } = window;
  const step = window.step !== undefined && window.step > 0 ? window.step : 5;
  const calendars = window.calendars ?? 1;
  const parts: PlanPart[] = [];
  const overflow: PlanOverflow[] = [];
  let cursor = range.start;
  for (const a of activities) {
    const seats = Math.max(0, Math.floor(a.seats));
    const dur = a.minutesPerSeat;
    if (seats <= 0 || !(dur > 0)) continue;
    const lanes = lanesOf(a, calendars);
    const slotsNeeded = Math.ceil(seats / lanes - EPS);
    const room = range.end - cursor;
    const fullLength = roundUpTo(slotsNeeded * dur, step);
    if (fullLength <= room) {
      parts.push({ activityId: a.activityId, name: a.name, range: { start: cursor, end: cursor + fullLength }, seats, slots: slotsNeeded });
      cursor += fullLength;
      continue;
    }
    const slotsFit = Math.floor(room / dur + EPS);
    if (slotsFit <= 0) {
      overflow.push({ activityId: a.activityId, name: a.name, seats });
      continue;
    }
    const placed = Math.min(seats, slotsFit * lanes);
    const length = Math.min(room, roundUpTo(slotsFit * dur, step));
    parts.push({ activityId: a.activityId, name: a.name, range: { start: cursor, end: cursor + length }, seats: placed, slots: slotsFit });
    cursor += length;
    if (seats - placed > 0) overflow.push({ activityId: a.activityId, name: a.name, seats: seats - placed });
  }
  return { parts, overflow, unused: cursor < range.end ? { start: cursor, end: range.end } : null };
}

/* ── The per-činnost coverage of all the picked windows ── */

export interface WindowReport {
  id: string | undefined;
  range: MinuteRange;
  dayKey: string | undefined;
  activityIds: readonly string[] | null;
  minutes: number;
  /** What the window holds, činnost by činnost (one part for a single-činnost window). */
  parts: PlanPart[];
  /** Minutes of the window no slot uses. */
  unusedMinutes: number;
  /** The window's činnosti had no players left before it: the whole window is spare ("Komplexní je už pokrytá"). */
  coveredAlready: boolean;
  /** Names of the činnosti this window is for, in the order's order (all of them for "Vše"). */
  names: string[];
  /**
   * Whole slots of the window no player needs (the capacity picked beyond the players), charged to the činnost the
   * window ends with; null when the rest is shorter than one of its slots.
   */
  spare: { activityId: string; name: string; seats: number; minutes: number } | null;
}

export interface PickActivityCoverage extends ActivityCoverage {
  /** 0-100 of this činnost's players covered. */
  percent: number;
  /** Places picked beyond this činnost's players (whole slots × capacity), and the minutes they hold. */
  spareSeats: number;
  spareMinutes: number;
}

export interface PickCoverage extends Coverage {
  perActivity: PickActivityCoverage[];
  /** Minutes of the picked windows that slots actually use. */
  usedMinutes: number;
  /** Picked minutes no slot uses (window rests, spare windows). */
  unusedMinutes: number;
  /** Places picked beyond the players, all činnosti together. */
  spareSeats: number;
  windows: WindowReport[];
}

const allowedSet = (w: PlanWindow, all: readonly string[]): Set<string> | null => {
  if (w.activityIds === null || w.activityIds === undefined || w.activityIds.length === 0) return null;
  const known = all.filter((id) => w.activityIds?.includes(id));
  return known.length === 0 || known.length >= all.length ? null : new Set(known);
};

const byTime = (a: PlanWindow, b: PlanWindow) => (a.dayKey ?? "9999").localeCompare(b.dayKey ?? "9999") || a.range.start - b.range.start || a.range.end - b.range.end;

/**
 * Every number the panel shows: per činnost, its players covered by whole slots of the windows that allow it, and per
 * window what it holds. Windows restricted to fewer činnosti are counted first (a spiro-only window is never starved by
 * a window that allows everything), then the rest in time order, each laid out by the sequential plan.
 *
 * `baseline` (enlarging a saved order): the numbers are those of the ADDED players only - what the whole pick covers
 * beyond the saved players, per činnost.
 */
export function pickCoverage(
  activities: readonly CoverageActivity[],
  windows: readonly PlanWindow[],
  options: { baseline?: readonly CoverageActivity[] } = {},
): PickCoverage {
  const all = activities.map((a) => a.activityId);
  const remaining = new Map(activities.map((a) => [a.activityId, Math.max(0, Math.floor(a.seats))] as const));
  const coveredSlots = new Map<string, number>();
  const usedMinutes = new Map<string, number>();

  const ordered = [...windows].sort((x, y) => {
    const ax = allowedSet(x, all);
    const ay = allowedSet(y, all);
    const sx = ax === null ? Number.POSITIVE_INFINITY : ax.size;
    const sy = ay === null ? Number.POSITIVE_INFINITY : ay.size;
    return sx - sy || byTime(x, y);
  });

  const reports = new Map<PlanWindow, WindowReport>();
  for (const w of ordered) {
    const allowed = allowedSet(w, all);
    const mine = activities.filter((a) => allowed === null || allowed.has(a.activityId));
    const before = mine.some((a) => (remaining.get(a.activityId) ?? 0) > 0);
    const plan = sequentialPlan(w, mine.map((a) => ({ ...a, seats: remaining.get(a.activityId) ?? 0 })));
    for (const p of plan.parts) {
      remaining.set(p.activityId, Math.max(0, (remaining.get(p.activityId) ?? 0) - p.seats));
      coveredSlots.set(p.activityId, (coveredSlots.get(p.activityId) ?? 0) + p.slots);
      const dur = activities.find((a) => a.activityId === p.activityId)?.minutesPerSeat ?? 0;
      usedMinutes.set(p.activityId, (usedMinutes.get(p.activityId) ?? 0) + p.slots * dur);
    }
    const used = plan.parts.reduce((n, p) => n + (p.range.end - p.range.start), 0);
    const unused = Math.max(0, windowMinutes(w) - used);
    /* The rest of the window as places: whole slots of the činnost it ends with (else the first one it allows). */
    const lastPart = plan.parts[plan.parts.length - 1];
    const charged = (lastPart !== undefined ? activities.find((a) => a.activityId === lastPart.activityId) : undefined) ?? mine.find((a) => a.minutesPerSeat > 0);
    let spare: WindowReport["spare"] = null;
    if (charged !== undefined && charged.minutesPerSeat > 0) {
      const slots = Math.floor(unused / charged.minutesPerSeat + EPS);
      if (slots > 0) spare = { activityId: charged.activityId, name: charged.name, seats: slots * lanesOf(charged, w.calendars ?? 1), minutes: slots * charged.minutesPerSeat };
    }
    reports.set(w, {
      id: w.id,
      range: w.range,
      dayKey: w.dayKey,
      activityIds: allowed === null ? null : [...allowed],
      minutes: windowMinutes(w),
      parts: plan.parts,
      unusedMinutes: unused,
      coveredAlready: !before && windowMinutes(w) > 0 && activities.some((a) => a.seats > 0),
      names: mine.map((a) => a.name),
      spare,
    });
  }
  const spareOf = (activityId: string) => {
    let seats = 0;
    let minutes = 0;
    for (const r of reports.values()) {
      if (r.spare?.activityId === activityId) {
        seats += r.spare.seats;
        minutes += r.spare.minutes;
      }
    }
    return { seats, minutes };
  };

  const perActivity: PickActivityCoverage[] = activities.map((a) => {
    const seats = Math.max(0, Math.floor(a.seats));
    const left = remaining.get(a.activityId) ?? 0;
    const coveredSeats = seats - left;
    const neededSlots = activitySlots(a);
    const slots = Math.min(neededSlots, coveredSlots.get(a.activityId) ?? 0);
    const noWindow =
      windows.length > 0 &&
      neededSlots > 0 &&
      !windows.some((w) => w.activityIds == null || w.activityIds.length === 0 || w.activityIds.includes(a.activityId));
    return {
      ...a,
      neededMinutes: activityNeed(a),
      allocatedMinutes: usedMinutes.get(a.activityId) ?? 0,
      neededSlots,
      coveredSlots: slots,
      remainingSlots: Math.ceil(left / capacityOf(a) - EPS),
      coveredSeats,
      remainingSeats: left,
      noWindow,
      percent: seats > 0 ? (left === 0 ? 100 : Math.min(99, Math.floor((coveredSeats / seats) * 100 + EPS))) : 0,
      spareSeats: spareOf(a.activityId).seats,
      spareMinutes: spareOf(a.activityId).minutes,
    };
  });

  const full = totals(perActivity, windows.map((w) => reports.get(w) as WindowReport));
  const baseline = options.baseline;
  if (baseline === undefined) return full;

  /* Enlarging: only the added players, covered by what the whole pick holds beyond the saved players. */
  const delta = activities.flatMap((a) => {
    const was = baseline.find((b) => b.activityId === a.activityId)?.seats ?? 0;
    const added = Math.max(0, Math.floor(a.seats) - Math.max(0, Math.floor(was)));
    if (added <= 0) return [];
    const now = full.perActivity.find((p) => p.activityId === a.activityId);
    const coveredSeats = Math.min(added, Math.max(0, (now?.coveredSeats ?? 0) - Math.max(0, Math.floor(was))));
    const neededSlots = activitySlots({ ...a, seats: added });
    const slots = Math.min(neededSlots, Math.ceil(coveredSeats / capacityOf(a) - EPS));
    const left = added - coveredSeats;
    return [{
      ...a,
      seats: added,
      neededMinutes: activityNeed({ ...a, seats: added }),
      allocatedMinutes: slots * Math.max(0, a.minutesPerSeat),
      neededSlots,
      coveredSlots: slots,
      remainingSlots: neededSlots - slots,
      coveredSeats,
      remainingSeats: left,
      noWindow: now?.noWindow ?? false,
      percent: added > 0 ? (left === 0 ? 100 : Math.min(99, Math.floor((coveredSeats / added) * 100 + EPS))) : 0,
      spareSeats: now?.spareSeats ?? 0,
      spareMinutes: now?.spareMinutes ?? 0,
    } satisfies PickActivityCoverage];
  });
  if (delta.length === 0) return full;
  const extra = totals(delta, full.windows);
  const needed = extra.neededMinutes;
  const picked = Math.min(needed, extra.usedMinutes);
  return {
    ...extra,
    pickedMinutes: picked,
    remainingMinutes: Math.max(0, needed - picked),
    surplusMinutes: 0,
    unusedMinutes: 0,
    additional: true,
  };
}

function totals(perActivity: PickActivityCoverage[], windows: WindowReport[]): PickCoverage {
  const sum = (pick: (a: PickActivityCoverage) => number) => perActivity.reduce((n, a) => n + pick(a), 0);
  const totalSeats = sum((a) => a.seats);
  const coveredSeats = sum((a) => a.coveredSeats);
  const needed = Math.max(0, Math.ceil(sum((a) => a.neededMinutes) - EPS));
  const picked = windows.reduce((n, w) => n + w.minutes, 0);
  const used = Math.round(sum((a) => a.allocatedMinutes));
  const covered = totalSeats > 0 && coveredSeats >= totalSeats;
  return {
    totalSeats,
    neededMinutes: needed,
    pickedMinutes: picked,
    remainingMinutes: Math.max(0, needed - used),
    surplusMinutes: Math.max(0, picked - used),
    coveredSeats,
    remainingSeats: totalSeats - coveredSeats,
    neededSlots: sum((a) => a.neededSlots),
    coveredSlots: sum((a) => a.coveredSlots),
    remainingSlots: sum((a) => a.remainingSlots),
    covered,
    percent: totalSeats > 0 ? (covered ? 100 : Math.min(99, Math.floor((coveredSeats / totalSeats) * 100 + EPS))) : 0,
    perActivity,
    usedMinutes: used,
    unusedMinutes: Math.max(0, picked - used),
    spareSeats: sum((a) => a.spareSeats),
    windows,
  };
}

/**
 * "Zkrátit na potřebu" (Etapa 12, the owner: "I added more slots by mistake and I'm losing money"): every window that
 * holds whole slots no player needs is cut back to what its players use, the end snapped UP to the window's grid
 * step; a window nothing uses goes (`range: null`). Only on the desk's click - never on its own. Windows with no
 * spare slot (a rest shorter than one slot, or fully used) are left exactly as they are.
 */
export function trimToNeed(activities: readonly CoverageActivity[], windows: readonly PlanWindow[]): { id: string; range: MinuteRange | null }[] {
  const coverage = pickCoverage(activities, windows);
  const out: { id: string; range: MinuteRange | null }[] = [];
  for (const w of windows) {
    if (w.id === undefined) continue;
    const report = coverage.windows.find((r) => r.id === w.id);
    if (report === undefined || report.spare === null) continue;
    const used = report.parts.reduce((n, p) => n + (p.range.end - p.range.start), 0);
    if (used <= 0) {
      out.push({ id: w.id, range: null });
      continue;
    }
    const step = w.step !== undefined && w.step > 0 ? w.step : 5;
    const end = Math.min(w.range.end, w.range.start + roundUpTo(used, step));
    if (end < w.range.end) out.push({ id: w.id, range: { start: w.range.start, end } });
  }
  return out;
}

/* ── "More options" under a činnost that is still short ── */

export interface MoreNeeded {
  seats: number;
  /** Minutes of calendar time the missing players need (whole slots). */
  minutes: number;
  /** Whole days of `dayMinutes` (null when the day's length is unknown). */
  days: number | null;
}

export function moreNeeded(a: Pick<CoverageActivity, "minutesPerSeat" | "parallelCapacity"> & { remainingSeats: number }, dayMinutes: number | null, calendars = 1): MoreNeeded {
  const seats = Math.max(0, a.remainingSeats);
  const slots = Math.ceil(seats / lanesOf(a, calendars) - EPS);
  const minutes = slots * Math.max(0, a.minutesPerSeat);
  const days = dayMinutes !== null && dayMinutes > 0 ? Math.ceil(minutes / dayMinutes - EPS) : null;
  return { seats, minutes, days };
}

const players = (n: number): string => `${n} ${n === 1 ? "hráč" : n >= 2 && n <= 4 ? "hráči" : "hráčů"}`;
const daysWord = (n: number): string => (n === 1 ? "celý den" : n >= 2 && n <= 4 ? "celé dny" : "celých dní");

/** "ještě 46 hráčů ≈ 69 h ≈ 9 celých dní při 1 kalendáři" (the days only when the day's length is known). */
export function moreNeededLine(need: MoreNeeded, calendars = 1): string {
  const base = `ještě ${players(need.seats)} ≈ ${formatFree(need.minutes)}`;
  if (need.days === null) return base;
  return `${base} ≈ ${need.days} ${daysWord(need.days)} při ${calendars} ${calendars === 1 ? "kalendáři" : "kalendářích"}`;
}

/** The open minutes of a working-hours row (break taken out); 0 when shut or unknown. */
export function openMinutesOf(row: { isOpen: boolean; startTime: string | null; endTime: string | null; breakStart: string | null; breakEnd: string | null } | undefined): number {
  if (row === undefined || !row.isOpen) return 0;
  const open = parseTimeOfDay(row.startTime);
  const close = parseTimeOfDay(row.endTime);
  if (open === null || close === null || close <= open) return 0;
  const bs = parseTimeOfDay(row.breakStart);
  const be = parseTimeOfDay(row.breakEnd);
  const pause = bs !== null && be !== null && be > bs ? be - bs : 0;
  return close - open - pause;
}

/**
 * "Přidat další den": from the free blocks of one day, the time ONE činnost's missing players need - whole slots
 * from the start of each block, never more than the players need, the rest of the day left free.
 */
export function takeForActivity(
  blocks: readonly FreeBlock[],
  activity: Pick<CoverageActivity, "minutesPerSeat" | "parallelCapacity">,
  remainingSeats: number,
  step = 5,
): { blocks: FreeBlock[]; slots: number; trimmed: boolean } {
  const dur = activity.minutesPerSeat;
  let left = Math.ceil(Math.max(0, remainingSeats) / lanesOf(activity, 1) - EPS);
  if (!(dur > 0) || left <= 0) return { blocks: [], slots: 0, trimmed: false };
  const out: FreeBlock[] = [];
  let slots = 0;
  for (const b of blocks) {
    if (left <= 0) break;
    const length = b.range.end - b.range.start;
    const fit = Math.min(left, Math.floor(length / dur + EPS));
    if (fit <= 0) continue;
    out.push({ calendarId: b.calendarId, range: { start: b.range.start, end: b.range.start + Math.min(length, roundUpTo(fit * dur, step)) } });
    left -= fit;
    slots += fit;
  }
  const taken = out.reduce((n, b) => n + (b.range.end - b.range.start), 0);
  const free = blocks.reduce((n, b) => n + (b.range.end - b.range.start), 0);
  return { blocks: out, slots, trimmed: taken < free };
}

/* ── Splitting a window into parts (the bubble's "Rozdělit") ── */

/** A part of a picked window while the desk splits it: its time and the činnosti it is for (null = all). */
export interface AskPart {
  range: MinuteRange;
  activityIds: string[] | null;
}

/** The grid step a window sits on: the calendar's step when it divides the window, else 15, 10, 5, 1. */
export function stepFor(range: MinuteRange, base: number): number {
  const length = range.end - range.start;
  for (const s of [base, 15, 10, 5, 1]) {
    if (s > 0 && Number.isInteger(s) && range.start % s === 0 && length % s === 0) return s;
  }
  return 1;
}

export const canSplit = (range: MinuteRange, step: number): boolean => range.end - range.start >= 2 * step;

/** The middle of a range snapped down to the step, never closer than one step to either edge. */
export function midpointOf(range: MinuteRange, step: number): number {
  const length = range.end - range.start;
  const mid = range.start + Math.floor(length / 2 / step) * step;
  return Math.min(range.end - step, Math.max(range.start + step, mid));
}

/** `parts[index]` cut in two at `at` (snapped and clamped inside it); both halves keep its činnosti. */
export function cutPart(parts: readonly AskPart[], index: number, at: number, step: number): AskPart[] {
  const p = parts[index];
  if (p === undefined || !canSplit(p.range, step)) return [...parts];
  const snapped = Math.round(at / step) * step;
  const cut = Math.min(p.range.end - step, Math.max(p.range.start + step, snapped));
  const copy = (ids: string[] | null) => (ids === null ? null : [...ids]);
  return [
    ...parts.slice(0, index),
    { range: { start: p.range.start, end: cut }, activityIds: copy(p.activityIds) },
    { range: { start: cut, end: p.range.end }, activityIds: copy(p.activityIds) },
    ...parts.slice(index + 1),
  ];
}

/** The cut between `parts[index]` and the next one moved to `at` (each side keeps at least one step). */
export function moveCut(parts: readonly AskPart[], index: number, at: number, step: number): AskPart[] {
  const a = parts[index];
  const b = parts[index + 1];
  if (a === undefined || b === undefined) return [...parts];
  const snapped = Math.round(at / step) * step;
  const cut = Math.min(b.range.end - step, Math.max(a.range.start + step, snapped));
  return parts.map((p, i) => (i === index ? { ...p, range: { start: p.range.start, end: cut } } : i === index + 1 ? { ...p, range: { start: cut, end: p.range.end } } : p));
}

/** The cut between `parts[index]` and the next one removed: one part again, with the first one's činnosti. */
export function mergeCut(parts: readonly AskPart[], index: number): AskPart[] {
  const a = parts[index];
  const b = parts[index + 1];
  if (a === undefined || b === undefined) return [...parts];
  return [...parts.slice(0, index), { range: { start: a.range.start, end: b.range.end }, activityIds: a.activityIds === null ? null : [...a.activityIds] }, ...parts.slice(index + 2)];
}

/**
 * "Rozdělit podle plánu": the planned parts of a window become its parts, each for its one činnost; the tail no part
 * uses keeps the window's own činnosti (nothing is dropped silently). A plan with nothing in it changes nothing.
 */
export function partsFromPlan(part: AskPart, plan: readonly PlanPart[]): AskPart[] {
  if (plan.length === 0) return [part];
  const out: AskPart[] = plan.map((p) => ({ range: { start: p.range.start, end: p.range.end }, activityIds: [p.activityId] }));
  const last = plan[plan.length - 1] as PlanPart;
  if (last.range.end < part.range.end) out.push({ range: { start: last.range.end, end: part.range.end }, activityIds: part.activityIds === null ? null : [...part.activityIds] });
  return out;
}
