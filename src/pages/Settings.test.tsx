/*
 * Nastavení: the board's three-pane screen.
 *
 * What is worth testing is not that the rows exist - it is that both the nav
 * and the cards come from one catalogue, that the search narrows them, that
 * a person is offered only what the server lets them open, and that the fake
 * settings that used to sit on this screen (a default appointment length, a
 * buffer, working hours - all hardcoded, saving nowhere) stay gone.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';
import { ThemePrefsContext } from '../themePrefs';
import { savePermissions } from '../auth/localSession';

/*
 * ── Signed in AS somebody, not IN A ROLE ──
 *
 * The owner sets permissions per employee, in three states, so a role could
 * not answer the question: an administrator whose `settings.clinic.manage`
 * was revoked still saw every screen. The screen reads the effective list the
 * server sends at sign-in, and so do these.
 */
const EVERYTHING = [
  'patients.view',
  'patients.register',
  'patients.edit',
  'patients.sensitive_identity.view',
  'settings.clinic.manage',
  'users.manage',
  'roles.manage',
  'bookings.create',
  'bookings.edit',
  'bookings.cancel',
  'questionnaires.manage',
  'communication.manage',
];

/** The server's own defaults for the Staff role. */
const RECEPTIONIST = [
  'patients.view',
  'patients.register',
  'patients.edit',
  'bookings.create',
  'bookings.edit',
  'bookings.cancel',
];

const holding = (permissions: readonly string[]) => {
  localStorage.setItem(
    'user',
    JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }),
  );
  localStorage.setItem('permissions', JSON.stringify(permissions));
};

beforeEach(() => {
  localStorage.clear();
  holding(EVERYTHING);
});

const themePrefs = {
  accent: '#0D9488',
  mode: 'light' as const,
  setAccent: () => {},
  setMode: () => {},
};

const renderSettings = () =>
  render(
    <ThemePrefsContext.Provider value={themePrefs}>
      <MemoryRouter initialEntries={['/settings']}>
        <Settings />
      </MemoryRouter>
    </ThemePrefsContext.Provider>,
  );

/* A row is drawn twice on a wide screen - in the nav and as a card - and both
   are links to the same place. "At least one, all pointing there" is the claim. */
const linksTo = (name: string | RegExp) =>
  screen.getAllByRole('link', { name }).map((a) => a.getAttribute('href'));

describe('the settings screen', () => {
  it('shows the board\'s groups, in its order, with the screens as links', async () => {
    renderSettings();

    const headings = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    expect(headings.slice(0, 4)).toEqual(['Provoz', 'Služby a ceny', 'Kluby', 'Komunikace']);
    expect(headings).toContain('Systém');
    expect(headings[headings.length - 1]).toBe('Osobní');

    expect(new Set(linksTo('Otevírací doba'))).toEqual(new Set(['/working-hours']));
    expect(new Set(linksTo('Slevy a cenové hladiny'))).toEqual(new Set(['/nastaveni/skupinove-slevy']));
    expect(new Set(linksTo('Hromadné objednávky'))).toEqual(new Set(['/vyhrazeni']));
    expect(new Set(linksTo('SMS a e-maily'))).toEqual(new Set(['/nastaveni/sablony-emailu']));
  });

  it('says what each screen holds, next to its name', async () => {
    renderSettings();
    expect(await screen.findByText(/Čím víc lidí přijde společně/)).toBeInTheDocument();
  });

  it('narrows the nav and the cards together when searched', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getAllByLabelText('Hledat v nastavení')[0], 'sleva');

    expect(screen.getAllByRole('link', { name: 'Slevy a cenové hladiny' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Otevírací doba' })).not.toBeInTheDocument();
    /* The personal cards are not a search hit for "sleva". */
    expect(screen.queryByText('Můj účet')).not.toBeInTheDocument();
  });

  it('says so when nothing matches', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.type(screen.getAllByLabelText('Hledat v nastavení')[0], 'xyzzy');

    expect(screen.getByText(/Nic odpovídajícího „xyzzy“\. Zkuste jiné slovo/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Otevírací doba' })).not.toBeInTheDocument();
  });
});

describe('what a receptionist sees', () => {
  beforeEach(() => holding(RECEPTIONIST));

  it('is not offered the administrator rows', async () => {
    renderSettings();

    /* Provoz is shown to her because Pauzy a přestávky needs no permission,
       while Otevírací doba and the rest of the group need
       settings.clinic.manage and are dropped. */
    expect((await screen.findAllByRole('link', { name: 'Pauzy a přestávky' })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Ceník' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Otevírací doba' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zaměstnanci' })).not.toBeInTheDocument();
  });

  it('still has her own settings', async () => {
    renderSettings();
    expect(await screen.findByText('Můj účet')).toBeInTheDocument();
    expect(screen.getByText('Vzhled')).toBeInTheDocument();
  });

  it('is not shown a whole section that holds nothing of hers', async () => {
    renderSettings();
    await screen.findByText('Můj účet');
    expect(screen.queryByRole('heading', { name: 'Systém' })).not.toBeInTheDocument();
  });
});

describe('the settings that used to lie here', () => {
  it('no longer offers a working day this screen cannot save', async () => {
    renderSettings();
    await screen.findByText('Můj účet');

    expect(screen.queryByText(/Začátek pracovní doby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Konec pracovní doby/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Buffer mezi termíny/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Výchozí délka termínu/)).not.toBeInTheDocument();
  });

  /*
   * The profile is read-only, and that is honest: GET /api/v1/account only
   * reads who is signed in, and nothing lets somebody change their own name,
   * so the editable fields that were here wrote the name into this browser
   * and nowhere else. A name is changed under Tým, by whoever manages accounts.
   */
  it('shows who you are without pretending the name can be changed here', async () => {
    renderSettings();

    expect(await screen.findByText('Jana Nová')).toBeVisible();
    expect(screen.getByText(/mění správce v sekci/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Uložit změny/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odhlásit se/ })).toBeInTheDocument();
  });
});

describe('a sign-in from before permissions were sent', () => {
  /*
   * A browser holding a session created before the server started sending the
   * permission list has no list at all. Every guarded row is hidden, and on
   * this screen that reads as the settings having disappeared — the owner
   * would report features missing rather than sign in again.
   */
  it('says the sign-in is stale instead of drawing a gutted menu', () => {
    localStorage.clear();
    localStorage.setItem(
      'user',
      JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }),
    );

    renderSettings();

    expect(screen.getByText(/Odhlaste se a přihlaste znovu/)).toBeInTheDocument();
  });

  it('says nothing when the server really did send an empty list', () => {
    holding([]);

    renderSettings();

    // Empty is a real answer — somebody with no permissions — and telling
    // them to sign in again would send them round in a circle.
    expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument();
  });

  it('says nothing to somebody signed in normally', () => {
    renderSettings();

    expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument();
  });

  /* The account refresh fills the list a moment after the screen opens; the
     notice must go with it rather than wait for the next visit. */
  it('stops saying so once the account refresh stores the list', async () => {
    localStorage.clear();
    localStorage.setItem(
      'user',
      JSON.stringify({ firstName: 'Jana', lastName: 'Nová', email: 'j@n.cz', role: 'Owner' }),
    );
    renderSettings();
    expect(screen.getByText(/Odhlaste se a přihlaste znovu/)).toBeInTheDocument();

    act(() => savePermissions(EVERYTHING));

    await waitFor(() =>
      expect(screen.queryByText(/Odhlaste se a přihlaste znovu/)).not.toBeInTheDocument(),
    );
  });
});

/*
 * The list is read live, not once. GET /api/v1/account rewrites it on start,
 * on focus and after a refusal, and an owner who grants a receptionist
 * `users.manage` while she has this screen open must see Zaměstnanci appear -
 * that grant used to reach her only after signing out and in again.
 */
describe('a permission that changes while the screen is open', () => {
  it('draws the rows the grant opens, without a new sign-in', async () => {
    holding(RECEPTIONIST);
    renderSettings();
    await screen.findByText('Můj účet');
    expect(screen.queryByRole('link', { name: 'Zaměstnanci' })).not.toBeInTheDocument();

    act(() => savePermissions([...RECEPTIONIST, 'users.manage']));

    expect((await screen.findAllByRole('link', { name: 'Zaměstnanci' })).length).toBeGreaterThan(0);
  });

  it('takes away the rows a revocation closes', async () => {
    renderSettings();
    expect((await screen.findAllByRole('link', { name: 'Zaměstnanci' })).length).toBeGreaterThan(0);

    act(() => savePermissions(RECEPTIONIST));

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: 'Zaměstnanci' })).not.toBeInTheDocument(),
    );
  });
});
