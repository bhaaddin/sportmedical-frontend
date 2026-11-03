/*
 * The 1 m floor marker: staff click its two ends on one frame of the clip. The frame is shown with `object-fit: contain`,
 * so a click is converted back to NATIVE video pixels (the unit the pipeline wants as `markerPx`).
 */
import { unproject, type ContainRect } from './overlay';

export interface PxPoint { x: number; y: number }

/** A click in the element's CSS pixels -> native video pixels; null when it lands in the letterbox bars. */
export function clickToVideoPx(rect: ContainRect, videoW: number, videoH: number, cx: number, cy: number): PxPoint | null {
  if (rect.scale === 0) return null;
  const p = unproject(rect, cx, cy);
  if (p.x < 0 || p.y < 0 || p.x > videoW || p.y > videoH) return null;
  return p;
}

/** Distance of the two ends in native video pixels, one decimal. */
export function markerPixelLength(a: PxPoint, b: PxPoint): number {
  return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * 10) / 10;
}

/** Too short a mark is a mis-click (under 1 % of the shorter side). */
export function markerPlausible(px: number, videoW: number, videoH: number): boolean {
  return px >= Math.min(videoW, videoH) * 0.01;
}
