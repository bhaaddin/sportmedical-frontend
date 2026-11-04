/* The stages of processing a clip, as the status screen draws them: Stažení, Rozpoznání pohybu (with a percentage), Analýza, Anatomie, Hotovo. */
import type { ClipStatus } from '../../api/movement';

export const STAGES = ['download', 'pose', 'analysis', 'anatomy', 'done'] as const;
export type StageId = (typeof STAGES)[number];
export type StepState = 'done' | 'active' | 'pending';
export interface Step { id: StageId; state: StepState; /** 0..100 while the stage is active and reports it, else null */ pct: number | null }
export interface Progress { stage: string; pct?: number | null }

/** The wire stage names (`downloaded`, `pose`, `analysis`, `anatomy`) to our stage ids; unknown names give null. */
export function stageOf(wire: string): StageId | null {
  switch (wire) {
    case 'downloaded': case 'download': return 'pose'; // the download is finished, recognition is the stage in progress
    case 'pose': return 'pose';
    case 'analysis': return 'analysis';
    case 'anatomy': return 'anatomy';
    default: return null;
  }
}

/**
 * Which step is done, which is running and which waits. Waiting in the queue (or an upload) shows nothing running; a processing
 * clip without progress yet is downloading; a finished clip has every step done; a failed one stops at the stage it reached.
 */
export function stageSteps(status: ClipStatus, progress?: Progress | null): Step[] {
  const pctOf = (p?: Progress | null) => (p?.pct === null || p?.pct === undefined ? null : Math.min(100, Math.max(0, p.pct)));
  let current = -1; // index of the running stage
  if (status === 'done') current = STAGES.length;
  else if (status === 'processing' || status === 'failed') {
    const id = progress ? stageOf(progress.stage) : null;
    current = id === null ? 0 : STAGES.indexOf(id);
  }
  return STAGES.map((id, i) => ({
    id,
    state: i < current ? 'done' : i === current ? 'active' : 'pending',
    pct: i === current && i !== 0 ? pctOf(progress) : null,
  }));
}

/** Overall progress 0..100 for a thin bar: each of the four working stages is a quarter. */
export function overallPct(status: ClipStatus, progress?: Progress | null): number {
  if (status === 'done') return 100;
  const steps = stageSteps(status, progress);
  const working = steps.slice(0, 4);
  return Math.round(working.reduce((sum, s) => sum + (s.state === 'done' ? 25 : s.state === 'active' ? 25 * ((s.pct ?? 0) / 100) : 0), 0));
}
