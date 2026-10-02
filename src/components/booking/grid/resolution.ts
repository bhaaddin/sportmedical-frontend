/*
 * The "ROZLIŠENÍ" toolbar: three named steps over the one continuous zoom the
 * grid already has (ctrl/⌘ + wheel moves it by 0.1). Each step is a row
 * height and the minute step the grid lines are drawn on; the toggle shows
 * whichever level the current zoom is nearest to, so a wheel zoom and a click
 * never disagree about what is on screen.
 */

export interface Resolution {
  key: 'hour' | 'half' | 'ten';
  /** The toggle's label. */
  label: string;
  /** The word in "Krok mřížky …". */
  hint: string;
  /** The grid zoom this level is. */
  zoom: number;
  /** Minutes between two grid lines. */
  step: number;
}

export const RESOLUTIONS: readonly Resolution[] = [
  { key: 'hour', label: 'Hodina', hint: 'hodina', zoom: 0.6, step: 60 },
  { key: 'half', label: '30 min', hint: '30 min', zoom: 1, step: 30 },
  { key: 'ten', label: '10 min', hint: '10 min', zoom: 2, step: 10 },
];

/** The level a zoom is nearest to. */
export function resolutionOf(zoom: number): Resolution {
  let best = RESOLUTIONS[0];
  for (const level of RESOLUTIONS) {
    if (Math.abs(level.zoom - zoom) < Math.abs(best.zoom - zoom)) best = level;
  }
  return best;
}

/** The level one step coarser (`-1`) or finer (`+1`), or the same at the ends. */
export function stepResolution(zoom: number, direction: -1 | 1): Resolution {
  const index = RESOLUTIONS.findIndex((r) => r.key === resolutionOf(zoom).key);
  const next = Math.min(RESOLUTIONS.length - 1, Math.max(0, index + direction));
  return RESOLUTIONS[next];
}
