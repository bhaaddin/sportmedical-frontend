import { afterEach, describe, expect, it } from 'vitest';
import { contrastRatio, parseColor, relativeLuminance, rgbToHsl, type Rgba } from '../accent';
import { activityColor, activityColorOrNull, textOnColor } from './activityColor';
import { TARGET_LUMINANCE, colorForHue, defaultActivityColor, hashHue, huesOfFirst, registerActivityIds, resetActivityIds, vanDerCorput } from './defaultActivityColors';

const hueOf = (hex: string): number => rgbToHsl(parseColor(hex) as Rgba).h;
const circ = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const minGap = (hues: number[]): number => Math.min(...hues.flatMap((a, i) => hues.slice(i + 1).map((b) => circ(a, b))));
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `01a0fe86-0000-7000-8000-${String(i).padStart(12, '0')}`);

afterEach(() => resetActivityIds());

describe('van der Corput hue spread', () => {
  it('starts 0, 180, 90, 270, 45', () => expect([0, 1, 2, 3, 4].map((i) => vanDerCorput(i) * 360)).toEqual([0, 180, 90, 270, 45]));
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('%i činnosti are at least 45 degrees apart', (n) => {
    if (n > 1) expect(minGap(huesOfFirst(n))).toBeGreaterThanOrEqual(45);
  });
});

describe('default činnost colours', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('%i činnosti get distinct hues in the colours actually drawn', (n) => {
    registerActivityIds(ids(n));
    const colours = ids(n).map((id) => defaultActivityColor(id));
    expect(new Set(colours).size).toBe(n);
    if (n > 1) expect(minGap(colours.map(hueOf))).toBeGreaterThanOrEqual(40);
  });
  it('is the same colour every time (deterministic by id), with or without the list', () => {
    const id = ids(1)[0];
    const alone = defaultActivityColor(id);
    expect(defaultActivityColor(id)).toBe(alone);
    registerActivityIds(ids(3));
    registerActivityIds(ids(3));
    expect(defaultActivityColor(id)).toBe(defaultActivityColor(id));
    expect(hashHue(id)).toBe(hashHue(id));
  });
  it('a činnost added later never moves the colour of the ones before it', () => {
    registerActivityIds(ids(3));
    const before = ids(3).map(defaultActivityColor);
    registerActivityIds(ids(6));
    expect(ids(3).map(defaultActivityColor)).toEqual(before);
  });
  it('every hue is AA-safe in both modes: 3:1 on the dark stage and on white, white text >= 4.5:1', () => {
    for (let h = 0; h < 360; h += 5) {
      const hex = colorForHue(h);
      expect(Math.abs(relativeLuminance(hex) - TARGET_LUMINANCE)).toBeLessThan(0.01);
      expect(contrastRatio(hex, '#001421')).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(hex, '#FFFFFF')).toBeGreaterThanOrEqual(3);
      expect(textOnColor(hex).ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('activityColor uses the default only when nothing was chosen', () => {
  it('an own colour wins; the služba shade the server sends is ignored; no id keeps the old order', () => {
    registerActivityIds(ids(2));
    const [a] = ids(2);
    expect(activityColor({ id: a, colorHex: '#AA5500', effectiveColorHex: '#09423B' })).toBe('#AA5500');
    expect(activityColor({ id: a, colorHex: null, effectiveColorHex: '#09423B' })).toBe(defaultActivityColor(a));
    expect(activityColorOrNull({ effectiveColorHex: '#09423B' })).toBe('#09423B');
    expect(activityColor({ effectiveColorHex: null, color: null }, '#2563EB')).toBe('#2563EB');
  });
});
