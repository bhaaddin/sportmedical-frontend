/* Angle curves as plain SVG paths, plus the grouping of curve keys into charts. */

export interface ChartGroup { base: string; keys: string[] }

/** knee_flexion_L + knee_flexion_R are one chart; trunk_flexion is its own. Order of first appearance. */
export function groupCurves(curves: Record<string, readonly (number | null)[]>): ChartGroup[] {
  const groups = new Map<string, ChartGroup>();
  for (const key of Object.keys(curves)) {
    if (!curves[key].some((v) => v !== null)) continue;
    const base = key.replace(/_(L|R)$/, '');
    const g = groups.get(base) ?? { base, keys: [] };
    g.keys.push(key);
    groups.set(base, g);
  }
  return [...groups.values()];
}

export interface Extent { min: number; max: number }

/** Shared min/max of several series with a little air; never a zero-height range. */
export function extentOf(series: readonly (readonly (number | null)[])[]): Extent {
  let min = Infinity;
  let max = -Infinity;
  for (const s of series) for (const v of s) if (v !== null && Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  if (max - min < 1e-6) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

/**
 * An SVG path in a W x H box. A null breaks the line (`M` again), so a gap in the measurement is a gap in the curve.
 */
export function curvePath(values: readonly (number | null)[], width: number, height: number, extent: Extent): string {
  const n = values.length;
  if (n === 0) return '';
  const span = extent.max - extent.min || 1;
  let d = '';
  let pen = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) { pen = false; continue; }
    const x = n === 1 ? 0 : (i / (n - 1)) * width;
    const y = height - ((v - extent.min) / span) * height;
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`;
    pen = true;
  }
  return d;
}
