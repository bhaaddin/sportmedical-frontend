/*
 * The club / clinic header, the generic dialogs (bell, account, search, club data), the dialog
 * frame (title, close, Esc, focus in / trap / return) and the toast with its undo - on the demo
 * data source with the application's APIs mocked.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Club } from '../../../../api/clubs';
import { setViewport, VIEWPORTS } from '../../../../test/viewport';
import { ThemePrefsContext, type ThemePrefs } from '../../../../themePrefs';
import { DemoDataSource } from '../../../data/DemoDataSource';
import type { PlannerCatalogue } from '../../../data/PlannerDataSource';
import type { ClubProfile } from '../../../model';
import { usePlannerActions } from '../../../state/PlannerStoreProvider';

const { api, getCompany, listAccounts, getClub, updateClub, signOut, realtime } = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn(), post: vi.fn(), put: vi.fn() },
  getCompany: vi.fn(),
  listAccounts: vi.fn(),
  getClub: vi.fn(),
  updateClub: vi.fn(),
  signOut: vi.fn(),
  realtime: vi.fn(),
}));

vi.mock('../../../../api/client', () => ({ default: api, client: api }));
vi.mock('../../../../hooks/useRealtimeSync', () => ({ useRealtimeSync: realtime }));
vi.mock('../../../../auth/signOut', () => ({ signOut }));
vi.mock('../../../../api/companySettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/companySettings')>();
  return { ...actual, companySettingsApi: { get: getCompany, put: vi.fn() } };
});
vi.mock('../../../../api/userAccounts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/userAccounts')>();
  return { ...actual, userAccountsApi: { ...actual.userAccountsApi, list: listAccounts } };
});
vi.mock('../../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getById: getClub, update: updateClub } };
});

const { ClubHeader } = await import('../../ClubHeader');
const { DialogLayer } = await import('../../DialogLayer');
const { PlannerAccountProvider } = await import('./account');
const { PlannerGate } = await import('../../PlannerGate');
const { PlannerProviders } = await import('../../PlannerProviders');
const { PlannerStage } = await import('../../PlannerStage');
const { Toast } = await import('../../Toast');
const { usePlannerKeyboard } = await import('../../usePlannerKeyboard');

const TODAY = '2026-11-10';
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

/** Demo source whose capabilities and club record the test chooses. */
class TestSource extends DemoDataSource {
  logoUpload = true;
  clubId: string | null = null;
  colorHex: string | null = null;
  profileReads = 0;
  override async getCatalogue(): Promise<PlannerCatalogue> {
    const c = await super.getCatalogue();
    return { ...c, capabilities: { ...c.capabilities, logoUpload: this.logoUpload } };
  }
  override async getClubProfile(): Promise<ClubProfile> {
    this.profileReads += 1;
    const p = await super.getClubProfile();
    return { ...p, ...(this.clubId ? { clubId: this.clubId } : {}), colorHex: this.colorHex };
  }
}

let actions: ReturnType<typeof usePlannerActions>;
function Probe() {
  actions = usePlannerActions();
  usePlannerKeyboard();
  return null;
}
function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function mount(opts: { source?: TestSource; mode?: 'club' | 'clinic'; user?: { displayName: string } | null; prefs?: ThemePrefs } = {}) {
  const source = opts.source ?? new TestSource({ today: TODAY });
  const tree = (
    <MemoryRouter>
      <PlannerProviders source={source} today={TODAY} initialDate="2026-11-20">
        <PlannerStage>
          <PlannerGate>
            <PlannerAccountProvider user={opts.user}>
              <Probe />
              <ClubHeader mode={opts.mode} user={opts.user} />
              <DialogLayer />
              <Toast />
            </PlannerAccountProvider>
          </PlannerGate>
        </PlannerStage>
      </PlannerProviders>
      <Where />
    </MemoryRouter>
  );
  render(opts.prefs ? <ThemePrefsContext.Provider value={opts.prefs}>{tree}</ThemePrefsContext.Provider> : tree);
  return source;
}

const text = (id: string) => document.getElementById(id)!;

const FEED = [
  { id: 'n1', type: 'appointment', title: 'Nová rezervace', message: 'Pacient Alfa', timestamp: minutesAgo(5), read: false, actionUrl: '/patients/1' },
  { id: 'n2', type: 'info', title: 'Dotazník vyplněn', message: 'Pacient Beta', timestamp: minutesAgo(50), read: true },
];

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.clear();
  for (const fn of [api.get, api.patch, api.delete, api.post, api.put, getCompany, listAccounts, getClub, updateClub, signOut, realtime]) fn.mockReset();
  api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: [] }));
  api.patch.mockResolvedValue({});
  api.delete.mockResolvedValue({});
  api.post.mockResolvedValue({ data: { lastSeenAtUtc: new Date().toISOString() } });
  getCompany.mockRejectedValue(new Error('nope'));
  listAccounts.mockResolvedValue([]);
});
afterEach(() => cleanup());

/* -------------------------------------------------------------------------- */
describe('header - club mode', () => {
  it('shows the nine values of the club and its name', async () => {
    mount({ source: new TestSource({ today: TODAY, profile: { ico: '27082440', dic: 'CZ27082440', address: 'Stará 1, Kladno', leaderName: 'Jan Novák', leaderEmail: 'jan@klub.cz', leaderPhone: '+420 600 000 001', contactName: 'Karel Trenér', contactEmail: 'k@klub.cz', contactPhone: '+420 777 111 222' } }) });
    await screen.findByTestId('club-header');
    expect(text('club-identity-name')).toHaveTextContent('RC Mountfield Říčany');
    expect(text('hdr-ico')).toHaveTextContent('27082440');
    expect(text('hdr-dic')).toHaveTextContent('CZ27082440');
    expect(text('hdr-address')).toHaveTextContent('Stará 1, Kladno');
    expect(text('hdr-leader')).toHaveTextContent('Jan Novák');
    expect(text('hdr-leader-email')).toHaveTextContent('jan@klub.cz');
    expect(text('hdr-leader-phone')).toHaveTextContent('+420 600 000 001');
    expect(text('hdr-contact')).toHaveTextContent('Karel Trenér');
    expect(text('hdr-contact-email')).toHaveTextContent('k@klub.cz');
    expect(text('hdr-contact-phone')).toHaveTextContent('+420 777 111 222');
    expect(within(screen.getByTestId('club-header')).queryByText('Doplnit')).toBeNull();
    expect(screen.getByTestId('club-header')).toHaveAttribute('data-mode', 'club');
    expect(document.querySelector('.club-identity-tag')).toHaveTextContent('KLUB');
  });

  it('prints "Doplnit" for every value the club does not have', async () => {
    mount({ source: new TestSource({ today: TODAY, profile: { ico: '27082440' } }) });
    await screen.findByTestId('club-header');
    expect(within(screen.getByTestId('club-header')).getAllByText('Doplnit')).toHaveLength(8);
    expect(text('hdr-dic')).toHaveClass('is-missing');
    expect(text('hdr-dic')).toHaveAttribute('title', 'Údaj zatím není vyplněn');
    expect(text('hdr-ico')).not.toHaveClass('is-missing');
  });

  it('draws the club initials on the club colour when the source cannot store a logo', async () => {
    const source = new TestSource({ today: TODAY });
    source.logoUpload = false;
    source.colorHex = '#1f6feb';
    mount({ source });
    const slot = await screen.findByTestId('club-logo-slot');
    expect(slot).toHaveClass('is-readonly');
    const avatar = within(slot).getByTestId('club-avatar');
    expect(avatar).toHaveTextContent('RM');
    expect(avatar).toHaveAttribute('data-color', '#1f6feb');
    expect(document.getElementById('club-logo-input')).toBeDisabled();
    expect(slot).toHaveAttribute('title', expect.stringContaining('nelze nahrát'));
    expect(within(slot).getByText(/Logo klubu zde zatím nelze nahrát/)).toBeInTheDocument();
    expect(screen.queryByText('Změnit logo')).toBeNull();
  });

  it('keeps the upload when the source supports it, and stores the chosen image', async () => {
    const source = mount();
    await screen.findByTestId('club-header');
    expect(screen.getByText('Změnit logo')).toBeInTheDocument();
    const input = document.getElementById('club-logo-input') as HTMLInputElement;
    expect(input).toBeEnabled();
    const save = vi.spyOn(source, 'saveLogo');
    fireEvent.change(input, { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });
    await waitFor(() => expect(save).toHaveBeenCalled());
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Zvolte prosím obrázek ve formátu PNG, JPG nebo WebP.')).toBeInTheDocument();
  });

  it('opens the club editor from "Upravit údaje"', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Upravit údaje klubu' }));
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', 'clubEdit');
  });
});

/* -------------------------------------------------------------------------- */
describe('header - clinic mode: the slim top bar', () => {
  const company = {
    legalName: 'SportMedical Diagnostics s.r.o.', ico: '11223344', dic: 'CZ11223344', address: 'Sportovní 5', city: 'Brno',
    postalCode: '602 00', bankAccount: '', iban: '', dataBox: '', phone: '+420 541 000 000', email: 'recepce@klinika.cz', invoiceDueDays: 14,
  };
  /** Everything the big card used to carry; none of it is on the standard calendar any more. */
  const REMOVED_TEXTS = ['KLINIKA', 'Nastavení firmy', 'IDENTIFIKAČNÍ ÚDAJE', 'VEDENÍ KLINIKY', 'KONTAKTNÍ OSOBA', 'IČO', 'DIČ', 'Adresa', 'Telefon', 'E-mail', 'Jméno', 'Doplnit', 'Logo kliniky'];
  const REMOVED_IDS = [
    'club-logo-slot', 'club-logo-input', 'club-logo-preview', 'club-edit-link', 'club-edit-label', 'club-details-strip',
    'hdr-ico', 'hdr-dic', 'hdr-address', 'hdr-leader', 'hdr-leader-email', 'hdr-leader-phone', 'hdr-contact', 'hdr-contact-email', 'hdr-contact-phone',
  ];

  it('is one line: the clinic name from the company settings, the bell and the profile chip - and nothing else', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'users.manage']));
    getCompany.mockResolvedValue(company);
    listAccounts.mockResolvedValue([{ userId: 'u1', email: 'owner@klinika.cz', displayName: 'MUDr. Eva Vlastníková', role: 'Owner', isActive: true }]);
    mount({ mode: 'clinic', user: { displayName: 'Jan Novák' } });
    const bar = await screen.findByTestId('club-header');
    expect(bar).toHaveAttribute('data-mode', 'clinic');
    expect(bar).toHaveClass('is-slim');
    await waitFor(() => expect(text('club-identity-name')).toHaveTextContent('SportMedical Diagnostics s.r.o.'));
    // the only controls: the bell and the profile chip
    expect(within(bar).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Oznámení', 'Profil uživatele Jan Novák']);
    expect(within(bar).getByText('JN')).toBeInTheDocument();
    // not one of the removed pieces: no text, no id, no logo, no strip, no tag, no settings button
    for (const t of REMOVED_TEXTS) expect(bar).not.toHaveTextContent(t);
    for (const id of REMOVED_IDS) expect(document.getElementById(id), id).toBeNull();
    expect(document.querySelector('.club-identity-tag, .club-head-info, .club-head-line, .club-identity-v45')).toBeNull();
    expect(within(bar).queryByRole('img')).toBeNull();
    // the name is all there is of the company: the company settings are read, the account list is not
    expect(getCompany).toHaveBeenCalled();
    expect(listAccounts).not.toHaveBeenCalled();
  });

  it('asks nothing it may not and shows the clinic name from the catalogue', async () => {
    mount({ mode: 'clinic' });
    await screen.findByTestId('club-header');
    expect(getCompany).not.toHaveBeenCalled();
    expect(listAccounts).not.toHaveBeenCalled();
    expect(text('club-identity-name')).toHaveTextContent(/\S/);
    expect(text('club-identity-name')).not.toHaveTextContent('RC Mountfield Říčany');
    expect(screen.queryByRole('button', { name: 'Otevřít nastavení firmy' })).toBeNull();
  });

  it('keeps the bell badge: the unread count of the feed, 99+ above 99', async () => {
    api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: FEED }));
    mount({ mode: 'clinic' });
    expect(await screen.findByTestId('club-bell-count')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Oznámení' })).toHaveAttribute('title', 'Oznámení (1 nepřečtených)');
  });

  it('keeps the bell and the profile chip working: each opens its dialog', async () => {
    api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: FEED }));
    mount({ mode: 'clinic', user: { displayName: 'Jan Novák' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Oznámení' }));
    const notes = await screen.findByTestId('planner-dialog');
    expect(within(notes).getByRole('heading', { name: 'Upozornění' })).toBeInTheDocument();
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', 'notifications');
    act(() => actions.closeDialog());
    await waitFor(() => expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Profil uživatele Jan Novák' }));
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', 'profile');
  });
});

describe('header - club mode keeps the full banner', () => {
  it('has the logo slot, the tag, the edit action and the three data sections, and is not the slim bar', async () => {
    mount({ mode: 'club' });
    const header = await screen.findByTestId('club-header');
    expect(header).toHaveAttribute('data-mode', 'club');
    expect(header).not.toHaveClass('is-slim');
    expect(screen.getByTestId('club-logo-slot')).toBeInTheDocument();
    expect(document.querySelector('.club-identity-tag')).toHaveTextContent('KLUB');
    expect(screen.getByRole('button', { name: 'Upravit údaje klubu' })).toBeInTheDocument();
    expect(document.getElementById('club-details-strip')).not.toBeNull();
    for (const id of ['hdr-ico', 'hdr-dic', 'hdr-address', 'hdr-leader', 'hdr-contact', 'hdr-contact-phone']) expect(document.getElementById(id), id).not.toBeNull();
    expect(within(header).getByRole('button', { name: 'Oznámení' })).toBeInTheDocument();
    expect(within(header).getByRole('button', { name: /^Profil uživatele/ })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
describe('bell and notifications', () => {
  it('shows the unread count of the application feed and opens the list', async () => {
    api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: FEED }));
    mount();
    expect(await screen.findByTestId('club-bell-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Oznámení' }));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Upozornění' })).toBeInTheDocument();
    expect(await within(dialog).findByText('Nová rezervace')).toBeInTheDocument();
    expect(within(dialog).getByText('Dotazník vyplněn')).toBeInTheDocument();
    expect(within(dialog).getByTestId('notification-summary')).toHaveTextContent('1 nepřečtených · 2 celkem');
    expect(within(dialog).getByTestId('occupancy-summary')).toHaveTextContent('termíny s plnou kapacitou');
  });

  it('draws no badge when everything is read', async () => {
    mount();
    await screen.findByTestId('club-header');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/notifications'));
    expect(screen.queryByTestId('club-bell-count')).toBeNull();
  });

  it('opens a row: marks it read, follows its link, closes the dialog', async () => {
    api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: FEED }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Oznámení' }));
    fireEvent.click(await screen.findByRole('button', { name: /Nová rezervace/ }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/notifications/n1/read'));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/patients/1'));
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    // the dialog was looked at: the server is told when it closed
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/notifications/seen'));
  });

  it('marks all read, deletes a row and reports a refusal in the planner toast', async () => {
    api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: FEED }));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Oznámení' }));
    const dialog = await screen.findByTestId('planner-dialog');
    await within(dialog).findByText('Nová rezervace');
    // the server now answers with everything read: the other bell (the header's) re-asks and follows
    api.get.mockImplementation(async (url: string) => (url === '/api/notifications/seen' ? { data: { lastSeenAtUtc: null } } : { data: FEED.map((n) => ({ ...n, read: true })) }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přečíst vše' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/notifications/read-all'));
    expect(await screen.findByText('Vše označeno jako přečtené')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('club-bell-count')).toBeNull());

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Smazat oznámení' })[1]!);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/notifications/n2'));
    await waitFor(() => expect(within(dialog).queryByText('Dotazník vyplněn')).toBeNull());

    api.delete.mockRejectedValueOnce(new Error('x'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Smazat oznámení' }));
    expect(await screen.findByText(/nepodařilo smazat/)).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
describe('profile', () => {
  it('names the person and offers the account menu items', async () => {
    window.localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Nováková', role: 'Owner' }));
    mount();
    expect(await screen.findByText('Jana Nováková')).toBeInTheDocument();
    expect(screen.getByText('JN')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Profil uživatele/ }));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Profil uživatele' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('profile-name')).toHaveTextContent('Jana Nováková');
    expect(within(dialog).getByText(/Vlastník/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Odhlásit se' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Otevřít nastavení' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/settings');
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });

  it('switches the application appearance from the profile when the application offers it', async () => {
    const setMode = vi.fn();
    mount({ prefs: { accent: '#0D5C52', mode: 'light', setAccent: vi.fn(), setMode } });
    fireEvent.click(await screen.findByRole('button', { name: /Profil uživatele/ }));
    const row = await screen.findByTestId('profile-appearance');
    fireEvent.click(within(row).getByRole('button', { name: 'Tmavý režim' }));
    expect(setMode).toHaveBeenCalledWith('dark');
  });

  it('draws no appearance row where the application provides none', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Profil uživatele/ }));
    await screen.findByTestId('planner-dialog');
    expect(screen.queryByTestId('profile-appearance')).toBeNull();
  });

  it('uses the name the page passes over the stored one', async () => {
    window.localStorage.setItem('user', JSON.stringify({ firstName: 'Stará', lastName: 'Osoba' }));
    mount({ user: { displayName: 'Jan Novák' } });
    fireEvent.click(await screen.findByRole('button', { name: /Profil uživatele Jan Novák/ }));
    expect(within(await screen.findByTestId('planner-dialog')).getByTestId('profile-name')).toHaveTextContent('Jan Novák');
  });
});

/* -------------------------------------------------------------------------- */
describe('search', () => {
  it('finds a term by činnost and opens it', async () => {
    mount();
    await screen.findByTestId('club-header');
    act(() => actions.openDialog({ kind: 'search' }));
    const dialog = await screen.findByTestId('planner-dialog');
    const input = within(dialog).getByRole('searchbox');
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'zzzz' } });
    expect(within(dialog).getByText('Nenašli se žádné termíny.')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'fyzio' } });
    const hits = dialog.querySelectorAll('.search-result');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toHaveTextContent(/Fyzio/i);
    fireEvent.click(hits[0]!);
    expect(['agendaDetail', 'eventDetail']).toContain(screen.getByTestId('dialog-layer').getAttribute('data-dialog'));
  });

  it('hands the whole-system search to the application palette', async () => {
    const heard = vi.fn();
    window.addEventListener('sm-open-search', heard);
    mount();
    await screen.findByTestId('club-header');
    act(() => actions.openDialog({ kind: 'search' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hledat v celém systému' }));
    expect(heard).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    window.removeEventListener('sm-open-search', heard);
  });
});

/* -------------------------------------------------------------------------- */
describe('club data dialogs', () => {
  it('shows the saved values read-only and leads to the editor', async () => {
    mount({ source: new TestSource({ today: TODAY, profile: { ico: '27082440', leaderName: 'Jan Novák' } }) });
    await screen.findByTestId('club-header');
    act(() => actions.openDialog({ kind: 'clubDetails' }));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByText('ÚDAJE ULOŽENY')).toBeInTheDocument();
    expect(within(dialog).getByText('27082440')).toBeInTheDocument();
    expect(within(dialog).getAllByText('—').length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upravit údaje klubu' }));
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', 'clubEdit');
  });

  it('offers "Doplnit údaje klubu" while nothing is filled in', async () => {
    mount();
    await screen.findByTestId('club-header');
    act(() => actions.openDialog({ kind: 'clubDetails' }));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByText('ÚDAJE NEVYPLNĚNY')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Doplnit údaje klubu' })).toBeInTheDocument();
  });

  it('edits a source without a club record in the small form and refreshes the header', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Upravit údaje klubu' }));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Údaje o klubu' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('IČO'), { target: { value: ' 27082440 ' } });
    fireEvent.change(within(dialog).getByLabelText('E-mail kontaktní osoby'), { target: { value: 'k@klub.cz' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Uložit údaje' }));
    await waitFor(() => expect(screen.queryByTestId('planner-dialog')).toBeNull());
    await waitFor(() => expect(text('hdr-ico')).toHaveTextContent('27082440'));
    expect(text('hdr-contact-email')).toHaveTextContent('k@klub.cz');
    expect(await screen.findByText('Kontaktní údaje klubu uloženy')).toBeInTheDocument();
  });

  it('edits a club of the system in the application\'s own club dialog and refreshes the header', async () => {
    const source = new TestSource({ today: TODAY });
    source.clubId = 'club-2';
    const club: Club = {
      id: 'club-2', name: 'RC Mountfield Říčany', ico: '27082440', dic: '', address: 'Stará 1', city: 'Říčany', postalCode: '25101',
      contactPerson: 'Karel Trenér', contactEmail: 'k@klub.cz', contactPhone: '+420777111222', bankAccount: '123456789', bankCode: '0800',
      iban: '', paymentTermsDays: 21, discountPercent: null, management: [], isActive: true, createdAt: '2026-01-01T00:00:00Z',
    };
    getClub.mockResolvedValue(club);
    updateClub.mockImplementation(async () => {
      (source as unknown as { profile: ClubProfile }).profile.dic = 'CZ27082440';
      return club;
    });
    mount({ source });
    fireEvent.click(await screen.findByRole('button', { name: 'Upravit údaje klubu' }));
    expect(await screen.findByText('Upravit klub')).toBeInTheDocument();
    expect(getClub).toHaveBeenCalledWith('club-2');
    // the application's dialog replaces the planner card; the layer does not block the stage
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    expect(screen.getByTestId('dialog-layer')).not.toHaveClass('open');
    const reads = source.profileReads;
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateClub).toHaveBeenCalledWith('club-2', expect.objectContaining({ ico: '27082440' })));
    await waitFor(() => expect(source.profileReads).toBeGreaterThan(reads));
    await waitFor(() => expect(text('hdr-dic')).toHaveTextContent('CZ27082440'));
    await waitFor(() => expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', ''));
  });

  it('closes and says so when the club cannot be loaded', async () => {
    const source = new TestSource({ today: TODAY });
    source.clubId = 'gone';
    getClub.mockRejectedValue(new Error('404'));
    mount({ source });
    fireEvent.click(await screen.findByRole('button', { name: 'Upravit údaje klubu' }));
    expect(await screen.findByText('Údaje klubu se nepodařilo načíst.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', ''));
  });
});

/* -------------------------------------------------------------------------- */
describe('dialog frame', () => {
  it('shows the title, closes with the X, the scrim, the footer button and Esc', async () => {
    mount();
    await screen.findByTestId('club-header');
    const layer = screen.getByTestId('dialog-layer');
    for (const closer of [
      () => fireEvent.click(within(screen.getByTestId('planner-dialog')).getByTitle('Zavřít')),
      () => fireEvent.click(document.querySelector('.modal-scrim')!),
      () => fireEvent.keyDown(document, { key: 'Escape' }),
    ]) {
      act(() => actions.openDialog({ kind: 'profile' }));
      const dialog = await screen.findByTestId('planner-dialog');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(within(dialog).getByRole('heading', { name: 'Profil uživatele' })).toBeInTheDocument();
      expect(layer).toHaveClass('open');
      closer();
      expect(screen.queryByTestId('planner-dialog')).toBeNull();
      expect(layer).not.toHaveClass('open');
    }
    act(() => actions.openDialog({ kind: 'search' }));
    fireEvent.click(within(await screen.findByTestId('planner-dialog')).getAllByRole('button', { name: 'Zavřít' }).at(-1)!);
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });

  it('moves focus into the dialog, keeps Tab inside it and gives focus back to the opener', async () => {
    mount();
    const opener = await screen.findByRole('button', { name: 'Upravit údaje klubu' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await screen.findByTestId('planner-dialog');
    // the first field takes the focus, as the prototype's openDialog does
    await waitFor(() => expect(within(dialog).getByLabelText('IČO')).toHaveFocus());

    const buttons = within(dialog).getAllByRole('button');
    const last = within(dialog).getByRole('button', { name: 'Uložit údaje' });
    expect(buttons.at(-1)).toBe(last);
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(buttons[0]!, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('replacing one dialog by another keeps the original opener for the return', async () => {
    mount();
    const bell = await screen.findByRole('button', { name: 'Oznámení' });
    bell.focus();
    fireEvent.click(bell);
    await screen.findByTestId('planner-dialog');
    act(() => actions.openDialog({ kind: 'profile' }));
    await screen.findByRole('heading', { name: 'Profil uživatele' });
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(bell).toHaveFocus());
  });
});

/* -------------------------------------------------------------------------- */
describe('toast', () => {
  it('shows the newest message and dismisses it after its time', async () => {
    mount();
    await screen.findByTestId('toast-layer');
    act(() => actions.toast('Ahoj', { durationMs: 60 }));
    expect(await screen.findByText('Ahoj')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Ahoj')).toBeNull());
    act(() => actions.toast('První', { durationMs: 0 }));
    act(() => actions.toast('Druhé', { durationMs: 0 }));
    expect(screen.getByText('Druhé')).toBeInTheDocument();
    expect(screen.queryByText('První')).toBeNull();
  });

  it('"↶ Zpět" reverts the last write through the data source', async () => {
    const source = mount();
    await screen.findByTestId('toast-layer');
    const before = (await source.listOrderSessions()).length;
    const result = await source.createInterval({ date: '2026-11-25', categoryId: 'physio', start: '09:00', quantity: 2 });
    expect((await source.listOrderSessions()).length).toBeGreaterThan(before - 1);
    const withNew = (await source.listOrderSessions()).length;
    act(() => {
      actions.setUndoToken(result.undoToken);
      actions.toast('✓ Přidáno 2 slotů', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 });
    });
    fireEvent.click(await screen.findByRole('button', { name: '↶ Zpět' }));
    expect(await screen.findByText('Poslední plánovací krok byl vrácen.')).toBeInTheDocument();
    expect(screen.queryByText('✓ Přidáno 2 slotů')).toBeNull();
    expect((await source.listOrderSessions()).length).toBeLessThanOrEqual(withNew);
    expect(result.undoToken).not.toBeNull();
  });

  it('says so when there is nothing to undo, and reports an undo the source refuses', async () => {
    const source = mount();
    await screen.findByTestId('toast-layer');
    act(() => actions.toast('Hotovo', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 0 }));
    fireEvent.click(await screen.findByRole('button', { name: '↶ Zpět' }));
    expect(await screen.findByText('Není co vracet.')).toBeInTheDocument();

    vi.spyOn(source, 'undo').mockRejectedValueOnce(new Error('Změna už nejde vrátit.'));
    act(() => {
      actions.setUndoToken('old');
      actions.toast('Hotovo 2', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 0 });
    });
    fireEvent.click(await screen.findByRole('button', { name: '↶ Zpět' }));
    expect(await screen.findByText('Změna už nejde vrátit.')).toBeInTheDocument();
  });
});
