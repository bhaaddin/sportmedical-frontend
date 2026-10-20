/*
 * The shared building blocks that used to hard-code the prototype's cyan or the forest tints now take them from the
 * theme. For the default accent they must give back the old literals; for every other accent, the accent's own.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, alpha } from '@mui/material/styles';
import { DARK, THEME_ACCENTS, buildTheme } from '../theme';
import { DEFAULT_ACCENT_HEX, lightTints, parseColor } from '../accent';
import { activeBg, activeGlow, barGlass, primaryIconSx, sideGlass } from './shell/shellStyles';
import { settingsHover, settingsLine, settingsSelected } from './settings/settingsStyle';
import { FilterChips } from './ui/FilterChips';
import { SoftCard } from './ui/SoftCard';
import { ProgressRing } from './ui/ProgressRing';

const ACCENTS = THEME_ACCENTS.map((a) => [a.label, a.color] as const);
const NON_DEFAULT = ACCENTS.filter(([, c]) => c !== DEFAULT_ACCENT_HEX);
const rgb = (hex: string) => {
  const c = parseColor(hex)!;
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
};

describe('shell styles', () => {
  it('the default dark theme gives the prototype\'s own cyan glow, edge and fill', () => {
    const t = buildTheme(DEFAULT_ACCENT_HEX, 'dark');
    expect(activeGlow(t, true)).toBe(`inset 0 0 0 1px ${alpha(DARK.cyan, 0.38)}, 0 0 14px ${alpha(DARK.cyan, 0.14)}`);
    expect(sideGlass(t)).toMatchObject({ borderColor: DARK.panelLine, backgroundImage: DARK.panel });
    expect(barGlass(t)).toMatchObject({ borderColor: DARK.lineLight });
    expect(primaryIconSx(t)).toMatchObject({ background: DARK.primaryFill, color: DARK.onCyan, boxShadow: DARK.primaryGlow });
  });

  it('light has no glow and no glass at all', () => {
    const t = buildTheme('#EA580C', 'light');
    expect(activeGlow(t, true)).toBe('none');
    expect(sideGlass(t)).toEqual({});
    expect(barGlass(t)).toEqual({});
  });

  it('an inactive entry never glows, in any accent', () => {
    for (const [, color] of ACCENTS) expect(activeGlow(buildTheme(color, 'dark'), false)).toBe('none');
  });

  it.each(NON_DEFAULT)('%s dark: the active entry, the side glass, the bar and the primary icon button are in the accent', (_label, color) => {
    const t = buildTheme(color, 'dark');
    const main = t.palette.primary.main;
    expect(activeGlow(t, true)).toContain(alpha(main, 0.38));
    expect(activeBg(t)).toBe(alpha(main, 0.16));
    expect((sideGlass(t) as { borderColor: string }).borderColor).not.toBe(DARK.panelLine);
    expect((barGlass(t) as { borderColor: string }).borderColor).not.toBe(DARK.lineLight);
    const icon = primaryIconSx(t) as { background: string; border: string };
    expect(icon.background).not.toBe(DARK.primaryFill);
    expect(icon.border).not.toBe(`1px solid ${DARK.primaryLine}`);
  });

  it.each(ACCENTS)('%s light: the active entry rests on the accent\'s own soft tint', (_label, color) => {
    expect(activeBg(buildTheme(color, 'light'))).toBe(lightTints(color).softBg);
  });

  it('the light primary icon button uses primary and its contrast text', () => {
    expect(primaryIconSx(buildTheme('#2563EB', 'light'))).toMatchObject({ bgcolor: 'primary.main', color: 'primary.contrastText' });
  });
});

describe('settings styles', () => {
  it.each(ACCENTS)('%s light: hover and selected are the accent\'s tints; the line is the fixed grey', (_label, color) => {
    const t = buildTheme(color, 'light');
    expect(settingsHover(t)).toBe(lightTints(color).hover);
    expect(settingsSelected(t)).toBe(lightTints(color).selected);
    expect(settingsLine(t)).toBe('#C9D0D7');
  });

  it('the default light theme keeps the board\'s hand-picked tints', () => {
    const t = buildTheme(DEFAULT_ACCENT_HEX, 'light');
    expect(settingsHover(t)).toBe('#E4EEEB');
    expect(settingsSelected(t)).toBe('#D7E9E5');
  });

  it('the default dark theme keeps the prototype\'s literals', () => {
    const t = buildTheme(DEFAULT_ACCENT_HEX, 'dark');
    expect(settingsHover(t)).toBe('rgba(0, 230, 228, 0.09)');
    expect(settingsSelected(t)).toBe('rgba(0, 230, 228, 0.16)');
    expect(settingsLine(t)).toBe('#0F5A73');
  });

  it.each(NON_DEFAULT)('%s dark: hover, selected and line are in the accent, not the cyan', (_label, color) => {
    const t = buildTheme(color, 'dark');
    expect(settingsHover(t)).toBe(alpha(t.palette.primary.main, 0.09));
    expect(settingsSelected(t)).toBe(alpha(t.palette.primary.main, 0.16));
    expect(settingsHover(t)).not.toBe('rgba(0, 230, 228, 0.09)');
    expect(settingsLine(t)).not.toBe('#0F5A73');
  });
});

describe('FilterChips and SoftCard follow the theme (rendered)', () => {
  const renderIn = (accent: string, mode: 'light' | 'dark', ui: React.ReactElement) =>
    render(<ThemeProvider theme={buildTheme(accent, mode)}>{ui}</ThemeProvider>);

  it.each(NON_DEFAULT)('%s dark: the active chip\'s background is a tint of the accent', (_label, color) => {
    renderIn(color, 'dark', <FilterChips value="a" onChange={() => undefined} options={[{ key: 'a', label: 'Aktivní' }, { key: 'b', label: 'Jiný' }]} />);
    const chip = screen.getByRole('button', { name: /Aktivní/ });
    const main = buildTheme(color, 'dark').palette.primary.main;
    const c = parseColor(main)!;
    expect(getComputedStyle(chip).backgroundColor).toBe(`rgba(${c.r}, ${c.g}, ${c.b}, 0.14)`);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Jiný/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it.each(NON_DEFAULT)('%s light: the active chip rests on the accent\'s soft tint and line', (_label, color) => {
    renderIn(color, 'light', <FilterChips value="a" onChange={() => undefined} options={[{ key: 'a', label: 'Aktivní' }]} />);
    const style = getComputedStyle(screen.getByRole('button', { name: /Aktivní/ }));
    expect(style.backgroundColor).toBe(rgb(lightTints(color).softBg));
    expect(style.borderTopColor).toBe(rgb(lightTints(color).softLine));
  });

  it.each(NON_DEFAULT)('%s dark: a soft card is washed in the accent', (_label, color) => {
    renderIn(color, 'dark', <SoftCard tone="soft" data-testid="card">x</SoftCard>);
    const c = parseColor(buildTheme(color, 'dark').palette.primary.main)!;
    expect(getComputedStyle(screen.getByTestId('card')).backgroundColor).toBe(`rgba(${c.r}, ${c.g}, ${c.b}, 0.07)`);
  });

  it.each(NON_DEFAULT)('%s light: a soft card uses the accent\'s soft tint', (_label, color) => {
    renderIn(color, 'light', <SoftCard tone="soft" data-testid="card">x</SoftCard>);
    expect(getComputedStyle(screen.getByTestId('card')).backgroundColor).toBe(rgb(lightTints(color).softBg));
  });

  it('the default dark soft card is the prototype\'s 7% cyan wash', () => {
    renderIn(DEFAULT_ACCENT_HEX, 'dark', <SoftCard tone="soft" data-testid="card">x</SoftCard>);
    expect(getComputedStyle(screen.getByTestId('card')).backgroundColor).toBe('rgba(0, 230, 228, 0.07)');
  });

  it('a plain soft card is not tinted at all', () => {
    renderIn('#EA580C', 'dark', <SoftCard data-testid="card">x</SoftCard>);
    expect(getComputedStyle(screen.getByTestId('card')).backgroundColor).not.toContain('234, 88, 12');
  });

  /* jsdom does not compute conic gradients, so read the rule emotion injected for the ring. */
  const ringRule = () => {
    const classes = screen.getByTestId('progress-ring').className.split(' ').filter((c) => c.startsWith('css-'));
    return [...document.querySelectorAll('style')]
      .flatMap((s) => [...(s.sheet?.cssRules ?? [])].map((r) => r.cssText))
      .filter((text) => text.includes('conic-gradient') && classes.some((c) => text.startsWith('.' + c)))
      .join('\n');
  };

  it('the default dark ring keeps the prototype\'s light aqua to sky arc', () => {
    renderIn(DEFAULT_ACCENT_HEX, 'dark', <ProgressRing value={60} label="Hotovo" />);
    const rule = ringRule();
    expect(rule).toContain('conic-gradient');
    expect(rule).toContain('rgb(156, 255, 243)');
    expect(rule).toContain('rgb(120, 221, 252)');
  });

  it.each(NON_DEFAULT)('%s dark: the progress ring is drawn without the prototype\'s aqua', (_label, color) => {
    renderIn(color, 'dark', <ProgressRing value={60} label="Hotovo" />);
    const rule = ringRule().toLowerCase();
    expect(rule).toContain('conic-gradient');
    expect(rule).not.toContain('#9cfff3');
    expect(rule).not.toContain('rgb(120, 221, 252)');
    expect(rule).not.toContain('rgb(156, 255, 243)');
  });
});
