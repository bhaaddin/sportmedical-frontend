/*
 * The rig: the named points and directions of ONE frame that everything anatomical is placed from - joints, feet, hands, the
 * face, the trunk axis, which way the athlete faces and which limbs are nearer to the camera. Built from the result's keypoint
 * names (COCO-WholeBody 133), never from fixed indexes. Pure.
 */
import { MIN_CONFIDENCE, type Skeleton } from '../skeleton';
import { dot, len, lerp, mid, mul, perp, sub, unit, v, type V } from './vec';

export type ViewKind = 'side' | 'front' | 'back';
export type SideId = 'L' | 'R';
export const SIDES: readonly SideId[] = ['L', 'R'];

const PART_NAMES = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle', 'big_toe', 'small_toe', 'heel'] as const;
export const HAND_PARTS = [
  'hand_wrist',
  'thumb1', 'thumb2', 'thumb3', 'thumb4', 'index1', 'index2', 'index3', 'index4', 'middle1', 'middle2', 'middle3', 'middle4',
  'ring1', 'ring2', 'ring3', 'ring4', 'pinky1', 'pinky2', 'pinky3', 'pinky4',
] as const;

export interface Rig {
  view: ViewKind;
  /** Joints and feet by "L.hip", "R.heel", ... */
  p: Record<string, V | undefined>;
  pelvisC: V;
  shoulderC: V;
  /** Unit vector along the trunk, pelvis to shoulders. */
  up: V;
  /** Torso length in pixels (pelvis centre to shoulder centre): the unit of the trunk and pelvis. */
  torso: number;
  /** Side view: unit vector of the direction the athlete faces, perpendicular to `up`; zero in front/back view. */
  fwd: V;
  facing: -1 | 0 | 1;
  /** The side nearer to the camera in a side view (null in front/back view). */
  near: SideId | null;
  /** Front/back view: unit vector from the midline out to each side; zero in a side view. */
  lat: Record<SideId, V>;
  /** The 68 face points (iBUG order), or an empty array. */
  face: (V | undefined)[];
  /** The 21 points of each hand. */
  hand: Record<SideId, (V | undefined)[]>;
}

const nameIndexCache = new WeakMap<object, Map<string, number>>();
function nameIndex(skeleton: Skeleton): Map<string, number> {
  let m = nameIndexCache.get(skeleton.names);
  if (m === undefined) {
    m = new Map(skeleton.names.map((n, i) => [n, i]));
    nameIndexCache.set(skeleton.names, m);
  }
  return m;
}

/** The rig of a frame, or null when the hips or the shoulders are not known (nothing sensible can be placed). */
export function buildRig(skeleton: Skeleton, frame: number, view: ViewKind): Rig | null {
  const pose = skeleton.frames[frame];
  if (pose === undefined) return null;
  const index = nameIndex(skeleton);
  const get = (name: string): V | undefined => {
    const i = index.get(name);
    if (i === undefined) return undefined;
    const k = pose[i];
    if (k === undefined || k[0] === null || k[1] === null || !(k[2] >= MIN_CONFIDENCE)) return undefined;
    return { x: k[0], y: k[1] };
  };

  const p: Record<string, V | undefined> = {};
  for (const side of SIDES) {
    const prefix = side === 'L' ? 'left' : 'right';
    for (const part of PART_NAMES) p[`${side}.${part}`] = get(`${prefix}_${part}`);
  }
  const hipL = p['L.hip'], hipR = p['R.hip'], shL = p['L.shoulder'], shR = p['R.shoulder'];
  if (!hipL || !hipR || !shL || !shR) return null;

  const pelvisC = mid(hipL, hipR);
  const shoulderC = mid(shL, shR);
  const trunk = sub(shoulderC, pelvisC);
  const torso = len(trunk);
  if (torso < 4) return null;
  const up = unit(trunk);

  let facing: -1 | 0 | 1 = 0;
  let fwd = v(0, 0);
  if (view === 'side') {
    let s = 0;
    for (const side of SIDES) {
      const toe = p[`${side}.big_toe`], heel = p[`${side}.heel`];
      if (toe && heel) s += toe.x - heel.x;
    }
    if (s === 0) { const nose = get('nose'); s = nose ? nose.x - shoulderC.x : 1; }
    facing = s >= 0 ? 1 : -1;
    /* the direction faced, made perpendicular to the trunk */
    const f = v(facing, 0);
    fwd = unit(sub(f, mul(up, dot(f, up))));
  }

  const lat = { L: v(0, 0), R: v(0, 0) };
  if (view !== 'side') {
    const across = perp(up);
    for (const side of SIDES) {
      const hip = side === 'L' ? hipL : hipR;
      const d = dot(sub(hip, pelvisC), across);
      const sign = Math.abs(d) > 1e-3 ? Math.sign(d) : side === 'L' ? -1 : 1;
      lat[side] = mul(across, sign);
    }
  }

  const face: (V | undefined)[] = [];
  for (let i = 0; i < 68; i++) face.push(get(`face_${i}`));
  const hand = {
    L: HAND_PARTS.map((n) => get(`left_${n}`)),
    R: HAND_PARTS.map((n) => get(`right_${n}`)),
  };

  return {
    view, p, pelvisC, shoulderC, up, torso, fwd, facing,
    near: view === 'side' ? (facing >= 0 ? 'R' : 'L') : null,
    lat, face, hand,
  };
}

/** The unit-length "anterior" direction used to offset things toward the front: the faced direction in a side view. */
export const anteriorOf = (rig: Rig): V => rig.fwd;

/** Linear blend helper re-exported for the models. */
export { lerp };
