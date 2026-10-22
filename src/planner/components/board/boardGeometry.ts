/*
 * Geometry of the week board: minutes <-> design pixels, the zoom and the hour labels. Pure; no DOM, no React.
 *
 * The prototype draws 07:00-19:00 into 455 px (`TIMELINE_HEIGHT`, 37.9167 px an hour). That is zoom 1 and it stays
 * exactly so. The board is zoomable from 1x to 6x (`boardZoom.ts`): the timeline is `zoom` times as tall as the fitted
 * one,
 *
 *     height(zoom) = fittedHeight x zoom       fittedHeight = the board body's own height (455 px at the file's size)
 *
 * and the board body scrolls inside the panel (see `board.css`). Everything else - cards, bands, the now line, the
 * selection, the ghosts - is placed by the pixels-per-minute of THIS geometry, so it follows the zoom without knowing it.
 */
import { clampZoom, lineStepFor } from './boardZoom';
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
  /** Height of the whole timeline in design px (the fitted height x the zoom). */
  height: number;
  /** Enlargement against the prototype (1 = the file). */
  scale: number;
}

/** The enlargement of the board at a zoom (1 = the prototype's 455 px, 6 = six times as tall). */
export function boardScaleFor(zoom: number): number {
  return clampZoom(zoom);
}

/** Timeline height of the standard-ordering layout: the club deck is gone, the board takes its place (455 + 174). */
export const STANDARD_TIMELINE_HEIGHT = 629;

export function boardGeometry(
  window: PlanningWindow,
  zoom = 1,
  baseHeight = TIMELINE_HEIGHT,
  /** The span `baseHeight` is spread over, when `window` was widened beyond it (the minute keeps its height, the board grows). */
  referenceSpanMinutes?: number,
): BoardGeometry {
  const spanMinutes = Math.max(60, window.endMinutes - window.startMinutes);
  const scale = boardScaleFor(zoom);
  const pxPerMinute = (baseHeight / Math.max(60, referenceSpanMinutes ?? spanMinutes)) * scale;
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
export { boxOfSpan, minuteAtY, yOfMinute } from './spanBox';
import { yOfMinute } from './spanBox';

/** A session card's box exactly like `weekEventsModel` (the same 25 px floor), at any zoom. */
export function cardBox(g: BoardGeometry, start: number, end: number): { top: number; height: number; compact: boolean } {
  const top = yOfMinute(g, start);
  const height = Math.max(MIN_CARD_HEIGHT, (end - start) * g.pxPerMinute);
  return { top, height, compact: height < COMPACT_BELOW };
}

/** One label of the hour column: "7:00" at an hour, "7:10" / "7:15" / "7:30" between (`sub`). */
export interface HourLabel {
  label: string;
  hour: number;
  /** Minute of the hour (0 for an hour label). */
  minute: number;
  top: number;
  /** A label between two hours - drawn smaller and dimmer. */
  sub: boolean;
}

/**
 * The labels of the hour column. `stepMinutes` 60 (the file) gives "7:00" … "18:00", `top` as the prototype's
 * `renderWeekHead`; 30 / 15 / 10 add the labels of those lines between the hours ("7:30", "7:15", "7:10" …), in the same
 * style as the hour labels, the same 11 px below their line.
 */
export function hourLabels(g: BoardGeometry, stepMinutes = 60): HourLabel[] {
  const step = stepMinutes > 0 && stepMinutes < 60 ? stepMinutes : 60;
  const out: HourLabel[] = [];
  const first = Math.ceil(g.startMinutes / step) * step;
  for (let m = first; m < g.endMinutes; m += step) {
    const hour = Math.floor(m / 60);
    const minute = m % 60;
    out.push({
      label: `${hour}:${String(minute).padStart(2, '0')}`,
      hour,
      minute,
      top: (m - g.startMinutes) * g.pxPerMinute + HOUR_LABEL_OFFSET,
      sub: minute !== 0,
    });
  }
  return out;
}

/**
 * Lines the board draws besides the hour lines (the CSS does those, exactly as the file): the step lines between the hours
 * from 2x up (every 30 / 15 / 10 minutes). `null` at 1x - the file has hour lines alone.
 */
export function stepLineHeight(g: BoardGeometry, stepMinutes: number): number | null {
  if (!(stepMinutes > 0) || stepMinutes >= 60) return null;
  return stepMinutes * g.pxPerMinute;
}

/** The step lines of a zoom (`lineStepFor`), as `stepLineHeight`. */
export const stepLineHeightFor = (g: BoardGeometry, zoom: number): number | null => stepLineHeight(g, lineStepFor(zoom));

/** The day column (0..6) under a horizontal fraction of the board, clamped. */
export function columnAtFraction(fraction: number, columns = 7): number {
  return Math.min(columns - 1, Math.max(0, Math.floor(fraction * columns)));
}

/**
 * The day column and - when the day is split into one column per calendar (reviewer 2.4) - the calendar's sub-column under
 * a horizontal fraction of the board. `subs` 1 is the plain week: `sub` is always 0.
 */
export function cellAtFraction(fraction: number, subs = 1, columns = 7): { col: number; sub: number } {
  const count = Math.max(1, Math.floor(subs));
  const x = Math.min(columns * count - 1, Math.max(0, Math.floor(fraction * columns * count)));
  return { col: Math.floor(x / count), sub: x % count };
}

/**
 * `style.left` / `style.width` of a card in `col`, `lane` of `lanes` - the prototype's strings when `lanes` is 1. With a day
 * split into `subs` calendar columns the card lives in column `sub` of them and the lanes divide THAT column.
 */
export function cardLeftWidth(col: number, lane: number, lanes: number, sub = 0, subs = 1): { left: string; width: string } {
  if (subs <= 1) {
    if (lanes <= 1) return { left: `calc(${col} * 100% / 7 + 3px)`, width: 'calc(100% / 7 - 6px)' };
    return {
      left: `calc(${col} * 100% / 7 + ${lane} * (100% / 7) / ${lanes} + 3px)`,
      width: `calc((100% / 7) / ${lanes} - 6px)`,
    };
  }
  /* the sub-column is (100% / 7) / subs wide and starts at (col * subs + sub) of them; a gap of 2px each side keeps the neighbours apart */
  const unit = `(100% / 7 / ${subs})`;
  const origin = `calc((${col} * ${subs} + ${sub}) * ${unit}`;
  if (lanes <= 1) return { left: `${origin} + 2px)`, width: `calc(${unit} - 4px)` };
  return { left: `${origin} + ${lane} * ${unit} / ${lanes} + 2px)`, width: `calc(${unit} / ${lanes} - 4px)` };
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

/**
 * The hours the board draws when something lies outside the planning window: the window widened to the whole
 * hours of the spans given (the old grid's `visibleHours` - a booking at 01:00 is still a booking and must not
 * fall off the top). Never narrower than `window`, never beyond the day.
 */
export function widenWindow(window: PlanningWindow, spans: readonly { start: number; end: number }[]): PlanningWindow {
  let start = window.startMinutes;
  let end = window.endMinutes;
  for (const s of spans) {
    start = Math.min(start, Math.floor(s.start / 60) * 60);
    end = Math.max(end, Math.ceil(s.end / 60) * 60);
  }
  return { startMinutes: Math.max(0, start), endMinutes: Math.min(24 * 60, end) };
}
