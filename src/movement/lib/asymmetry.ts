/* Left-right comparison of the metrics, and how an asymmetry is shown. */
import type { Metric } from '../../api/movement';

export interface MetricRow {
  id: string;
  unit: string;
  left: Metric | null;
  right: Metric | null;
  /** The asymmetry the pipeline reported (either side carries it), else computed from the two values. */
  asymmetryPct: number | null;
  /** Metrics without a side (a single value). */
  single: Metric | null;
  /** The pipeline's name of the metric (cs / en), when it sent one. */
  label: { cs: string; en: string } | null;
  /** The same metric read from the 3D model (the `<id>_3d` twin), per side. */
  twin: { left: Metric | null; right: Metric | null; single: Metric | null } | null;
}

/** A metric read from the fitted 3D model: its source says so, or its id ends in `_3d`. */
export const is3dTwin = (m: Pick<Metric, 'id' | 'source'>): boolean => m.source === '3d' || /_3d$/.test(m.id);

/** Group by metric id, in first-seen order. */
export function metricRows(metrics: readonly Metric[]): MetricRow[] {
  const rows = new Map<string, MetricRow>();
  /* a 3D twin is shown beside its 2D metric, never as a row of its own (when the 2D one exists) */
  const base = new Set(metrics.filter((m) => !is3dTwin(m)).map((m) => m.id));
  for (const m of metrics) {
    if (is3dTwin(m) && base.has(m.id.replace(/_3d$/, ''))) {
      const row = rows.get(m.id.replace(/_3d$/, '')) ?? { id: m.id.replace(/_3d$/, ''), unit: m.unit, left: null, right: null, asymmetryPct: null, single: null, label: null, twin: null };
      const twin = row.twin ?? { left: null, right: null, single: null };
      if (m.side === 'L') twin.left = m; else if (m.side === 'R') twin.right = m; else twin.single = m;
      row.twin = twin;
      rows.set(row.id, row);
      continue;
    }
    const row = rows.get(m.id) ?? { id: m.id, unit: m.unit, left: null, right: null, asymmetryPct: null, single: null, label: null, twin: null };
    row.label = row.label ?? m.label ?? null;
    if (m.side === 'L') row.left = m; else if (m.side === 'R') row.right = m; else row.single = m;
    rows.set(m.id, row);
  }
  for (const row of rows.values()) {
    /* only what the pipeline reported: it leaves the asymmetry empty when both sides are near zero, so no "200 %" is invented here */
    row.asymmetryPct = row.left?.asymmetryPct ?? row.right?.asymmetryPct ?? null;
  }
  return [...rows.values()];
}

/** |L-R| relative to the mean of the two, in percent; null when a side is missing or both are ~0. */
export function computeAsymmetry(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  const mean = (Math.abs(left) + Math.abs(right)) / 2;
  if (mean < 1e-9) return null;
  return (Math.abs(left - right) / mean) * 100;
}

/** A non-breaking space, so a value never wraps away from its unit. */
const NB = String.fromCharCode(160);

/** "6,2 %" - one decimal, Czech comma and a non-breaking space; "–" when unknown. */
export function formatAsymmetry(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '–';
  return `${(Math.round(Math.abs(pct) * 10) / 10).toFixed(1).replace('.', ',')}${NB}%`;
}

/** Above 10 % a pair is worth a look, above 15 % it is a finding. */
export type AsymmetryLevel = 'ok' | 'watch' | 'red' | 'unknown';
export function asymmetryLevel(pct: number | null | undefined): AsymmetryLevel {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'unknown';
  const a = Math.abs(pct);
  return a > 15 ? 'red' : a > 10 ? 'watch' : 'ok';
}

/** A value with its unit, Czech decimals: "18,4 °", "0,21 s". */
export function formatValue(value: number, unit: string): string {
  const text = (Math.round(value * 10) / 10).toString().replace('.', ',');
  if (unit === 'deg') return `${text}${NB}°`;
  if (unit === 'pct' || unit === '%') return `${text}${NB}%`;
  return unit === '' ? text : `${text}${NB}${unit}`;
}

/** Is a value outside its norm band? Null when there is no band. */
export function outsideNorm(m: Pick<Metric, 'value' | 'normBand'>): boolean | null {
  if (m.normBand === null || m.normBand === undefined) return null;
  return m.value < m.normBand[0] || m.value > m.normBand[1];
}
