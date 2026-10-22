/*
 * The board's span -> pixel arithmetic, apart from `boardGeometry.ts` on purpose: this file imports nothing at run time, so the lazy layers
 * (lunch, worker clash) can use it without dragging the planner's whole model (which `boardGeometry` imports for a constant) into a chunk
 * of its own - that split alone made the planner's first load 7 kB heavier.
 */
import type { BoardGeometry } from './boardGeometry';

/** Pixels from the top of the timeline for a wall-clock minute (not clamped). */
export const yOfMinute = (g: Pick<BoardGeometry, 'startMinutes' | 'pxPerMinute'>, minute: number): number => (minute - g.startMinutes) * g.pxPerMinute;

/** The wall-clock minute at `y` px from the top of the timeline (not clamped). */
export const minuteAtY = (g: Pick<BoardGeometry, 'startMinutes' | 'pxPerMinute'>, y: number): number => g.startMinutes + y / g.pxPerMinute;

/** Top and height of a span, cut to the window; the height is never below `minHeight`. */
export function boxOfSpan(
  g: Pick<BoardGeometry, 'startMinutes' | 'endMinutes' | 'pxPerMinute'>,
  start: number,
  end: number,
  minHeight = 0,
): { top: number; height: number } {
  const from = Math.max(start, g.startMinutes);
  const to = Math.min(end, g.endMinutes);
  return { top: yOfMinute(g, from), height: Math.max(minHeight, Math.max(0, to - from) * g.pxPerMinute) };
}
