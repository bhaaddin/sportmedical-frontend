/*
 * The muscles: each is a belly between an origin and an insertion, both anchored on a bone segment (a position along it and an
 * offset to the side). Their length is measured on every frame; the belly swells and reddens as the muscle shortens against its
 * length in the first frames of the clip. THIS IS A VISUAL MODEL derived from how the bones move - not EMG, not force.
 * Pure geometry; the painter lives in draw.ts.
 */
import { contraction, depthOf, isFar, normalFor, shorteningSpeed, thicknessFactor } from './geometry';
import { buildRig, SIDES, type Rig, type SideId, type ViewKind } from './rig';
import type { Skeleton } from '../skeleton';
import { add, dist, lerp, mid, mul, perp, sub, unit, v, type V } from './vec';

export type SegId = 'thigh' | 'shank' | 'foot' | 'upperArm' | 'forearm' | 'trunk';
/** [segment, position along it (0..1), offset in the front view (out from the midline), offset in a side view (toward the front)]. Offsets are fractions of the segment length. */
export type Anchor = readonly [SegId, number, number, number];

export interface MuscleDef {
  id: string;
  group: 'leg' | 'arm' | 'core';
  /** Views in which the muscle is on the visible side of the body. */
  views: readonly ViewKind[];
  anchors: readonly Anchor[];
  /** Half thickness at the belly's peak, as a fraction of the reference length (thigh, upper arm or torso). */
  half: number;
  /** The part of the path that is muscle (the rest is tendon), as fractions of the path length. */
  belly: readonly [number, number];
}

const ALL: readonly ViewKind[] = ['front', 'back', 'side'];
const FRONT: readonly ViewKind[] = ['front', 'side'];
const BACK: readonly ViewKind[] = ['back', 'side'];

export const MUSCLES: readonly MuscleDef[] = [
  /* hip and thigh */
  { id: 'gluteus_maximus', group: 'leg', views: BACK, half: 0.085, belly: [0.0, 1.0], anchors: [['trunk', 0.1, 0.07, -0.13], ['trunk', -0.02, 0.17, -0.15], ['thigh', 0.2, 0.08, -0.07]] },
  { id: 'gluteus_medius', group: 'leg', views: ALL, half: 0.055, belly: [0.0, 0.85], anchors: [['trunk', 0.15, 0.21, -0.03], ['thigh', 0.07, 0.1, 0.0]] },
  { id: 'iliopsoas', group: 'leg', views: FRONT, half: 0.05, belly: [0.0, 0.8], anchors: [['trunk', 0.28, 0.05, 0.05], ['trunk', 0.02, 0.12, 0.06], ['thigh', 0.12, -0.03, 0.03]] },
  { id: 'rectus_femoris', group: 'leg', views: FRONT, half: 0.062, belly: [0.0, 0.72], anchors: [['trunk', 0.03, 0.12, 0.1], ['thigh', 0.5, 0.0, 0.075], ['shank', 0.1, 0.0, 0.05]] },
  { id: 'vastus_lateralis', group: 'leg', views: FRONT, half: 0.075, belly: [0.0, 0.85], anchors: [['thigh', 0.1, 0.1, 0.02], ['thigh', 0.6, 0.075, 0.05], ['shank', 0.07, 0.035, 0.05]] },
  { id: 'vastus_medialis', group: 'leg', views: FRONT, half: 0.06, belly: [0.0, 0.8], anchors: [['thigh', 0.36, -0.075, 0.04], ['thigh', 0.9, -0.06, 0.05], ['shank', 0.06, -0.03, 0.05]] },
  { id: 'hamstrings', group: 'leg', views: BACK, half: 0.066, belly: [0.08, 0.86], anchors: [['trunk', -0.06, 0.07, -0.13], ['thigh', 0.55, 0.0, -0.075], ['shank', 0.07, 0.015, -0.045]] },
  { id: 'adductors', group: 'leg', views: ['front', 'back'], half: 0.062, belly: [0.0, 0.9], anchors: [['trunk', -0.05, 0.03, 0.02], ['thigh', 0.55, -0.085, 0.0]] },
  /* lower leg */
  { id: 'gastrocnemius_medial', group: 'leg', views: BACK, half: 0.05, belly: [0.0, 0.62], anchors: [['thigh', 0.97, -0.03, -0.075], ['shank', 0.4, -0.04, -0.075], ['foot', 0.0, 0.0, -0.02]] },
  { id: 'gastrocnemius_lateral', group: 'leg', views: BACK, half: 0.048, belly: [0.0, 0.62], anchors: [['thigh', 0.97, 0.03, -0.075], ['shank', 0.4, 0.04, -0.075], ['foot', 0.0, 0.0, -0.02]] },
  { id: 'soleus', group: 'leg', views: BACK, half: 0.044, belly: [0.0, 0.6], anchors: [['shank', 0.14, 0.02, -0.06], ['shank', 0.55, 0.0, -0.07], ['foot', 0.0, 0.0, -0.02]] },
  { id: 'tibialis_anterior', group: 'leg', views: FRONT, half: 0.034, belly: [0.0, 0.58], anchors: [['shank', 0.08, 0.04, 0.055], ['shank', 0.62, 0.02, 0.05], ['foot', 0.34, -0.03, 0.03]] },
  { id: 'peroneals', group: 'leg', views: ALL, half: 0.03, belly: [0.0, 0.58], anchors: [['shank', 0.12, 0.07, -0.01], ['shank', 0.62, 0.055, -0.03], ['foot', 0.5, 0.05, 0.0]] },
  /* trunk */
  { id: 'erector_spinae', group: 'core', views: BACK, half: 0.05, belly: [0.04, 0.96], anchors: [['trunk', 0.0, 0.06, -0.17], ['trunk', 0.8, 0.05, -0.15]] },
  { id: 'rectus_abdominis', group: 'core', views: FRONT, half: 0.05, belly: [0.0, 1.0], anchors: [['trunk', 0.02, 0.03, 0.2], ['trunk', 0.46, 0.04, 0.22]] },
  { id: 'obliques', group: 'core', views: ALL, half: 0.075, belly: [0.0, 1.0], anchors: [['trunk', 0.05, 0.17, 0.02], ['trunk', 0.46, 0.15, 0.06]] },
  { id: 'pectoralis_major', group: 'core', views: FRONT, half: 0.08, belly: [0.0, 0.8], anchors: [['trunk', 0.68, 0.04, 0.22], ['upperArm', 0.16, 0.0, 0.06]] },
  { id: 'trapezius', group: 'core', views: ALL, half: 0.062, belly: [0.0, 1.0], anchors: [['trunk', 1.04, 0.01, -0.08], ['trunk', 0.97, 0.18, -0.04], ['trunk', 0.97, 0.32, -0.02]] },
  /* shoulder and arm */
  { id: 'deltoid', group: 'arm', views: ALL, half: 0.1, belly: [0.0, 1.0], anchors: [['trunk', 0.98, 0.3, 0.0], ['upperArm', 0.46, 0.1, 0.01]] },
  { id: 'biceps', group: 'arm', views: FRONT, half: 0.06, belly: [0.0, 0.62], anchors: [['trunk', 0.9, 0.28, 0.07], ['upperArm', 0.5, 0.0, 0.07], ['forearm', 0.12, 0.0, 0.05]] },
  { id: 'triceps', group: 'arm', views: BACK, half: 0.065, belly: [0.0, 0.72], anchors: [['upperArm', 0.1, 0.02, -0.075], ['upperArm', 0.62, 0.0, -0.085], ['forearm', 0.0, 0.0, -0.06]] },
  { id: 'forearm_flexors', group: 'arm', views: FRONT, half: 0.05, belly: [0.0, 0.55], anchors: [['upperArm', 0.97, -0.03, 0.03], ['forearm', 0.45, 0.0, 0.03], ['forearm', 1.0, 0.0, 0.0]] },
  { id: 'forearm_extensors', group: 'arm', views: BACK, half: 0.045, belly: [0.0, 0.55], anchors: [['upperArm', 0.97, 0.04, -0.02], ['forearm', 0.45, 0.0, -0.04], ['forearm', 1.0, 0.0, -0.02]] },
];

/** The two end points of a segment, or null when a joint is unknown. */
function segment(rig: Rig, S: SideId, seg: SegId): { a: V; b: V; ref: number } | null {
  const p = rig.p;
  switch (seg) {
    case 'thigh': { const a = p[`${S}.hip`], b = p[`${S}.knee`]; return a && b ? { a, b, ref: dist(a, b) } : null; }
    case 'shank': { const a = p[`${S}.knee`], b = p[`${S}.ankle`]; return a && b ? { a, b, ref: dist(a, b) } : null; }
    case 'foot': {
      const a = p[`${S}.heel`], tb = p[`${S}.big_toe`], ts = p[`${S}.small_toe`];
      if (!a || !tb || !ts) return null;
      const b = mid(tb, ts);
      /* the heel tendon lands on the back of the heel bone, a little above the heel point */
      return { a, b, ref: dist(a, b) };
    }
    case 'upperArm': { const a = p[`${S}.shoulder`], b = p[`${S}.elbow`]; return a && b ? { a, b, ref: dist(a, b) } : null; }
    case 'forearm': { const a = p[`${S}.elbow`], b = p[`${S}.wrist`]; return a && b ? { a, b, ref: dist(a, b) } : null; }
    case 'trunk': return { a: rig.pelvisC, b: rig.shoulderC, ref: rig.torso };
  }
}

/** One anchor in canvas pixels. */
export function anchorPoint(rig: Rig, S: SideId, anchor: Anchor): V | null {
  const seg = segment(rig, S, anchor[0]);
  if (seg === null) return null;
  const dir = unit(sub(seg.b, seg.a));
  const n = normalFor(rig, S, dir);
  const off = (rig.view === 'side' ? anchor[3] : anchor[2]) * seg.ref;
  const base = lerp(seg.a, seg.b, anchor[1]);
  return v(base.x + n.x * off, base.y + n.y * off);
}

export function refLength(rig: Rig, S: SideId, group: MuscleDef['group']): number {
  if (group === 'core') return rig.torso;
  const a = group === 'leg' ? rig.p[`${S}.hip`] : rig.p[`${S}.shoulder`];
  const b = group === 'leg' ? rig.p[`${S}.knee`] : rig.p[`${S}.elbow`];
  return a && b ? dist(a, b) : rig.torso * 0.8;
}

/** Straight-line path length through the anchors, or NaN when one is unknown. */
export function pathLength(points: readonly (V | null)[]): number {
  let L = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!a || !b) return Number.NaN;
    L += dist(a, b);
  }
  return L;
}

/* ───────── measured over the whole clip, once ───────── */

export interface MuscleAnalysis {
  /** Length of every muscle on every frame: lengths[frame][muscle * 2 + side]. NaN when not measurable. */
  lengths: Float32Array[];
  /** The rest length: mean over the first frames of the clip. */
  rest: Float32Array;
  fps: number;
}

const cache = new WeakMap<object, Map<ViewKind, MuscleAnalysis>>();
const REST_FRAMES = 8;

export function analyseMuscles(skeleton: Skeleton, view: ViewKind, fps: number): MuscleAnalysis {
  let byView = cache.get(skeleton.frames);
  if (byView === undefined) { byView = new Map(); cache.set(skeleton.frames, byView); }
  const hit = byView.get(view);
  if (hit !== undefined) return hit;

  const n = MUSCLES.length * 2;
  const lengths: Float32Array[] = [];
  for (let f = 0; f < skeleton.frames.length; f++) {
    const row = new Float32Array(n).fill(Number.NaN);
    const rig = buildRig(skeleton, f, view);
    if (rig !== null) {
      MUSCLES.forEach((m, mi) => SIDES.forEach((S, si) => { row[mi * 2 + si] = pathLength(m.anchors.map((a) => anchorPoint(rig, S, a))); }));
    }
    lengths.push(row);
  }
  const rest = new Float32Array(n).fill(Number.NaN);
  for (let i = 0; i < n; i++) {
    let sum = 0, c = 0;
    for (let f = 0; f < Math.min(REST_FRAMES, lengths.length); f++) if (Number.isFinite(lengths[f][i])) { sum += lengths[f][i]; c++; }
    if (c > 0) rest[i] = sum / c;
  }
  const out = { lengths, rest, fps };
  byView.set(view, out);
  return out;
}

/** Ratio to the rest length and the contraction proxy of one muscle on one frame. */
export function muscleState(an: MuscleAnalysis, frame: number, index: number): { ratio: number; c: number } {
  const L = an.lengths[frame]?.[index];
  const rest = an.rest[index];
  if (!Number.isFinite(L) || !Number.isFinite(rest) || rest <= 0) return { ratio: 1, c: 0 };
  const prev = an.lengths[Math.max(0, frame - 1)][index];
  const next = an.lengths[Math.min(an.lengths.length - 1, frame + 1)][index];
  const speed = Number.isFinite(prev) && Number.isFinite(next) ? shorteningSpeed(prev, next, rest, an.fps) : 0;
  const ratio = L / rest;
  return { ratio, c: contraction(ratio, speed) };
}

/* ───────── one frame ───────── */

export interface MuscleInst {
  id: string;
  z: number;
  far: boolean;
  /** The centre line of the belly and the half thickness (px) at each of its points. */
  line: V[];
  half: number[];
  /** The tendon parts of the path (before and after the belly). */
  tendons: V[][];
  ratio: number;
  c: number;
  thickness: number;
  /** Trunk muscles lie over the ribs and the pelvis (a see-through layer), limb muscles under the bones. */
  over: boolean;
}

/** Catmull-Rom through the anchors, `per` samples per span. */
function smoothPath(pts: readonly V[], per = 6): V[] {
  if (pts.length < 3) return [...pts];
  const out: V[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(v(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Cuts a polyline at fractions of its length. */
function slicePath(pts: readonly V[], t0: number, t1: number): V[] {
  const total = pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);
  if (total === 0) return [...pts];
  const out: V[] = [];
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += dist(pts[i - 1], pts[i]);
    const t = run / total;
    if (t >= t0 && t <= t1) out.push(pts[i]);
  }
  return out;
}

export function buildMuscles(rig: Rig, an: MuscleAnalysis, frame: number): MuscleInst[] {
  const out: MuscleInst[] = [];
  MUSCLES.forEach((m, mi) => {
    if (!m.views.includes(rig.view)) return;
    SIDES.forEach((S, si) => {
      const anchors = m.anchors.map((a) => anchorPoint(rig, S, a));
      if (anchors.some((a) => a === null)) return;
      const path = smoothPath(anchors as V[]);
      const { ratio, c } = muscleState(an, frame, mi * 2 + si);
      const thickness = thicknessFactor(ratio);
      const belly = slicePath(path, m.belly[0], m.belly[1]);
      if (belly.length < 2) return;
      const ref = refLength(rig, S, m.group);
      const peak = Math.max(1.2, m.half * ref * thickness * (m.group === 'leg' ? 1.45 : m.group === 'arm' ? 1.3 : 1.15));
      const half = belly.map((_, i) => {
        const s = i / (belly.length - 1);
        return peak * (0.2 + 0.8 * Math.pow(Math.sin(Math.PI * s), 0.7));
      });
      const tendons: V[][] = [];
      if (m.belly[0] > 0.001) tendons.push(slicePath(path, 0, m.belly[0] + 0.02));
      if (m.belly[1] < 0.999) tendons.push(slicePath(path, m.belly[1] - 0.02, 1));
      const z = depthOf(m.group, S, rig);
      out.push({ id: `${S}.${m.id}`, z, far: isFar(S, rig), line: belly, half, tendons, ratio, c, thickness, over: m.group === 'core' });
    });
  });
  return out;
}

/** The patellar tendon, from the patella to the tibial tuberosity. */
export function patellarTendon(rig: Rig, S: SideId): V[] | null {
  const hip = rig.p[`${S}.hip`], knee = rig.p[`${S}.knee`], ankle = rig.p[`${S}.ankle`];
  if (!hip || !knee || !ankle) return null;
  const thigh = dist(hip, knee);
  const fd = unit(sub(knee, hip));
  const sd = unit(sub(ankle, knee));
  const n = normalFor(rig, S, sd);
  const side = rig.view === 'side';
  const top = side ? add(knee, mul(unit(add(rig.fwd, mul(sub(sd, fd), 0.35))), thigh * 0.062 + thigh * 0.04)) : add(knee, mul(fd, thigh * 0.0));
  const end = add(add(knee, mul(sd, dist(knee, ankle) * 0.1)), mul(side ? rig.fwd : v(0, 0), thigh * 0.05));
  void n; void mid; void perp;
  return [top, end];
}
