/*
 * Nastavení and Administrace for people with limited rights: who is offered which row, what the search finds, and the
 * personal part at the foot (account read-only, sign-out).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { ThemePrefsContext } from '../themePrefs';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('../auth/signOut', () => ({ signOut }));
const get = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

import Settings from './Settings';

const prefs = { accent: '#0D9488', mode: 'light' as const, setAccent: () => {}, setMode: () => {} };
const show = (path: string) =>
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
const hold = (permissions: string[], user: Record<string, unknown> = { firstName: 'Jana', lastName: 'Nová', email: 'jana@ordinace.cz', role: 'Staff' }) => {
  localStorage.setItem('permissions', JSON.stringify(permissions));
  localStorage.setItem('user', JSON.stringify(user));
};
const hrefs = (region: HTMLElement) => within(region).getAllByRole('link').map((a) => a.getAttribute('href'));

beforeEach(() => {
  localStorage.clear();
  signOut.mockReset().mockResolvedValue(undefined);
  get.mockReset().mockRejectedValue({ response: { status: 404 } });
  setViewport(VIEWPORTS.desktop);
});

describe('Komunikace a dokumenty on Nastavení', () => {
  it('for an owner lists the messages, the questionnaire and the document templates', async () => {
    hold(['settings.clinic.manage', 'communication.manage', 'questionnaires.manage']);
    show('/nastaveni');
    const region = await screen.findByRole('region', { name: 'Komunikace a dokumenty' });
    expect(hrefs(region)).toEqual(['/nastaveni/zpravy', '/dotaznik-nastaveni', '/dokumenty-sablony']);
  });

  it('for somebody with only communication.manage lists the messages alone', async () => {
    hold(['communication.manage']);
    show('/nastaveni');
    expect(hrefs(await screen.findByRole('region', { name: 'Komunikace a dokumenty' }))).toEqual(['/nastaveni/zpravy']);
  });

  it('for somebody with only questionnaires.manage lists the questionnaire alone', async () => {
    hold(['questionnaires.manage']);
    show('/nastaveni');
    expect(hrefs(await screen.findByRole('region', { name: 'Komunikace a dokumenty' }))).toEqual(['/dotaznik-nastaveni']);
  });

  it('for a receptionist has no such heading at all', async () => {
    hold(['patients.view', 'bookings.create']);
    show('/nastaveni');
    await screen.findByRole('link', { name: /Můj účet a zabezpečení/ });
    expect(screen.queryByRole('heading', { name: 'Komunikace a dokumenty' })).toBeNull();
  });
});

describe('Administrace for people with limited rights', () => {
  it('for somebody who only manages users lists the team', async () => {
    hold(['users.manage']);
    show('/administrace');
    expect(hrefs(await screen.findByRole('region', { name: 'Administrace' }))).toEqual(['/staff-management']);
  });

  it('for settings.clinic.manage lists everything except the team', async () => {
    hold(['settings.clinic.manage']);
    show('/administrace');
    const list = hrefs(await screen.findByRole('region', { name: 'Administrace' }));
    expect(list).not.toContain('/staff-management');
    expect(list).toEqual(expect.arrayContaining(['/nastaveni/firma-a-faktury', '/nastaveni/media-a-texty', '/nastaveni/uloziste-medii', '/audit-log', '/system-health']));
  });

  it('every row is a large link with its name and what is inside', async () => {
    hold(['settings.clinic.manage']);
    show('/administrace');
    const link = within(await screen.findByRole('region', { name: 'Administrace' })).getByRole('link', { name: /Firma a faktury/ });
    expect(link).toHaveTextContent('Fakturační údaje firmy, bankovní účet, datová schránka a splatnost faktur');
  });
});

describe('search for somebody with limited rights', () => {
  it('finds only what she may open', async () => {
    hold(['communication.manage']);
    show('/nastaveni');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'faktur');
    expect(screen.queryByRole('link', { name: /Firma a faktury/ })).toBeNull();
  });

  it('finds the messages for the person who may edit them', async () => {
    hold(['communication.manage']);
    show('/nastaveni');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'sms');
    expect(screen.getByRole('link', { name: /Zprávy/ })).toHaveAttribute('href', '/nastaveni/zpravy');
  });

  it('finds the account screen by "heslo" for everybody', async () => {
    hold([]);
    show('/nastaveni');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'heslo');
    expect(screen.getByRole('link', { name: /Můj účet a zabezpečení/ })).toHaveAttribute('href', '/nastaveni/zabezpeceni');
  });

  it('counts nothing it should not: every hit is a row of the list', async () => {
    hold(['settings.clinic.manage', 'users.manage', 'communication.manage', 'questionnaires.manage']);
    show('/nastaveni');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'dokument');
    const results = screen.getByRole('region', { name: 'Výsledky hledání' });
    expect(within(results).getAllByRole('listitem').length).toBeGreaterThan(2);
  });

  it('ignores a search of only spaces and keeps the headings', async () => {
    hold(['settings.clinic.manage']);
    show('/nastaveni');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), '   ');
    expect(screen.getByRole('heading', { level: 2, name: 'Provoz' })).toBeInTheDocument();
  });
});

describe('Vzhled aplikace a odhlášení (the personal part)', () => {
  const open = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /Vzhled aplikace a odhlášení/ }));
  };

  it('shows the name and the e-mail of the signed-in person, read-only', async () => {
    hold(['patients.view']);
    show('/nastaveni');
    await open();
    const card = (await screen.findByText('Můj účet')).closest('div') as HTMLElement;
    const section = card.parentElement as HTMLElement;
    expect(within(section).getByText('Jana Nová')).toBeInTheDocument();
    expect(within(section).getByText('jana@ordinace.cz')).toBeInTheDocument();
    expect(within(section).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(section).getByText(/Jméno a e-mail mění správce/)).toBeInTheDocument();
  });

  it('says "Přihlášený uživatel" when the stored account has no name', async () => {
    hold([], { email: 'x@y.cz' });
    show('/nastaveni');
    await open();
    expect(await screen.findByText('Přihlášený uživatel')).toBeInTheDocument();
  });

  it('survives a damaged stored account', async () => {
    localStorage.setItem('permissions', '[]');
    localStorage.setItem('user', '{broken');
    show('/nastaveni');
    await open();
    expect(await screen.findByText('Přihlášený uživatel')).toBeInTheDocument();
  });

  it('signs out through the one sign-out routine', async () => {
    hold(['patients.view']);
    show('/nastaveni');
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Odhlásit se' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('a session older than the permission list', () => {
  it('says so instead of drawing a gutted page', async () => {
    localStorage.setItem('user', JSON.stringify({ firstName: 'Jana' }));
    show('/nastaveni');
    expect(await screen.findByText(/Přihlášení je starší než nastavení oprávnění/)).toBeInTheDocument();
  });
});

describe.each(Object.entries(VIEWPORTS))('the pages at %s (%i px)', (_name, width) => {
  it('draw the headings of Nastavení and the list of Administrace', async () => {
    setViewport(width);
    hold(['settings.clinic.manage', 'users.manage', 'questionnaires.manage', 'communication.manage']);
    show('/nastaveni');
    expect(await screen.findByRole('heading', { level: 2, name: 'Komunikace a dokumenty' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Kluby' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Uživatelé a práva/ })).toBeNull();
  });
});
