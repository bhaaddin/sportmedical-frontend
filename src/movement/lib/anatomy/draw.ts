/*
 * Painter of the anatomical overlay. The geometry arrives in VIDEO pixels (boneModel / muscleModel), so the canvas is set to the
 * video-to-stage transform once and every point is used as it is; widths are given in screen pixels and divided by the scale.
 * Order: by depth (far limbs, trunk, near limbs) and within a depth muscles, bones, tendons, joint caps. Far-side limbs are dimmer.
 */
import type { ContainRect } from '../overlay';
import { buildBones, type BoneFrame, type Caps, type Shape, type Tone } from './boneModel';
import { analyseMuscles, buildMuscles, patellarTendon, type MuscleInst } from './muscleModel';
import { muscleColor, rgba } from './geometry';
import { buildRig, SIDES, type Rig, type ViewKind } from './rig';
import { perp, unit, sub, type V } from './vec';
import type { Skeleton } from '../skeleton';

export interface AnatomyLayers { bones: boolean; muscles: boolean; tendons: boolean; joints: boolean }
export const DEFAULT_ANATOMY_LAYERS: AnatomyLayers = { bones: true, muscles: true, tendons: true, joints: true };

export interface TendonInst { id: string; z: number; far: boolean; pts: V[]; width: number }

export interface AnatomyFrame {
  rig: Rig;
  bones: BoneFrame;
  muscles: MuscleInst[];
  tendons: TendonInst[];
}

/** All the geometry of one frame, or null when the hips or shoulders are unknown. */
export function buildAnatomyFrame(skeleton: Skeleton, frame: number, view: ViewKind, fps: number): AnatomyFrame | null {
  const rig = buildRig(skeleton, frame, view);
  if (rig === null) return null;
  const bones = buildBones(rig);
  const analysis = analyseMuscles(skeleton, view, fps);
  const muscles = buildMuscles(rig, analysis, frame);
  const tendons: TendonInst[] = [];
  const T = rig.torso;
  for (const m of muscles) m.tendons.forEach((pts, i) => { if (pts.length > 1) tendons.push({ id: `${m.id}.t${i}`, z: m.z, far: m.far, pts, width: T * 0.009 }); });
  for (const S of SIDES) {
    const pt = patellarTendon(rig, S);
    if (pt) tendons.push({ id: `${S}.patellar`, z: bones.caps.find((c) => c.id === `${S}.knee`)?.z ?? 30, far: bones.caps.find((c) => c.id === `${S}.knee`)?.far ?? false, pts: pt, width: T * 0.013 });
  }
  return { rig, bones, muscles, tendons };
}

/* ───────── colours ───────── */

const BONE = { light: '#f6edd4', mid: '#e3d3aa', edge: '#b39b6c', outline: 'rgba(58, 44, 28, 0.92)', small: '#e8d9b3', teeth: '#fbf8ee', dark: 'rgba(22, 16, 12, 0.82)' };
const CARTILAGE = 'rgba(150, 206, 226, 0.28)';
const TENDON = 'rgba(248, 244, 232, 0.95)';
const TENDON_EDGE = 'rgba(110, 98, 78, 0.55)';

const fillOf = (ctx: CanvasRenderingContext2D, s: Shape): string | CanvasGradient => {
  if (s.tone === 'teeth') return BONE.teeth;
  if (s.tone === 'dark') return BONE.dark;
  if (s.tone === 'small' || s.axis === null || s.half < 1.5) return BONE.small;
  const [a, b] = s.axis;
  if (s.flat) {
    /* a flat bone is lit from its middle: light in the centre, darker toward the rim */
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const g = ctx.createRadialGradient(cx - s.half * 0.15, cy - s.half * 0.2, s.half * 0.05, cx, cy, s.half);
    g.addColorStop(0, BONE.light);
    g.addColorStop(0.55, BONE.mid);
    g.addColorStop(1, BONE.edge);
    return g;
  }
  const d = unit(sub(b, a));
  const n = perp(d);
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const g = ctx.createLinearGradient(cx - n.x * s.half, cy - n.y * s.half, cx + n.x * s.half, cy + n.y * s.half);
  g.addColorStop(0, BONE.edge);
  g.addColorStop(0.3, BONE.light);
  g.addColorStop(0.62, BONE.mid);
  g.addColorStop(1, BONE.edge);
  return g;
};

/** Signed area of a flat polygon (positive = clockwise on a y-down canvas). */
export function signedArea(pts: readonly number[]): number {
  let a = 0;
  const n = pts.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return a / 2;
}

/** Every outline is walked the same way round, so overlapping parts of one bone fill as a union instead of cancelling out. */
function tracePoly(ctx: CanvasRenderingContext2D, pts: readonly number[]): void {
  const n = pts.length;
  if (n < 6) return;
  if (signedArea(pts) >= 0) {
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < n; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  } else {
    ctx.moveTo(pts[n - 2], pts[n - 1]);
    for (let i = n - 4; i >= 0; i -= 2) ctx.lineTo(pts[i], pts[i + 1]);
  }
  ctx.closePath();
}
function traceLine(ctx: CanvasRenderingContext2D, pts: readonly number[]): void {
  if (pts.length < 4) return;
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
}

interface Item { z: number; order: number; draw: () => void }

export interface DrawOptions {
  layers: AnatomyLayers;
  /** Line-width unit (1 at about 1000 px of displayed video). */
  unit: number;
  /** Seconds-free pulse is not used here; kept for symmetry with the wireframe painter. */
  highlight?: ReadonlySet<string>;
}

/**
 * Paints a frame onto a canvas that is currently in CSS pixels: sets the video transform, draws, and restores the transform.
 * `rect` is where the video picture sits in the stage (viewRect).
 */
export function drawAnatomy(ctx: CanvasRenderingContext2D, a: AnatomyFrame, rect: ContainRect, dpr: number, options: DrawOptions): void {
  const { layers } = options;
  const k = 1 / Math.max(rect.scale, 1e-6);
  const css = (px: number) => px * k * options.unit;
  ctx.save();
  ctx.setTransform(dpr * rect.scale, 0, 0, dpr * rect.scale, dpr * rect.x, dpr * rect.y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const items: Item[] = [];
  const dim = (far: boolean) => { ctx.globalAlpha = far ? 0.58 : 1; };

  if (layers.muscles) {
    for (const m of a.muscles) items.push({ z: m.z, order: m.over ? 1.5 : 0, draw: () => { dim(m.far); drawMuscle(ctx, m, css, m.over ? 0.6 : 1); } });
  }
  if (layers.bones) {
    for (const s of a.bones.shapes) items.push({ z: s.z, order: 1, draw: () => { dim(s.far); drawShape(ctx, s, css); } });
  }
  if (layers.tendons) {
    for (const t of a.tendons) items.push({ z: t.z, order: 2, draw: () => { dim(t.far); drawTendon(ctx, t, css); } });
  }
  if (layers.joints) {
    for (const c of a.bones.caps) items.push({ z: c.z, order: 3, draw: () => { dim(c.far); drawCap(ctx, c, css); } });
  }
  items.sort((p, q) => p.z - q.z || p.order - q.order);
  for (const it of items) it.draw();

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, css: (px: number) => number): void {
  const big = s.tone === 'bone' && s.half >= 1.5;
  const ow = css(big ? 1.5 : 1);
  if (s.polys.length > 0) {
    ctx.beginPath();
    for (const p of s.polys) tracePoly(ctx, p);
    ctx.lineWidth = ow * 2;
    ctx.strokeStyle = s.tone === 'dark' ? 'rgba(0,0,0,0)' : BONE.outline;
    ctx.stroke();
    ctx.fillStyle = fillOf(ctx, s);
    ctx.fill();
    if (s.highlight.length > 3 && big) {
      ctx.beginPath();
      traceLine(ctx, s.highlight);
      ctx.strokeStyle = 'rgba(255, 255, 250, 0.55)';
      ctx.lineWidth = css(1.4);
      ctx.stroke();
    }
  }
  if (s.lines.length > 0) {
    ctx.beginPath();
    for (const l of s.lines) traceLine(ctx, l);
    ctx.strokeStyle = BONE.outline;
    ctx.lineWidth = Math.max(s.lineWidth, 0.01) + ow * 2;
    ctx.stroke();
    ctx.strokeStyle = BONE.mid;
    ctx.lineWidth = Math.max(s.lineWidth, 0.01);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 252, 240, 0.5)';
    ctx.lineWidth = Math.max(s.lineWidth * 0.3, css(0.6));
    ctx.stroke();
  }
}

function drawMuscle(ctx: CanvasRenderingContext2D, m: MuscleInst, css: (px: number) => number, alpha: number): void {
  const n = m.line.length;
  if (n < 2) return;
  const left: V[] = [];
  const right: V[] = [];
  for (let i = 0; i < n; i++) {
    const p = m.line[i];
    const d = unit(sub(m.line[Math.min(n - 1, i + 1)], m.line[Math.max(0, i - 1)]));
    const nr = perp(d);
    left.push({ x: p.x + nr.x * m.half[i], y: p.y + nr.y * m.half[i] });
    right.push({ x: p.x - nr.x * m.half[i], y: p.y - nr.y * m.half[i] });
  }
  const col = muscleColor(m.c);
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fillStyle = rgba(col, alpha);
  ctx.fill();
  ctx.lineWidth = css(1);
  ctx.strokeStyle = rgba({ r: col.r * 0.55, g: col.g * 0.4, b: col.b * 0.42, a: 0.85 });
  ctx.stroke();
  /* fibres along the belly */
  ctx.beginPath();
  for (const f of [-0.55, -0.27, 0, 0.27, 0.55]) {
    for (let i = 0; i < n; i++) {
      const x = m.line[i].x + (left[i].x - m.line[i].x) * f;
      const y = m.line[i].y + (left[i].y - m.line[i].y) * f;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = rgba({ r: 120, g: 18, b: 30, a: 0.32 });
  ctx.lineWidth = css(0.8);
  ctx.stroke();
}

function drawTendon(ctx: CanvasRenderingContext2D, t: TendonInst, css: (px: number) => number): void {
  ctx.beginPath();
  ctx.moveTo(t.pts[0].x, t.pts[0].y);
  for (let i = 1; i < t.pts.length; i++) ctx.lineTo(t.pts[i].x, t.pts[i].y);
  ctx.strokeStyle = TENDON_EDGE;
  ctx.lineWidth = t.width + css(1.2);
  ctx.stroke();
  ctx.strokeStyle = TENDON;
  ctx.lineWidth = t.width;
  ctx.stroke();
}

function drawCap(ctx: CanvasRenderingContext2D, c: Caps, css: (px: number) => number): void {
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, Math.max(c.rx, css(1.2)), Math.max(c.ry, css(1.2)), c.rot, 0, Math.PI * 2);
  ctx.fillStyle = CARTILAGE;
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 120, 140, 0.45)';
  ctx.lineWidth = css(0.7);
  ctx.stroke();
}

export type { Tone };
