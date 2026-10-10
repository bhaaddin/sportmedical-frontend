/*
 * The "ROZLIŠENÍ" toolbar: four named steps over the one continuous zoom the
 * grid already has (ctrl/⌘ + wheel moves it by 0.1). Each step is a row
 * height and the minute step the grid lines are drawn on; the toggle shows
 * whichever level the current zoom is nearest to, so a wheel zoom and a click
 * never disagree about what is on screen.
 *
 * The 15-minute level (Etapa 12): between "30 min" and "10 min" the wheel
 * passes a zoom where the rows are visibly a quarter hour tall, and the toggle
 * used to keep saying "30 min" there (owner: "when I zoom to 15 min it shows
 * in the middle that it is 15, but the label still says 30"). It is a level of
 * its own now, with its own row height, so the picture and the text agree.
 */

export interface Resolution {
  key: 'hour' | 'half' | 'quarter' | 'ten';
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
  { key: 'quarter', label: '15 min', hint: '15 min', zoom: 1.5, step: 15 },
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

/*
 * How tall an hour is, per level, as the board draws them (Z-60 / Z-30 / Z-10):
 * 46 px at "Hodina", 52 px at "30 min", 65 px at "15 min", 78 px at "10 min".
 * Between the levels (ctrl/⌘ + wheel moves the zoom by 0.1) the height follows
 * a straight line, so the wheel and the toggle never disagree about what is on
 * screen. The 15-minute anchor sits exactly on the old 30→10 line, so no zoom
 * the wheel can reach changed height when the level was added.
 */
const HOUR_PX: readonly { zoom: number; px: number }[] = RESOLUTIONS.map((level) => ({
  zoom: level.zoom,
  px: { hour: 46, half: 52, quarter: 65, ten: 78 }[level.key],
}));

export function pxPerHour(zoom: number): number {
  if (zoom <= HOUR_PX[0].zoom) return HOUR_PX[0].px;
  for (let i = 1; i < HOUR_PX.length; i += 1) {
    const a = HOUR_PX[i - 1];
    const b = HOUR_PX[i];
    if (zoom <= b.zoom) return a.px + ((zoom - a.zoom) / (b.zoom - a.zoom)) * (b.px - a.px);
  }
  return HOUR_PX[HOUR_PX.length - 1].px;
}

/** Pixels per minute of the grid at a zoom. */
export const pxPerMinuteOf = (zoom: number): number => pxPerHour(zoom) / 60;
