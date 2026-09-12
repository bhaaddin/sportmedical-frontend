/*
 * The scanner's arithmetic.
 *
 * These are the failures that would reach a patient without anybody noticing:
 * a page saved mirrored because two corners were swapped, a page saved
 * quarter-turned because "top-left" was decided by x+y on a tilted shot, or a
 * shadow on the desk accepted as a document so the výpis is stored as a
 * photograph of a table.
 *
 * None of it needs a camera, so all of it is tested here rather than by eye.
 */
import { describe, it, expect } from 'vitest';
import {
  orderCorners,
  quadArea,
  isConvex,
  isPlausibleDocument,
  outputSize,
  normaliseRotation,
  rotatedSize,
  type Point,
  type Quad,
} from './geometry';

const p = (x: number, y: number): Point => ({ x, y });

/** An upright page, corners deliberately shuffled. */
const SHUFFLED = [p(300, 400), p(100, 100), p(300, 100), p(100, 400)];

describe('orderCorners', () => {
  it('puts a shuffled upright page into top-left, top-right, bottom-right, bottom-left', () => {
    const quad = orderCorners(SHUFFLED);
    expect(quad).toEqual([p(100, 100), p(300, 100), p(300, 400), p(100, 400)]);
  });

  it('refuses anything that is not four points', () => {
    expect(orderCorners([p(0, 0), p(1, 1), p(2, 2)])).toBeNull();
    expect(orderCorners([p(0, 0), p(1, 1), p(2, 2), p(3, 3), p(4, 4)])).toBeNull();
  });

  /*
   * The case the usual x+y trick gets wrong. This page is rotated about 20
   * degrees, and the corner with the smallest coordinate sum is no longer the
   * top-left one. Whatever order comes back, it must go round the page rather
   * than cut across it - a crossed order is what produces a mirrored scan.
   */
  it('returns corners that walk the page rather than cross it, on a tilted shot', () => {
    const tilted = [p(140, 100), p(360, 180), p(300, 420), p(80, 340)];
    const quad = orderCorners(tilted) as Quad;

    expect(quad).not.toBeNull();
    expect(isConvex(quad)).toBe(true);
    /* Crossing the quad would lose area; walking it keeps all of it. */
    expect(quadArea(quad)).toBeGreaterThan(50_000);
  });

  it('keeps all four of the points it was given', () => {
    const quad = orderCorners(SHUFFLED) as Quad;
    for (const point of SHUFFLED) {
      expect(quad).toContainEqual(point);
    }
  });
});

describe('quadArea', () => {
  it('measures a rectangle', () => {
    const quad: Quad = [p(0, 0), p(200, 0), p(200, 300), p(0, 300)];
    expect(quadArea(quad)).toBe(60_000);
  });

  it('is positive whichever way round the corners run', () => {
    const clockwise: Quad = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
    const anticlockwise: Quad = [p(0, 0), p(0, 10), p(10, 10), p(10, 0)];
    expect(quadArea(clockwise)).toBe(100);
    expect(quadArea(anticlockwise)).toBe(100);
  });
});

describe('isConvex', () => {
  it('accepts a rectangle', () => {
    expect(isConvex([p(0, 0), p(10, 0), p(10, 10), p(0, 10)])).toBe(true);
  });

  /* An arrowhead: four points, but not a shape any sheet of paper makes. */
  it('rejects a shape that bends back on itself', () => {
    expect(isConvex([p(0, 0), p(10, 0), p(5, 5), p(10, 10)])).toBe(false);
  });
});

describe('isPlausibleDocument', () => {
  const FRAME_W = 1000;
  const FRAME_H = 1000;

  it('accepts a page filling a good part of the frame', () => {
    const quad: Quad = [p(100, 100), p(900, 100), p(900, 900), p(100, 900)];
    expect(isPlausibleDocument(quad, FRAME_W, FRAME_H)).toBe(true);
  });

  /*
   * A business card on a desk, or a shadow. It detects perfectly and is not
   * what anybody meant to scan, and accepting it saves a výpis that is mostly
   * table.
   */
  it('rejects something far too small to be the page being held up', () => {
    const quad: Quad = [p(10, 10), p(110, 10), p(110, 110), p(10, 110)];
    expect(isPlausibleDocument(quad, FRAME_W, FRAME_H)).toBe(false);
  });

  it('rejects a long thin sliver - a table edge, not a sheet', () => {
    const quad: Quad = [p(0, 400), p(1000, 400), p(1000, 440), p(0, 440)];
    expect(isPlausibleDocument(quad, FRAME_W, FRAME_H)).toBe(false);
  });

  it('rejects a bent shape even when it is large', () => {
    const quad: Quad = [p(0, 0), p(1000, 0), p(500, 500), p(1000, 1000)];
    expect(isPlausibleDocument(quad, FRAME_W, FRAME_H)).toBe(false);
  });

  it('rejects everything when the frame has no size', () => {
    const quad: Quad = [p(0, 0), p(10, 0), p(10, 10), p(0, 10)];
    expect(isPlausibleDocument(quad, 0, 0)).toBe(false);
  });
});

describe('outputSize', () => {
  it('measures a straight rectangle exactly', () => {
    const quad: Quad = [p(0, 0), p(400, 0), p(400, 600), p(0, 600)];
    expect(outputSize(quad)).toEqual({ width: 400, height: 600 });
  });

  /*
   * Photographed at an angle the near edge is longer than the far one. Taking
   * the longer of each pair keeps the near edge's detail instead of squeezing
   * the page down to its far edge.
   */
  it('takes the longer of each opposing pair, so nothing is squeezed', () => {
    const quad: Quad = [p(50, 0), p(350, 0), p(400, 600), p(0, 600)];
    /* Both slanted sides are hypot(50, 600) = 602.08, rounded up to 603. The
       top edge is 300 and the bottom 400, so width takes the bottom. */
    expect(outputSize(quad)).toEqual({ width: 400, height: 603 });
  });

  it('never returns zero', () => {
    const quad: Quad = [p(5, 5), p(5, 5), p(5, 5), p(5, 5)];
    const size = outputSize(quad);
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});

describe('rotation', () => {
  it('folds any number of quarter turns into one of four angles', () => {
    expect(normaliseRotation(0)).toBe(0);
    expect(normaliseRotation(1)).toBe(90);
    expect(normaliseRotation(4)).toBe(0);
    expect(normaliseRotation(5)).toBe(90);
    expect(normaliseRotation(-1)).toBe(270);
  });

  it('swaps the sides on a quarter turn', () => {
    expect(rotatedSize(400, 600, 90)).toEqual({ width: 600, height: 400 });
    expect(rotatedSize(400, 600, 270)).toEqual({ width: 600, height: 400 });
  });

  /* The one that is easy to get wrong: the picture changes, the box does not. */
  it('keeps the sides on a half turn', () => {
    expect(rotatedSize(400, 600, 180)).toEqual({ width: 400, height: 600 });
    expect(rotatedSize(400, 600, 0)).toEqual({ width: 400, height: 600 });
  });
});
