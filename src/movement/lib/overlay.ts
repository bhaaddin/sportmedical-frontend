/*
 * The skeleton overlay: pure geometry (`buildScene`) and a small painter (`drawScene`).
 *
 * The canvas lies exactly over the stage. The video is placed in it by `viewRect`: letterboxed like `object-fit: contain`, or -
 * in "Detail" - zoomed onto the athlete. Skeleton coordinates are pixels of the VIDEO FRAME; `project` maps them to canvas CSS
 * pixels. The scene is drawn straight from the result's `edges` and `groups` (no fixed point layout): body limbs thick with a dark
 * halo, hands with every finger bone, the face as a fine mesh, feet with heel-toe triangles, all fading with confidence.
 */
import { LAYER_OF, MIN_CONFIDENCE, labelPriorityFloor, pillFont, placeLabels, confidenceAlpha, edgeAlpha, edgeRegion, edgeStyle, flexionArc, jointRadius, lineUnit, regionsOf, sideOf, trailOf, type Bounds, type Region, type Skeleton } from './skeleton';

export interface Box { x: number; y: number; w: number; h: number }
export interface ContainRect extends Box { scale: number }

/** Where a videoW x videoH picture lands inside a boxW x boxH element with `object-fit: contain`. */
export function containRect(boxW: number, boxH: number, videoW: number, videoH: number): ContainRect {
  if (boxW <= 0 || boxH <= 0 || videoW <= 0 || videoH <= 0) return { x: 0, y: 0, w: 0, h: 0, scale: 0 };
  const scale = Math.min(boxW / videoW, boxH / videoH);
  const w = videoW * scale;
  const h = videoH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h, scale };
}

/**
 * Where the video picture is placed in the stage. Without `zoom` that is the contain rect. With `zoom` (the athlete's bounds in
 * video pixels) the picture is scaled so the bounds fill the stage and are centred in it (as far as the picture's own edges allow);
 * the rest is cropped.
 */
export function viewRect(boxW: number, boxH: number, videoW: number, videoH: number, zoom: Bounds | null): ContainRect {
  if (zoom === null || boxW <= 0 || boxH <= 0 || videoW <= 0 || videoH <= 0) return containRect(boxW, boxH, videoW, videoH);
  const bw = Math.max(1, zoom.x1 - zoom.x0);
  const bh = Math.max(1, zoom.y1 - zoom.y0);
  /* fit the bounds, but never less than needed for the picture to cover the stage (no empty bars) */
  const scale = Math.max(Math.min(boxW / bw, boxH / bh), boxW / videoW, boxH / videoH);
  const cx = (zoom.x0 + zoom.x1) / 2;
  const cy = (zoom.y0 + zoom.y1) / 2;
  const w = videoW * scale;
  const h = videoH * scale;
  /* centre on the athlete, but never show past the edge of the picture when it is bigger than the stage */
  const place = (centre: number, box: number, size: number) => (size >= box ? Math.min(0, Math.max(box - size, box / 2 - centre * scale)) : (box - size) / 2);
  return { x: place(cx, boxW, w), y: place(cy, boxH, h), w, h, scale };
}

/** A video-pixel point -> canvas CSS pixels. */
export function project(rect: ContainRect, px: number, py: number): { x: number; y: number } {
  return { x: rect.x + px * rect.scale, y: rect.y + py * rect.scale };
}

/** A canvas CSS-pixel point -> video pixels (the inverse; used by tests and for hit tests). */
export function unproject(rect: ContainRect, cx: number, cy: number): { x: number; y: number } {
  return rect.scale === 0 ? { x: 0, y: 0 } : { x: (cx - rect.x) / rect.scale, y: (cy - rect.y) / rect.scale };
}

export interface Layers { body: boolean; hands: boolean; face: boolean; feet: boolean; angles: boolean; trail: boolean; events: boolean }
export const DEFAULT_LAYERS: Layers = { body: true, hands: true, face: true, feet: true, angles: true, trail: true, events: true };

/** What the review screen toggles: the anatomical layers, the keypoints and the extras. */
export interface ViewLayers { bones: boolean; muscles: boolean; tendons: boolean; joints: boolean; points: boolean; angles: boolean; trail: boolean; events: boolean; /** 3D: semi-transparent copies of earlier poses */ ghosts: boolean }
export const DEFAULT_VIEW_LAYERS: ViewLayers = { bones: true, muscles: true, tendons: true, joints: true, points: false, angles: true, trail: true, events: true, ghosts: false };
/** 3D anatomie (MyoSim bones and muscles in WebGL), Anatomie 2D (the procedural drawing, the fallback) or Kostra (the wireframe of the keypoints). */
export type OverlayStyle = 'anatomy3d' | 'anatomy' | 'wire';

export type ColorKey = 'left' | 'right' | 'center' | 'face' | 'highlight';

export interface StrokeBatch { region: Region; key: ColorKey; width: number; alpha: number; halo: boolean; glow: boolean; segs: number[] }
export interface Dot { x: number; y: number; r: number; key: ColorKey; alpha: number; region: Region }
export interface ArcShape { cx: number; cy: number; r: number; start: number; sweep: number; key: ColorKey }
export interface Pill { x: number; y: number; text: string; tone: 'angle' | 'event'; /** the joint this pill belongs to, when it was moved away from it */ leader?: { x: number; y: number } }
export interface Ring { x: number; y: number; r: number }
export interface Trail { key: ColorKey; pts: { x: number; y: number }[] }
export interface OverlayScene {
  rect: ContainRect; unit: number;
  strokes: StrokeBatch[]; dots: Dot[]; arcs: ArcShape[]; labels: Pill[]; rings: Ring[]; trails: Trail[];
}

/** The wireframe layers a review-screen toggle set stands for: every region follows "Kosti". */
export const wireLayersOf = (l: ViewLayers): Layers => ({ body: l.bones, hands: l.bones, face: l.bones, feet: l.bones, angles: l.angles, trail: l.trail, events: l.events });

/** An angle to show: the joint, the points of the segments on both sides of it, and the measured value. */
export interface AngleSpec { joint: number; prev: number[]; next: number; value: number; /** 2 for a knee, 1 for a hip: what is dropped first on a small figure */ priority?: number }

export interface SceneInput {
  skeleton: Skeleton;
  frame: number;
  box: { w: number; h: number };
  video: { w: number; h: number };
  highlight: ReadonlySet<number>;
  layers: Layers;
  /** The athlete's bounds while "Detail" is on. */
  zoom?: Bounds | null;
  /** Leave out the lines between points / the point markers (the anatomical style draws its own bodies). */
  noLines?: boolean;
  noDots?: boolean;
  angles?: readonly AngleSpec[];
  eventCaptions?: readonly { joint: number; text: string }[];
}

const bucket = (a: number): number => (a >= 0.99 ? 1 : a >= 0.6 ? 0.7 : 0.4);
const TRAIL_JOINTS = ['left_ankle', 'right_ankle', 'left_wrist', 'right_wrist'] as const;

/** Everything the canvas needs for one frame, already in canvas pixels. */
export function buildScene(input: SceneInput): OverlayScene {
  const { skeleton, frame, layers, highlight } = input;
  const rect = viewRect(input.box.w, input.box.h, input.video.w, input.video.h, input.zoom ?? null);
  const unit = lineUnit(rect.w);
  const scene: OverlayScene = { rect, unit, strokes: [], dots: [], arcs: [], labels: [], rings: [], trails: [] };
  const pose = skeleton.frames[frame];
  if (pose === undefined || rect.scale === 0) return scene;

  const regions = regionsOf(skeleton);
  const shown = (r: Region) => layers[LAYER_OF[r]];
  const point = (i: number) => {
    const k = pose[i];
    if (k === undefined || k[0] === null || k[1] === null || !(k[2] >= MIN_CONFIDENCE)) return null;
    return { ...project(rect, k[0], k[1]), c: k[2] };
  };
  const keyOf = (i: number): ColorKey => {
    if (highlight.has(i)) return 'highlight';
    const side = sideOf(skeleton.names[i], regions[i]);
    return regions[i] === 'face' ? 'face' : side === 'L' ? 'left' : side === 'R' ? 'right' : 'center';
  };

  /* strokes from the edges, batched by region, colour and fade so a frame is a handful of canvas calls */
  const batches = new Map<string, StrokeBatch>();
  for (const [a, b] of input.noLines ? [] : skeleton.edges) {
    const ra = regions[a];
    const rb = regions[b];
    if (ra === undefined || rb === undefined) continue;
    const region = edgeRegion(ra, rb);
    if (!shown(region) || !shown(ra) || !shown(rb)) continue;
    const pa = point(a);
    const pb = point(b);
    if (pa === null || pb === null) continue;
    const hi = highlight.has(a) && highlight.has(b);
    const sideA = sideOf(skeleton.names[a], ra);
    const sideB = sideOf(skeleton.names[b], rb);
    const key: ColorKey = hi ? 'highlight' : region === 'face' ? 'face' : sideA === sideB && sideA !== 'C' ? (sideA === 'L' ? 'left' : 'right') : sideA !== 'C' && sideB === 'C' ? (sideA === 'L' ? 'left' : 'right') : sideB !== 'C' && sideA === 'C' ? (sideB === 'L' ? 'left' : 'right') : 'center';
    const style = edgeStyle(region, unit, hi);
    const alpha = bucket(edgeAlpha(pa.c, pb.c)) * style.alpha;
    const id = `${region}|${key}|${alpha}|${hi}`;
    let batch = batches.get(id);
    if (batch === undefined) {
      batch = { region, key, width: style.width, alpha, halo: style.halo, glow: style.glow, segs: [] };
      batches.set(id, batch);
    }
    batch.segs.push(pa.x, pa.y, pb.x, pb.y);
  }
  scene.strokes = [...batches.values()];

  /* joint markers, sized by importance */
  pose.forEach((_, i) => {
    const region = regions[i];
    if (!shown(region)) return;
    const p = point(i);
    if (p === null) return;
    const hi = highlight.has(i);
    if (!input.noDots) scene.dots.push({ x: p.x, y: p.y, r: jointRadius(skeleton.names[i], region, unit, hi), key: keyOf(i), alpha: confidenceAlpha(p.c), region });
    if (hi) scene.rings.push({ x: p.x, y: p.y, r: 11 * unit });
  });

  /* a faint trail behind the ankles and wrists */
  if (layers.trail) {
    for (const name of TRAIL_JOINTS) {
      const i = skeleton.names.indexOf(name);
      if (i < 0 || !shown(regions[i])) continue;
      const pts = trailOf(skeleton.frames, frame, i, 10).map((p) => project(rect, p.x, p.y));
      if (pts.length > 1) scene.trails.push({ key: keyOf(i), pts });
    }
  }

  /* flexion arcs with their value in a small pill; pills never overlap, and a small figure keeps only the important ones */
  const font = pillFont(unit);
  const items: { id: string; ax: number; ay: number; px: number; py: number; w: number; h: number; priority: number; text: string; tone: 'angle' | 'event' }[] = [];
  let top = Infinity, bottom = -Infinity;
  pose.forEach((_, i) => { const p = regions[i] === 'body' || regions[i] === 'feet' ? point(i) : null; if (p) { top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); } });
  const floor = labelPriorityFloor(Number.isFinite(top) ? bottom - top : 1e9);
  if (layers.angles && input.angles !== undefined) {
    input.angles.forEach((spec, k) => {
      const j = point(spec.joint);
      const n = point(spec.next);
      const ps = spec.prev.map(point).filter((p): p is NonNullable<typeof p> => p !== null);
      if (j === null || n === null || ps.length === 0) return;
      const prev = { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
      const arc = flexionArc(prev, j, n, spec.value);
      const r = 20 * unit;
      const priority = spec.priority ?? 1;
      if (priority < floor) return;
      scene.arcs.push({ cx: j.x, cy: j.y, r, start: arc.start, sweep: arc.sweep, key: keyOf(spec.joint) });
      const text = `${Math.round(spec.value)}°`;
      items.push({ id: `a${k}`, ax: j.x, ay: j.y, px: j.x + Math.cos(arc.mid) * (r + 15 * unit), py: j.y + Math.sin(arc.mid) * (r + 15 * unit), w: text.length * font * 0.62 + 12, h: font + 8, priority: priority + 1, text, tone: 'angle' });
    });
  }
  if (layers.events && input.eventCaptions !== undefined) {
    input.eventCaptions.forEach((c, i) => {
      const p = point(c.joint);
      if (p === null) return;
      const evFont = Math.max(10, font - 3);
      items.push({ id: `e${i}`, ax: p.x, ay: p.y, px: p.x + 14, py: p.y + 18 + i * 22, w: c.text.length * evFont * 0.6 + 12, h: evFont + 8, priority: 0, text: c.text, tone: 'event' });
    });
  }
  const placedAt = placeLabels(items, input.box);
  items.forEach((it, i) => {
    const pl = placedAt[i];
    if (pl.hidden) return;
    scene.labels.push({ x: pl.x, y: pl.y, text: it.text, tone: it.tone, ...(pl.leader ? { leader: { x: it.ax, y: it.ay } } : {}) });
  });
  return scene;
}

export interface OverlayColors { left: string; right: string; center: string; face: string; highlight: string; label: string; labelBg: string; event: string; halo: string }

/**
 * Paint a scene: face mesh, then the haloed body and feet, hands, trails, joint markers, arcs, pills and the pulsing rings.
 * `pulse` is 0..1 (0 = a still ring, the Animace setting off or reduced). One call per video frame.
 */
export function drawScene(ctx: CanvasRenderingContext2D, scene: OverlayScene, size: { w: number; h: number }, dpr: number, colors: OverlayColors, pulse = 0, clear = true): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (clear) ctx.clearRect(0, 0, size.w, size.h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const colorOf = (k: ColorKey) => colors[k];
  const strokeBatch = (b: StrokeBatch, width: number, color: string, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < b.segs.length; i += 4) { ctx.moveTo(b.segs[i], b.segs[i + 1]); ctx.lineTo(b.segs[i + 2], b.segs[i + 3]); }
    ctx.stroke();
  };
  const of = (regions: Region[]) => scene.strokes.filter((b) => regions.includes(b.region));

  for (const b of of(['face'])) strokeBatch(b, b.width, colorOf(b.key), b.alpha);
  const thick = of(['body', 'feet']);
  for (const b of thick) if (b.halo) strokeBatch(b, b.width + 3.2 * scene.unit, colors.halo, b.alpha * 0.75);
  for (const b of thick) {
    if (b.glow) { ctx.shadowColor = colorOf(b.key); ctx.shadowBlur = 9 * scene.unit; }
    strokeBatch(b, b.width, colorOf(b.key), b.alpha);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
  for (const b of of(['leftHand', 'rightHand'])) strokeBatch(b, b.width, colorOf(b.key), b.alpha);

  for (const t of scene.trails) {
    ctx.strokeStyle = colorOf(t.key);
    ctx.lineWidth = 2.2 * scene.unit;
    for (let i = 1; i < t.pts.length; i++) {
      ctx.globalAlpha = 0.5 * (i / t.pts.length);
      ctx.beginPath();
      ctx.moveTo(t.pts[i - 1].x, t.pts[i - 1].y);
      ctx.lineTo(t.pts[i].x, t.pts[i].y);
      ctx.stroke();
    }
  }

  for (const d of scene.dots) {
    ctx.globalAlpha = d.alpha * (d.region === 'face' ? 0.75 : 1);
    if (d.region === 'body' && d.r > 3 * scene.unit) {
      ctx.fillStyle = colors.halo;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r + 1.6 * scene.unit, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = colorOf(d.key);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  for (const a of scene.arcs) {
    ctx.strokeStyle = colors.halo;
    ctx.lineWidth = 4.2 * scene.unit;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, a.r, a.start, a.start + a.sweep, a.sweep < 0);
    ctx.stroke();
    ctx.strokeStyle = colorOf(a.key);
    ctx.lineWidth = 2.2 * scene.unit;
    ctx.stroke();
  }

  const fontPx = pillFont(scene.unit);
  ctx.font = `700 ${fontPx}px system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const l of scene.labels) {
    if (l.leader) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = colors.label;
      ctx.lineWidth = Math.max(1, scene.unit);
      ctx.beginPath();
      ctx.moveTo(l.leader.x, l.leader.y);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const px = l.tone === 'event' ? Math.max(10, fontPx - 3) : fontPx;
    ctx.font = `700 ${px}px system-ui, sans-serif`;
    const w = ctx.measureText(l.text).width + 12;
    const h = px + 8;
    ctx.fillStyle = colors.labelBg;
    ctx.beginPath();
    ctx.roundRect(l.x - w / 2, l.y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = l.tone === 'event' ? colors.event : colors.label;
    ctx.fillText(l.text, l.x, l.y + 0.5);
  }

  for (const r of scene.rings) {
    const grow = pulse * 7 * scene.unit;
    ctx.globalAlpha = 1 - pulse * 0.6;
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 2.4 * scene.unit;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + grow, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
