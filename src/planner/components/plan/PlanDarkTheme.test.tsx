/*
 * The planner's popovers are drawn in a portal; PlanDarkTheme gives them the dark theme, and the desk's accent.
 * Before the accent work it was built with a fixed '#0D9488' that dark mode ignored, so they stayed cyan.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';
import { PlanDarkTheme } from './PlanDarkTheme';
import { ThemePrefsContext } from '../../../themePrefs';
import { THEME_ACCENTS } from '../../../theme';
import { CYAN, DEFAULT_ACCENT_HEX, deriveShift, shiftColor } from '../../../accent';

function Probe() {
  const t = useTheme();
  return <output data-testid="p">{`${t.palette.mode}|${t.palette.primary.main}|${t.palette.primary.contrastText}`}</output>;
}

const withPrefs = (accent: string, mode: 'light' | 'dark') => (
  <ThemePrefsContext.Provider value={{ accent, mode, setAccent: () => undefined, setMode: () => undefined }}>
    <ThemeProvider theme={createTheme({ palette: { mode } })}>
      <PlanDarkTheme>
        <Probe />
      </PlanDarkTheme>
    </ThemeProvider>
  </ThemePrefsContext.Provider>
);

describe('PlanDarkTheme', () => {
  it('works outside the application (a lab, a test): dark, the default cyan', () => {
    render(
      <PlanDarkTheme>
        <Probe />
      </PlanDarkTheme>,
    );
    expect(screen.getByTestId('p').textContent).toBe('dark|#00E6E4|#001E2C');
  });

  it.each(THEME_ACCENTS.flatMap((a) => (['light', 'dark'] as const).map((m) => [a.label, a.color, m] as const)))(
    '%s (%s) with the app in %s mode: the popovers are dark and follow the accent',
    (_label, color, mode) => {
      render(withPrefs(color, mode));
      const expected = color === DEFAULT_ACCENT_HEX ? CYAN : shiftColor(CYAN, deriveShift(color));
      expect(screen.getByTestId('p').textContent).toBe(`dark|${expected}|#001E2C`);
    },
  );

  it('rebuilds when the accent changes', () => {
    const { rerender } = render(withPrefs('#2563EB', 'dark'));
    const before = screen.getByTestId('p').textContent;
    rerender(withPrefs('#EA580C', 'dark'));
    expect(screen.getByTestId('p').textContent).not.toBe(before);
  });

  it('does not rebuild the theme when only the mode changes (the popovers are dark either way)', () => {
    const { rerender } = render(withPrefs('#7C3AED', 'dark'));
    const before = screen.getByTestId('p').textContent;
    rerender(withPrefs('#7C3AED', 'light'));
    expect(screen.getByTestId('p').textContent).toBe(before);
  });
});
