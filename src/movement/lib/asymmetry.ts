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
}

/** Group by metric id, in first-seen order. */
export function metricRows(metrics: readonly Metric[]): MetricRow[] {
  const rows = new Map<string, MetricRow>();
  for (const m of metrics) {
    const row = rows.get(m.id) ?? { id: m.id, unit: m.unit, left: null, right: null, asymmetryPct: null, single: null };
    if (m.side === 'L') row.left = m; else if (m.side === 'R') row.right = m; else row.single = m;
    rows.set(m.id, row);
  }
  for (const row of rows.values()) {
    const reported = row.left?.asymmetryPct ?? row.right?.asymmetryPct ?? null;
    row.asymmetryPct = reported ?? computeAsymmetry(row.left?.value ?? null, row.right?.value ?? null);
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
