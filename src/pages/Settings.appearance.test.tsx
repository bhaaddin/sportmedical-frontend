/*
 * Nastavení -> Osobní -> Vzhled: every swatch x every mode, against the REAL provider (state, localStorage, MUI theme,
 * the custom properties on the document root) - not a stub. "Colours must change and all the settings must work":
 * a click must change the palette and the root variables at once, survive a reload, and survive nonsense in storage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import Settings from './Settings';
import { AccentRootVars } from '../AccentRootVars';
import { ThemePrefsProvider } from '../ThemePrefsProvider';
import { DEFAULT_ACCENT, LEGACY_MODE_STORAGE_KEY, MODE_STORAGE_KEY, ACCENT_STORAGE_KEY } from '../themePrefs';
import { THEME_ACCENTS } from '../theme';
import { CYAN, DEFAULT_ACCENT_HEX, accentVariables, deriveShift, lightTints, shiftColor, shiftExpression } from '../accent';
import { setViewport, VIEWPORTS } from '../test/viewport';

const ACCENTS = THEME_ACCENTS.map((a) => [a.label, a.color, a.key] as const);
const NON_DEFAULT = ACCENTS.filter(([, color]) => color !== DEFAULT_ACCENT_HEX);

function Probe() {
  const theme = useTheme();
  return <output data-testid="probe">{`${theme.palette.mode}|${theme.palette.primary.main}`}</output>;
}

function renderApp() {
  return render(
    <ThemePrefsProvider>
      <AccentRootVars />
      <Probe />
      <MemoryRouter initialEntries={['/settings']}>
        <Settings />
      </MemoryRouter>
    </ThemePrefsProvider>,
  );
}

const root = () => document.documentElement;
const rootVar = (name: string) => root().style.getPropertyValue(name);
const probe = () => screen.getByTestId('probe').textContent;
const swatch = (label: string) => screen.getByRole('button', { name: label });

function expectedPrimary(color: string, mode: 'light' | 'dark') {
  return mode === 'light' ? color : shiftColor(CYAN, deriveShift(color));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }));
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'users.manage', 'communication.manage', 'questionnaires.manage']));
  setViewport(VIEWPORTS.desktop);
});
afterEach(() => {
  cleanup();
  root().removeAttribute('style');
  vi.restoreAllMocks();
});

describe('the appearance card', () => {
  it('shows the six swatches named as in the owner\'s screenshot, the forest green pressed, dark as the default', () => {
    renderApp();
    expect(screen.getByText('Barva aplikace')).toBeInTheDocument();
    for (const [label] of ACCENTS) expect(swatch(label)).toBeInTheDocument();
    expect(swatch('Lesní zelená')).toHaveAttribute('aria-pressed', 'true');
    for (const [label] of NON_DEFAULT) expect(swatch(label)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Tmavý' }).className).toMatch(/contained/i);
    expect(probe()).toBe(`dark|${CYAN}`);
  });

  it('draws each swatch in its own colour at 44 x 44 (a touch target)', () => {
    renderApp();
    for (const [label, color] of ACCENTS) {
      const style = getComputedStyle(swatch(label));
      expect(style.width).toBe('44px');
      expect(style.height).toBe('44px');
      expect(style.backgroundColor).toBe(`rgb(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)})`);
    }
  });

  it('puts no accent on the document root for the default accent', () => {
    renderApp();
    expect(rootVar('--sm-hsl')).toBe('');
    expect(rootVar('--sm-accent')).toBe('');
  });
});

describe.each(ACCENTS)('clicking "%s" (%s)', (label, color) => {
  describe.each(['dark', 'light'] as const)('in %s mode', (mode) => {
    const act1 = async () => {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
      renderApp();
      await userEvent.click(swatch(label));
    };

    it('marks only that swatch as pressed', async () => {
      await act1();
      for (const [other] of ACCENTS) expect(swatch(other)).toHaveAttribute('aria-pressed', String(other === label));
    });

    it('changes the MUI palette at once (no reload)', async () => {
      await act1();
      expect(probe()).toBe(`${mode}|${expectedPrimary(color, mode)}`);
    });

    it('stores the choice under sm-theme-accent', async () => {
      await act1();
      expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe(color);
    });

    it('sets (or, for the default, clears) the root variables', async () => {
      await act1();
      const vars = accentVariables(color, mode);
      for (const [name, value] of Object.entries(vars)) expect(rootVar(name)).toBe(value ?? '');
      if (color !== DEFAULT_ACCENT_HEX) expect(rootVar('--sm-hsl')).toBe(shiftExpression(deriveShift(color)));
    });

    it('is read back after a reload', async () => {
      await act1();
      cleanup();
      root().removeAttribute('style');
      renderApp();
      expect(swatch(label)).toHaveAttribute('aria-pressed', 'true');
      expect(probe()).toBe(`${mode}|${expectedPrimary(color, mode)}`);
      expect(rootVar('--sm-accent')).toBe(accentVariables(color, mode)['--sm-accent'] ?? '');
    });
  });
});

describe('switching between the accents', () => {
  it('goes through all six and back to the default without leaving anything of the previous one on the root', async () => {
    renderApp();
    for (const [label, color] of NON_DEFAULT) {
      await userEvent.click(swatch(label));
      expect(rootVar('--sm-hsl')).toBe(shiftExpression(deriveShift(color)));
    }
    await userEvent.click(swatch('Lesní zelená'));
    for (const name of Object.keys(accentVariables(DEFAULT_ACCENT_HEX, 'dark'))) expect(rootVar(name)).toBe('');
    expect(probe()).toBe(`dark|${CYAN}`);
  });

  it('five different clicks give five different primaries in each mode', async () => {
    renderApp();
    for (const mode of ['Tmavý', 'Světlý']) {
      await userEvent.click(screen.getByRole('button', { name: mode }));
      const seen = new Set<string>();
      for (const [label] of ACCENTS) {
        await userEvent.click(swatch(label));
        seen.add(probe()!);
      }
      expect(seen.size).toBe(6);
    }
  });
});

describe('the mode buttons', () => {
  it('Světlý switches the palette and the tints, Tmavý switches them back, the accent stays', async () => {
    renderApp();
    await userEvent.click(swatch('Oranžová'));
    expect(rootVar('--sm-tint-hover')).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Světlý' }));
    expect(probe()).toBe('light|#EA580C');
    expect(rootVar('--sm-tint-hover')).toBe(lightTints('#EA580C').hover);
    expect(rootVar('--sm-on-accent')).toBe('#1A1D21');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('light');
    await userEvent.click(screen.getByRole('button', { name: 'Tmavý' }));
    expect(probe()).toBe(`dark|${shiftColor(CYAN, deriveShift('#EA580C'))}`);
    expect(rootVar('--sm-tint-hover')).toBe('');
    expect(localStorage.getItem(MODE_STORAGE_KEY)).toBe('dark');
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('#EA580C');
  });

  it('shows the active mode as the contained button, in both directions', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Světlý' }));
    expect(screen.getByRole('button', { name: 'Světlý' }).className).toMatch(/contained/i);
    expect(screen.getByRole('button', { name: 'Tmavý' }).className).toMatch(/outlined/i);
    await userEvent.click(screen.getByRole('button', { name: 'Tmavý' }));
    expect(screen.getByRole('button', { name: 'Tmavý' }).className).toMatch(/contained/i);
  });

  it('clicking the active mode again changes nothing', async () => {
    renderApp();
    const before = probe();
    await userEvent.click(screen.getByRole('button', { name: 'Tmavý' }));
    expect(probe()).toBe(before);
  });

  it('light is remembered across a reload; so is dark after light', async () => {
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Světlý' }));
    cleanup();
    renderApp();
    expect(probe()).toBe(`light|${DEFAULT_ACCENT_HEX}`);
    await userEvent.click(screen.getByRole('button', { name: 'Tmavý' }));
    cleanup();
    renderApp();
    expect(probe()).toBe(`dark|${CYAN}`);
  });

  it('a browser that has never chosen starts dark, and the pre-v2 "light" key is dropped, not obeyed', () => {
    localStorage.setItem(LEGACY_MODE_STORAGE_KEY, 'light');
    renderApp();
    expect(probe()).toBe(`dark|${CYAN}`);
    expect(localStorage.getItem(LEGACY_MODE_STORAGE_KEY)).toBeNull();
  });
});

describe('what is in storage when the app opens', () => {
  it.each([
    ['nothing', null],
    ['an empty string', ''],
    ['a colour name', 'orange'],
    ['not hex', '0D5C52'],
    ['a short hex', '#12'],
    ['an rgb()', 'rgb(1, 2, 3)'],
    ['white (invisible as a button)', '#FFFFFF'],
    ['a script', '<script>alert(1)</script>'],
    ['JSON', '{"color":"#EA580C"}'],
  ])('%s falls back to the default accent and a working palette', (_name, stored) => {
    if (stored !== null) localStorage.setItem(ACCENT_STORAGE_KEY, stored);
    renderApp();
    expect(swatch('Lesní zelená')).toHaveAttribute('aria-pressed', 'true');
    expect(probe()).toBe(`dark|${CYAN}`);
    expect(rootVar('--sm-hsl')).toBe('');
  });

  it.each([
    ['upper case', '#EA580C'],
    ['lower case', '#ea580c'],
    ['padded', '  #EA580C '],
  ])('a valid accent (%s) is honoured and shown as the Oranžová swatch', (_name, stored) => {
    localStorage.setItem(ACCENT_STORAGE_KEY, stored);
    renderApp();
    expect(swatch('Oranžová')).toHaveAttribute('aria-pressed', 'true');
    expect(rootVar('--sm-hsl')).toBe(shiftExpression(deriveShift('#EA580C')));
  });

  it.each([
    ['junk', 'purple'],
    ['empty', ''],
    ['uppercase junk', 'LIGHT '],
  ])('a stored mode that is %s is the dark default', (_name, stored) => {
    localStorage.setItem(MODE_STORAGE_KEY, stored);
    renderApp();
    expect(probe()).toBe(`dark|${CYAN}`);
  });

  it('the old teal that earlier builds offered still works, though it has no swatch', () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, '#0D7377');
    renderApp();
    expect(probe()).toBe(`dark|${shiftColor(CYAN, deriveShift('#0D7377'))}`);
    for (const [label] of ACCENTS) expect(swatch(label)).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('a browser that refuses storage (private mode)', () => {
  it('still changes the look for this visit', async () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === ACCENT_STORAGE_KEY || key === MODE_STORAGE_KEY) throw new DOMException('denied', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    renderApp();
    await userEvent.click(swatch('Modrá'));
    expect(probe()).toBe(`dark|${shiftColor(CYAN, deriveShift('#2563EB'))}`);
    await userEvent.click(screen.getByRole('button', { name: 'Světlý' }));
    expect(probe()).toBe('light|#2563EB');
  });

  it('opens on the defaults when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    renderApp();
    expect(probe()).toBe(`dark|${CYAN}`);
  });
});

describe('two tabs', () => {
  it('a choice made in another tab moves this one (storage event)', async () => {
    renderApp();
    localStorage.setItem(ACCENT_STORAGE_KEY, '#7C3AED');
    localStorage.setItem(MODE_STORAGE_KEY, 'light');
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: ACCENT_STORAGE_KEY, newValue: '#7C3AED' }));
      window.dispatchEvent(new StorageEvent('storage', { key: MODE_STORAGE_KEY, newValue: 'light' }));
    });
    expect(probe()).toBe('light|#7C3AED');
    expect(swatch('Fialová')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clearing storage in another tab (key null) returns this one to the defaults', async () => {
    localStorage.setItem(ACCENT_STORAGE_KEY, '#7C3AED');
    renderApp();
    localStorage.clear();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(probe()).toBe(`dark|${CYAN}`);
  });

  it('ignores the storage events of unrelated keys', async () => {
    renderApp();
    await userEvent.click(swatch('Modrá'));
    const before = probe();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: 'x' }));
    });
    expect(probe()).toBe(before);
  });
});

describe('leaving the staff app', () => {
  it('removes every accent variable when the staff-only component unmounts (portals keep their own look)', async () => {
    const { unmount } = render(
      <ThemePrefsProvider>
        <AccentRootVars />
      </ThemePrefsProvider>,
    );
    localStorage.setItem(ACCENT_STORAGE_KEY, '#EA580C');
    unmount();
    localStorage.setItem(ACCENT_STORAGE_KEY, '#EA580C');
    const second = render(
      <ThemePrefsProvider>
        <AccentRootVars />
      </ThemePrefsProvider>,
    );
    expect(rootVar('--sm-hsl')).not.toBe('');
    second.unmount();
    expect(rootVar('--sm-hsl')).toBe('');
    expect(rootVar('--sm-accent')).toBe('');
    expect(rootVar('--sm-soft-bg')).toBe('');
  });

  it('a provider without AccentRootVars never touches the root', async () => {
    render(
      <ThemePrefsProvider>
        <Probe />
      </ThemePrefsProvider>,
    );
    expect(rootVar('--sm-hsl')).toBe('');
  });
});

describe('keyboard', () => {
  it('a swatch is a real button that Enter and Space activate', async () => {
    renderApp();
    swatch('Fialová').focus();
    await userEvent.keyboard('{Enter}');
    expect(swatch('Fialová')).toHaveAttribute('aria-pressed', 'true');
    swatch('Modrá').focus();
    await userEvent.keyboard(' ');
    expect(swatch('Modrá')).toHaveAttribute('aria-pressed', 'true');
    expect(swatch('Fialová')).toHaveAttribute('aria-pressed', 'false');
  });

  it('every swatch is reachable by Tab and none is a link', () => {
    renderApp();
    for (const [label] of ACCENTS) {
      expect(swatch(label).tagName).toBe('BUTTON');
      expect(swatch(label)).toHaveAttribute('type', 'button');
      expect(swatch(label).tabIndex).toBe(0);
    }
  });

  it('fireEvent click without pointer events works too (touch)', () => {
    renderApp();
    fireEvent.click(swatch('Tyrkysová'));
    expect(swatch('Tyrkysová')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('the default constant', () => {
  it('DEFAULT_ACCENT is the forest swatch the identity shift belongs to', () => {
    expect(DEFAULT_ACCENT).toBe(DEFAULT_ACCENT_HEX);
    expect(THEME_ACCENTS[0].color).toBe(DEFAULT_ACCENT);
  });
});
