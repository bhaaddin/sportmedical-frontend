/*
 * Which keypoints a flag is about. A flag names a region ("knee") and maybe a side; clicking it highlights those joints.
 * Names are halpe26 (left_hip, right_knee, ...); an unknown region highlights nothing (never a wrong joint).
 */
import type { Flag, Side } from '../../api/movement';

const SIDE_NAME: Record<Side, 'left' | 'right'> = { L: 'left', R: 'right' };

const REGION_JOINTS: Record<string, readonly string[]> = {
  knee: ['hip', 'knee', 'ankle'],
  hip: ['shoulder', 'hip', 'knee'],
  ankle: ['knee', 'ankle', 'heel', 'big_toe'],
  foot: ['ankle', 'heel', 'big_toe', 'small_toe'],
  trunk: ['shoulder', 'hip'],
  pelvis: ['hip'],
};

/** Both sides when the flag has none (a trunk or pelvis flag, or a symmetry flag). */
export function jointNamesForFlag(flag: Pick<Flag, 'region' | 'side'>): string[] {
  const parts = REGION_JOINTS[flag.region];
  if (parts === undefined) return [];
  const sides: ('left' | 'right')[] = flag.side === null ? ['left', 'right'] : [SIDE_NAME[flag.side]];
  const names = parts.flatMap((p) => sides.map((s) => `${s}_${p}`));
  if (flag.region === 'trunk') names.push('neck');
  return names;
}

/** Indexes into `names` (the skeleton's keypoint list). */
export function jointIndexesForFlag(flag: Pick<Flag, 'region' | 'side'>, names: readonly string[]): Set<number> {
  const wanted = new Set(jointNamesForFlag(flag));
  const out = new Set<number>();
  names.forEach((n, i) => { if (wanted.has(n)) out.add(i); });
  return out;
}

/**
 * The curve that belongs to a joint, for the on-video angle label: knee -> knee_flexion_L etc.
 * Returns [jointName, curveKey] pairs for the sides present in `curves`.
 */
export function angleLabelTargets(curves: Record<string, unknown>): { joint: string; curve: string }[] {
  const out: { joint: string; curve: string }[] = [];
  for (const [part, base] of [['knee', 'knee_flexion'], ['hip', 'hip_flexion']] as const) {
    for (const side of ['L', 'R'] as const) {
      const curve = `${base}_${side}`;
      if (curve in curves) out.push({ joint: `${SIDE_NAME[side]}_${part}`, curve });
    }
  }
  if ('trunk_flexion' in curves) out.push({ joint: 'neck', curve: 'trunk_flexion' });
  return out;
}
