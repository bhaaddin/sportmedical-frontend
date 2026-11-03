/* Small pure rules of the review screen: flag grouping, score presentation, fault-tag relevance, session compare. */
import type { ClipDetail, ClipSummary, Decision, FaultTag, Flag, Movement, MovementSession } from '../../api/movement';
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
  | { kind: 'decided'; band: 'green' | 'watch' | 'red' };

/** What the chip says: a draft until a decision exists, then the clinician's band. */
export function scoreView(clip: Pick<ClipDetail, 'result' | 'decisions'>): ScoreView | null {
  const decision = latestDecision(clip.decisions);
  if (decision !== null) return { kind: 'decided', band: decision.band };
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

/* ───────── timeline ───────── */

export interface TrendPoint { sessionId: string; date: string; errorCount: number; band: 'green' | 'watch' | 'red' | 'needs_review' }

/** Score trend of one movement: oldest first, one point per session (the first finished clip of that movement). */
export function scoreTrend(sessions: readonly MovementSession[], movement: Movement): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const s of sessions) {
    const clip = s.clips.find((c) => c.movement === movement && c.status === 'done' && c.score);
    if (clip?.score) points.push({ sessionId: s.id, date: s.date, errorCount: clip.score.errorCount, band: clip.decisionBand ?? clip.score.band });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface CompareRow { key: string; id: string; side: 'L' | 'R' | null; unit: string; before: number | null; after: number | null; delta: number | null }

function clipOf(session: MovementSession | undefined, movement: Movement): ClipSummary | undefined {
  return session?.clips.find((c) => c.movement === movement && c.status === 'done');
}

/** Key metrics of the same movement in two sessions, side by side, with the change. */
export function compareSessions(before: MovementSession | undefined, after: MovementSession | undefined, movement: Movement): CompareRow[] {
  const a = clipOf(before, movement)?.keyMetrics ?? [];
  const b = clipOf(after, movement)?.keyMetrics ?? [];
  const keyOf = (m: { id: string; side: 'L' | 'R' | null }) => `${m.id}:${m.side ?? '-'}`;
  const keys = new Map<string, { id: string; side: 'L' | 'R' | null; unit: string }>();
  for (const m of [...a, ...b]) if (!keys.has(keyOf(m))) keys.set(keyOf(m), { id: m.id, side: m.side, unit: m.unit });
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
