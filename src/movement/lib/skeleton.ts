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

/* ───────── labels that do not overlap ───────── */

export interface LabelItem {
  id: string;
  /** The joint the label belongs to, and where the label would like to be (centres, canvas px). */
  ax: number; ay: number; px: number; py: number;
  w: number; h: number;
  /** Higher wins a free spot; a label of priority 0 is dropped when there is none. */
  priority: number;
}
export interface PlacedLabel { id: string; x: number; y: number; /** moved away from its joint: draw a leader line */ leader: boolean; hidden: boolean }

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, gap: number): boolean =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap;

/**
 * Places the pills so that none covers another: each takes its wish if free, else the nearest free spot on rings around its joint
 * (a leader line then joins it to the joint). Important labels place first; one that finds no room is hidden unless it matters
 * (priority > 0). bounds keeps them inside the stage.
 */
export function placeLabels(items: readonly LabelItem[], bounds?: { w: number; h: number }, gap = 3): PlacedLabel[] {
  const order = [...items].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  const placed: { id: string; x: number; y: number; w: number; h: number }[] = [];
  const out = new Map<string, PlacedLabel>();
  const inside = (x: number, y: number, it: LabelItem) => bounds === undefined || (x - it.w / 2 >= 0 && x + it.w / 2 <= bounds.w && y - it.h / 2 >= 0 && y + it.h / 2 <= bounds.h);
  for (const it of order) {
    const free = (x: number, y: number) => inside(x, y, it) && !placed.some((p) => overlaps({ x, y, w: it.w, h: it.h }, p, gap));
    let spot: { x: number; y: number } | null = free(it.px, it.py) ? { x: it.px, y: it.py } : null;
    for (let ring = 1; spot === null && ring <= 4; ring++) {
      const radius = it.h * 0.9 * ring + Math.hypot(it.px - it.ax, it.py - it.ay);
      for (let k = 0; k < 12 && spot === null; k++) {
        const ang = (k / 12) * Math.PI * 2 + Math.atan2(it.py - it.ay, it.px - it.ax);
        const x = it.ax + Math.cos(ang) * radius;
        const y = it.ay + Math.sin(ang) * radius;
        if (free(x, y)) spot = { x, y };
      }
    }
    if (spot === null) {
      if (it.priority > 0) spot = { x: it.px, y: it.py };
      else { out.set(it.id, { id: it.id, x: it.px, y: it.py, leader: false, hidden: true }); continue; }
    }
    placed.push({ id: it.id, x: spot.x, y: spot.y, w: it.w, h: it.h });
    out.set(it.id, { id: it.id, x: spot.x, y: spot.y, leader: Math.hypot(spot.x - it.px, spot.y - it.py) > it.h * 0.4, hidden: false });
  }
  return items.map((it) => out.get(it.id)!);
}

/** Which angle labels are worth drawing for a figure this tall on screen: all, only the knees, or none. */
export function labelPriorityFloor(figurePx: number): number {
  if (figurePx < 90) return 3;
  if (figurePx < 170) return 2;
  return 0;
}

/** The pill font follows the zoom: smaller on a tiny stage, larger when zoomed in. */
export function pillFont(unit: number): number {
  return Math.round(10 + 4 * Math.min(1.3, Math.max(0.55, unit)));
}
