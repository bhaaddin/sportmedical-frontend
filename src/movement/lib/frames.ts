/* Time <-> frame. `times` is skeleton.times: one presentation time (seconds) per frame, ascending. */

/** Media times of a decoder come with rounding noise (0.0333 instead of 0.03333...): a frame is reached half a millisecond early. */
const EPS = 0.0005;

/** The frame shown at `time`: the last frame whose time is <= time (clamped to the first and last frame). */
export function frameIndexAt(times: readonly number[], time: number): number {
  const n = times.length;
  const t = time + EPS;
  if (n === 0 || !Number.isFinite(t) || t <= times[0]) return 0;
  if (t >= times[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid;
  }
  return lo;
}

/**
 * The time to seek a <video> to so that it lands on `frame`: the middle of the frame's interval, so a decoder that
 * rounds either way still shows that frame and `frameIndexAt` reads the same index back.
 */
export function seekTimeOf(times: readonly number[], frame: number): number {
  const n = times.length;
  if (n === 0) return 0;
  const f = clampFrame(frame, n);
  const start = times[f];
  const next = f + 1 < n ? times[f + 1] : start + (n > 1 ? start - times[f - 1] : 0);
  return start + (next - start) / 2;
}

export function clampFrame(frame: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(frame)));
}

/** A position 0..1 along a scrubber / chart -> a frame. */
export function frameAtRatio(ratio: number, count: number): number {
  if (count <= 1) return 0;
  return clampFrame(Math.min(1, Math.max(0, ratio)) * (count - 1), count);
}

/** A frame -> a position 0..1. */
export function ratioOfFrame(frame: number, count: number): number {
  return count <= 1 ? 0 : clampFrame(frame, count) / (count - 1);
}

/** "12,34 s" style clock: seconds with two decimals, Czech comma. */
export function clock(seconds: number): string {
  return `${seconds.toFixed(2).replace('.', ',')} s`;
}
