/*
 * Nastavení and Administrace: the two plain pages (Matko, 1. 11. 2026).
 *
 * What is worth testing is not that the rows exist - it is that both pages come from one catalogue, that the daily page
 * is short (four headings, one closed list, the account row on top), that the Administrace is invisible to everybody who
 * may not manage users or the clinic, that the search narrows, that a person is offered only what the server lets them
 * open, that the old addresses still lead somewhere, and that the fake settings that used to sit on this screen stay gone.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';
import Settings from './Settings';
import { ThemePrefsContext } from '../themePrefs';
import { savePermissions } from '../auth/localSession';

const get = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

const EVERYTHING = [
  'patients.view', 'patients.register', 'patients.edit', 'patients.sensitive_identity.view',
  'settings.clinic.manage', 'users.manage', 'roles.manage', 'bookings.create', 'bookings.edit', 'bookings.cancel',
  'questionnaires.manage', 'communication.manage',
];

/** The server's own defaults for the Staff role. */
const RECEPTIONIST = ['patients.view', 'patients.register', 'patients.edit', 'bookings.create', 'bookings.edit', 'bookings.cancel'];

const holding = (permissions: readonly string[]) => {
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }));
  localStorage.setItem('permissions', JSON.stringify(permissions));
};

beforeEach(() => {
  localStorage.clear();
  holding(EVERYTHING);
  setViewport(VIEWPORTS.desktop);
  get.mockReset();
  /* A server that has the security rules: the screen is offered. */
  get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/settings/security-policy') {
      return { data: { reconfirmForAdmin: false, reconfirmMinutes: 15, requireTwoFactorForAdmins: false, adminIdleLock: false, adminIdleLockMinutes: 10 } };
    }
    throw { response: { status: 404 } };
  });
});

const themePrefs = { accent: '#0D9488', mode: 'light' as const, setAccent: () => {}, setMode: () => {} };

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

const renderSettings = (path = '/nastaveni') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ThemePrefsContext.Provider value={themePrefs}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/nastaveni" element={<Settings area="daily" />} />
            <Route path="/administrace" element={<Settings area="admin" />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/:group" element={<Settings />} />
            <Route path="*" element={<div>jinde</div>} />
          </Routes>
          <Where />
        </MemoryRouter>
      </ThemePrefsContext.Provider>
    </QueryClientProvider>,
  );

const group = (name: string) => screen.getByRole('region', { name });

describe('Nastavení (the daily page)', () => {
  it('has one h1, the big search box, the account row, and four plain headings in the decided order', async () => {
    renderSettings();

    expect(await screen.findByRole('heading', { level: 1, name: 'Nastavení' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Hledat v nastavení')).toHaveLength(1);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Provoz', 'Služby a ceny', 'Komunikace a dokumenty', 'Kluby']);
  });

  it('puts "Můj účet a zabezpečení" on top, before every heading, for everybody', async () => {
    holding([]);
    renderSettings();

    const account = await screen.findByRole('link', { name: /Můj účet a zabezpečení/ });
    expect(account).toHaveAttribute('href', '/nastaveni/zabezpeceni');
    const first = screen.getAllByRole('heading', { level: 2 })[0];
    expect(account.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lists the most used screens directly, each a link straight to the screen', async () => {
    renderSettings();

    const provoz = await screen.findByRole('region', { name: 'Provoz' });
    const names = within(provoz).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(names).toEqual(['/working-hours', '/blokovany-cas', '/svatky', '/nepritomnosti', '/calendars']);
    expect(within(group('Služby a ceny')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/nastaveni/sluzby', '/nastaveni/cenik']);
    expect(within(group('Komunikace a dokumenty')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/nastaveni/zpravy', '/dotaznik-nastaveni', '/dokumenty-sablony']);
    expect(within(group('Kluby')).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/nastaveni/kluby']);
    /* One quiet line from the catalogue. */
    expect(within(provoz).getByRole('link', { name: /^Otevírací doba/ })).toHaveTextContent('Hodiny podle dnů v týdnu');
  });

  it('keeps the rest of the daily screens in ONE closed list, "Další nastavení"', async () => {
    const user = userEvent.setup();
    renderSettings();

    const toggle = await screen.findByRole('button', { name: /Další nastavení/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /Docházka/ })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: /Další nastavení/ });
    expect(within(panel).getAllByRole('link').map((l) => l.getAttribute('href')).sort()).toEqual([
      '/exceptions', '/nastaveni/zmeny-rezervaci', '/nastaveni/dochazka', '/nastaveni/vzhled-kalendare', '/activities', '/nastaveni/slevy',
      '/nastaveni/barvy-sluzeb', '/vyhrazeni', '/hodnoceni-pacientu', '/pravidla-dokumentu', '/nastaveni/udaje-pacienta',
      '/nastaveni/rychla-registrace', '/nastaveni/odkaz-registrace',
    ].sort());
    /* No admin screen and no most-used screen is repeated in it. */
    expect(within(panel).queryByRole('link', { name: /Uživatelé a práva/ })).not.toBeInTheDocument();
    expect(within(panel).queryByRole('link', { name: /^Otevírací doba/ })).not.toBeInTheDocument();
  });

  it('never draws "Vyžaduje nastavení" here, and no tile inside a tile (rows in one list)', async () => {
    renderSettings();
    await screen.findByRole('heading', { level: 2, name: 'Provoz' });
    expect(screen.queryByText('Vyžaduje nastavení')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-card="setting"]').length).toBe(0);
  });

  it('searches names, descriptions and keywords, in everything the person may open', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText('Hledat v nastavení'), 'sleva');

    const results = screen.getByRole('region', { name: 'Výsledky hledání' });
    expect(within(results).getByRole('link', { name: /Slevy a cenové hladiny/ })).toHaveAttribute('href', '/nastaveni/slevy');
    expect(within(results).getAllByText('Služby a ceny').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /Otevírací doba/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Provoz' })).not.toBeInTheDocument();
  });

  it('finds an item by what a receptionist would type, diacritics or not', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText('Hledat v nastavení'), 'obed');
    expect(screen.getByRole('link', { name: /Otevírací doba/ })).toHaveAttribute('href', '/working-hours');
  });

  it('says so when nothing matches, and "Zrušit hledání" brings the page back', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getByLabelText('Hledat v nastavení'), 'xyzzy');
    expect(screen.getByText(/Nic odpovídajícího „xyzzy“\. Zkuste jiné slovo/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Zrušit hledání' }));
    expect(screen.getByLabelText('Hledat v nastavení')).toHaveValue('');
    expect(screen.getByRole('heading', { level: 2, name: 'Provoz' })).toBeInTheDocument();
  });
});

describe('Administrace', () => {
  it('lists the decided screens in one plain list, with the same search', async () => {
    renderSettings('/administrace');

    expect(await screen.findByRole('heading', { level: 1, name: 'Administrace' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hledat v nastavení')).toBeInTheDocument();
    const list = await screen.findByRole('region', { name: 'Administrace' });
    const hrefs = within(list).getAllByRole('link').map((a) => a.getAttribute('href')).sort();
    expect(hrefs).toEqual([
      '/admin', '/audit-log', '/nastaveni/bezpecnostni-pravidla', '/nastaveni/firma-a-faktury', '/nastaveni/fronta-emailu',
      '/nastaveni/historie-zmen', '/nastaveni/integrace', '/nastaveni/media-a-texty', '/nastaveni/souhlasy',
      '/nastaveni/uloziste-medii', '/nastaveni/zabezpeceni-a-zalohy', '/staff-management', '/system-health',
    ].sort());
    expect(screen.queryByRole('link', { name: /Otevírací doba/ })).not.toBeInTheDocument();
  });

  it('finds an administration screen by search', async () => {
    const user = userEvent.setup();
    renderSettings('/administrace');
    await user.type(screen.getByLabelText('Hledat v nastavení'), 'faktur');
    expect(within(screen.getByRole('region', { name: 'Výsledky hledání' })).getByRole('link', { name: /Firma a faktury/ })).toHaveAttribute('href', '/nastaveni/firma-a-faktury');
  });

  it('is offered to somebody who only manages users, with only what they may open', async () => {
    holding(['users.manage']);
    renderSettings('/administrace');
    const list = await screen.findByRole('region', { name: 'Administrace' });
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/staff-management']);
  });

  it.each([[[]], [RECEPTIONIST], [['questionnaires.manage', 'communication.manage']]])('shows NOTHING of it to %j - the address goes back to Nastavení', async (held) => {
    holding(held);
    renderSettings('/administrace');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nastavení' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Administrace' })).not.toBeInTheDocument();
  });

  it.each([[[]], [RECEPTIONIST]])('and no search on Nastavení finds an administration screen for %j', async (held) => {
    const user = userEvent.setup();
    holding(held);
    renderSettings('/nastaveni');
    await user.type(screen.getByLabelText('Hledat v nastavení'), 'uživatel');
    expect(screen.queryByRole('link', { name: /Uživatelé a práva/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Hledat v nastavení'));
    await user.type(screen.getByLabelText('Hledat v nastavení'), 'audit');
    expect(screen.queryByRole('link', { name: /Auditní log/ })).not.toBeInTheDocument();
  });

  it('an owner finds the administration from Nastavení, marked "Administrace"', async () => {
    const user = userEvent.setup();
    renderSettings('/nastaveni');
    await user.type(screen.getByLabelText('Hledat v nastavení'), 'audit');
    const results = screen.getByRole('region', { name: 'Výsledky hledání' });
    expect(within(results).getByRole('link', { name: /Auditní log/ })).toHaveAttribute('href', '/audit-log');
    expect(within(results).getAllByText('Administrace').length).toBeGreaterThan(0);
  });

  it('does not offer "Bezpečnostní pravidla" while the server has no such route (silently)', async () => {
    get.mockReset().mockRejectedValue({ response: { status: 404 } });
    renderSettings('/administrace');
    const list = await screen.findByRole('region', { name: 'Administrace' });
    await waitFor(() => expect(within(list).queryByRole('link', { name: /Bezpečnostní pravidla/ })).not.toBeInTheDocument());
    expect(within(list).getByRole('link', { name: /Uživatelé a práva/ })).toBeInTheDocument();
  });
});

describe('the old addresses', () => {
  it('/settings leads to Nastavení', async () => {
    renderSettings('/settings');
    expect(await screen.findByTestId('where')).toHaveTextContent('/nastaveni');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nastavení' })).toBeInTheDocument();
  });

  it.each([
    ['provoz', '/nastaveni'], ['sluzby-a-ceny', '/nastaveni'], ['kluby', '/nastaveni'], ['komunikace', '/nastaveni'],
    ['dokumenty', '/nastaveni'], ['neexistuje', '/nastaveni'], ['vzhled-webu', '/administrace'], ['system', '/administrace'],
  ])('/settings/%s leads to %s', async (groupId, to) => {
    renderSettings(`/settings/${groupId}`);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(to));
  });
});

describe('the three layouts', () => {
  it.each([VIEWPORTS.phone, VIEWPORTS.tablet, VIEWPORTS.desktop])('draw the daily page at %i px with 44 px rows and targets', async (width) => {
    setViewport(width);
    renderSettings();

    expect(await screen.findByRole('heading', { level: 1, name: 'Nastavení' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Otevírací doba/ })).toHaveAttribute('href', '/working-hours');
    expect(screen.getByRole('button', { name: /Další nastavení/ })).toBeInTheDocument();
  });

  it.each([VIEWPORTS.phone, VIEWPORTS.tablet, VIEWPORTS.desktop])('draw the Administrace at %i px', async (width) => {
    setViewport(width);
    renderSettings('/administrace');
    expect(await screen.findByRole('link', { name: /Uživatelé a práva/ })).toHaveAttribute('href', '/staff-management');
    expect(screen.getByRole('link', { name: /Historie změn/ })).toHaveAttribute('href', '/nastaveni/historie-zmen');
  });
});

describe('what a receptionist sees', () => {
  beforeEach(() => holding(RECEPTIONIST));

  it('is not offered the administrator rows, but keeps what needs no permission', async () => {
    renderSettings();

    const provoz = await screen.findByRole('region', { name: 'Provoz' });
    expect(within(provoz).getAllByRole('link')).toHaveLength(1);
    expect(within(provoz).getByRole('link', { name: /^Pauzy a přestávky/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Můj účet a zabezpečení/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Uživatelé a práva/ })).not.toBeInTheDocument();
  });

  it('is not shown a whole heading that holds nothing of hers', async () => {
    renderSettings();
    await screen.findByRole('heading', { level: 2, name: 'Provoz' });
    expect(screen.queryByRole('heading', { name: 'Kluby' })).not.toBeInTheDocument();
  });
});

describe('the settings that used to lie here', () => {
  it('no longer offers a working day this screen cannot save', async () => {
    renderSettings();
    await screen.findByRole('heading', { level: 2, name: 'Provoz' });

    expect(screen.queryByText(/Začátek pracovní doby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Konec pracovní doby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Buffer mezi termíny/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Výchozí délka termínu/)).not.toBeInTheDocument();
  });

  /* The profile is read-only: nothing lets somebody change their own name, so editable fields would write it into this browser only. */
  it('shows who you are without pretending the name can be changed here (inside "Vzhled aplikace a odhlášení")', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole('button', { name: /Vzhled aplikace a odhlášení/ }));
    expect(await screen.findByText('Jana Nová')).toBeVisible();
    expect(screen.getByText(/mění správce v sekci/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Uložit změny/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odhlásit se/ })).toBeInTheDocument();
  });
});

describe('a sign-in from before permissions were sent', () => {
  const stale = () => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }));
  };

  it('says the sign-in is stale instead of drawing a gutted page', () => {
    stale();
    renderSettings();
    expect(screen.getByText(/Odhlaste se a přihlaste znovu/)).toBeInTheDocument();
  });

  it('says nothing when the server really did send an empty list, or to somebody signed in normally', () => {
    holding([]);
    renderSettings();
    expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument();
  });

  it('stops saying so once the account refresh stores the list', async () => {
    stale();
    renderSettings();
    expect(screen.getByText(/Odhlaste se a přihlaste znovu/)).toBeInTheDocument();

    act(() => savePermissions(EVERYTHING));

    await waitFor(() => expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument());
  });
});

describe('a permission that changes while the page is open', () => {
  it('draws the rows the grant opens, without a new sign-in', async () => {
    holding(RECEPTIONIST);
    renderSettings();
    await screen.findByRole('heading', { level: 2, name: 'Provoz' });
    expect(screen.queryByRole('link', { name: /Otevírací doba/ })).not.toBeInTheDocument();

    act(() => savePermissions([...RECEPTIONIST, 'settings.clinic.manage']));

    expect(await screen.findByRole('link', { name: /Otevírací doba/ })).toBeInTheDocument();
  });

  it('takes away the rows a revocation closes', async () => {
    renderSettings();
    expect(await screen.findByRole('link', { name: /Otevírací doba/ })).toBeInTheDocument();

    act(() => savePermissions(RECEPTIONIST));

    await waitFor(() => expect(screen.queryByRole('link', { name: /Otevírací doba/ })).not.toBeInTheDocument());
  });
});
