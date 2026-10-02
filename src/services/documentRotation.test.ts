/*
 * Turning an uploaded page before it is sent.
 *
 * The failure that would reach a patient's record unnoticed: a page turned a
 * half turn but drawn into a box with its sides swapped, so the výpis is
 * stored squashed.
 */
import { describe, it, expect } from 'vitest';
import { normaliseRotation, rotatedSize } from './documentRotation';

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
