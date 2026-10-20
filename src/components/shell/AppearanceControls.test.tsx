/*
 * The account menu's / the phone sheet's appearance controls. Until now the swatches were hidden in dark mode ("a swatch
 * would do nothing there"); now the accent reaches dark too, so they are offered in both modes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { AppearanceControls, AccountMenu } from './AccountMenu';
import { ThemePrefsProvider } from '../../ThemePrefsProvider';
import { MODE_STORAGE_KEY, ACCENT_STORAGE_KEY } from '../../themePrefs';
import { THEME_ACCENTS } from '../../theme';
import { CYAN, DEFAULT_ACCENT_HEX, deriveShift, shiftColor } from '../../accent';

const ACCENTS = THEME_ACCENTS.map((a) => [a.label, a.color] as const);

function Probe() {
  const t = useTheme();
  return <output data-testid="probe">{`${t.palette.mode}|${t.palette.primary.main}`}</output>;
}

const renderControls = () =>
  render(
    <ThemePrefsProvider>
      <Probe />
      <AppearanceControls />
    </ThemePrefsProvider>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('style');
});

describe.each(['dark', 'light'] as const)('in %s mode', (mode) => {
  beforeEach(() => localStorage.setItem(MODE_STORAGE_KEY, mode));

  it('offers all six swatches', () => {
    renderControls();
    for (const [label] of ACCENTS) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it.each(ACCENTS)('clicking %s (%s) recolours the app now and stores it', async (label, color) => {
    renderControls();
    await userEvent.click(screen.getByRole('button', { name: label }));
    const expected = mode === 'light' ? color : color === DEFAULT_ACCENT_HEX ? CYAN : shiftColor(CYAN, deriveShift(color));
    expect(screen.getByTestId('probe').textContent).toBe(`${mode}|${expected}`);
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe(color);
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
  });

  it('the mode button says what it will switch to, and switches', async () => {
    renderControls();
    const other = mode === 'dark' ? 'Světlý režim' : 'Tmavý režim';
    await userEvent.click(screen.getByRole('button', { name: other }));
    expect(screen.getByTestId('probe').textContent?.startsWith(mode === 'dark' ? 'light' : 'dark')).toBe(true);
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe(mode === 'dark' ? 'light' : 'dark');
  });
});

describe('the account menu', () => {
  it('carries the same controls under Nastavení and above Odhlásit se', async () => {
    render(
      <ThemePrefsProvider>
        <MemoryRouter>
          <button type="button" id="anchor">a</button>
          <AccountMenu anchorEl={document.body} onClose={() => undefined} onOpenSettings={() => undefined} />
        </MemoryRouter>
      </ThemePrefsProvider>,
    );
    expect(await screen.findByRole('menuitem', { name: /Nastavení/ })).toBeInTheDocument();
    expect(screen.getByText('Vzhled')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /zelená|Břidlicová|Tyrkysová|Modrá|Fialová|Oranžová/ })).toHaveLength(6);
    expect(screen.getByRole('menuitem', { name: /Odhlásit se/ })).toBeInTheDocument();
  });

  it('opens settings from the first entry', async () => {
    let opened = 0;
    render(
      <ThemePrefsProvider>
        <MemoryRouter>
          <AccountMenu anchorEl={document.body} onClose={() => undefined} onOpenSettings={() => { opened += 1; }} />
        </MemoryRouter>
      </ThemePrefsProvider>,
    );
    await userEvent.click(await screen.findByRole('menuitem', { name: /Nastavení/ }));
    expect(opened).toBe(1);
  });
});
