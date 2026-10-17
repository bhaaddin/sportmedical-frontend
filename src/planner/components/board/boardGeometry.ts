/*
 * Geometry of the week board: minutes <-> design pixels, the zoom ("Rozlišení") and the
 * hour labels. Pure; no DOM, no React.
 *
 * The prototype draws 07:00-19:00 into 455 px (`TIMELINE_HEIGHT`, 37.9167 px an hour). That is
 * the "30 min" level of our calendar and it stays exactly so. The calendar's other levels
 * (`grid/resolution.ts`: Hodina 46 / 30 min 52 / 15 min 65 / 10 min 78 px an hour) enlarge the
 * board by the SAME ratio they enlarge our old grid, never below the prototype's own height:
 *
 *     scale(zoom) = max(1, pxPerHour(zoom) / pxPerHour(1))      1 / 1 / 1.25 / 1.5
 *
 * so "Hodina" and "30 min" share one size (they differ in the lines and the snapping step) and
 * the finer levels grow the board; the board body then scrolls (see `board.css`).
 */
import { pxPerHour } from '../../../components/booking/grid/resolution';
import { TIMELINE_HEIGHT } from '../../model';
import type { PlanningWindow } from '../../model';

/** The prototype puts each hour label 11 px below its hour line. */
export const HOUR_LABEL_OFFSET = 11;

/** The smallest card the prototype draws (`Math.max(25, ...)`). */
export const MIN_CARD_HEIGHT = 25;

/** A card shorter than this is drawn `compact` (prototype `height<52`). */
export const COMPACT_BELOW = 52;

export interface BoardGeometry {
  startMinutes: number;
  endMinutes: number;
  spanMinutes: number;
  /** Design px per minute. */
  pxPerMinute: number;
  /** Design px per hour. */
  pxPerHour: number;
  /** Height of the whole timeline in design px (>= 455). */
  height: number;
  /** Enlargement against the prototype (1 = the file). */
  scale: number;
}

/** The enlargement of the board at a calendar zoom (1 = the prototype's 455 px). */
export function boardScaleFor(zoom: number): number {
  const base = pxPerHour(1);
  if (!(base > 0)) return 1;
  return Math.max(1, pxPerHour(zoom) / base);
}

export function boardGeometry(window: PlanningWindow, zoom = 1): BoardGeometry {
  const spanMinutes = Math.max(60, window.endMinutes - window.startMinutes);
  const scale = boardScaleFor(zoom);
  const pxPerMinute = (TIMELINE_HEIGHT / spanMinutes) * scale;
  return {
    startMinutes: window.startMinutes,
    endMinutes: window.startMinutes + spanMinutes,
    spanMinutes,
    pxPerMinute,
    pxPerHour: pxPerMinute * 60,
    height: spanMinutes * pxPerMinute,
    scale,
  };
}

/** Distance from the top of the timeline of a wall-clock minute. */
export const yOfMinute = (g: BoardGeometry, minute: number): number => (minute - g.startMinutes) * g.pxPerMinute;

/** The wall-clock minute at `y` px from the top of the timeline (not clamped). */
export const minuteAtY = (g: BoardGeometry, y: number): number => g.startMinutes + y / g.pxPerMinute;

/** Top and height of a span, cut to the window; the height is never below `minHeight`. */
export function boxOfSpan(
  g: BoardGeometry,
  start: number,
  end: number,
  minHeight = 0,
): { top: number; height: number } {
  const from = Math.max(start, g.startMinutes);
  const to = Math.min(end, g.endMinutes);
  return { top: yOfMinute(g, from), height: Math.max(minHeight, Math.max(0, to - from) * g.pxPerMinute) };
}

/** A session card's box exactly like `weekEventsModel` (the same 25 px floor), at any zoom. */
export function cardBox(g: BoardGeometry, start: number, end: number): { top: number; height: number; compact: boolean } {
  const top = yOfMinute(g, start);
  const height = Math.max(MIN_CARD_HEIGHT, (end - start) * g.pxPerMinute);
  return { top, height, compact: height < COMPACT_BELOW };
}

/** Hour labels ("7:00" … "18:00"): `top` as the prototype's `renderWeekHead`. */
export function hourLabels(g: BoardGeometry): { label: string; hour: number; top: number }[] {
  const out: { label: string; hour: number; top: number }[] = [];
  const first = Math.ceil(g.startMinutes / 60);
  const last = Math.floor(g.endMinutes / 60);
  for (let h = first; h < last; h++) {
    out.push({ label: `${h}:00`, hour: h, top: (h * 60 - g.startMinutes) * g.pxPerMinute + HOUR_LABEL_OFFSET });
  }
  return out;
}

/**
 * Lines the board draws: every hour (the CSS does it, exactly as the file) plus the finer step of the
 * 15 / 10 minute levels. At 30 min and Hodina the file's own hour lines are all there is.
 */
export function stepLineHeight(g: BoardGeometry, stepMinutes: number): number | null {
  if (!(stepMinutes > 0) || stepMinutes >= 30) return null;
  return stepMinutes * g.pxPerMinute;
}

/** The day column (0..6) under a horizontal fraction of the board, clamped. */
export function columnAtFraction(fraction: number, columns = 7): number {
  return Math.min(columns - 1, Math.max(0, Math.floor(fraction * columns)));
}

/** `style.left` / `style.width` of a card in `col`, `lane` of `lanes` - the prototype's strings when `lanes` is 1. */
export function cardLeftWidth(col: number, lane: number, lanes: number): { left: string; width: string } {
  if (lanes <= 1) return { left: `calc(${col} * 100% / 7 + 3px)`, width: 'calc(100% / 7 - 6px)' };
  return {
    left: `calc(${col} * 100% / 7 + ${lane} * (100% / 7) / ${lanes} + 3px)`,
    width: `calc((100% / 7) / ${lanes} - 6px)`,
  };
}

/** Snap a wall-clock minute DOWN to a step ("slot" the pointer is in). */
export const floorToStep = (minute: number, step: number): number => Math.floor(minute / (step > 0 ? step : 30)) * (step > 0 ? step : 30);

/**
 * The slot range a drag covered, from the slot it began in to the slot the pointer is in now -
 * either direction, always at least one slot, kept inside the window (`dragRange` of the old grid).
 */
export function selectionRange(
  g: BoardGeometry,
  anchorMinute: number,
  currentMinute: number,
  step: number,
): { start: number; end: number } {
  const slot = step > 0 ? step : 30;
  const clamp = (m: number) => Math.min(Math.max(m, g.startMinutes), g.endMinutes - 1);
  const a = floorToStep(clamp(anchorMinute), slot);
  const b = floorToStep(clamp(currentMinute), slot);
  const start = Math.max(g.startMinutes, Math.min(a, b));
  const end = Math.min(g.endMinutes, Math.max(a, b) + slot);
  return { start, end: Math.max(end, Math.min(g.endMinutes, start + slot)) };
}
