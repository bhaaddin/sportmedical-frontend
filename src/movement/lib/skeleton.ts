/*
 * Pure helpers of the skeleton overlay: which region a keypoint or an edge belongs to, how a point is styled, how it fades
 * with confidence, the athlete's bounding box (for the "Detail" zoom), flexion-arc geometry and motion trails.
 * Nothing here knows a 26- or a 133-point layout: it reads `names`, `edges` and (when present) `groups` of the result.
 */
import type { ClipResult } from '../../api/movement';

export type Skeleton = ClipResult['skeleton'];
export type Region = 'body' | 'feet' | 'face' | 'leftHand' | 'rightHand';
export type Side = 'L' | 'R' | 'C';
export type Layer = 'body' | 'hands' | 'face' | 'feet';

/** Region -> the layer toggle that shows it. */
export const LAYER_OF: Record<Region, Layer> = { body: 'body', feet: 'feet', face: 'face', leftHand: 'hands', rightHand: 'hands' };

/** Below this confidence a point is not drawn at all. */
export const MIN_CONFIDENCE = 0.3;
/** From here up it is drawn fully; in between it fades. */
export const FULL_CONFIDENCE = 0.7;

/** 0 (hidden) .. 1 (full): a point fades in over the confidence range. */
export function confidenceAlpha(confidence: number): number {
  if (!(confidence >= MIN_CONFIDENCE)) return 0;
  if (confidence >= FULL_CONFIDENCE) return 1;
  return 0.25 + 0.75 * ((confidence - MIN_CONFIDENCE) / (FULL_CONFIDENCE - MIN_CONFIDENCE));
}

/** An edge is only as visible as its weaker end. */
export const edgeAlpha = (a: number, b: number): number => Math.min(confidenceAlpha(a), confidenceAlpha(b));

const isFootName = (n: string) => /(big_toe|small_toe|heel)$/.test(n);

/** The region of every keypoint: from `groups` (half-open ranges) when the result has them, else from the names. */
export function regionsOf(skeleton: Pick<Skeleton, 'names'> & { groups?: Record<string, [number, number]> | null }): Region[] {
  const { names, groups } = skeleton;
  return names.map((name, i) => {
    if (groups) {
      for (const key of ['body', 'feet', 'face', 'leftHand', 'rightHand'] as const) {
        const g = groups[key];
        if (g && i >= g[0] && i < g[1]) return key;
      }
    }
    if (name.startsWith('face')) return 'face';
    if (name.startsWith('left_hand') || /^left_(thumb|index|middle|ring|pinky)/.test(name)) return 'leftHand';
    if (name.startsWith('right_hand') || /^right_(thumb|index|middle|ring|pinky)/.test(name)) return 'rightHand';
    if (isFootName(name)) return 'feet';
    return 'body';
  });
}

/** The side of a keypoint: warm (left) or cool (right) in the overlay, centre things neutral. */
export function sideOf(name: string | undefined, region: Region): Side {
  if (region === 'leftHand') return 'L';
  if (region === 'rightHand') return 'R';
  if (region === 'face') return 'C';
  if (name === undefined) return 'C';
  if (name.startsWith('left')) return 'L';
  if (name.startsWith('right')) return 'R';
  return 'C';
}

/** The region an edge is drawn as: hands and feet win over the body (the wrist-to-hand link is a hand line). */
export function edgeRegion(a: Region, b: Region): Region {
  for (const r of ['leftHand', 'rightHand', 'face', 'feet'] as const) if (a === r || b === r) return r;
  return 'body';
}

export interface LineStyle { width: number; alpha: number; halo: boolean; glow: boolean }

/** Line width in CSS pixels at `unit` (see `lineUnit`); the body is bold and haloed, the face a fine mesh. */
export function edgeStyle(region: Region, unit: number, highlighted: boolean): LineStyle {
  switch (region) {
    case 'body': return { width: (highlighted ? 6 : 4.2) * unit, alpha: 1, halo: true, glow: true };
    case 'feet': return { width: 3 * unit, alpha: 0.95, halo: true, glow: false };
    case 'leftHand':
    case 'rightHand': return { width: 1.5 * unit, alpha: 0.95, halo: false, glow: false };
    case 'face': return { width: 0.9 * unit, alpha: 0.6, halo: false, glow: false };
  }
}

const BIG = /(shoulder|hip|knee|ankle)$/;
const MEDIUM = /(elbow|wrist|nose|neck|head)$/;

/** Marker radius: big at the joints that matter (hips, knees, ankles, shoulders), tiny on the face. */
export function jointRadius(name: string, region: Region, unit: number, highlighted: boolean): number {
  let r: number;
  if (region === 'face') r = 1.05;
  else if (region === 'leftHand' || region === 'rightHand') r = /wrist$/.test(name) ? 2.6 : /[1]$/.test(name) ? 2 : 1.7;
  else if (region === 'feet') r = 2.6;
  else if (BIG.test(name)) r = 5.6;
  else if (MEDIUM.test(name)) r = 4;
  else r = 2.8;
  return (highlighted ? r * 1.5 : r) * unit;
}

/** Line widths scale with the displayed size of the video: 1 at about 1000 px wide, clamped. */
export function lineUnit(displayedVideoWidth: number): number {
  return Math.min(2.2, Math.max(0.55, displayedVideoWidth / 1000));
}

/* ───────── bounding box and the "Detail" zoom ───────── */

export interface Bounds { x0: number; y0: number; x1: number; y1: number }

/**
 * The box that holds the athlete in ALL frames (so the zoom does not jump while they move). Face and hand points are left out
 * (they are inside the body anyway and only add noise); points below the confidence floor are ignored. Null for no points.
 */
export function skeletonBounds(skeleton: Skeleton, pad = 0.12): Bounds | null {
  const regions = regionsOf(skeleton);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const frame of skeleton.frames) {
    for (let i = 0; i < frame.length; i++) {
      if (regions[i] === 'face' || regions[i] === 'leftHand' || regions[i] === 'rightHand') continue;
      const [x, y, c] = frame[i];
      if (x === null || y === null || !(c >= MIN_CONFIDENCE)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (!Number.isFinite(x0)) return null;
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  return { x0: x0 - w * pad, y0: y0 - h * pad, x1: x1 + w * pad, y1: y1 + h * pad };
}

/** Width / height of a box. */
export const aspectOf = (b: Bounds): number => (b.x1 - b.x0) / Math.max(1, b.y1 - b.y0);

/** The shape of the stage while zoomed: the athlete's box, but never thinner than 3:5 nor wider than the video. */
export function detailAspect(b: Bounds, videoAspect: number): number {
  return Math.min(videoAspect, Math.max(0.6, aspectOf(b)));
}

/* ───────── flexion arc ───────── */

export interface Arc { cx: number; cy: number; start: number; sweep: number; mid: number }

/**
 * The arc that shows a flexion of `valueDeg` at `joint`: it starts along the continuation of the upper segment (prev -> joint)
 * and sweeps toward the lower one (joint -> next), the way the limb actually bent. The size of the sweep is the measured value,
 * so the arc and the number always agree. Angles are canvas radians (y down, clockwise positive).
 */
export function flexionArc(prev: { x: number; y: number }, joint: { x: number; y: number }, next: { x: number; y: number }, valueDeg: number): Arc {
  const d1x = joint.x - prev.x;
  const d1y = joint.y - prev.y;
  const d2x = next.x - joint.x;
  const d2y = next.y - joint.y;
  const start = Math.atan2(d1y, d1x);
  const cross = d1x * d2y - d1y * d2x;
  const sign = cross >= 0 ? 1 : -1;
  const sweep = sign * (Math.max(0, Math.min(180, valueDeg)) * Math.PI) / 180;
  return { cx: joint.x, cy: joint.y, start, sweep, mid: start + sweep / 2 };
}

/* ───────── motion trail ───────── */

/** The positions of one keypoint over the last `length` frames up to `frame` (oldest first), skipping unknown points. */
export function trailOf(frames: Skeleton['frames'], frame: number, index: number, length = 10): { x: number; y: number; c: number }[] {
  const out: { x: number; y: number; c: number }[] = [];
  for (let f = Math.max(0, frame - length); f <= frame; f++) {
    const k = frames[f]?.[index];
    if (k && k[0] !== null && k[1] !== null && k[2] >= MIN_CONFIDENCE) out.push({ x: k[0], y: k[1], c: k[2] });
  }
  return out;
}
