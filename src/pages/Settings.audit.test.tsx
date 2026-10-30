/*
 * The hub and the group pages of the second half of Nastavení: who is offered which row, what the search finds for
 * somebody with limited rights, and the "Osobní" section (account read-only, sign-out). The Vzhled card is not tested here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { ThemePrefsContext } from '../themePrefs';

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('../auth/signOut', () => ({ signOut }));

import Settings from './Settings';

const prefs = { accent: '#0D9488', mode: 'light' as const, setAccent: () => {}, setMode: () => {} };
const show = (path: string) =>
  render(
    <ThemePrefsContext.Provider value={prefs}>
      <MemoryRouter initialEntries={[path]}>
        <Settings />
      </MemoryRouter>
    </ThemePrefsContext.Provider>,
  );
const hold = (permissions: string[], user: Record<string, unknown> = { firstName: 'Jana', lastName: 'Nová', email: 'jana@ordinace.cz', role: 'Staff' }) => {
  localStorage.setItem('permissions', JSON.stringify(permissions));
  localStorage.setItem('user', JSON.stringify(user));
};
/* A group page has one shelf, "Položky": its screens. */
const rows = (_group: string) => within(screen.getByRole('list', { name: 'Položky' })).getAllByRole('link').map((a) => a.getAttribute('href'));

beforeEach(() => {
  localStorage.clear();
  signOut.mockReset().mockResolvedValue(undefined);
  setViewport(VIEWPORTS.desktop);
});

describe('the group pages of the second half', () => {
  it('Komunikace for an owner lists the three screens', async () => {
    hold(['settings.clinic.manage', 'communication.manage']);
    show('/settings/komunikace');
    await screen.findByRole('heading', { level: 1, name: 'Komunikace' });
    expect(rows('Komunikace')).toEqual(['/nastaveni/zpravy', '/nastaveni/fronta-emailu', '/hodnoceni-pacientu']);
  });

  it('Komunikace for somebody with only communication.manage lists the messages and the reviews', async () => {
    hold(['communication.manage']);
    show('/settings/komunikace');
    await screen.findByRole('heading', { level: 1, name: 'Komunikace' });
    expect(rows('Komunikace')).toEqual(['/nastaveni/zpravy', '/hodnoceni-pacientu']);
  });

  it('Dokumenty for somebody with only questionnaires.manage lists the questionnaire alone', async () => {
    hold(['questionnaires.manage']);
    show('/settings/dokumenty');
    await screen.findByRole('heading', { level: 1, name: 'Dokumenty' });
    expect(rows('Dokumenty')).toEqual(['/dotaznik-nastaveni']);
  });

  it('Dokumenty for settings.clinic.manage lists everything except the questionnaire', async () => {
    hold(['settings.clinic.manage']);
    show('/settings/dokumenty');
    await screen.findByRole('heading', { level: 1, name: 'Dokumenty' });
    expect(rows('Dokumenty')).toEqual(['/nastaveni/souhlasy', '/dokumenty-sablony', '/pravidla-dokumentu', '/nastaveni/udaje-pacienta', '/nastaveni/rychla-registrace', '/nastaveni/odkaz-registrace']);
  });

  it('Systém for somebody who only manages users lists the team and the security screen', async () => {
    hold(['users.manage']);
    show('/settings/system');
    await screen.findByRole('heading', { level: 1, name: 'Systém' });
    expect(rows('Systém')).toEqual(['/staff-management', '/nastaveni/zabezpeceni']);
  });

  it('Systém for a receptionist lists only her own security screen', async () => {
    hold(['patients.view', 'bookings.create']);
    show('/settings/system');
    await screen.findByRole('heading', { level: 1, name: 'Systém' });
    expect(rows('Systém')).toEqual(['/nastaveni/zabezpeceni']);
  });

  it('Vzhled webu is closed to somebody without settings.clinic.manage, and says so', async () => {
    hold(['communication.manage']);
    show('/settings/vzhled-webu');
    expect(await screen.findByText(/V téhle skupině pro vás zatím není nic/)).toBeInTheDocument();
  });

  it('Vzhled webu for settings.clinic.manage lists the media screen and the storage', async () => {
    hold(['settings.clinic.manage']);
    show('/settings/vzhled-webu');
    await screen.findByRole('heading', { level: 1, name: 'Vzhled webu' });
    expect(rows('Vzhled webu')).toEqual(['/nastaveni/media-a-texty', '/nastaveni/uloziste-medii']);
  });

  it('every row is a large link with its name and what is inside', async () => {
    hold(['settings.clinic.manage']);
    show('/settings/system');
    await screen.findByRole('heading', { level: 1, name: 'Systém' });
    const list = screen.getByRole('list', { name: 'Položky' });
    const link = within(list).getByRole('link', { name: /Firma a faktury/ });
    expect(link).toHaveTextContent('Fakturační údaje firmy, bankovní účet, datová schránka a splatnost faktur');
  });
});

describe('search on the hub for somebody with limited rights', () => {
  it('finds only what she may open', async () => {
    hold(['communication.manage']);
    show('/settings');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'faktur');
    expect(screen.queryByRole('link', { name: /Firma a faktury/ })).toBeNull();
  });

  it('finds the templates for the person who may edit them', async () => {
    hold(['communication.manage']);
    show('/settings');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'sms');
    expect(screen.getByRole('link', { name: /Zprávy/ })).toHaveAttribute('href', '/nastaveni/zpravy');
  });

  it('finds the two-factor screen by "heslo" for everybody', async () => {
    hold([]);
    show('/settings');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'heslo');
    expect(screen.getByRole('link', { name: /Zabezpečení/ })).toHaveAttribute('href', '/nastaveni/zabezpeceni');
  });

  it('counts the hits', async () => {
    hold(['settings.clinic.manage', 'users.manage', 'communication.manage', 'questionnaires.manage']);
    show('/settings');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), 'dokument');
    const results = screen.getByRole('region', { name: 'Výsledky hledání' });
    const count = within(results).getByLabelText(/^Počet: \d+$/);
    expect(Number(count.textContent)).toBe(within(results).getAllByRole('listitem').length);
  });

  it('ignores a search of only spaces and keeps the tiles', async () => {
    hold(['settings.clinic.manage']);
    show('/settings');
    await userEvent.type(await screen.findByLabelText('Hledat v nastavení'), '   ');
    expect(screen.getByRole('link', { name: 'Celá skupina: Systém' })).toBeInTheDocument();
  });
});

describe('Osobní: Můj účet', () => {
  it('shows the name and the e-mail of the signed-in person, read-only', async () => {
    hold(['patients.view']);
    show('/settings');
    const card = (await screen.findByText('Můj účet')).closest('div') as HTMLElement;
    const section = card.parentElement as HTMLElement;
    expect(within(section).getByText('Jana Nová')).toBeInTheDocument();
    expect(within(section).getByText('jana@ordinace.cz')).toBeInTheDocument();
    expect(within(section).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(section).getByText(/Jméno a e-mail mění správce/)).toBeInTheDocument();
  });

  it('says "Přihlášený uživatel" when the stored account has no name', async () => {
    hold([], { email: 'x@y.cz' });
    show('/settings');
    expect(await screen.findByText('Přihlášený uživatel')).toBeInTheDocument();
  });

  it('survives a damaged stored account', async () => {
    localStorage.setItem('permissions', '[]');
    localStorage.setItem('user', '{broken');
    show('/settings');
    expect(await screen.findByText('Přihlášený uživatel')).toBeInTheDocument();
  });

  it('signs out through the one sign-out routine', async () => {
    hold(['patients.view']);
    show('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Odhlásit se' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('a session older than the permission list', () => {
  it('says so instead of drawing a gutted hub', async () => {
    localStorage.setItem('user', JSON.stringify({ firstName: 'Jana' }));
    show('/settings');
    expect(await screen.findByText(/Přihlášení je starší než nastavení oprávnění/)).toBeInTheDocument();
  });
});

describe.each(Object.entries(VIEWPORTS))('the hub at %s (%i px)', (_name, width) => {
  it('draws a link per visible group', async () => {
    setViewport(width);
    hold(['settings.clinic.manage', 'users.manage']);
    show('/settings');
    expect(await screen.findByRole('link', { name: 'Celá skupina: Dokumenty' })).toHaveAttribute('href', '/settings/dokumenty');
    expect(screen.getByRole('link', { name: 'Celá skupina: Vzhled webu' })).toHaveAttribute('href', '/settings/vzhled-webu');
    expect(screen.getByRole('link', { name: 'Celá skupina: Systém' })).toHaveAttribute('href', '/settings/system');
  });
});
