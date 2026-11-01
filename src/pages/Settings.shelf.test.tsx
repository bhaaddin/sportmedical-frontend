/*
 * The Administrace page: "Vyžaduje nastavení" from the security lights the app already reads, the light on the security
 * row, and that a person who may not open that screen is never asked for it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { ThemePrefsContext } from '../themePrefs';

const get = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

import Settings from './Settings';

const prefs = { accent: '#0D9488', mode: 'light' as const, setAccent: () => {}, setMode: () => {} };
const show = (path = '/administrace') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemePrefsContext.Provider value={prefs}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/nastaveni" element={<Settings area="daily" />} />
            <Route path="/administrace" element={<Settings area="admin" />} />
          </Routes>
        </MemoryRouter>
      </ThemePrefsContext.Provider>
    </QueryClientProvider>,
  );
const hold = (permissions: string[]) => {
  localStorage.setItem('permissions', JSON.stringify(permissions));
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz' }));
};
const answer = (l: Record<string, string>) =>
  get.mockImplementation((url: string) =>
    url === '/api/system/security/lights' ? Promise.resolve({ data: { backups: 'green', accounts: 'green', environment: 'green', activity: 'green', overall: 'green', ...l } }) : Promise.reject({ response: { status: 404 } }),
  );

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
  hold(['settings.clinic.manage', 'users.manage']);
});

describe.each(Object.entries(VIEWPORTS))('Vyžaduje nastavení at %s (%i px)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('appears first when a light is red, and links to the screen that fixes it', async () => {
    answer({ backups: 'red' });
    show();
    const need = await screen.findByRole('region', { name: 'Vyžaduje nastavení' });
    const link = within(need).getByRole('link', { name: /Zabezpečení a zálohy/ });
    expect(link).toHaveAttribute('href', '/nastaveni/zabezpeceni-a-zalohy');
    expect(link).toHaveTextContent('Problém: Zálohy');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Vyžaduje nastavení');
  });
});

describe('Vyžaduje nastavení, in particular', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('is not drawn when every light is green - and the row shows the state in a word', async () => {
    answer({});
    show();
    const list = await screen.findByRole('region', { name: 'Administrace' });
    await waitFor(() => expect(within(list).getByTestId('security-status-chip')).toHaveTextContent('V pořádku'));
    expect(screen.queryByRole('region', { name: 'Vyžaduje nastavení' })).not.toBeInTheDocument();
  });

  it('is not drawn, and the row carries no light, when the lights cannot be read', async () => {
    get.mockRejectedValue({ response: { status: 503 } });
    show();
    await screen.findByRole('region', { name: 'Administrace' });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/system/security/lights'));
    expect(screen.queryByRole('region', { name: 'Vyžaduje nastavení' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('security-status-chip')).not.toBeInTheDocument();
  });

  it('never asks for the lights for somebody who may not open the security screen', async () => {
    hold(['patients.view']);
    answer({ backups: 'red' });
    show('/nastaveni');
    await screen.findByRole('heading', { level: 1, name: 'Nastavení' });
    expect(get).not.toHaveBeenCalledWith('/api/system/security/lights');
    expect(screen.queryByRole('region', { name: 'Vyžaduje nastavení' })).not.toBeInTheDocument();
  });
});

describe('the pages as one product with Přehled and Pacienti', () => {
  it('Nastavení is a shelf page: one h1, every heading a named region', async () => {
    setViewport(VIEWPORTS.desktop);
    answer({});
    const { container } = show('/nastaveni');
    await screen.findByRole('region', { name: 'Provoz' });
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('[data-shelf-page]')).not.toBeNull();
    for (const s of container.querySelectorAll('section[data-group]')) {
      expect(s.getAttribute('aria-labelledby') ?? s.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
