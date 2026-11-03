/*
 * The skeleton overlay: pure geometry and a small drawing routine.
 *
 * The canvas lies exactly over the <video> element. The video is drawn with `object-fit: contain`, so the picture is
 * smaller than the element on one axis and centred (letterboxing). Skeleton coordinates are pixels of the VIDEO FRAME;
 * `containRect` finds where that frame sits inside the element and `project` maps a point into canvas CSS pixels.
 */
import type { ClipResult } from '../../api/movement';

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

/** A video-pixel point -> canvas CSS pixels. */
export function project(rect: ContainRect, px: number, py: number): { x: number; y: number } {
  return { x: rect.x + px * rect.scale, y: rect.y + py * rect.scale };
}

/** A canvas CSS-pixel point -> video pixels (the inverse; used by tests and for hit tests). */
export function unproject(rect: ContainRect, cx: number, cy: number): { x: number; y: number } {
  return rect.scale === 0 ? { x: 0, y: 0 } : { x: (cx - rect.x) / rect.scale, y: (cy - rect.y) / rect.scale };
}

/** Below this confidence a keypoint is not drawn. */
export const MIN_DRAW_CONFIDENCE = 0.2;

export interface DrawLabel { text: string; x: number; y: number; tone: 'angle' | 'event' }
export interface DrawJoint { index: number; x: number; y: number; side: 'L' | 'R' | 'C'; highlighted: boolean }
export interface DrawBone { from: { x: number; y: number }; to: { x: number; y: number }; side: 'L' | 'R' | 'C'; highlighted: boolean }
export interface OverlayScene { rect: ContainRect; joints: DrawJoint[]; bones: DrawBone[]; labels: DrawLabel[] }

export interface SceneInput {
  skeleton: ClipResult['skeleton'];
  frame: number;
  box: { w: number; h: number };
  video: { w: number; h: number };
  highlight: ReadonlySet<number>;
  layers: { skeleton: boolean; angles: boolean; events: boolean };
  /** Angle labels for this frame: joint index -> text. */
  angles?: ReadonlyMap<number, string>;
  /** Event captions for this frame. */
  eventCaptions?: readonly { joint: number; text: string }[];
}

const sideOfName = (name: string | undefined): 'L' | 'R' | 'C' => {
  if (name === undefined) return 'C';
  if (name.startsWith('left')) return 'L';
  if (name.startsWith('right')) return 'R';
  return 'C';
};

/** Everything the canvas needs for one frame, already in canvas pixels. */
export function buildScene(input: SceneInput): OverlayScene {
  const rect = containRect(input.box.w, input.box.h, input.video.w, input.video.h);
  const empty: OverlayScene = { rect, joints: [], bones: [], labels: [] };
  const pose = input.skeleton.frames[input.frame];
  if (pose === undefined || rect.scale === 0) return empty;

  const at = (i: number) => {
    const k = pose[i];
    if (k === undefined || k[2] < MIN_DRAW_CONFIDENCE) return null;
    return project(rect, k[0], k[1]);
  };
  const joints: DrawJoint[] = [];
  const bones: DrawBone[] = [];
  const labels: DrawLabel[] = [];

  if (input.layers.skeleton) {
    for (const [a, b] of input.skeleton.edges) {
      const pa = at(a);
      const pb = at(b);
      if (pa === null || pb === null) continue;
      const side = sideOfName(input.skeleton.names[a]) === sideOfName(input.skeleton.names[b])
        ? sideOfName(input.skeleton.names[a])
        : 'C';
      bones.push({ from: pa, to: pb, side, highlighted: input.highlight.has(a) && input.highlight.has(b) });
    }
    pose.forEach((_, i) => {
      const p = at(i);
      if (p !== null) joints.push({ index: i, x: p.x, y: p.y, side: sideOfName(input.skeleton.names[i]), highlighted: input.highlight.has(i) });
    });
  }
  if (input.layers.angles && input.angles !== undefined) {
    input.angles.forEach((text, joint) => {
      const p = at(joint);
      if (p !== null) labels.push({ text, x: p.x + 10, y: p.y - 8, tone: 'angle' });
    });
  }
  if (input.layers.events && input.eventCaptions !== undefined) {
    input.eventCaptions.forEach((c, i) => {
      const p = at(c.joint);
      if (p !== null) labels.push({ text: c.text, x: p.x + 12, y: p.y + 16 + i * 22, tone: 'event' });
    });
  }
  return { rect, joints, bones, labels };
}

export interface OverlayColors { left: string; right: string; center: string; highlight: string; label: string; labelBg: string; event: string }

/** Paint a scene. `dpr` scales the backing store; the context is reset each call. */
export function drawScene(ctx: CanvasRenderingContext2D, scene: OverlayScene, size: { w: number; h: number }, dpr: number, colors: OverlayColors): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.w, size.h);
  const unit = Math.max(1, scene.rect.w / 640);
  ctx.lineCap = 'round';
  const colorOf = (side: 'L' | 'R' | 'C', hi: boolean) => (hi ? colors.highlight : side === 'L' ? colors.left : side === 'R' ? colors.right : colors.center);

  for (const b of scene.bones) {
    ctx.strokeStyle = colorOf(b.side, b.highlighted);
    ctx.lineWidth = (b.highlighted ? 4.5 : 2.5) * Math.min(unit, 1.6);
    ctx.beginPath();
    ctx.moveTo(b.from.x, b.from.y);
    ctx.lineTo(b.to.x, b.to.y);
    ctx.stroke();
  }
  for (const j of scene.joints) {
    ctx.fillStyle = colorOf(j.side, j.highlighted);
    ctx.beginPath();
    ctx.arc(j.x, j.y, (j.highlighted ? 6 : 3.5) * Math.min(unit, 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const l of scene.labels) {
    const w = ctx.measureText(l.text).width + 10;
    ctx.fillStyle = colors.labelBg;
    ctx.fillRect(l.x - 5, l.y - 10, w, 20);
    ctx.fillStyle = l.tone === 'event' ? colors.event : colors.label;
    ctx.fillText(l.text, l.x, l.y);
  }
}
