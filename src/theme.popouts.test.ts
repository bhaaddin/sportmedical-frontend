/*
 * R5 - the contrast table of every pop-out surface: 6 accents x 2 modes, each text/icon/border token against EVERY colour the
 * surface paints (the dark glass is a three-stop gradient), composited the way the browser paints a translucent colour.
 * Pure numbers from the theme tokens (`popoutTokens`, `FIELD_EDGE`, the tone table); the real pixels are checked by
 * scripts/stage3b/audit-popouts.mjs.
 */
import { describe, expect, it } from 'vitest';
import { alpha } from '@mui/material/styles';
import { AA, accentInk, blend, contrastRatio, parseColor, toHex } from './accent';
import { DARK, DESIGN, FIELD_EDGE, THEME_ACCENTS, TONE_CSS, buildTheme, popoutTokens, toneColors } from './theme';

const COMBOS = THEME_ACCENTS.flatMap((a) => (['light', 'dark'] as const).map((mode) => [a.key, a.color, mode] as const));
const over = (base: string, top: string): string => {
  const c = parseColor(top);
  if (c === null) throw new Error(`not a colour: ${top}`);
  return toHex(blend(base, { ...c, a: 1 }, c.a));
};

describe.each(COMBOS)('pop-out surface %s (%s) %s', (_key, accent, mode) => {
  const pop = popoutTokens(accent, mode);
  const theme = buildTheme(accent, mode);

  it.each(pop.stops.map((s) => [s]))('text, muted text and the accent read on the surface stop %s', (stop) => {
    expect(contrastRatio(pop.text, stop)).toBeGreaterThanOrEqual(AA);
    expect(contrastRatio(pop.muted, stop)).toBeGreaterThanOrEqual(AA);
    const accentText = mode === 'light' ? accentInk(accent) : theme.palette.primary.main;
    expect(contrastRatio(accentText, stop)).toBeGreaterThanOrEqual(AA);
    /* a hovered / selected item keeps its text readable */
    for (const state of [pop.hover, pop.selected]) {
      const item = over(stop, state);
      expect(contrastRatio(pop.text, item)).toBeGreaterThanOrEqual(AA);
      expect(contrastRatio(pop.muted, item)).toBeGreaterThanOrEqual(AA);
    }
  });

  it('the soft status tones read on the surface and on their own fill', () => {
    for (const tone of ['green', 'beige', 'red', 'grey', 'blue'] as const) {
      const t = toneColors(theme, tone);
      for (const stop of pop.stops) {
        const fill = over(stop, t.bg);
        expect(contrastRatio(t.fg, fill), `${tone} on ${stop}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('every semantic action colour has a contrast text (filled alert / button)', () => {
    for (const key of ['primary', 'success', 'warning', 'error', 'info'] as const) {
      const p = theme.palette[key];
      expect(contrastRatio(p.contrastText, p.main), key).toBeGreaterThanOrEqual(AA);
    }
  });

  it('an input boundary is >= 3:1 on every surface a field sits on (WCAG 1.4.11)', () => {
    const surfaces = [...pop.stops, theme.palette.background.paper, theme.palette.background.default];
    for (const s of surfaces) expect(contrastRatio(FIELD_EDGE[mode], s)).toBeGreaterThanOrEqual(3);
  });

  it('the CSS custom properties the theme sets on :root are these tokens', () => {
    const root = (theme.components?.MuiCssBaseline?.styleOverrides as Record<string, Record<string, string>>)[':root'];
    expect(root['--sm-pop-paper']).toBe(pop.paper);
    expect(root['--sm-pop-border']).toBe(pop.border);
    expect(root['--sm-pop-text']).toBe(pop.text);
    expect(root['--sm-pop-muted']).toBe(pop.muted);
    expect(root['--sm-pop-hover']).toBe(pop.hover);
    for (const tone of ['green', 'beige', 'red', 'grey', 'blue'] as const) {
      expect(root[`--sm-tone-${tone}-bg`]).toBe(toneColors(theme, tone).bg);
      expect(root[`--sm-tone-${tone}-fg`]).toBe(toneColors(theme, tone).fg);
    }
  });
});

describe('the dark pop-out surface is the prototype glass', () => {
  it('its stops are the floating gradient the theme paints', () => {
    for (const stop of popoutTokens('#0D5C52', 'dark').stops) expect(DARK.floating.toLowerCase()).toContain(stop.toLowerCase());
  });
  it('the tone variables fall back to the light pastel when the theme has not set them', () => {
    expect(TONE_CSS.red.bg).toBe(`var(--sm-tone-red-bg, ${DESIGN.tone.red.bg})`);
  });
  it('the default accent keeps the hover wash of the dark theme', () => {
    expect(popoutTokens('#0D5C52', 'dark').hover).toBe(alpha(DARK.cyan, 0.09));
  });
});
