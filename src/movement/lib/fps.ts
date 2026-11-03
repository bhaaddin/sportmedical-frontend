/* Frame-rate estimate from the media times of video frames, as requestVideoFrameCallback reports them. */

const STANDARD_FPS = [24, 25, 30, 48, 50, 60, 90, 100, 120, 144, 240] as const;

/** Snap to a standard rate when within 4 %, else round to one decimal. */
export function snapFps(fps: number): number {
  for (const s of STANDARD_FPS) if (Math.abs(fps - s) / s <= 0.04) return s;
  return Math.round(fps * 10) / 10;
}

/**
 * The frame rate from ascending media times (seconds) of presented frames. Uses the MEDIAN interval, so a few dropped
 * or duplicated callbacks do not move it. Null when there are too few distinct frames to say anything.
 */
export function estimateFps(mediaTimes: readonly number[]): number | null {
  const deltas: number[] = [];
  for (let i = 1; i < mediaTimes.length; i++) {
    const d = mediaTimes[i] - mediaTimes[i - 1];
    if (d > 1e-4 && Number.isFinite(d)) deltas.push(d);
  }
  if (deltas.length < 5) return null;
  deltas.sort((a, b) => a - b);
  const median = deltas[deltas.length >> 1];
  return snapFps(1 / median);
}
