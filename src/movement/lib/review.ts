/* Small pure rules of the review screen: flag grouping, score presentation, fault-tag relevance, session compare. */
import type { ClipDetail, Decision, FaultTag, Flag, Metric, Movement, MovementSession } from '../../api/movement';
import { FAULT_TAGS } from '../../api/movement';

export const SEVERITY_ORDER = ['red', 'watch', 'info'] as const;

/** Flags grouped by severity, worst first; empty groups are left out. Order inside a group is kept. */
export function groupFlags(flags: readonly Flag[]): { severity: Flag['severity']; flags: Flag[] }[] {
  return SEVERITY_ORDER
    .map((severity) => ({ severity, flags: flags.filter((f) => f.severity === severity) }))
    .filter((g) => g.flags.length > 0);
}

/** The newest decision (decisions are append-only; the list is in any order, `decidedAt` decides). */
export function latestDecision(decisions: readonly Decision[]): Decision | null {
  if (decisions.length === 0) return null;
  return [...decisions].sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt))[0];
}

export function decisionsNewestFirst(decisions: readonly Decision[]): Decision[] {
  return [...decisions].sort((a, b) => Date.parse(b.decidedAt) - Date.parse(a.decidedAt));
}

export type ScoreView =
  | { kind: 'draft'; band: 'green' | 'watch' | 'red' }
  | { kind: 'needs_review' }
  | { kind: 'decided'; band: 'green' | 'watch' | 'red' }
  | { kind: 'rejected' };

/** What the chip says: a draft until a decision exists, then the clinician's band. */
export function scoreView(clip: Pick<ClipDetail, 'result' | 'decisions'>): ScoreView | null {
  const decision = latestDecision(clip.decisions);
  if (decision !== null) return decision.band === null ? { kind: 'rejected' } : { kind: 'decided', band: decision.band };
  const band = clip.result?.score.band;
  if (band === undefined) return null;
  return band === 'needs_review' ? { kind: 'needs_review' } : { kind: 'draft', band };
}

/** Tags first that belong to the movement; the rest follow. */
const RUNNING_TAGS: readonly FaultTag[] = ['overstride', 'heel_strike_overstride', 'pelvic_drop', 'crossover', 'trunk_lean_running', 'foot_rotation', 'asymmetric_landing'];
const LANDING_TAGS: readonly FaultTag[] = ['stiff_landing', 'knee_valgus', 'trunk_upright', 'lateral_trunk_lean', 'stance_width', 'foot_rotation', 'asymmetric_landing'];

export function tagsForMovement(movement: Movement): { main: FaultTag[]; other: FaultTag[] } {
  const main = [...(movement === 'running' ? RUNNING_TAGS : LANDING_TAGS)];
  return { main, other: FAULT_TAGS.filter((t) => !main.includes(t)) };
}

/** Is the next decision allowed to be sent? accept/edit need a band; reject does not. */
export function decisionReady(action: 'accept' | 'edit' | 'reject' | null, band: string | null): boolean {
  if (action === null) return false;
  return action === 'reject' || band !== null;
}

/** The API names the author by staff id only: show "Klinik" with the last four characters, never the whole id. */
export function staffLabel(staffId: string): string {
  return `Klinik ${staffId.replace(/[^0-9a-z]/gi, '').slice(-4)}`;
}

/* ───────── timeline ───────── */

/** The three bands as a level, lower is better; `needs_review` has none. */
export const BAND_LEVEL = { green: 1, watch: 2, red: 3 } as const;

export interface TrendPoint { sessionId: string; date: string; level: 1 | 2 | 3; band: 'green' | 'watch' | 'red' }

/** Band trend of one movement: oldest first, one point per session (its first finished clip of that movement with a band). */
export function scoreTrend(sessions: readonly MovementSession[], movement: Movement): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const s of sessions) {
    const clip = s.clips.find((c) => c.movement === movement && c.status === 'done' && c.band !== null && c.band !== 'needs_review');
    if (clip && clip.band !== null && clip.band !== 'needs_review') points.push({ sessionId: s.id, date: s.date, level: BAND_LEVEL[clip.band], band: clip.band });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface CompareRow { key: string; id: string; label: { cs: string; en: string } | null; side: 'L' | 'R' | null; unit: string; before: number | null; after: number | null; delta: number | null }

/** The finished clip of a movement in a session (the one the comparison reads). */
export function doneClipOf(session: MovementSession | undefined, movement: Movement): string | null {
  return session?.clips.find((c) => c.movement === movement && c.status === 'done')?.clipId ?? null;
}

/** Headline metrics of a result: the left-right ones first, at most six. */
export function keyMetrics(metrics: readonly Metric[] | undefined): Metric[] {
  return [...(metrics ?? [])].sort((a, b) => Number(b.side !== null) - Number(a.side !== null)).slice(0, 6);
}

/** Key metrics of the same movement in two results, side by side, with the change. */
export function compareMetrics(before: readonly Metric[] | undefined, after: readonly Metric[] | undefined): CompareRow[] {
  const a = keyMetrics(before);
  const b = keyMetrics(after);
  const keyOf = (m: { id: string; side: 'L' | 'R' | null }) => `${m.id}:${m.side ?? '-'}`;
  const keys = new Map<string, { id: string; label: { cs: string; en: string } | null; side: 'L' | 'R' | null; unit: string }>();
  for (const m of [...a, ...b]) if (!keys.has(keyOf(m))) keys.set(keyOf(m), { id: m.id, label: m.label ?? null, side: m.side, unit: m.unit });
  return [...keys.entries()].map(([key, meta]) => {
    const x = a.find((m) => keyOf(m) === key)?.value ?? null;
    const y = b.find((m) => keyOf(m) === key)?.value ?? null;
    return { key, ...meta, before: x, after: y, delta: x !== null && y !== null ? y - x : null };
  });
}

/** Movements that have at least one finished clip across the sessions. */
export function movementsIn(sessions: readonly MovementSession[]): Movement[] {
  const out = new Set<Movement>();
  for (const s of sessions) for (const c of s.clips) if (c.status === 'done') out.add(c.movement);
  return [...out];
}

/**
 * The name of a metric to show: the pipeline's own label in the language of the screen, else our wording for its id, else a
 * readable form of the id - never the raw code.
 */
export function metricName(label: { cs: string; en: string } | null | undefined, id: string, lang: 'cs' | 'en', maybe: (key: string, fallback: string) => string): string {
  const fromPipeline = label?.[lang];
  if (fromPipeline !== undefined && fromPipeline !== '') return fromPipeline;
  const ours = maybe(`metric.${id}`, '');
  if (ours !== '') return ours;
  const words = id.replace(/[._]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
