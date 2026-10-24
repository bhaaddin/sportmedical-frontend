/*
 * R23 - a click that leaves a small hole.
 *
 * Owner: "When I click in the wrong slot, say at 10:40, and there is a gap of 10 minutes between the first and the second term, there has
 * to be a choice: either the booking starts at 10:30 right after the previous term, or I confirm 10:40 as clicked because I am tired and
 * want 10 minutes of rest."
 *
 * Pure minutes-of-the-day rules, no DOM. `busy` is what the calendar cannot give on that day, sorted and MERGED (`busyIntervals`:
 * closed time, lunch, bookings, blocks - a club's hold is a block - and the minutes already gone today). Whatever touches the
 * clicked place is therefore measured the same way, whether it is a booking, the lunch, a club block or the opening time.
 *
 *   lead  the hole between the end of what comes before the clicked start and the start: 0 < hole < one slot -> ask
 *         ("Hned po předchozím" = start at that end, same length; "Přesně jak jsem klikl" = as clicked);
 *   tail  the hole between the booking's end and what comes after: 0 < hole < the board step -> ask
 *         ("Posunout na konec" = end where the next starts, same length; "Nechat").
 * The moved place is offered only when it is itself free (it passes the same `busy`): never into the lunch, closed time, a club hold
 * or another booking. No place before / after (nothing busy there) means nothing to ask.
 */
export interface MinuteSpan {
  start: number;
  end: number;
}

export type GapKind = 'lead' | 'tail';

export interface GapQuestion {
  kind: GapKind;
  /** The hole in minutes. */
  gap: number;
  /** The place if the booking is moved against its neighbour (same length). */
  moved: MinuteSpan;
  /** The place as clicked. */
  asClicked: MinuteSpan;
}

const overlaps = (busy: readonly MinuteSpan[], r: MinuteSpan): boolean => busy.some((b) => r.start < b.end && b.start < r.end);

/** The end of the busy stretch that comes before `start` (the last one ending at or before it), or null when nothing comes before. */
export function previousEnd(busy: readonly MinuteSpan[], start: number): number | null {
  let end: number | null = null;
  for (const b of busy) if (b.end <= start && (end === null || b.end > end)) end = b.end;
  return end;
}

/** The start of the busy stretch that comes after `end`, or null when nothing does. */
export function nextStart(busy: readonly MinuteSpan[], end: number): number | null {
  let start: number | null = null;
  for (const b of busy) if (b.start >= end && (start === null || b.start < start)) start = b.start;
  return start;
}

/** Before the booking: a hole shorter than `slot` after what comes before. */
export function leadGap(busy: readonly MinuteSpan[], range: MinuteSpan, slot: number): GapQuestion | null {
  if (!(slot > 0) || range.end <= range.start) return null;
  const prev = previousEnd(busy, range.start);
  if (prev === null) return null;
  const gap = range.start - prev;
  if (gap <= 0 || gap >= slot) return null;
  const moved = { start: prev, end: prev + (range.end - range.start) };
  if (overlaps(busy, moved)) return null;
  return { kind: 'lead', gap, moved, asClicked: range };
}

/** After the booking: a hole shorter than `step` before what comes after. */
export function tailGap(busy: readonly MinuteSpan[], range: MinuteSpan, step: number): GapQuestion | null {
  if (!(step > 0) || range.end <= range.start) return null;
  const next = nextStart(busy, range.end);
  if (next === null) return null;
  const gap = next - range.end;
  if (gap <= 0 || gap >= step) return null;
  const moved = { start: next - (range.end - range.start), end: next };
  if (overlaps(busy, moved)) return null;
  return { kind: 'tail', gap, moved, asClicked: range };
}

/** The first question for a click (the lead one, else the tail one); null = book as clicked without asking. */
export function firstGapQuestion(busy: readonly MinuteSpan[], range: MinuteSpan, slot: number, step: number): GapQuestion | null {
  return leadGap(busy, range, slot) ?? tailGap(busy, range, step);
}

/** After a LEAD answer the place may have changed: the tail question is asked about the place that was chosen. */
export function nextGapQuestion(busy: readonly MinuteSpan[], answered: GapKind, chosen: MinuteSpan, step: number): GapQuestion | null {
  return answered === 'lead' ? tailGap(busy, chosen, step) : null;
}

export const GAP_TEXT = {
  leadTitle: (gap: number) => `Mezi termíny zůstane mezera ${gap} min`,
  tailTitle: (gap: number) => `Za termínem zůstane mezera ${gap} min`,
  lead: (hhmm: string) => `Hned po předchozím (${hhmm})`,
  asClicked: (hhmm: string) => `Přesně jak jsem klikl (${hhmm})`,
  tail: (hhmm: string) => `Posunout na konec (do ${hhmm})`,
  keep: 'Nechat',
  leadHint: 'Začít hned po předchozím termínu, nebo nechat čas, který jste vybrali?',
  tailHint: 'Posunout termín k dalšímu, nebo nechat mezeru?',
} as const;

/** "10:30" for a minute of the day. */
export const withHHMM = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
