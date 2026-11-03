/*
 * Pure geometry of the anatomy renderer: placing a bone template between two joints, which of two limbs is drawn first, how the
 * foot's five metatarsals and toes fan out between heel, big toe and small toe, how the hand's bones follow its 21 points,
 * and how a muscle's length turns into thickness and colour.
 */
import type { BoneTemplate, Poly } from './templates';
import type { Rig, SideId } from './rig';
import { clamp, dist, dot, lerp, len, mul, perp, sub, unit, v, add, type V } from './vec';

export interface Placed {
  /** The outlines, each as a flat [x0, y0, x1, y1, ...] list in canvas pixels. */
  parts: number[][];
  highlight: number[];
  a: V;
  b: V;
  /** Bone length in pixels. */
  length: number;
  /** Half the bone's visible width at its widest, in pixels (for gradients and outline weights). */
  half: number;
}

/** The unit normal of a bone's axis that points to the template's +v side: toward the front in a side view, outward in a front view. */
export function normalFor(rig: Rig, side: SideId | null, dir: V): V {
  const n = perp(dir);
  const ref = rig.view === 'side' ? rig.fwd : side === null ? v(0, 0) : rig.lat[side];
  return dot(n, ref) < 0 ? mul(n, -1) : n;
}

const flat = (poly: Poly, a: V, dir: V, n: V, L: number, offsetV: number, widthScale: number): number[] => {
  const out: number[] = [];
  for (const [u, vv] of poly) {
    const across = (offsetV + vv * widthScale) * L;
    out.push(a.x + dir.x * u * L + n.x * across, a.y + dir.y * u * L + n.y * across);
  }
  return out;
};

/**
 * Places a template between joints `a` (proximal, u=0) and `b` (distal, u=1). `widthScale` fattens or slims it, `offsetV` slides it
 * sideways (fraction of the length; a fibula beside the tibia), `normal` says which way +v points.
 */
export function placeTemplate(tpl: BoneTemplate, a: V, b: V, normal: V, widthScale = 1, offsetV = 0): Placed {
  const L = dist(a, b);
  const dir = L < 1e-6 ? v(1, 0) : unit(sub(b, a));
  let maxV = 0;
  for (const part of tpl.parts) for (const p of part) maxV = Math.max(maxV, Math.abs(p[1]));
  return {
    parts: tpl.parts.map((p) => flat(p, a, dir, normal, L, offsetV, widthScale)),
    highlight: flat(tpl.highlight, a, dir, normal, L, offsetV, widthScale),
    a, b, length: L, half: maxV * widthScale * L,
  };
}

/* ───────── depth order ───────── */

export type Group = 'leg' | 'arm' | 'core';

/**
 * Painting order: bigger is drawn later (on top). In a side view the limbs of the far side go first and dimmer, then the trunk,
 * then the near limbs; in a front or back view legs are under the trunk and arms over it.
 */
export function depthOf(group: Group, side: SideId | null, rig: Rig): number {
  if (group === 'core') return 20;
  if (rig.view !== 'side') return group === 'leg' ? 10 : 30;
  const near = side !== null && side === rig.near;
  return (near ? 30 : 10) + (group === 'arm' ? 2 : 0);
}

/** Far limbs are drawn dimmer. */
export const isFar = (side: SideId | null, rig: Rig): boolean => rig.view === 'side' && side !== null && side !== rig.near;

/* ───────── foot ───────── */

export interface Seg { a: V; b: V }
export interface FootFan {
  /** Where the tarsals end and the metatarsals begin. */
  tarsus: V;
  metatarsals: Seg[];
  /** The proximal phalanges (and the big toe's distal one), toe by toe, big toe first. */
  phalanges: Seg[][];
  /** The metatarsal heads. */
  heads: V[];
}

/**
 * The bones of a foot from the heel, the big-toe tip and the small-toe tip: the five metatarsals fan out between the two toe
 * points (big toe first), and each toe continues to its tip - two phalanges for the big toe, one block for the others.
 */
export function footFan(heel: V, toeBig: V, toeSmall: V): FootFan {
  const tipMid = lerp(toeBig, toeSmall, 0.5);
  const footLen = Math.max(1, dist(heel, tipMid));
  const forward = unit(sub(tipMid, heel));
  let across = unit(sub(toeBig, toeSmall));
  if (len(across) === 0 || dist(toeBig, toeSmall) < 0.05 * footLen) across = mul(perp(forward), dot(perp(forward), v(0, 1)) >= 0 ? 1 : -1);
  const spread = Math.max(dist(toeBig, toeSmall), 0.12 * footLen);
  const tarsus = lerp(heel, tipMid, 0.34);
  const metatarsals: Seg[] = [];
  const phalanges: Seg[][] = [];
  const heads: V[] = [];
  for (let k = 0; k < 5; k++) {
    const t = k / 4;
    const tip = lerp(toeBig, toeSmall, t);
    const off = mul(across, (0.5 - t) * spread * 0.55);
    const base = add(tarsus, off);
    const head = lerp(base, add(tip, mul(across, (0.5 - t) * spread * 0.0)), 0.64);
    metatarsals.push({ a: base, b: head });
    heads.push(head);
    if (k === 0) {
      const knuckle = lerp(head, tip, 0.52);
      phalanges.push([{ a: head, b: knuckle }, { a: knuckle, b: tip }]);
    } else {
      phalanges.push([{ a: head, b: tip }]);
    }
  }
  return { tarsus, metatarsals, phalanges, heads };
}

/* ───────── hand ───────── */

export interface HandBone { id: string; a: V; b: V; kind: 'metacarpal' | 'phalanx'; finger: number }
export interface HandBones { bones: HandBone[]; carpals: V[]; joints: V[]; palm: V }

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;

/**
 * Every bone of a hand from its 21 points (index 0 the wrist, then four per finger, thumb to little finger): carpals around the
 * wrist, a metacarpal and three phalanges per finger (the thumb's metacarpal starts at its first point). Bones whose end
 * points are unknown are left out.
 */
export function handBones(hand: readonly (V | undefined)[]): HandBones | null {
  const wrist = hand[0];
  if (wrist === undefined) return null;
  const bones: HandBone[] = [];
  const joints: V[] = [];
  const pt = (i: number) => hand[i];
  const push = (id: string, a: V | undefined, b: V | undefined, kind: HandBone['kind'], finger: number) => {
    if (a !== undefined && b !== undefined && dist(a, b) > 0.4) bones.push({ id, a, b, kind, finger });
  };
  for (let f = 0; f < 5; f++) {
    const base = 1 + f * 4;
    const [p1, p2, p3, p4] = [pt(base), pt(base + 1), pt(base + 2), pt(base + 3)];
    const name = FINGERS[f];
    if (f === 0) {
      push(`${name}.trapezium`, wrist, p1, 'metacarpal', f);
      push(`${name}.meta`, p1, p2, 'metacarpal', f);
      push(`${name}.prox`, p2, p3, 'phalanx', f);
      push(`${name}.dist`, p3, p4, 'phalanx', f);
    } else {
      push(`${name}.meta`, wrist, p1, 'metacarpal', f);
      push(`${name}.prox`, p1, p2, 'phalanx', f);
      push(`${name}.mid`, p2, p3, 'phalanx', f);
      push(`${name}.dist`, p3, p4, 'phalanx', f);
    }
    for (const p of [p1, p2, p3]) if (p !== undefined) joints.push(p);
  }
  const knuckles = [5, 9, 13, 17].map(pt).filter((p): p is V => p !== undefined);
  let palm = v(0, 1);
  const carpals: V[] = [];
  if (knuckles.length > 0) {
    const c = knuckles.reduce((s, p) => add(s, p), v(0, 0));
    const centre = mul(c, 1 / knuckles.length);
    palm = unit(sub(centre, wrist));
    const handLen = dist(centre, wrist);
    const across = perp(palm);
    for (const [along, lat] of [[0.1, -0.2], [0.1, 0], [0.1, 0.2], [0.26, -0.13], [0.26, 0.13]] as const) {
      carpals.push(add(add(wrist, mul(palm, along * handLen)), mul(across, lat * handLen)));
    }
  }
  return { bones, carpals, joints, palm };
}

/* ───────── muscle length -> look ───────── */

/** How much a muscle's belly swells: thicker when it is shorter than at rest, thinner when stretched. */
export function thicknessFactor(ratio: number): number {
  return clamp(1 + 1.1 * (1 - ratio), 0.7, 1.55);
}

/** A 0..1 proxy for how hard a muscle is working: shortening below its rest length and how fast it shortens (per second, in rest lengths). */
export function contraction(ratio: number, shorteningSpeed: number): number {
  return clamp(6 * Math.max(0, 1 - ratio) + 0.5 * Math.max(0, shorteningSpeed), 0, 1);
}

/** Positive while the muscle shortens: rest lengths per second, by a central difference around the frame. */
export function shorteningSpeed(prev: number, next: number, rest: number, fps: number): number {
  if (rest <= 0) return 0;
  return ((prev - next) / (2 * rest)) * fps;
}

export interface Rgba { r: number; g: number; b: number; a: number }
const MUTED: Rgba = { r: 168, g: 84, b: 90, a: 0.42 };
const BRIGHT: Rgba = { r: 238, g: 52, b: 62, a: 0.82 };

/** Muted rose at rest to bright red under contraction. */
export function muscleColor(c: number): Rgba {
  const t = clamp(c, 0, 1);
  const f = (a: number, b: number) => a + (b - a) * t;
  return { r: f(MUTED.r, BRIGHT.r), g: f(MUTED.g, BRIGHT.g), b: f(MUTED.b, BRIGHT.b), a: f(MUTED.a, BRIGHT.a) };
}

export const rgba = (c: Rgba, aScale = 1): string => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${(c.a * aScale).toFixed(3)})`;
