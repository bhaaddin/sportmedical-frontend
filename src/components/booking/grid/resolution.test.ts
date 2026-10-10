import { describe, expect, it } from 'vitest';
import { RESOLUTIONS, pxPerHour, resolutionOf, stepResolution } from './resolution';

describe('the resolution levels', () => {
  it('are hour → 30 → 15 → 10, each with the step the toolbar shows', () => {
    expect(RESOLUTIONS.map((r) => r.key)).toEqual(['hour', 'half', 'quarter', 'ten']);
    expect(RESOLUTIONS.map((r) => r.step)).toEqual([60, 30, 15, 10]);
    expect(RESOLUTIONS.map((r) => r.label)).toEqual(['Hodina', '30 min', '15 min', '10 min']);
    expect(RESOLUTIONS.map((r) => r.hint)).toEqual(['hodina', '30 min', '15 min', '10 min']);
  });

  it('maps a zoom to the nearest level', () => {
    expect(resolutionOf(0.6).key).toBe('hour');
    expect(resolutionOf(1).key).toBe('half');
    expect(resolutionOf(1.2).key).toBe('half');
    /* The wheel stop where the rows are a quarter hour tall says so now (Etapa 12). */
    expect(resolutionOf(1.3).key).toBe('quarter');
    expect(resolutionOf(1.5).key).toBe('quarter');
    expect(resolutionOf(1.7).key).toBe('quarter');
    expect(resolutionOf(1.8).key).toBe('ten');
    expect(resolutionOf(2).key).toBe('ten');
  });

  it('the 15-minute level has a 15-minute step', () => {
    expect(resolutionOf(1.5)).toMatchObject({ key: 'quarter', label: '15 min', hint: '15 min', zoom: 1.5, step: 15 });
  });

  it('steps coarser and finer through all four and stops at the ends', () => {
    expect(stepResolution(0.6, 1).key).toBe('half');
    expect(stepResolution(1, 1).key).toBe('quarter');
    expect(stepResolution(1.5, 1).key).toBe('ten');
    expect(stepResolution(2, 1).key).toBe('ten');
    expect(stepResolution(2, -1).key).toBe('quarter');
    expect(stepResolution(1.5, -1).key).toBe('half');
    expect(stepResolution(1, -1).key).toBe('hour');
    expect(stepResolution(0.6, -1).key).toBe('hour');
  });

  it('a wheel zoom near 15 min steps to its neighbours, not past them', () => {
    expect(stepResolution(1.4, 1).key).toBe('ten');
    expect(stepResolution(1.6, -1).key).toBe('half');
  });
});

describe('the height of an hour', () => {
  it('is the board’s 46 / 52 / 65 / 78 px at the four levels and in between on the wheel', () => {
    expect(pxPerHour(0.6)).toBe(46);
    expect(pxPerHour(1)).toBe(52);
    expect(pxPerHour(1.5)).toBe(65);
    expect(pxPerHour(2)).toBe(78);
    expect(pxPerHour(0.8)).toBe(49);
    expect(pxPerHour(1.25)).toBe(58.5);
    expect(pxPerHour(1.75)).toBe(71.5);
    expect(pxPerHour(0.1)).toBe(46);
    expect(pxPerHour(3)).toBe(78);
  });

  it('a quarter-hour row at the 15-minute level is a whole number of pixels tall', () => {
    const level = RESOLUTIONS.find((r) => r.key === 'quarter');
    expect(level).toBeDefined();
    expect((pxPerHour(level!.zoom) / 60) * level!.step).toBe(16.25);
  });
});
