/*
 * The accent maths: parsing, the cyan-family shift, the AA contrast guarantees for every accent on the dark
 * surfaces and under the button ink, the CSS side (`--sm-hsl`, `hsl(from ...)`), and the custom properties.
 */
import { describe, expect, it } from 'vitest';
import {
  AA,
  CYAN,
  DARK_SURFACES,
  DEFAULT_ACCENT_HEX,
  IDENTITY_SHIFT,
  ON_ACCENT_INK,
  SHIFT_VAR,
  accentCss,
  accentVariables,
  blend,
  contrastRatio,
  darken,
  deriveShift,
  hslToRgb,
  isAccentChrome,
  isIdentityShift,
  lightTints,
  normalizeHex,
  onAccentText,
  accentInk,
  parseColor,
  relativeLuminance,
  rgbToHsl,
  sanitizeAccent,
  shiftColor,
  shiftCssColors,
  shiftExpression,
  shiftHsl,
  tintOf,
  toHex,
  toRgbString,
  unwrappedAccentColors,
  wrapCssColors,
} from './accent';
import { THEME_ACCENTS } from './theme';

const ACCENTS = THEME_ACCENTS.map((a) => [a.key, a.color] as const);
const NON_DEFAULT = ACCENTS.filter(([, color]) => color !== DEFAULT_ACCENT_HEX);
/** The tops of the fills the dark ink sits on (primary button, selected segment, their hovers). */
const FILL_STOPS = ['#24F8E0', '#06CBBB', '#17EAD8', '#00BDA9', '#4FFFEA', '#1FDCCB', '#3AF4E4', '#10CDB9'];

describe('parseColor', () => {
  it.each([
    ['#000', { r: 0, g: 0, b: 0, a: 1 }],
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#0D5C52', { r: 13, g: 92, b: 82, a: 1 }],
    ['#0d5c52', { r: 13, g: 92, b: 82, a: 1 }],
    ['  #0D5C52  ', { r: 13, g: 92, b: 82, a: 1 }],
    ['#abc', { r: 170, g: 187, b: 204, a: 1 }],
    ['rgb(1, 2, 3)', { r: 1, g: 2, b: 3, a: 1 }],
    ['rgb(1 2 3)', { r: 1, g: 2, b: 3, a: 1 }],
    ['rgba(0, 223, 227, 0.79)', { r: 0, g: 223, b: 227, a: 0.79 }],
    ['rgba(0,223,227,.79)', { r: 0, g: 223, b: 227, a: 0.79 }],
    ['rgb(0 223 227 / 50%)', { r: 0, g: 223, b: 227, a: 0.5 }],
    ['rgb(100%, 0%, 0%)', { r: 255, g: 0, b: 0, a: 1 }],
    ['rgba(300, -5, 10, 2)', { r: 255, g: 0, b: 10, a: 1 }],
  ])('reads %s', (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it('reads the alpha of an 8-digit and a 4-digit hex', () => {
    expect(parseColor('#38ccff91')?.a).toBeCloseTo(0x91 / 255, 2);
    expect(parseColor('#0f08')?.a).toBeCloseTo(0x88 / 255, 2);
    expect(parseColor('#0f08')).toMatchObject({ r: 0, g: 255, b: 0 });
  });

  it.each(['', 'red', 'transparent', '#12', '#12345', '#1234567', '#GGGGGG', 'rgb(1,2)', 'rgb(1,2,3,4,5)', 'rgb(a,b,c)', 'hsl(10, 10%, 10%)', 'var(--x)', 'url(#x)'])(
    'rejects %j',
    (input) => {
      expect(parseColor(input)).toBeNull();
    },
  );
});

describe('formatting', () => {
  it.each([
    [{ r: 13, g: 92, b: 82, a: 1 }, '#0D5C52'],
    [{ r: 0, g: 0, b: 0, a: 1 }, '#000000'],
    [{ r: 255, g: 255, b: 255, a: 1 }, '#FFFFFF'],
    [{ r: 0, g: 230, b: 228, a: 0.5 }, '#00E6E480'],
    [{ r: 300, g: -4, b: 12.4, a: 1 }, '#FF000C'],
  ])('toHex %j -> %s', (rgba, expected) => {
    expect(toHex(rgba)).toBe(expected);
  });

  it.each([
    [{ r: 1, g: 2, b: 3, a: 1 }, 'rgb(1, 2, 3)'],
    [{ r: 0, g: 223.4, b: 227, a: 0.79 }, 'rgba(0, 223, 227, 0.79)'],
    [{ r: 0, g: 0, b: 0, a: 0.123456 }, 'rgba(0, 0, 0, 0.123)'],
  ])('toRgbString %j -> %s', (rgba, expected) => {
    expect(toRgbString(rgba)).toBe(expected);
  });

  it('round-trips every swatch colour through parse and hex', () => {
    for (const [, color] of ACCENTS) expect(toHex(parseColor(color)!)).toBe(color);
  });
});

describe('rgb <-> hsl', () => {
  it.each([
    ['#FF0000', 0, 100, 50],
    ['#00FF00', 120, 100, 50],
    ['#0000FF', 240, 100, 50],
    ['#FFFFFF', 0, 0, 100],
    ['#000000', 0, 0, 0],
    ['#808080', 0, 0, 50.2],
    ['#00E6E4', 179.1, 100, 45.1],
  ])('%s is hsl(%d, %d%%, %d%%)', (hex, h, s, l) => {
    const hsl = rgbToHsl(parseColor(hex)!);
    expect(hsl.h).toBeCloseTo(h, 0);
    expect(hsl.s).toBeCloseTo(s, 0);
    expect(hsl.l).toBeCloseTo(l, 0);
  });

  it('converts back within one channel step for every swatch and the prototype cyan family', () => {
    for (const hex of [...ACCENTS.map(([, c]) => c), CYAN, '#23F2E7', '#00ADAB', '#06CBBB', '#10EDDA']) {
      const rgb = parseColor(hex)!;
      const back = hslToRgb(rgbToHsl(rgb));
      expect(Math.abs(back.r - rgb.r)).toBeLessThan(0.001);
      expect(Math.abs(back.g - rgb.g)).toBeLessThan(0.001);
      expect(Math.abs(back.b - rgb.b)).toBeLessThan(0.001);
    }
  });

  it('wraps a negative or past-360 hue', () => {
    expect(toHex(hslToRgb({ h: -120, s: 100, l: 50 }))).toBe('#0000FF');
    expect(toHex(hslToRgb({ h: 480, s: 100, l: 50 }))).toBe('#00FF00');
  });

  it('keeps the alpha it is given', () => {
    expect(hslToRgb({ h: 10, s: 50, l: 50 }, 0.3).a).toBe(0.3);
  });
});

describe('contrast', () => {
  it.each([
    ['#000000', '#FFFFFF', 21],
    ['#FFFFFF', '#FFFFFF', 1],
    ['#777777', '#FFFFFF', 4.48],
    ['#0D5C52', '#FFFFFF', 7.9],
    ['#EA580C', '#FFFFFF', 3.56],
  ])('%s on %s is %d:1', (a, b, expected) => {
    expect(contrastRatio(a, b)).toBeCloseTo(expected, 1);
    expect(contrastRatio(b, a)).toBeCloseTo(expected, 1);
  });

  it('luminance of black is 0 and of white is 1', () => {
    expect(relativeLuminance('#000')).toBe(0);
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
  });

  it('throws on something that is not a colour', () => {
    expect(() => relativeLuminance('nope')).toThrow(/Not a colour/);
  });

  it('blend mixes linearly and ignores alpha of the inputs', () => {
    expect(toHex(blend('#000000', '#FFFFFF', 0.5))).toBe('#808080');
    expect(toHex(blend('#102030', '#102030', 0.7))).toBe('#102030');
    expect(blend('#000', '#fff', 0).r).toBe(0);
    expect(blend('#000', '#fff', 1).r).toBe(255);
  });
});

describe('isAccentChrome - what moves with the accent', () => {
  it.each([
    ['the prototype cyan', '#00E6E4', true],
    ['aqua', '#23F2E7', true],
    ['the lit border rgba', 'rgba(0, 223, 227, 0.79)', true],
    ['the primary line', '#0BEAD7', true],
    ['the lit hairline', '#087E97', true],
    ['the focus outline', '#50ffff', true],
    ['a deep teal fill', '#006b6d', true],
    ['a 33% teal', '#0D9488', true],
    ['the semantic green', '#00E5C6', true],
    ['navy page', '#001421', false],
    ['navy glass', '#001A2A', false],
    ['navy floating', '#042C3D', false],
    ['navy line', '#06415A', false],
    ['near-white text', '#F4FAFF', false],
    ['near-white aqua text', '#DDFFFF', false],
    ['a grey', '#808080', false],
    ['the muted blue-grey', '#A3B9CE', false],
    ['semantic blue', '#118CFF', false],
    ['semantic purple', '#974BF8', false],
    ['semantic amber', '#FFB21F', false],
    ['semantic red', '#FF1950', false],
    ['black', '#000000', false],
    ['white', '#FFFFFF', false],
    ['an orange', '#EA580C', false],
    ['a violet', '#7C3AED', false],
  ])('%s (%s) -> %s', (_name, color, expected) => {
    expect(isAccentChrome(rgbToHsl(parseColor(color)!))).toBe(expected);
  });

  it('has the edges where the rule says', () => {
    expect(isAccentChrome({ h: 150, s: 45, l: 16 })).toBe(true);
    expect(isAccentChrome({ h: 149.9, s: 80, l: 50 })).toBe(false);
    expect(isAccentChrome({ h: 195, s: 80, l: 50 })).toBe(true);
    expect(isAccentChrome({ h: 195.1, s: 80, l: 50 })).toBe(false);
    expect(isAccentChrome({ h: 180, s: 44.9, l: 50 })).toBe(false);
    expect(isAccentChrome({ h: 180, s: 80, l: 15.9 })).toBe(false);
    expect(isAccentChrome({ h: 180, s: 80, l: 89.9 })).toBe(true);
    expect(isAccentChrome({ h: 180, s: 80, l: 90 })).toBe(false);
  });
});

describe('shiftHsl and shiftColor', () => {
  it('the identity shift changes nothing and is recognised', () => {
    expect(isIdentityShift(IDENTITY_SHIFT)).toBe(true);
    expect(isIdentityShift({ dh: 0, ds: 1, kl: 0.01 })).toBe(false);
    expect(isIdentityShift({ dh: 1, ds: 1, kl: 0 })).toBe(false);
    expect(isIdentityShift({ dh: 0, ds: 0.9, kl: 0 })).toBe(false);
    for (const color of [CYAN, 'rgba(0, 223, 227, 0.79)', '#001421', 'not-a-colour']) expect(shiftColor(color, IDENTITY_SHIFT)).toBe(color);
  });

  it('moves the hue modulo 360, scales saturation, lifts lightness toward white', () => {
    expect(shiftHsl({ h: 350, s: 80, l: 40 }, { dh: 20, ds: 0.5, kl: 0.5 })).toEqual({ h: 10, s: 40, l: 70 });
    expect(shiftHsl({ h: 10, s: 80, l: 40 }, { dh: -20, ds: 1, kl: 0 }).h).toBe(350);
    expect(shiftHsl({ h: 10, s: 80, l: 40 }, { dh: 0, ds: 2, kl: 0 }).s).toBe(100);
  });

  it('keeps the alpha of an rgba and the format of the input', () => {
    const moved = shiftColor('rgba(0, 223, 227, 0.79)', { dh: 40, ds: 1, kl: 0 });
    expect(moved).toMatch(/^rgba\(\d+, \d+, \d+, 0\.79\)$/);
    expect(shiftColor('#00E6E4', { dh: 40, ds: 1, kl: 0 })).toMatch(/^#[0-9A-F]{6}$/);
    expect(shiftColor('#00E6E480', { dh: 40, ds: 1, kl: 0 })).toMatch(/^#[0-9A-F]{8}$/);
  });

  it.each(['#001421', '#042C3D', '#F4FAFF', '#118CFF', '#FFB21F', '#FF1950', '#974BF8', '#A3B9CE'])(
    'leaves %s (not accent chrome) alone under every accent',
    (color) => {
      for (const [, accent] of NON_DEFAULT) expect(shiftColor(color, deriveShift(accent))).toBe(color);
    },
  );

  it('leaves a colour it cannot read alone', () => {
    expect(shiftColor('var(--cyan)', { dh: 40, ds: 1, kl: 0 })).toBe('var(--cyan)');
    expect(shiftColor('currentColor', { dh: 40, ds: 1, kl: 0 })).toBe('currentColor');
  });
});

describe('shiftCssColors', () => {
  const shift = { dh: 100, ds: 1, kl: 0 };

  it('moves every accent-chrome literal of a gradient and leaves the rest', () => {
    const out = shiftCssColors('linear-gradient(105deg, #24F8E0, #06CBBB 50%, #001421)', shift);
    expect(out).not.toContain('#24F8E0');
    expect(out).not.toContain('#06CBBB');
    expect(out).toContain('#001421');
    expect(out.startsWith('linear-gradient(105deg, #')).toBe(true);
  });

  it('moves each part of a shadow list', () => {
    const out = shiftCssColors('0 0 1px #00EBF7, 0 7px 23px rgba(0, 0, 0, 0.6), 0 0 21px rgba(0, 216, 221, 0.165)', shift);
    expect(out).toContain('rgba(0, 0, 0, 0.6)');
    expect(out).not.toContain('#00EBF7');
    expect(out).not.toContain('rgba(0, 216, 221, 0.165)');
    expect(out).toMatch(/0\.165\)$/);
  });

  it('is the identity for the identity shift (byte for byte)', () => {
    const text = '0 0 1px #00EBF7, inset 0 0 21px rgba(1, 38, 56, 0.38), linear-gradient(#24F8E0, #06CBBB)';
    expect(shiftCssColors(text, IDENTITY_SHIFT)).toBe(text);
  });

  it('copes with text that has no colours', () => {
    expect(shiftCssColors('none', shift)).toBe('none');
    expect(shiftCssColors('', shift)).toBe('');
  });
});

describe('the CSS side', () => {
  it('writes the shift as the three channels hsl(from ...) reads', () => {
    expect(shiftExpression({ dh: 40.5, ds: 0.83, kl: 0.51 })).toBe('calc(h + 40.5) calc(s * 0.83) calc(l + (100 - l) * 0.51)');
    expect(shiftExpression(IDENTITY_SHIFT)).toBe('calc(h + 0) calc(s * 1) calc(l + (100 - l) * 0)');
  });

  it('wraps a colour so the unset variable is the identity', () => {
    expect(accentCss('#00e6e4')).toBe('hsl(from #00e6e4 var(--sm-hsl, h s l))');
    expect(accentCss('rgba(0,223,227,.79)')).toBe('hsl(from rgba(0,223,227,.79) var(--sm-hsl, h s l))');
    expect(SHIFT_VAR).toBe('--sm-hsl');
  });

  describe('wrapCssColors', () => {
    it('wraps accent chrome only and counts it', () => {
      const { css, wrapped } = wrapCssColors('a{color:#00e6e4;background:#001421;border:1px solid rgba(0,223,227,.79);outline:#fff}');
      expect(wrapped).toBe(2);
      expect(css).toBe(
        'a{color:hsl(from #00e6e4 var(--sm-hsl, h s l));background:#001421;border:1px solid hsl(from rgba(0,223,227,.79) var(--sm-hsl, h s l));outline:#fff}',
      );
    });

    it('is idempotent', () => {
      const once = wrapCssColors('a{color:#00e6e4;box-shadow:0 0 6px #23f2e7aa}').css;
      const twice = wrapCssColors(once);
      expect(twice.css).toBe(once);
      expect(twice.wrapped).toBe(0);
    });

    it('wraps inside var() fallbacks and keeps 8-digit hex whole', () => {
      const { css } = wrapCssColors('b{background:var(--cyan, #23f2e7);box-shadow:0 0 6px #23f2e7aa}');
      expect(css).toContain('var(--cyan, hsl(from #23f2e7 var(--sm-hsl, h s l)))');
      expect(css).toContain('hsl(from #23f2e7aa var(--sm-hsl, h s l))');
    });

    it('leaves a stylesheet without accent colours byte for byte', () => {
      const text = '.x{color:#fff;background:rgba(0,0,0,.5);margin:0}';
      expect(wrapCssColors(text)).toEqual({ css: text, wrapped: 0 });
    });
  });

  describe('unwrappedAccentColors', () => {
    it('finds bare accent chrome and ignores wrapped and non-accent colours', () => {
      const text = `a{color:#00e6e4;border:hsl(from #23f2e7 var(--sm-hsl, h s l));background:#001421;x:rgba(0, 223, 227, 0.2)}`;
      expect(unwrappedAccentColors(text)).toEqual(['#00e6e4', 'rgba(0, 223, 227, 0.2)']);
    });

    it('finds nothing in the output of wrapCssColors', () => {
      const text = 'a{color:#00e6e4;border:rgba(0,223,227,.79);glow:0 0 9px #10edda}';
      expect(unwrappedAccentColors(wrapCssColors(text).css)).toEqual([]);
    });
  });
});

describe('sanitizeAccent / normalizeHex', () => {
  it.each(ACCENTS)('keeps the %s swatch %s', (_key, color) => {
    expect(sanitizeAccent(color)).toBe(color);
    expect(sanitizeAccent(color.toLowerCase())).toBe(color);
  });

  it.each([
    [undefined],
    [null],
    [42],
    [{}],
    [[]],
    [''],
    ['   '],
    ['red'],
    ['orange'],
    ['#'],
    ['#12'],
    ['#12345'],
    ['#1234567'],
    ['#GGGGGG'],
    ['0D5C52'],
    ['rgb(13, 92, 82)'],
    ['hsl(174, 75%, 20%)'],
    ['#0D5C52FF'],
    ['#fff'],
    ['#FFFFFF'],
    ['#FAFAFA'],
    ['#FFFF00'],
    ['javascript:alert(1)'],
    ['url(x)'],
  ])('falls back to the default for %j', (input) => {
    expect(sanitizeAccent(input)).toBe(DEFAULT_ACCENT_HEX);
  });

  it('accepts a valid 3-digit colour that is dark enough', () => {
    expect(sanitizeAccent('#036')).toBe('#003366');
  });

  it('accepts the old teal that earlier builds offered', () => {
    expect(sanitizeAccent('#0D7377')).toBe('#0D7377');
  });

  it('trims whitespace around a valid colour', () => {
    expect(sanitizeAccent('  #2563eb ')).toBe('#2563EB');
  });

  it('normalizeHex uppercases and drops alpha, and refuses non-hex notation', () => {
    expect(normalizeHex('#2563eb')).toBe('#2563EB');
    expect(normalizeHex('#2563ebaa')).toBe('#2563EB');
    expect(normalizeHex('rgb(1,2,3)')).toBeNull();
    expect(normalizeHex('nope')).toBeNull();
  });
});

describe('deriveShift - one accent, one shift', () => {
  it('the default accent is the identity (the prototype untouched)', () => {
    expect(deriveShift(DEFAULT_ACCENT_HEX)).toEqual(IDENTITY_SHIFT);
    expect(deriveShift(DEFAULT_ACCENT_HEX.toLowerCase())).toEqual(IDENTITY_SHIFT);
  });

  it.each(['', 'junk', '#FFFFFF', 'rgb(1,2,3)'])('a pick it cannot use (%j) is the identity as well', (input) => {
    expect(deriveShift(input)).toEqual(IDENTITY_SHIFT);
  });

  it('the five other accents each get a different shift', () => {
    const seen = new Set(NON_DEFAULT.map(([, color]) => JSON.stringify(deriveShift(color))));
    expect(seen.size).toBe(NON_DEFAULT.length);
  });

  describe.each(NON_DEFAULT)('%s (%s)', (_key, color) => {
    const shift = deriveShift(color);
    const accent = shiftColor(CYAN, shift);

    it('moves the cyan hue to the pick\'s own hue', () => {
      const pickHue = rgbToHsl(parseColor(color)!).h;
      const moved = rgbToHsl(parseColor(accent)!).h;
      const diff = Math.min(Math.abs(moved - pickHue), 360 - Math.abs(moved - pickHue));
      expect(diff).toBeLessThan(6);
    });

    it('does not turn a dull pick into neon', () => {
      const pickSat = rgbToHsl(parseColor(color)!).s;
      expect(shift.ds).toBeLessThanOrEqual(1);
      expect(shift.ds).toBeGreaterThanOrEqual(0.15);
      expect(Math.abs(shift.ds * 100 - Math.max(15, pickSat))).toBeLessThan(1.5);
    });

    it('lifts lightness by a fraction between 0 and 1', () => {
      expect(shift.kl).toBeGreaterThanOrEqual(0);
      expect(shift.kl).toBeLessThan(0.99);
    });

    it.each(DARK_SURFACES)('the accent text reads on the navy surface %s (AA 4.5:1)', (surface) => {
      expect(contrastRatio(accent, surface)).toBeGreaterThanOrEqual(AA);
    });

    it.each(DARK_SURFACES)('and on the 16% accent tint over %s', (surface) => {
      expect(contrastRatio(accent, blend(surface, accent, 0.16))).toBeGreaterThanOrEqual(AA);
    });

    it.each(FILL_STOPS)('the button ink reads on the fill stop %s (AA 4.5:1)', (stop) => {
      expect(contrastRatio(ON_ACCENT_INK, shiftColor(stop, shift))).toBeGreaterThanOrEqual(AA);
    });

    it('aqua (the lighter text accent) reads on every navy surface too', () => {
      const aqua = shiftColor('#23F2E7', shift);
      for (const surface of DARK_SURFACES) expect(contrastRatio(aqua, surface)).toBeGreaterThanOrEqual(AA);
    });

    it('is the smallest lift that satisfies every check (not washed out for nothing)', () => {
      if (shift.kl === 0) return;
      const lower = { ...shift, kl: Math.round((shift.kl - 0.01) * 100) / 100 };
      const lowerAccent = shiftColor(CYAN, lower);
      const stillOk =
        DARK_SURFACES.every((s) => contrastRatio(lowerAccent, s) >= AA && contrastRatio(lowerAccent, blend(s, lowerAccent, 0.16)) >= AA) &&
        FILL_STOPS.every((f) => contrastRatio(ON_ACCENT_INK, shiftColor(f, lower)) >= AA);
      expect(stillOk).toBe(false);
    });
  });

  it('the default accent keeps the prototype\'s own contrasts (cyan 12:1 on the page)', () => {
    expect(contrastRatio(CYAN, '#001421')).toBeGreaterThan(11);
    expect(contrastRatio(ON_ACCENT_INK, '#00BDA9')).toBeGreaterThan(6);
  });

  it('a custom hex works like a swatch and is deterministic', () => {
    const a = deriveShift('#BE185D');
    expect(deriveShift('#be185d')).toEqual(a);
    expect(contrastRatio(shiftColor(CYAN, a), '#001421')).toBeGreaterThanOrEqual(AA);
  });
});

describe('light mode helpers', () => {
  describe.each(ACCENTS)('%s (%s)', (_key, color) => {
    it('chooses a button text that reads on the accent as well as anything can', () => {
      const text = onAccentText(color);
      const best = Math.max(contrastRatio('#FFFFFF', color), contrastRatio('#1A1D21', color));
      expect(contrastRatio(text, color)).toBeCloseTo(best, 5);
    });

    it('white text wins whenever it reaches AA', () => {
      if (contrastRatio('#FFFFFF', color) >= AA) expect(onAccentText(color)).toBe('#FFFFFF');
    });
  });

  it('forest and slate keep white, the pale/bright accents get ink where white fails AA', () => {
    expect(onAccentText('#0D5C52')).toBe('#FFFFFF');
    expect(onAccentText('#2B3440')).toBe('#FFFFFF');
    expect(onAccentText('#2563EB')).toBe('#FFFFFF');
    expect(onAccentText('#EA580C')).toBe('#1A1D21');
    expect(onAccentText('#0D9488')).toBe('#1A1D21');
  });

  it('the default accent keeps the board\'s hand-picked tints exactly', () => {
    expect(lightTints(DEFAULT_ACCENT_HEX)).toEqual({ hover: '#E4EEEB', selected: '#D7E9E5', softBg: '#F4F8F7', softLine: '#C9D6D3' });
    expect(lightTints('junk')).toEqual(lightTints(DEFAULT_ACCENT_HEX));
  });

  it.each(NON_DEFAULT)('the tints of %s are its own, pale, and ordered by strength', (_key, color) => {
    const t = lightTints(color);
    expect(t.hover).not.toBe('#E4EEEB');
    const lum = (c: string) => relativeLuminance(c);
    expect(lum(t.softBg)).toBeGreaterThan(lum(t.hover));
    expect(lum(t.hover)).toBeGreaterThan(lum(t.selected));
    expect(lum(t.selected)).toBeGreaterThan(lum(t.softLine));
    expect(contrastRatio(t.softBg, '#FFFFFF')).toBeLessThan(1.15);
  });

  it('tintOf mixes into white, darken into black', () => {
    expect(tintOf('#000000', 0.5)).toBe('#808080');
    expect(tintOf('#EA580C', 0)).toBe('#FFFFFF');
    expect(tintOf('#EA580C', 1)).toBe('#EA580C');
    expect(darken('#EA580C', 0)).toBe('#EA580C');
    expect(darken('#EA580C', 1)).toBe('#000000');
    expect(() => tintOf('nope', 0.2)).toThrow();
    expect(() => darken('nope', 0.2)).toThrow();
  });
});

describe('accentVariables - what the staff app puts on the document root', () => {
  const ALL = [
    '--sm-hsl', '--sm-accent', '--sm-accent-light', '--sm-accent-dark', '--sm-accent-hover', '--sm-accent-active',
    '--sm-accent-rgb', '--sm-accent-ink', '--sm-on-accent', '--sm-tint-hover', '--sm-tint-selected', '--sm-soft-bg', '--sm-soft-line',
    '--sm-planner-accent', '--sm-planner-accent-ink', '--sm-planner-on-accent',
  ];

  it.each(['light', 'dark'] as const)('the default accent sets nothing in %s (the stylesheets\' fallbacks are the default look)', (mode) => {
    const vars = accentVariables(DEFAULT_ACCENT_HEX, mode);
    expect(Object.keys(vars).sort()).toEqual([...ALL].sort());
    expect(Object.values(vars).every((v) => v === null)).toBe(true);
  });

  describe('the planner tint (R15d)', () => {
    it('unset, the planner follows the accent: the shift is the accent itself', () => {
      expect(accentVariables('#2563EB', 'dark', null)['--sm-hsl']).toBe(shiftExpression(deriveShift('#2563EB')));
      expect(accentVariables('#2563EB', 'dark', null)['--sm-planner-accent']).toBeNull();
    });
    it('set, the planner stage is drawn in the tint while the rest keeps the accent', () => {
      const dark = accentVariables('#2563EB', 'dark', '#EA580C');
      expect(dark['--sm-hsl']).toBe(shiftExpression(deriveShift('#EA580C')));
      expect(dark['--sm-accent']).toBe(accentVariables('#2563EB', 'dark')['--sm-accent']);
      const light = accentVariables('#2563EB', 'light', '#EA580C');
      expect(light['--sm-planner-accent']).toBe('#EA580C');
      expect(light['--sm-planner-accent-ink']).toBe(accentInk('#EA580C'));
      expect(light['--sm-planner-on-accent']).toBe(onAccentText('#EA580C'));
      expect(light['--sm-accent']).toBe('#2563EB');
    });
    it('a tint on the default accent still reaches the planner; a tint equal to the default sets nothing for it', () => {
      expect(accentVariables(DEFAULT_ACCENT_HEX, 'light', '#7C3AED')['--sm-planner-accent']).toBe('#7C3AED');
      expect(accentVariables('#2563EB', 'light', DEFAULT_ACCENT_HEX)['--sm-planner-accent']).toBeNull();
      expect(accentVariables('#2563EB', 'dark', DEFAULT_ACCENT_HEX)['--sm-hsl']).toBeNull();
    });
    it('a junk tint is the default one', () => {
      expect(accentVariables('#2563EB', 'light', 'red')['--sm-planner-accent']).toBeNull();
    });
  });

  it.each(['light', 'dark'] as const)('a junk accent sets nothing in %s either', (mode) => {
    expect(Object.values(accentVariables('junk', mode)).every((v) => v === null)).toBe(true);
  });

  describe.each(NON_DEFAULT)('%s (%s)', (_key, color) => {
    it('always carries the shift (the planner is dark in either mode)', () => {
      for (const mode of ['light', 'dark'] as const) {
        expect(accentVariables(color, mode)['--sm-hsl']).toBe(shiftExpression(deriveShift(color)));
      }
    });

    it('light: the colour itself, its rgb triplet, its button text and its tints', () => {
      const v = accentVariables(color, 'light');
      const rgb = parseColor(color)!;
      expect(v['--sm-accent']).toBe(color);
      expect(v['--sm-accent-rgb']).toBe(`${rgb.r}, ${rgb.g}, ${rgb.b}`);
      expect(v['--sm-on-accent']).toBe(onAccentText(color));
      expect(v['--sm-tint-hover']).toBe(lightTints(color).hover);
      expect(v['--sm-tint-selected']).toBe(lightTints(color).selected);
      expect(v['--sm-soft-bg']).toBe(lightTints(color).softBg);
      expect(v['--sm-soft-line']).toBe(lightTints(color).softLine);
    });

    it('dark: the shifted cyan, its rgb triplet and the dark ink; no light tints', () => {
      const v = accentVariables(color, 'dark');
      const main = shiftColor(CYAN, deriveShift(color));
      const rgb = parseColor(main)!;
      expect(v['--sm-accent']).toBe(main);
      expect(v['--sm-accent-rgb']).toBe(`${rgb.r}, ${rgb.g}, ${rgb.b}`);
      expect(v['--sm-on-accent']).toBe(ON_ACCENT_INK);
      expect(v['--sm-tint-hover']).toBeNull();
      expect(v['--sm-soft-bg']).toBeNull();
    });

    it('every state colour is a plain hex the stylesheets can use', () => {
      for (const mode of ['light', 'dark'] as const) {
        const v = accentVariables(color, mode);
        for (const name of ['--sm-accent', '--sm-accent-light', '--sm-accent-dark', '--sm-accent-hover', '--sm-accent-active']) {
          expect(v[name]).toMatch(/^#[0-9A-F]{6}$/);
        }
      }
    });

    it('hover and active differ from the main colour', () => {
      for (const mode of ['light', 'dark'] as const) {
        const v = accentVariables(color, mode);
        expect(v['--sm-accent-hover']).not.toBe(v['--sm-accent']);
        expect(v['--sm-accent-active']).not.toBe(v['--sm-accent']);
      }
    });
  });

  it('light and dark give different --sm-accent for every non-default accent', () => {
    for (const [, color] of NON_DEFAULT) {
      expect(accentVariables(color, 'light')['--sm-accent']).not.toBe(accentVariables(color, 'dark')['--sm-accent']);
    }
  });

  it('all five non-default accents give five distinct values in each mode', () => {
    for (const mode of ['light', 'dark'] as const) {
      expect(new Set(NON_DEFAULT.map(([, c]) => accentVariables(c, mode)['--sm-accent'])).size).toBe(5);
    }
  });
});

describe('the toHex/toRgbString of a shifted colour agree with the CSS formula', () => {
  /* hsl(from C calc(h + dh) calc(s * ds) calc(l + (100 - l) * kl)) is exactly shiftHsl on rgbToHsl(C). */
  it.each(NON_DEFAULT)('%s: shiftColor equals shiftHsl of the same colour', (_key, color) => {
    const shift = deriveShift(color);
    for (const literal of ['#00E6E4', '#23F2E7', '#10EDDA', '#087E97', '#0BEAD7', '#50FFFF', '#006B6D']) {
      const rgb = parseColor(literal)!;
      const expected = toHex(hslToRgb(shiftHsl(rgbToHsl(rgb), shift)));
      expect(shiftColor(literal, shift)).toBe(expected);
    }
  });
});
