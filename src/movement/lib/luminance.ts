/* Brightness of sampled frames. Pure over RGBA bytes, so it is tested without a canvas. */

/** Mean relative luminance 0..255 of an RGBA buffer (Rec. 709 weights on the stored sRGB values). */
export function meanLuminance(rgba: ArrayLike<number>): number {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  let sum = 0;
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    sum += 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
  }
  return sum / pixels;
}

/** Below this mean (0..255) a clip is too dark for the pose model. */
export const DARK_LIMIT = 45;

/** The brightness of a clip from several sampled frames: the median, so one dark frame (a blink) does not reject it. */
export function clipLuminance(frameMeans: readonly number[]): number | null {
  if (frameMeans.length === 0) return null;
  const s = [...frameMeans].sort((a, b) => a - b);
  return s[s.length >> 1];
}

export const isTooDark = (mean: number): boolean => mean < DARK_LIMIT;
