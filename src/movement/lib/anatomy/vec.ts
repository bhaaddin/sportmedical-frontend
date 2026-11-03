/* Tiny 2D vector helpers for the anatomy renderer (plain objects, no classes: they are created thousands of times a second). */
export interface V { x: number; y: number }

export const v = (x: number, y: number): V => ({ x, y });
export const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k });
export const len = (a: V): number => Math.hypot(a.x, a.y);
export const dist = (a: V, b: V): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: V, b: V): V => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const lerp = (a: V, b: V, t: number): V => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const dot = (a: V, b: V): number => a.x * b.x + a.y * b.y;
/** The unit vector, or the zero vector for a zero-length input (never NaN). */
export const unit = (a: V): V => {
  const l = Math.hypot(a.x, a.y);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Rotated a quarter turn clockwise on a y-down canvas. */
export const perp = (a: V): V => ({ x: -a.y, y: a.x });
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** a + dir*along + normal*across. */
export const at = (a: V, dir: V, along: number, normal: V, across: number): V => ({
  x: a.x + dir.x * along + normal.x * across,
  y: a.y + dir.y * along + normal.y * across,
});
