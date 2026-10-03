import { describe, expect, it } from 'vitest';
import { resolutionOf, stepResolution } from './resolution';

describe('the resolution levels', () => {
  it('maps a zoom to the nearest level', () => {
    expect(resolutionOf(0.6).key).toBe('hour');
    expect(resolutionOf(1).key).toBe('half');
    expect(resolutionOf(1.3).key).toBe('half');
    expect(resolutionOf(1.7).key).toBe('ten');
    expect(resolutionOf(2).key).toBe('ten');
  });

  it('steps coarser and finer and stops at the ends', () => {
    expect(stepResolution(1, 1).key).toBe('ten');
    expect(stepResolution(1, -1).key).toBe('hour');
    expect(stepResolution(2, 1).key).toBe('ten');
    expect(stepResolution(0.6, -1).key).toBe('hour');
  });
});

import { pxPerHour } from './resolution';

describe('the height of an hour', () => {
  it('is the board’s 46 / 52 / 78 px at the three levels and in between on the wheel', () => {
    expect(pxPerHour(0.6)).toBe(46);
    expect(pxPerHour(1)).toBe(52);
    expect(pxPerHour(2)).toBe(78);
    expect(pxPerHour(1.5)).toBe(65);
    expect(pxPerHour(0.1)).toBe(46);
    expect(pxPerHour(3)).toBe(78);
  });
});
