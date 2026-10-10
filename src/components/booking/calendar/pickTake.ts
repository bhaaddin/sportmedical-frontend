import type { MinuteRange } from "../grid/timeRange";
import type { CoverageActivity } from "../../clubs/order/coverage";
import type { FreeBlock } from "./pickDays";
import { pickCoverage, type PickCoverage, type PlanWindow } from "./pickPlan";

/*
 * The one-tap shortcuts of "výběr termínů" ("Celý den" in the month, a free block on the phone) take the free time of
 * the day or block ONLY UP TO what the order still misses - rounded up to a whole slot - and leave the rest free for
 * ordinary bookings. Everything the desk marks by hand (painting, tap-start/tap-end, resizing) stays exactly as marked;
 * that never passes through here.
 *
 * Pure: the missing need is read from the same calculator the panel uses (`pickCoverage`, per činnost and per
 * window), so the allocation is the one the desk already sees.
 */

export interface TakeState {
  activities: readonly CoverageActivity[];
  /** Enlarging an order: the order as saved (see `pickCoverage`). */
  baseline?: readonly CoverageActivity[];
  windows: readonly PlanWindow[];
}

/** The coverage the panel shows for this state - one expression for the panel and for the shortcuts. */
export function coverageOf(state: TakeState): PickCoverage {
  return pickCoverage(state.activities, state.windows, state.baseline === undefined ? {} : { baseline: state.baseline });
}

export interface TakeResult {
  /** What the order already has covers every slot: the shortcut adds nothing. */
  covered: boolean;
  /** The ranges to pick, in the order of `blocks`, never longer than the free time. */
  blocks: FreeBlock[];
  /** Minutes of those ranges. */
  minutes: number;
  /** All the free time offered. */
  freeMinutes: number;
  /** Less than all the free time was taken (the rest stays free for ordinary bookings). */
  trimmed: boolean;
}

const lengthOf = (r: MinuteRange): number => r.end - r.start;

/**
 * The part of `blocks` a shortcut tap takes: from the first free minute onwards, as many minutes as are still missing
 * (rounded up to a whole slot: the length of the shortest činnost that still misses slots), never more than the free
 * time. With no known need (no players) the blocks are taken whole, as before.
 */
export function takeNeeded(state: TakeState, blocks: readonly FreeBlock[]): TakeResult {
  const freeMinutes = blocks.reduce((n, b) => n + lengthOf(b.range), 0);
  const whole: TakeResult = { covered: false, blocks: blocks.map((b) => ({ ...b, range: { ...b.range } })), minutes: freeMinutes, freeMinutes, trimmed: false };
  const now = coverageOf(state);
  if (now.neededMinutes <= 0) return whole;
  if (now.covered) return { covered: true, blocks: [], minutes: 0, freeMinutes, trimmed: false };

  const lengths = now.perActivity.filter((a) => a.remainingSlots > 0 && a.minutesPerSeat > 0).map((a) => a.minutesPerSeat);
  const slot = lengths.length > 0 ? Math.min(...lengths) : 1;
  /* The trial window is the first `m` minutes of the blocks, laid out as the blocks are (a "Vše" window per block). */
  let take = freeMinutes;
  for (let m = slot; m < freeMinutes; m += slot) {
    const trial: PlanWindow[] = [];
    let left = m;
    for (const b of blocks) {
      if (left <= 0) break;
      const len = Math.min(left, lengthOf(b.range));
      trial.push({ range: { start: b.range.start, end: b.range.start + len }, activityIds: null });
      left -= len;
    }
    const next = coverageOf({ ...state, windows: [...state.windows, ...trial] });
    if (next.covered) {
      take = m;
      break;
    }
  }
  if (take >= freeMinutes) return whole;

  const out: FreeBlock[] = [];
  let left = take;
  for (const b of blocks) {
    if (left <= 0) break;
    const len = Math.min(left, lengthOf(b.range));
    out.push({ calendarId: b.calendarId, range: { start: b.range.start, end: b.range.start + len } });
    left -= len;
  }
  return { covered: false, blocks: out, minutes: take, freeMinutes, trimmed: true };
}

/** `range` with the `cuts` taken out: what is left of it, early to late. */
export function subtractRanges(range: MinuteRange, cuts: readonly MinuteRange[]): MinuteRange[] {
  let pieces: MinuteRange[] = [{ ...range }];
  for (const cut of cuts) {
    const next: MinuteRange[] = [];
    for (const p of pieces) {
      if (cut.end <= p.start || cut.start >= p.end) {
        next.push(p);
        continue;
      }
      if (cut.start > p.start) next.push({ start: p.start, end: cut.start });
      if (cut.end < p.end) next.push({ start: cut.end, end: p.end });
    }
    pieces = next;
  }
  return pieces.filter((p) => p.end > p.start);
}
