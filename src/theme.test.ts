/*
 * The four themes are real palettes, and every one of them is eye-safe by
 * measurement: no pure black, no pure white, and body text at WCAG AA
 * contrast (4.5:1) or better on both backgrounds it can sit on.
 *
 * What would have to break for these to fail: a palette that pastes #000 or
 * #FFF back in, a text colour too close to its paper, a key the server's
 * catalogue does not have, or `buildTheme` throwing on a key it does not know
 * instead of falling back.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_COLORS, THEME_KEYS, buildTheme, isThemeKey } from './theme';

function channel(hex: string, at: number): number {
  const value = parseInt(hex.slice(at, at + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function everyColour(key: (typeof THEME_KEYS)[number]): string[] {
  const c = THEME_COLORS[key];
  return [
    ...Object.values(c.primary),
    ...Object.values(c.secondary),
    ...Object.values(c.background),
    ...Object.values(c.text),
    c.success,
    c.warning,
    c.error,
    c.info,
    c.divider,
    c.appBar.background,
    c.appBar.text,
  ];
}

describe('the four themes', () => {
  it('are exactly the keys the server catalogue has', () => {
    expect([...THEME_KEYS]).toEqual(['clinic-light', 'calm-warm', 'contrast-dark', 'print-mono']);
    expect(DEFAULT_THEME).toBe('clinic-light');
  });

  it.each(THEME_KEYS)('%s uses no pure black and no pure white anywhere', (key) => {
    for (const colour of everyColour(key)) {
      expect(colour).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(colour.toUpperCase()).not.toBe('#000000');
      expect(colour.toUpperCase()).not.toBe('#FFFFFF');
    }
  });

  it.each(THEME_KEYS)('%s keeps body text at AA contrast on both backgrounds', (key) => {
    const c = THEME_COLORS[key];
    expect(contrast(c.text.primary, c.background.default)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text.primary, c.background.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.text.secondary, c.background.paper)).toBeGreaterThanOrEqual(4.5);
    /* A button's label on the button, and the title on the bar. */
    expect(contrast(c.primary.contrastText, c.primary.main)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.appBar.text, c.appBar.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEME_KEYS)('%s builds a MUI theme that carries its own palette', (key) => {
    const theme = buildTheme(key);
    expect(theme.palette.mode).toBe(THEME_COLORS[key].mode);
    expect(theme.palette.primary.main.toUpperCase()).toBe(THEME_COLORS[key].primary.main.toUpperCase());
    expect(theme.palette.background.paper.toUpperCase()).toBe(THEME_COLORS[key].background.paper.toUpperCase());
  });

  it('falls back to the default for a key it does not know, rather than crashing', () => {
    for (const unknown of ['neon', '', null, undefined, 42]) {
      expect(isThemeKey(unknown)).toBe(false);
      expect(buildTheme(unknown as string).palette.primary.main.toUpperCase()).toBe(
        THEME_COLORS[DEFAULT_THEME].primary.main.toUpperCase(),
      );
    }
  });

  it('the black-and-white theme really has no colour in it', () => {
    const c = THEME_COLORS['print-mono'];
    for (const colour of everyColour('print-mono')) {
      const r = colour.slice(1, 3);
      const g = colour.slice(3, 5);
      const b = colour.slice(5, 7);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
    expect(c.mode).toBe('light');
  });
});
