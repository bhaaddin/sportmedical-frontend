/*
 * The arithmetic behind the scanner: which four points are the corners of a
 * page, which way round they go, and how big the flattened result should be.
 *
 * Kept apart from OpenCV and from React on purpose. This is the part that can
 * be quietly wrong - a page detected upside down, a corner pair swapped so the
 * output comes out mirrored, a sliver of desk accepted as a document - and
 * none of it needs a camera to test.
 */

export interface Point {
  x: number;
  y: number;
}

/** Four corners, always in the order top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

/**
 * Put four unordered points into a consistent corner order.
 *
 * Sorting by "sum" and "difference" is the usual trick and it breaks on a page
 * photographed at an angle: rotate the sheet far enough and the corner with
 * the smallest x+y stops being the top-left one. This sorts by angle around
 * the centre instead, which holds for any rotation up to the point where
 * "top" stops being meaningful - and then picks the starting corner as the one
 * nearest the image origin, so the page comes out upright rather than
 * quarter-turned.
 */
export function orderCorners(points: Point[]): Quad | null {
  if (points.length !== 4) return null;

  const cx = points.reduce((s, p) => s + p.x, 0) / 4;
  const cy = points.reduce((s, p) => s + p.y, 0) / 4;

  /* Clockwise in screen coordinates, where y grows downward. */
  const byAngle = [...points].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );

  let startIndex = 0;
  let best = Infinity;
  for (let i = 0; i < 4; i += 1) {
    const p = byAngle[i];
    const d = p.x * p.x + p.y * p.y;
    if (d < best) {
      best = d;
      startIndex = i;
    }
  }

  const ordered = [
    byAngle[startIndex],
    byAngle[(startIndex + 1) % 4],
    byAngle[(startIndex + 2) % 4],
    byAngle[(startIndex + 3) % 4],
  ];

  return ordered as Quad;
}

/** Shoelace. Always positive - direction is `orderCorners`'s business. */
export function quadArea(quad: Quad): number {
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** True when every interior angle turns the same way. A bent quad is not a page. */
export function isConvex(quad: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const a = quad[i];
    const b = quad[(i + 1) % 4];
    const c = quad[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return sign !== 0;
}

export interface PlausibilityLimits {
  /** Smallest share of the frame a page may occupy. */
  minAreaRatio: number;
  /** Longest-to-shortest side ratio. A4 photographed at an angle stays well under this. */
  maxSideRatio: number;
}

export const DEFAULT_LIMITS: PlausibilityLimits = {
  /*
   * A page held at arm's length fills well over a fifth of the frame. Below
   * that it is a business card on a desk, a tile, or the shadow under a
   * monitor - all of which detect beautifully and are not what anybody meant
   * to scan.
   */
  minAreaRatio: 0.2,
  maxSideRatio: 6,
};

/**
 * Whether a detected quad is worth offering as a page.
 *
 * Deliberately conservative. A wrong detection that looks confident is worse
 * than no detection: the person accepts it, and the výpis is saved with its
 * top third cut off. When this says no, the scanner keeps looking and the
 * shutter stays available.
 */
export function isPlausibleDocument(
  quad: Quad,
  frameWidth: number,
  frameHeight: number,
  limits: PlausibilityLimits = DEFAULT_LIMITS,
): boolean {
  if (!isConvex(quad)) return false;

  const frameArea = frameWidth * frameHeight;
  if (frameArea <= 0) return false;
  if (quadArea(quad) / frameArea < limits.minAreaRatio) return false;

  const sides = [
    distance(quad[0], quad[1]),
    distance(quad[1], quad[2]),
    distance(quad[2], quad[3]),
    distance(quad[3], quad[0]),
  ];
  const shortest = Math.min(...sides);
  if (shortest <= 0) return false;
  if (Math.max(...sides) / shortest > limits.maxSideRatio) return false;

  return true;
}

/**
 * How large the flattened page should be.
 *
 * Each dimension takes the longer of its two opposing edges, so the corner
 * nearest the camera - the one with the longest edges - sets the scale and
 * nothing is squeezed. Rounded up, never to zero.
 */
export function outputSize(quad: Quad): { width: number; height: number } {
  const top = distance(quad[0], quad[1]);
  const bottom = distance(quad[3], quad[2]);
  const left = distance(quad[0], quad[3]);
  const right = distance(quad[1], quad[2]);

  return {
    width: Math.max(1, Math.ceil(Math.max(top, bottom))),
    height: Math.max(1, Math.ceil(Math.max(left, right))),
  };
}

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
