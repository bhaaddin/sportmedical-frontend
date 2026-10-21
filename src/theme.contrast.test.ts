/*
 * Reviewer 2.5 - the contrast table of the booking surfaces: every accent x both modes, text against the background it really
 * sits on (the pair is composited the way the browser paints it), >= AA (4.5:1). Pure numbers from the theme, no DOM.
 *
 * What went wrong before: the selected card / mode card of the booking bubble took ACCENT_SOFT (light mode's pale fill) in the
 * dark theme, so white text sat on a near-white card ("hovering turns the text white on a light background"), the footer and the
 * read-only fields took DESIGN.head, and orange / teal accents were 3.4-3.7:1 as text on white.
 */
import { describe, expect, it } from 'vitest';
import { alpha } from '@mui/material/styles';
import { AA, accentInk, blend, contrastRatio, lightTints, parseColor, toHex } from './accent';
import { ACCENT_SOFT, DARK, THEME_ACCENTS, accentInkOf, buildTheme, headSurface } from './theme';

const ACCENTS = THEME_ACCENTS.map((a) => [a.key, a.color] as const);
const MODES = ['light', 'dark'] as const;
const COMBOS = ACCENTS.flatMap(([key, color]) => MODES.map((mode) => [key, color, mode] as const));

/** A colour that may carry alpha, painted over an opaque base. */
function over(base: string, top: string): string {
  const rgba = parseColor(top);
  if (rgba === null) throw new Error(`not a colour: ${top}`);
  return toHex(blend(base, { ...rgba, a: 1 }, rgba.a));
}

/** The value `--sm-soft-bg` has in a mode: the CssBaseline's `:root` rule in dark, AccentRootVars / the fallback in light. */
function softBgOf(theme: ReturnType<typeof buildTheme>): string {
  if (theme.palette.mode === 'light') return lightTints(theme.palette.primary.main).softBg;
  const css = (theme.components?.MuiCssBaseline?.styleOverrides ?? {}) as Record<string, Record<string, string>>;
  const value = css[':root']?.['--sm-soft-bg'];
  if (value === undefined) throw new Error('dark theme sets no --sm-soft-bg');
  return value;
}

describe('booking surfaces: text on the soft selected card (činnost card, mode card)', () => {
  it.each(COMBOS)('%s (%s) %s: primary text and secondary text read on the selected card', (_key, color, mode) => {
    const theme = buildTheme(color, mode);
    const card = over(theme.palette.background.paper, softBgOf(theme));
    expect(contrastRatio(over(card, theme.palette.text.primary), card)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(over(card, theme.palette.text.secondary), card)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(accentInkOf(theme), card)).toBeGreaterThanOrEqual(AA);
  });

  it('the dark theme no longer leaves ACCENT_SOFT on its light fallback', () => {
    for (const [, color] of ACCENTS) {
      const theme = buildTheme(color, 'dark');
      const value = softBgOf(theme);
      expect(value).not.toBe('#F4F8F7');
      /* white ink on the pale fallback was 1.02:1 */
      expect(contrastRatio(DARK.white, over(theme.palette.background.paper, value))).toBeGreaterThan(10);
    }
    expect(ACCENT_SOFT.bg).toBe('var(--sm-soft-bg, #F4F8F7)');
  });
});

describe('booking surfaces: the sunken footer and the read-only fields', () => {
  it.each(COMBOS)('%s (%s) %s: text.primary and text.secondary read on headSurface', (_key, color, mode) => {
    const theme = buildTheme(color, mode);
    const surface = over(theme.palette.background.paper, headSurface(theme));
    expect(contrastRatio(over(surface, theme.palette.text.primary), surface)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(over(surface, theme.palette.text.secondary), surface)).toBeGreaterThanOrEqual(AA);
  });
});

describe('the accent as text and as a pressed fill', () => {
  it.each(ACCENTS)('%s (%s): accentInk reads on white and on the soft tint, and never drifts far from the pick', (_key, color) => {
    const ink = accentInk(color);
    expect(contrastRatio(ink, '#FFFFFF')).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(ink, lightTints(ink).softBg)).toBeGreaterThanOrEqual(AA);
    /* a pick that already reads is left exactly as it is */
    if (contrastRatio(color, '#FFFFFF') >= AA && contrastRatio(color, lightTints(color).softBg) >= AA) expect(ink.toUpperCase()).toBe(color.toUpperCase());
  });

  it.each(ACCENTS)('%s (%s) light: the button text reads on the hover fill too (dark-ink accents go lighter, not darker)', (_key, color) => {
    const { palette } = buildTheme(color, 'light');
    expect(contrastRatio(palette.primary.contrastText, palette.primary.main)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(palette.primary.contrastText, palette.primary.dark)).toBeGreaterThanOrEqual(AA);
  });

  it('orange and teal were the failing picks, and are the only ones that change', () => {
    const changed = ACCENTS.filter(([, c]) => accentInk(c).toUpperCase() !== c.toUpperCase()).map(([k]) => k);
    expect(changed.sort()).toEqual(['orange', 'teal']);
  });

  it.each(ACCENTS)('%s (%s) dark: the accent text reads on the glass panel and on the soft card', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const paper = theme.palette.background.paper;
    expect(contrastRatio(theme.palette.primary.main, paper)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(theme.palette.primary.main, over(paper, alpha(theme.palette.primary.main, 0.14)))).toBeGreaterThanOrEqual(AA);
  });
});
