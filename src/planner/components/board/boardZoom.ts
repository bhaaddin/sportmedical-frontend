/*
 * The zoom of the week board - pure maths, no DOM, no React.
 *
 * Owner, 18. 10. 2026: "add zoom in the calendar - like 10 min max, and on the hour max like 6x zoom".
 *
 *   z = 1    the file's own board: all the hours of the window fill the board body, nothing scrolls;
 *   z > 1    the timeline is `z` times that tall and the board body scrolls INSIDE the panel;
 *   z = 6    one hour is six times its height at 1x, which is where ten-minute rows are clearly legible.
 *
 * What the zoom decides, besides the height:
 *
 *   zoom      lines drawn           labels            snap of free-time marking and of moving a booking
 *   1  - <2   every hour            hours             30 min  (the file's own; the lines are coarser than the snap)
 *   2  - <3.5 + every half hour     + half hours      30 min
 *   3.5 - <5  + every 15 minutes    + quarter hours   15 min
 *   5  - 6    + every 10 minutes    + ten minutes     10 min
 *
 * and, for the club planning drag (which the file snaps to the nearest 5 minutes), 5 min up to 2x and the visible line step
 * above - where the pointer means the ROW it is in, its top line (`snapPointerMinute`). Moving a term or a booking snaps its
 * top edge to the NEAREST line of that step; resizing pulls whole slots of the činnost, as in the file.
 * The gear's "Rozlišení" presets are four points of this one scale: Hodina 1x, 30 min 2x, 15 min 3.5x, 10 min 6x.
 */

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 6;

/** `localStorage` key of the zoom (1-6). The first version (`calendarZoom`, 0.6-2) was the old grid's scale. */
export const ZOOM_STORAGE_KEY = 'calendarZoomV2';
export const LEGACY_ZOOM_STORAGE_KEY = 'calendarZoom';

export type ResolutionKey = 'hour' | 'half' | 'quarter' | 'ten';

export interface ZoomPreset {
  key: ResolutionKey;
  /** The gear's button label. */
  label: string;
  /** The word in "Krok mřížky …". */
  hint: string;
  /** The zoom this preset sets. */
  zoom: number;
  /** The old grid's zoom this preset replaced (`grid/resolution.ts`), for migrating a saved setting. */
  legacyZoom: number;
  /** Minutes between two lines the preset draws. */
  step: number;
}

export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  { key: 'hour', label: 'Hodina', hint: 'hodina', zoom: 1, legacyZoom: 0.6, step: 60 },
  { key: 'half', label: '30 min', hint: '30 min', zoom: 2, legacyZoom: 1, step: 30 },
  { key: 'quarter', label: '15 min', hint: '15 min', zoom: 3.5, legacyZoom: 1.5, step: 15 },
  { key: 'ten', label: '10 min', hint: '10 min', zoom: 6, legacyZoom: 2, step: 10 },
];

/** The zoom at which each finer line step appears. */
export const HALF_HOUR_FROM = 2;
export const QUARTER_FROM = 3.5;
export const TEN_MINUTES_FROM = 5;

/** The values the "−" / "+" buttons and the keys walk through. */
export const ZOOM_LADDER: readonly number[] = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6];

const EPS = 1e-6;

/** Inside 1-6, two decimals (`NaN` / out of range is the file's own 1). */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN;
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 100) / 100;
}

/** Minutes between two drawn lines at a zoom: 60 / 30 / 15 / 10. */
export function lineStepFor(zoom: number): 60 | 30 | 15 | 10 {
  const z = clampZoom(zoom);
  if (z >= TEN_MINUTES_FROM - EPS) return 10;
  if (z >= QUARTER_FROM - EPS) return 15;
  if (z >= HALF_HOUR_FROM - EPS) return 30;
  return 60;
}

/** The step marking free time and moving a booking snap to: the visible line, but never coarser than the file's 30 min. */
export function snapStepFor(zoom: number): 30 | 15 | 10 {
  const line = lineStepFor(zoom);
  return line === 60 ? 30 : line;
}

/** The step of the club planning drag (the file's 5 minutes) - the visible line from 2x up, so a pointer lands on a row. */
export function placementSnapFor(zoom: number, fileSnap = 5): number {
  const line = lineStepFor(zoom);
  return line === 60 ? fileSnap : line;
}

/** The preset a zoom is nearest to (the gear shows it as pressed). */
export function presetOf(zoom: number): ZoomPreset {
  const z = clampZoom(zoom);
  let best = ZOOM_PRESETS[0]!;
  for (const preset of ZOOM_PRESETS) {
    if (Math.abs(preset.zoom - z) < Math.abs(best.zoom - z)) best = preset;
  }
  return best;
}

/** The preset one step coarser (`-1`) or finer (`+1`) than the zoom, or the same at the ends. */
export function stepPreset(zoom: number, direction: -1 | 1): ZoomPreset {
  const index = ZOOM_PRESETS.findIndex((p) => p.key === presetOf(zoom).key);
  return ZOOM_PRESETS[Math.min(ZOOM_PRESETS.length - 1, Math.max(0, index + direction))]!;
}

/** The next ladder value above (`+1`) or below (`-1`) a zoom; the zoom itself at the ends. */
export function stepZoom(zoom: number, direction: -1 | 1): number {
  const z = clampZoom(zoom);
  if (direction > 0) return ZOOM_LADDER.find((v) => v > z + EPS) ?? ZOOM_MAX;
  for (let i = ZOOM_LADDER.length - 1; i >= 0; i -= 1) if (ZOOM_LADDER[i]! < z - EPS) return ZOOM_LADDER[i]!;
  return ZOOM_MIN;
}

/** "2×", "1,5×": the zoom for the control (Czech decimal comma). */
export function formatZoom(zoom: number): string {
  const rounded = Math.round(clampZoom(zoom) * 10) / 10;
  return `${String(rounded).replace('.', ',')}×`;
}

/**
 * The factor a wheel event multiplies the zoom by. A mouse notch (|deltaY| ~ 100) is about x1.28; a trackpad pinch
 * (browsers send it as ctrl + wheel with small fractional deltas) is finer.
 */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY;
  const k = Math.abs(px) < 50 ? 0.01 : 0.0025;
  return Math.exp(-Math.max(-120, Math.min(120, px)) * k);
}

/** The zoom a saved value of the first version (`calendarZoom`: 0.6, 1, 1.5, 2) becomes - by the nearest old level. */
export function migrateLegacyZoom(legacy: number): number {
  if (!Number.isFinite(legacy)) return ZOOM_MIN;
  let best = ZOOM_PRESETS[0]!;
  for (const preset of ZOOM_PRESETS) {
    if (Math.abs(preset.legacyZoom - legacy) < Math.abs(best.legacyZoom - legacy)) best = preset;
  }
  return best.zoom;
}

/**
 * The zoom to start with from what storage holds: a valid `calendarZoomV2` wins; otherwise a saved `calendarZoom` is
 * migrated (once - the caller writes the result under the new key); otherwise the file's 1x.
 */
export function readStoredZoom(storage: Pick<Storage, 'getItem'> | null): { zoom: number; migrated: boolean } {
  try {
    const raw = storage?.getItem(ZOOM_STORAGE_KEY);
    if (raw !== null && raw !== undefined && raw !== '') {
      const v = Number(raw);
      if (Number.isFinite(v) && v >= ZOOM_MIN && v <= ZOOM_MAX) return { zoom: clampZoom(v), migrated: false };
    }
    const legacyRaw = storage?.getItem(LEGACY_ZOOM_STORAGE_KEY);
    if (legacyRaw !== null && legacyRaw !== undefined && legacyRaw !== '') {
      const legacy = Number(legacyRaw);
      if (Number.isFinite(legacy) && legacy >= 0.6 && legacy <= 2) return { zoom: migrateLegacyZoom(legacy), migrated: true };
    }
  } catch {
    /* storage blocked: the file's own zoom */
  }
  return { zoom: ZOOM_MIN, migrated: false };
}

/* ---------------------------- pointer <-> minute ---------------------------- */

/**
 * The wall-clock minute under a pointer. `rect` is the timeline element's `getBoundingClientRect()` - which already
 * includes how far the scroll region moved it, so a scrolled board needs no extra offset - and `layoutHeight` its height
 * in its own (design) px, because the stage may be scaled.
 */
export function minuteAtClientY(
  g: { startMinutes: number; pxPerMinute: number },
  rect: { top: number; height: number },
  layoutHeight: number,
  clientY: number,
): number {
  const scale = rect.height > 0 && layoutHeight > 0 ? rect.height / layoutHeight : 1;
  return g.startMinutes + (clientY - rect.top) / scale / g.pxPerMinute;
}

/** The same by the scroll region instead of the timeline's rectangle: `scrollTop` of the body and the body's top edge. */
export function minuteAtViewportY(
  g: { startMinutes: number; pxPerMinute: number },
  scrollTop: number,
  bodyTop: number,
  scale: number,
  clientY: number,
): number {
  return g.startMinutes + (scrollTop + (clientY - bodyTop) / (scale > 0 ? scale : 1)) / g.pxPerMinute;
}

/**
 * The `scrollTop` that puts `minute` at `offset` design px below the top of the scroll region, kept inside the content.
 * (`pxPerMinute` and `startMinutes` of the NEW geometry, `height` its timeline height, `viewport` the region's height.)
 */
export function scrollTopFor(
  g: { startMinutes: number; pxPerMinute: number; height: number },
  minute: number,
  offset: number,
  viewport: number,
): number {
  const raw = (minute - g.startMinutes) * g.pxPerMinute - offset;
  return Math.max(0, Math.min(Math.max(0, g.height - viewport), raw));
}

/**
 * What the board scrolls to the first time it is zoomed in from 1x: now when the shown week has today (and now is inside the
 * hours), otherwise the first session of the shown range, otherwise the top of the window. The minute is put a third of the
 * way down, so what happens just before it is in view too.
 */
export function focusMinuteFor(args: {
  window: { startMinutes: number; endMinutes: number };
  nowMinute: number | null;
  firstSessionMinute: number | null;
}): number {
  const { window: w, nowMinute, firstSessionMinute } = args;
  if (nowMinute !== null && nowMinute >= w.startMinutes && nowMinute <= w.endMinutes) return nowMinute;
  if (firstSessionMinute !== null) return Math.min(w.endMinutes, Math.max(w.startMinutes, firstSessionMinute));
  return w.startMinutes;
}

/** Distance of two touch points - the pinch measures this. */
export const pinchDistance = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
