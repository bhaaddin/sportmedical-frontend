/*
 * buildTheme(accent, mode): every accent x every mode. The accent must be visible in the palette AND in the
 * component overrides, in dark as well as in light, and must never leak into the semantic colours.
 */
import { describe, expect, it } from 'vitest';
import { alpha } from '@mui/material/styles';
import {
  AA,
  CYAN,
  DARK_SURFACES,
  DEFAULT_ACCENT_HEX,
  ON_ACCENT_INK,
  contrastRatio,
  deriveShift,
  isAccentChrome,
  lightTints,
  onAccentText,
  parseColor,
  rgbToHsl,
  shiftColor,
} from './accent';
import { ACCENT_SOFT, DARK, THEME_ACCENTS, accentLiteral, buildTheme, darkOf, darkTokens, shiftOf, tintsOf } from './theme';
import { themePicture } from './test/themeSerialize';
import { createTheme } from '@mui/material/styles';

const ACCENTS = THEME_ACCENTS.map((a) => [a.key, a.color] as const);
const NON_DEFAULT = ACCENTS.filter(([, c]) => c !== DEFAULT_ACCENT_HEX);
const MODES = ['light', 'dark'] as const;
const COMBOS = ACCENTS.flatMap(([key, color]) => MODES.map((mode) => [key, color, mode] as const));

/** Colour literals of the semantic tones: statuses, not the accent. */
const SEMANTIC_GREEN = new Set([
  '#00E5C6', '#4DF2DA', 'rgba(0, 229, 198, 0.12)', 'rgba(0, 229, 198, 0.45)',
  /* MUI's own darker variant of success.main (#00E5C6), derived by augmentColor. */
  'rgb(0, 160, 138)',
]);

function literalsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    for (const m of value.match(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^()]*\)/g) ?? []) out.push(m);
  } else if (Array.isArray(value)) value.forEach((v) => literalsOf(v, out));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach((v) => literalsOf(v, out));
  return out;
}

describe('the palette follows the accent', () => {
  it.each(COMBOS)('%s (%s) %s: primary.main is the pick in light, the shifted cyan in dark', (_key, color, mode) => {
    const theme = buildTheme(color, mode);
    const expected = mode === 'light' ? color : shiftColor(CYAN, deriveShift(color));
    expect(theme.palette.primary.main.toUpperCase()).toBe(expected.toUpperCase());
    expect(theme.palette.mode).toBe(mode);
  });

  it.each(COMBOS)('%s (%s) %s: the button text reads on primary.main (AA)', (_key, color, mode) => {
    const theme = buildTheme(color, mode);
    const { main, contrastText } = theme.palette.primary;
    expect(contrastRatio(contrastText, main)).toBeGreaterThanOrEqual(AA - 0.01);
  });

  it.each(NON_DEFAULT)('%s: primary.main differs from the default in both modes', (_key, color) => {
    for (const mode of MODES) {
      expect(buildTheme(color, mode).palette.primary.main).not.toBe(buildTheme(DEFAULT_ACCENT_HEX, mode).palette.primary.main);
    }
  });

  it('the six accents give six different primaries in each mode', () => {
    for (const mode of MODES) {
      expect(new Set(ACCENTS.map(([, c]) => buildTheme(c, mode).palette.primary.main.toLowerCase())).size).toBe(6);
    }
  });

  it.each(NON_DEFAULT)('%s dark: action colours are tints of the shifted cyan', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const main = theme.palette.primary.main;
    expect(theme.palette.action.hover).toBe(alpha(main, 0.09));
    expect(theme.palette.action.selected).toBe(alpha(main, 0.14));
    expect(theme.palette.action.focus).toBe(alpha(main, 0.16));
  });

  it.each(NON_DEFAULT)('%s light: action colours are tints of the pick', (_key, color) => {
    const theme = buildTheme(color, 'light');
    expect(theme.palette.action.selected).toBe(alpha(color, 0.08));
    expect(theme.palette.action.focus).toBe(alpha(color, 0.12));
  });

  it.each(NON_DEFAULT)('%s dark: primary.light and primary.dark are the shifted aqua and deep cyan', (_key, color) => {
    const shift = deriveShift(color);
    const { light, dark } = buildTheme(color, 'dark').palette.primary;
    expect(light.toUpperCase()).toBe(shiftColor('#23F2E7', shift));
    expect(dark.toUpperCase()).toBe(shiftColor('#00ADAB', shift));
  });

  it.each(COMBOS)('%s (%s) %s: the page and paper surfaces never change with the accent', (_key, color, mode) => {
    const base = buildTheme(DEFAULT_ACCENT_HEX, mode).palette;
    const theme = buildTheme(color, mode).palette;
    expect(theme.background).toEqual(base.background);
    expect(theme.text).toEqual(base.text);
    expect(theme.divider).toBe(base.divider);
  });

  it.each(COMBOS)('%s (%s) %s: success / warning / error / info stay what they are', (_key, color, mode) => {
    const base = buildTheme(DEFAULT_ACCENT_HEX, mode).palette;
    const theme = buildTheme(color, mode).palette;
    for (const tone of ['success', 'warning', 'error', 'info'] as const) expect(theme[tone]).toEqual(base[tone]);
  });
});

describe('dark accent text and fills read on the navy', () => {
  it.each(ACCENTS)('%s (%s): primary.main on every dark surface', (_key, color) => {
    const main = buildTheme(color, 'dark').palette.primary.main;
    for (const surface of DARK_SURFACES) expect(contrastRatio(main, surface)).toBeGreaterThanOrEqual(AA);
  });

  it.each(ACCENTS)('%s (%s): primary.light on every dark surface', (_key, color) => {
    const light = buildTheme(color, 'dark').palette.primary.light;
    for (const surface of DARK_SURFACES) expect(contrastRatio(light, surface)).toBeGreaterThanOrEqual(AA);
  });

  it.each(ACCENTS)('%s (%s): the dark ink on the contained button\'s gradient ends', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const fill = darkOf(theme).primaryFill;
    const stops = fill.match(/#[0-9a-fA-F]{6}/g) ?? [];
    expect(stops.length).toBe(2);
    for (const stop of stops) expect(contrastRatio(ON_ACCENT_INK, stop)).toBeGreaterThanOrEqual(AA);
    expect(theme.palette.primary.contrastText).toBe(ON_ACCENT_INK);
  });
});

describe('component overrides follow the accent', () => {
  const dark = (color: string) => JSON.stringify(themePicture(buildTheme(color, 'dark')));

  it.each(NON_DEFAULT)('%s dark: the picture of the theme differs from the default in many places', (_key, color) => {
    const a = dark(color);
    const b = dark(DEFAULT_ACCENT_HEX);
    expect(a).not.toBe(b);
    const countDiff = (x: string, y: string) => x.split('"').filter((token, i) => token !== y.split('"')[i]).length;
    expect(countDiff(a, b)).toBeGreaterThan(20);
  });

  /* The accent-chrome literals the default dark theme draws (the prototype's cyan family), without the statuses. */
  const defaultChrome = new Set(
    literalsOf(JSON.parse(dark(DEFAULT_ACCENT_HEX))).filter((lit) => isAccentChrome(rgbToHsl(parseColor(lit)!)) && !SEMANTIC_GREEN.has(lit)),
  );

  it.each(NON_DEFAULT)('%s dark: not one prototype cyan literal is left in the theme (only the semantic green)', (_key, color) => {
    const left = literalsOf(JSON.parse(dark(color))).filter((lit) => defaultChrome.has(lit));
    expect(left).toEqual([]);
  });

  it('the default dark theme, by contrast, still has its cyan literals', () => {
    const left = literalsOf(JSON.parse(dark(DEFAULT_ACCENT_HEX))).filter(
      (lit) => isAccentChrome(rgbToHsl(parseColor(lit)!)) && !SEMANTIC_GREEN.has(lit),
    );
    expect(left.length).toBeGreaterThan(20);
  });

  it.each(NON_DEFAULT)('%s dark: the contained primary button is painted in the accent family', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const contained = (theme.components?.MuiButton?.styleOverrides as { contained: Record<string, Record<string, unknown>> }).contained;
    const primary = contained['&.MuiButton-colorPrimary'] as { background: string; border: string; color: string };
    expect(primary.background).toBe(darkOf(theme).primaryFill);
    expect(primary.background).not.toBe(DARK.primaryFill);
    expect(primary.border).toContain(darkOf(theme).primaryLine);
    expect(primary.color).toBe(ON_ACCENT_INK);
  });

  it.each(NON_DEFAULT)('%s dark: the selected toggle segment is painted in the accent family', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const selected = (theme.components?.MuiToggleButton?.styleOverrides as { root: Record<string, Record<string, string>> }).root['&.Mui-selected'];
    expect(selected.background).not.toContain('#17EAD8');
    expect(selected.background).toContain('linear-gradient(105deg, #');
  });

  it.each(NON_DEFAULT)('%s light: the selected toggle segment is the pick with readable text', (_key, color) => {
    const theme = buildTheme(color, 'light');
    const selected = (theme.components?.MuiToggleButton?.styleOverrides as { root: Record<string, Record<string, string>> }).root['&.Mui-selected'];
    expect(selected.backgroundColor).toBe(color);
    expect(selected.color).toBe(onAccentText(color));
  });

  it.each(NON_DEFAULT)('%s light: selected list rows and info alerts use the pick\'s tint, not the forest one', (_key, color) => {
    const theme = buildTheme(color, 'light');
    const list = (theme.components?.MuiListItemButton?.styleOverrides as { root: Record<string, Record<string, string>> }).root['&.Mui-selected'];
    expect(list.backgroundColor).toBe(lightTints(color).softBg);
    expect(list.backgroundColor).not.toBe('#F4F8F7');
  });

  it.each(NON_DEFAULT)('%s: tabs, links of focus and outlined inputs use primary in both modes', (_key, color) => {
    for (const mode of MODES) {
      const theme = buildTheme(color, mode);
      const main = theme.palette.primary.main;
      const tab = (theme.components?.MuiTab?.styleOverrides as { root: Record<string, Record<string, string>> }).root['&.Mui-selected'];
      expect(tab.color).toBe(main);
      const tabs = (theme.components?.MuiTabs?.styleOverrides as { indicator: { backgroundColor: string } }).indicator;
      expect(tabs.backgroundColor).toBe(main);
      const input = (theme.components?.MuiOutlinedInput?.styleOverrides as { root: Record<string, Record<string, unknown>> }).root['&.Mui-focused .MuiOutlinedInput-notchedOutline'];
      expect(input.borderColor).toBe(main);
    }
  });

  it.each(NON_DEFAULT)('%s dark: the tab indicator glows in the accent', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const indicator = (theme.components?.MuiTabs?.styleOverrides as { indicator: { boxShadow: string } }).indicator;
    expect(indicator.boxShadow).toContain(theme.palette.primary.main);
  });

  it.each(NON_DEFAULT)('%s dark: the progress bar and the primary chip follow the accent', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const bar = JSON.stringify(theme.components?.MuiLinearProgress?.styleOverrides);
    expect(bar).not.toContain('#00998E');
    expect(bar).not.toContain('#02F3E5');
    const chip = (theme.components?.MuiChip?.styleOverrides as { colorPrimary: { color: string } }).colorPrimary;
    expect(chip.color).toBe(theme.palette.primary.light);
  });

  it.each(NON_DEFAULT)('%s dark: the dialog, menu and paper edges use the accent\'s lit border', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    const edge = darkOf(theme).panelLine;
    expect(edge).not.toBe(DARK.panelLine);
    const card = (theme.components?.MuiCard?.styleOverrides as { root: { border: string } }).root;
    expect(card.border).toContain(edge);
  });

  it('a light theme never uses the dark glass', () => {
    const picture = JSON.stringify(themePicture(buildTheme('#EA580C', 'light')));
    expect(picture).not.toContain('radial-gradient(ellipse at 85% 0%');
  });
});

describe('the helpers a component uses to follow the theme', () => {
  it('darkTokens(identity) is DARK, value for value', () => {
    expect(darkTokens({ dh: 0, ds: 1, kl: 0 })).toEqual(DARK);
  });

  it.each(NON_DEFAULT)('%s: darkTokens moves the accent chrome and keeps the surfaces and tones', (_key, color) => {
    const t = darkTokens(deriveShift(color));
    expect(t.cyan).not.toBe(DARK.cyan);
    expect(t.aqua).not.toBe(DARK.aqua);
    expect(t.panelLine).not.toBe(DARK.panelLine);
    expect(t.primaryFill).not.toBe(DARK.primaryFill);
    expect(t.bg).toBe(DARK.bg);
    expect(t.glass).toBe(DARK.glass);
    expect(t.white).toBe(DARK.white);
    expect(t.tone).toEqual(DARK.tone);
    expect(t.text).toEqual(DARK.text);
    expect(t.green).toBe(DARK.green);
    expect(t.red).toBe(DARK.red);
    expect(t.onCyan).toBe(DARK.onCyan);
  });

  it.each(ACCENTS)('%s: darkOf / shiftOf / tintsOf read what buildTheme stored', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    expect(shiftOf(theme)).toEqual(deriveShift(color));
    expect(darkOf(theme).cyan).toBe(theme.palette.primary.main);
    expect(tintsOf(theme)).toEqual(lightTints(color));
  });

  it('a theme that was not built by buildTheme gets the prototype\'s values', () => {
    const bare = createTheme();
    expect(darkOf(bare)).toEqual(DARK);
    expect(shiftOf(bare)).toEqual({ dh: 0, ds: 1, kl: 0 });
    expect(tintsOf(bare)).toEqual(lightTints(DEFAULT_ACCENT_HEX));
    expect(accentLiteral(bare, '#6AF8F0')).toBe('#6AF8F0');
  });

  it.each(NON_DEFAULT)('%s: accentLiteral moves a prototype cyan and leaves a navy alone', (_key, color) => {
    const theme = buildTheme(color, 'dark');
    expect(accentLiteral(theme, '#6AF8F0')).not.toBe('#6AF8F0');
    expect(accentLiteral(theme, '#001421')).toBe('#001421');
  });

  it('ACCENT_SOFT reads the variables the staff app sets, with the board\'s forest tints as fallback', () => {
    expect(ACCENT_SOFT.bg).toBe('var(--sm-soft-bg, #F4F8F7)');
    expect(ACCENT_SOFT.line).toBe('var(--sm-soft-line, #C9D6D3)');
  });
});

describe('the swatches', () => {
  it('there are six, with unique keys, labels and colours', () => {
    expect(THEME_ACCENTS).toHaveLength(6);
    expect(new Set(THEME_ACCENTS.map((a) => a.key)).size).toBe(6);
    expect(new Set(THEME_ACCENTS.map((a) => a.label)).size).toBe(6);
    expect(new Set(THEME_ACCENTS.map((a) => a.color)).size).toBe(6);
  });

  it('the first (the default) is the forest green', () => {
    expect(THEME_ACCENTS[0]).toEqual({ key: 'forest', label: 'Lesní zelená', color: DEFAULT_ACCENT_HEX });
  });

  it.each(ACCENTS)('%s (%s) is a colour that survives sanitizing and shows as a button on the light page', (_key, color) => {
    expect(contrastRatio(color, '#FFFFFF')).toBeGreaterThan(3);
    expect(buildTheme(color, 'light').palette.primary.main).toBe(color);
  });

  it('the Czech labels are the ones in the owner\'s screenshot', () => {
    expect(THEME_ACCENTS.map((a) => a.label)).toEqual(['Lesní zelená', 'Břidlicová', 'Tyrkysová', 'Modrá', 'Fialová', 'Oranžová']);
  });
});
