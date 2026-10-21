/*
 * The clinic's open time of a day: the opening hours without the lunch break (both come from the clinic's own
 * settings, as `DayMark.hours` / `DayMark.lunch`; nothing is a literal here).
 *
 * The rule (owner, 21. 10. 2026 - "the planner ate my lunch break"): a club term never contains the break and never
 * reaches outside the opening hours. Slots are laid one after another INSIDE the open pieces of the day; a slot that
 * would straddle the break moves to the piece after it; the minutes, slots, prices and the need calculator therefore
 * only ever see time the clinic really works. A block that crosses the break becomes two terms, one on each side.
 *
 * Pure: no React, no network. Without a day mark (the demo, a day nobody read) the open time is the planning window.
 */
import { timeAsMinutes } from './time';
import type { ClockTime, DayMark, IsoDate, PlannerContext, PlanningWindow } from './types';

export interface MinutePiece {
  start: number;
  end: number;
}

/** A run of whole slots of one činnost inside one open piece. */
export interface SlotPart {
  start: number;
  end: number;
  slots: number;
}

const minutes = (t: ClockTime | undefined | null): number | null => {
  if (!t) return null;
  const m = timeAsMinutes(t);
  return Number.isFinite(m) ? m : null;
};

/** The open pieces of one day: the hours (or the whole planning window) minus the lunch break. A closed day has none. */
export function openPieces(window: PlanningWindow, mark?: DayMark | null): MinutePiece[] {
  if (!mark) return [{ start: window.startMinutes, end: window.endMinutes }];
  if (mark.closed) return [];
  const from = minutes(mark.hours?.from);
  const to = minutes(mark.hours?.to);
  const start = Math.max(window.startMinutes, from ?? window.startMinutes);
  const end = Math.min(window.endMinutes, to ?? window.endMinutes);
  if (!(end > start)) return [];
  const bs = minutes(mark.lunch?.from);
  const be = minutes(mark.lunch?.to);
  if (bs !== null && be !== null && be > bs && be > start && bs < end) {
    const out: MinutePiece[] = [];
    if (bs > start) out.push({ start, end: Math.min(bs, end) });
    if (be < end) out.push({ start: Math.max(be, start), end });
    return out;
  }
  return [{ start, end }];
}

type WithMarks = Pick<PlannerContext, 'window'> & { dayMarks?: Readonly<Record<IsoDate, DayMark>> };

/** `openPieces` of a date through the context's day marks (or the ones passed in). */
export const piecesOf = (ctx: WithMarks, date: IsoDate, marks: Readonly<Record<IsoDate, DayMark>> | undefined = ctx.dayMarks): MinutePiece[] =>
  openPieces(ctx.window, marks?.[date]);

/**
 * Lay `quantity` whole slots of `duration` minutes from `from` downwards through the open pieces. A gap (break, closed
 * time) is skipped; a slot never straddles it. `placed` < `quantity` when the day runs out of open time.
 */
export function layoutSlots(
  pieces: readonly MinutePiece[],
  from: number,
  quantity: number,
  duration: number,
): { parts: SlotPart[]; placed: number } {
  const parts: SlotPart[] = [];
  if (!(duration > 0) || quantity <= 0) return { parts, placed: 0 };
  let left = quantity;
  for (const p of [...pieces].sort((a, b) => a.start - b.start)) {
    if (left === 0) break;
    const s = Math.max(p.start, from);
    const room = Math.floor((p.end - s) / duration + 1e-9);
    if (room <= 0) continue;
    const take = Math.min(room, left);
    parts.push({ start: s, end: s + take * duration, slots: take });
    left -= take;
  }
  return { parts, placed: quantity - left };
}

/** How many whole slots fit from `from` to the end of the day's open time. */
export const slotsFrom = (pieces: readonly MinutePiece[], from: number, duration: number): number =>
  layoutSlots(pieces, from, Number.MAX_SAFE_INTEGER, duration).placed;

/** How many whole slots fit before `anchor` (laid backwards from it). */
export function slotsBefore(pieces: readonly MinutePiece[], anchor: number, duration: number): number {
  if (!(duration > 0)) return 0;
  let n = 0;
  for (const p of pieces) {
    const e = Math.min(p.end, anchor);
    n += Math.max(0, Math.floor((e - p.start) / duration + 1e-9));
  }
  return n;
}

/**
 * Where `quantity` slots that END at `anchor` begin (laid backwards through the open pieces, skipping gaps). The caller
 * lays them out again downwards from that start, so the block that is drawn is the block that is saved.
 */
export function startBefore(pieces: readonly MinutePiece[], anchor: number, quantity: number, duration: number): { start: number; placed: number } {
  let left = quantity;
  let start = anchor;
  for (const p of [...pieces].sort((a, b) => b.start - a.start)) {
    if (left === 0) break;
    const e = Math.min(p.end, anchor);
    const room = Math.floor((e - p.start) / duration + 1e-9);
    if (room <= 0) continue;
    const take = Math.min(room, left);
    start = e - take * duration;
    left -= take;
  }
  return { start, placed: quantity - left };
}

const clock = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Why [start, end) is not clinic time on `date` - null when it lies inside one open piece (or when nothing is known
 * about the day). The reasons name the break / the hours, which come from the clinic's settings.
 */
export function openTimeBlock(ctx: WithMarks, date: IsoDate, start: number, end: number, marks?: Readonly<Record<IsoDate, DayMark>>): string | null {
  const all = marks ?? ctx.dayMarks;
  const mark = all?.[date];
  if (!mark) return null;
  if (mark.closed) return `V tento den je zavřeno${mark.label ? ` (${mark.label})` : ''}.`;
  const pieces = openPieces(ctx.window, mark);
  if (pieces.some((p) => start >= p.start && end <= p.end)) return null;
  const bs = minutes(mark.lunch?.from);
  const be = minutes(mark.lunch?.to);
  if (bs !== null && be !== null && start < be && end > bs) return `Termín zasahuje do polední pauzy ${clock(bs)}–${clock(be)}. Pauza zůstává volná.`;
  const hs = minutes(mark.hours?.from);
  const he = minutes(mark.hours?.to);
  if (hs !== null && he !== null) return `Termín je mimo ordinační dobu ${clock(hs)}–${clock(he)}.`;
  return 'Termín je mimo čas, kdy ordinace pracuje.';
}
