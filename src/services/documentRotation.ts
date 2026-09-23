/*
 * The arithmetic behind the "Otočit" button in the upload preview.
 *
 * Kept apart from the canvas work in `documentMedia.ts` so it can be tested
 * without a browser: a half turn that swapped the sides would save a page
 * squashed into the wrong box, and nobody would notice until it was printed.
 */

/** Quarter turns clockwise. Anything is accepted and folded into 0-3. */
export function normaliseRotation(quarterTurns: number): 0 | 90 | 180 | 270 {
  const t = ((Math.round(quarterTurns) % 4) + 4) % 4;
  return ([0, 90, 180, 270] as const)[t];
}

/**
 * The canvas a rotated image needs. A quarter turn swaps the sides; a half
 * turn does not - which is the case that is easy to get wrong, because the
 * image still looks different while the box stays the same.
 */
export function rotatedSize(
  width: number,
  height: number,
  degrees: 0 | 90 | 180 | 270,
): { width: number; height: number } {
  return degrees === 90 || degrees === 270
    ? { width: height, height: width }
    : { width, height };
}
