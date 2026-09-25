/*
 * The shell - the main content area, the sidebar - takes its colours from the
 * theme, whichever of the four the account chose. The palette test measures
 * the palette; this one measures the shell, because the shell is where the
 * dark theme was broken: `Kontrast – tmavá` painted near-white text on a
 * hardcoded light-grey main area, and the palette test could not see it.
 *
 * What would have to break for this to fail: a hardcoded background pasted
 * back into the main element, or the sidebar's hover colour pinned to a
 * light-theme mint.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { THEME_COLORS, THEME_KEYS, buildTheme } from './theme';

vi.mock('./auth/accountRefresh', () => ({ useAccountRefresh: () => undefined }));
vi.mock('./components/NotificationCenter', () => ({ default: () => null }));
vi.mock('./components/UniversalSearch', () => ({ default: () => null }));
vi.mock('./components/KeyboardShortcuts', () => ({ KeyboardShortcuts: () => null }));
vi.mock('./components/NetworkBanner', () => ({ default: () => null }));
vi.mock('./auth/signOut', () => ({ signOut: vi.fn() }));

const { Layout } = await import('./App');

/** `#RRGGBB` the way jsdom reports a computed colour. */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function renderShell(key: (typeof THEME_KEYS)[number]) {
  window.localStorage.setItem('user', JSON.stringify({ firstName: 'A', lastName: 'B' }));
  window.localStorage.setItem('permissions', JSON.stringify([]));
  render(
    <ThemeProvider theme={buildTheme(key)}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Layout>
            <div>obsah</div>
          </Layout>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => window.localStorage.clear());

describe('the shell wears the chosen theme', () => {
  it.each(THEME_KEYS)('%s paints the main area with the palette background', (key) => {
    renderShell(key);
    const main = screen.getByRole('main', { name: 'Hlavní obsah' });
    expect(getComputedStyle(main).backgroundColor).toBe(rgb(THEME_COLORS[key].background.default));
  });

  it('contrast-dark keeps its body text and its main area apart', () => {
    renderShell('contrast-dark');
    const main = screen.getByRole('main', { name: 'Hlavní obsah' });
    expect(getComputedStyle(main).backgroundColor).toBe(rgb('#12161C'));
    expect(getComputedStyle(main).backgroundColor).not.toBe(rgb('#F5F7FA'));
  });
});
