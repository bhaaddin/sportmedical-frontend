/*
 * Uživatelé a práva: the actions that cannot be undone from the same screen - a password reset, a role change, switching an
 * account off - and who is allowed to be offered what.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { list, setActive, create, update, resetPassword, assignRole } = vi.hoisted(() => ({
  list: vi.fn(), setActive: vi.fn(), create: vi.fn(), update: vi.fn(), resetPassword: vi.fn(), assignRole: vi.fn(),
}));
vi.mock('../api/userAccounts', async () => {
  const actual = await vi.importActual<typeof import('../api/userAccounts')>('../api/userAccounts');
  return { ...actual, userAccountsApi: { list, setActive, create, update, resetPassword, assignRole } };
});
vi.mock('../components/admin/UserPermissionsDialog', () => ({ UserPermissionsDialog: ({ userId, isOwner }: { userId: string | null; isOwner: boolean }) => (userId === null ? null : <div data-testid="permissions">{userId}|{String(isOwner)}</div>) }));
vi.mock('../components/admin/WhereSomebodyWorksDialog', () => ({ WhereSomebodyWorksDialog: ({ userId }: { userId: string | null }) => (userId === null ? null : <div data-testid="rota">{userId}</div>) }));

const { default: StaffManagement } = await import('./StaffManagement');

const account = (over: Record<string, unknown> = {}) => ({
  userId: 'u1', email: 'jana@ordinace.cz', displayName: 'Jana Nová', role: 'Staff', isActive: true, mustChangePassword: false,
  createdAtUtc: '2026-09-01T10:00:00Z', lastLoginAtUtc: null, ...over,
});
const owner = account({ userId: 'u0', email: 'majitel@ordinace.cz', displayName: 'Majitel Klinika', role: 'Owner', lastLoginAtUtc: '2026-10-19T08:00:00Z' });

const show = () => render(<MemoryRouter><StaffManagement /></MemoryRouter>);
const permissions = (held: string[]) => localStorage.setItem('permissions', JSON.stringify(held));

beforeEach(() => {
  localStorage.clear();
  permissions(['users.manage', 'settings.clinic.manage']);
  list.mockReset().mockResolvedValue([owner, account(), account({ userId: 'u2', email: 'petr@ordinace.cz', displayName: 'Petr Starý', isActive: false })]);
  setActive.mockReset().mockResolvedValue(account());
  create.mockReset().mockResolvedValue({ account: account({ userId: 'u3', email: 'nova@ordinace.cz' }), temporaryPassword: 'Dočasné-Heslo-1' });
  update.mockReset().mockResolvedValue(account());
  resetPassword.mockReset().mockResolvedValue({ account: account(), temporaryPassword: 'Nove-Docasne-2' });
  assignRole.mockReset().mockResolvedValue(account({ role: 'Administrator' }));
});

const row = async (name: string) => within((await screen.findByText(name)).closest('tr') as HTMLElement);

describe('resetting a password', () => {
  it('asks first: one click on the lock icon does not throw the password away', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Resetovat heslo?')).toBeInTheDocument();
    expect(within(dialog).getByText(/přestane platit/)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('Zrušit leaves the password alone', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit' }));
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('resets once for that account and shows the new temporary password for the person to hand over', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resetovat heslo' }));
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Nove-Docasne-2')).toBeInTheDocument();
    expect(screen.getByText('jana@ordinace.cz', { selector: 'strong' })).toBeInTheDocument();
  });

  it('says the temporary password was e-mailed when the server shows none, and offers no copy button', async () => {
    resetPassword.mockResolvedValue({ account: account(), temporaryPasswordEmailed: true });
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resetovat heslo' }));
    expect(await screen.findByText('Dočasné heslo bylo odesláno e-mailem uživateli.')).toBeInTheDocument();
    expect(screen.queryByText(/^Heslo:/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kopírovat' })).toBeNull();
  });

  it('still shows the password when the server returns one (e-mail not configured), flag absent or false', async () => {
    resetPassword.mockResolvedValue({ account: account(), temporaryPassword: 'Nove-Docasne-3', temporaryPasswordEmailed: false });
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resetovat heslo' }));
    expect(await screen.findByText('Nove-Docasne-3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kopírovat' })).toBeInTheDocument();
  });

  it('a double click on the confirmation resets once (a second reset would invalidate the first password)', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    resetPassword.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    await user.dblClick(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resetovat heslo' }));
    expect(resetPassword).toHaveBeenCalledTimes(1);
    release({ account: account(), temporaryPassword: 'X' });
  });

  it('says in Czech why a refused reset was refused', async () => {
    const user = userEvent.setup();
    resetPassword.mockRejectedValue({ response: { data: { code: 'access.denied' } } });
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Resetovat heslo pro jana@ordinace.cz' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resetovat heslo' }));
    expect(await screen.findByText('Na tohle nemáte oprávnění.')).toBeInTheDocument();
  });
});

describe('creating an account', () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Přidat zaměstnance' }));
    return screen.findByRole('dialog');
  };

  it('needs a name and an e-mail before Přidat is live', async () => {
    const user = userEvent.setup();
    show();
    const dialog = await open(user);
    const add = within(dialog).getByRole('button', { name: 'Přidat' });
    expect(add).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Jméno a příjmení'), 'Nová Osoba');
    expect(add).toBeDisabled();
    await user.type(within(dialog).getByLabelText('E-mail'), 'nova@ordinace.cz');
    expect(add).toBeEnabled();
  });

  it('sends the trimmed name and e-mail with the chosen role, then shows the temporary password once', async () => {
    const user = userEvent.setup();
    show();
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText('Jméno a příjmení'), '  Nová Osoba ');
    await user.type(within(dialog).getByLabelText('E-mail'), ' nova@ordinace.cz ');
    await user.click(within(dialog).getByRole('button', { name: 'Přidat' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ email: 'nova@ordinace.cz', displayName: 'Nová Osoba', role: 'Staff' }));
    expect(await screen.findByText('Dočasné-Heslo-1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hotovo' }));
    expect(screen.queryByText('Dočasné-Heslo-1')).toBeNull();
  });

  it('says in Czech that the e-mail already belongs to somebody, and keeps the dialog', async () => {
    const user = userEvent.setup();
    create.mockRejectedValue({ response: { data: { code: 'account.email_already_exists' } } });
    show();
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText('Jméno a příjmení'), 'Nová Osoba');
    await user.type(within(dialog).getByLabelText('E-mail'), 'jana@ordinace.cz');
    await user.click(within(dialog).getByRole('button', { name: 'Přidat' }));
    expect(await within(dialog).findByText('Účet s tímto e-mailem už existuje.')).toBeInTheDocument();
  });

  it('a double click on Přidat creates one account', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    create.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    show();
    const dialog = await open(user);
    await user.type(within(dialog).getByLabelText('Jméno a příjmení'), 'Nová Osoba');
    await user.type(within(dialog).getByLabelText('E-mail'), 'nova@ordinace.cz');
    await user.dblClick(within(dialog).getByRole('button', { name: 'Přidat' }));
    expect(create).toHaveBeenCalledTimes(1);
    release({ account: account(), temporaryPassword: 'X' });
  });
});

describe('roles', () => {
  it('offers the Owner role only to somebody who may manage roles', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Změnit roli Jana Nová' }));
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Role'));
    expect(screen.queryByRole('option', { name: 'Vlastník' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Administrátor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Personál' })).toBeInTheDocument();
  });

  it('offers it with roles.manage', async () => {
    const user = userEvent.setup();
    permissions(['users.manage', 'roles.manage']);
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Změnit roli Jana Nová' }));
    await user.click(within(await screen.findByRole('dialog')).getByLabelText('Role'));
    expect(screen.getByRole('option', { name: 'Vlastník' })).toBeInTheDocument();
  });

  it('keeps Uložit off until another role is picked, then sends that role for that account', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Změnit roli Jana Nová' }));
    const dialog = await screen.findByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Uložit' });
    expect(save).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Role'));
    await user.click(await screen.findByRole('option', { name: 'Administrátor' }));
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(assignRole).toHaveBeenCalledWith('u1', 'Administrator'));
    expect(await screen.findByText('Role změněna.')).toBeInTheDocument();
  });

  it('says why the last owner cannot lose the role', async () => {
    const user = userEvent.setup();
    permissions(['users.manage', 'roles.manage']);
    assignRole.mockRejectedValue({ response: { data: { code: 'account.last_owner_protected' } } });
    show();
    await user.click((await row('Majitel Klinika')).getByRole('button', { name: 'Změnit roli Majitel Klinika' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Role'));
    await user.click(await screen.findByRole('option', { name: 'Personál' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Posledního aktivního vlastníka nejde vypnout ani mu vzít roli.')).toBeInTheDocument();
  });
});

describe('access and the list', () => {
  it('counts active accounts per role and the switched-off ones', async () => {
    show();
    await screen.findByText('Jana Nová');
    const card = (label: string) => within(screen.getByRole('region', { name: 'Přehled' })).getByText(label).closest('[data-card="metric"]') as HTMLElement;
    expect(card('Vlastník')).toHaveTextContent('1');
    expect(card('Personál')).toHaveTextContent('1');
    expect(card('Vypnutý přístup')).toHaveTextContent('1');
  });

  it('asks before switching an account off, and says the open sessions end at once', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Vypnout přístup Jana Nová' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/otevřená přihlášení skončí hned/)).toBeInTheDocument();
    expect(setActive).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Vypnout přístup' }));
    await waitFor(() => expect(setActive).toHaveBeenCalledWith('u1', false));
  });

  it('switches a dismissed account back on without asking, and says so', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Petr Starý')).getByRole('button', { name: 'Zapnout přístup Petr Starý' }));
    await waitFor(() => expect(setActive).toHaveBeenCalledWith('u2', true));
    expect(await screen.findByText('Petr Starý se může znovu přihlásit.')).toBeInTheDocument();
  });

  it('marks an account that has never signed in, and writes the last sign-in of the others', async () => {
    list.mockResolvedValue([account({ mustChangePassword: true }), owner]);
    show();
    expect(await screen.findByText('Čeká na první přihlášení')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('opens the permissions and the rota of the right person, and tells the dialog when it is the owner', async () => {
    const user = userEvent.setup();
    show();
    await user.click((await row('Majitel Klinika')).getByRole('button', { name: 'Co smí Majitel Klinika' }));
    expect(await screen.findByTestId('permissions')).toHaveTextContent('u0|true');
    await user.click((await row('Jana Nová')).getByRole('button', { name: 'Kde pracuje Jana Nová' }));
    expect(await screen.findByTestId('rota')).toHaveTextContent('u1');
  });

  it('links to the absences of that person only with settings.clinic.manage', async () => {
    show();
    const link = (await row('Jana Nová')).getByRole('link', { name: 'Nepřítomnost Jana Nová' });
    expect(link).toHaveAttribute('href', '/nepritomnosti?userId=u1');
  });

  it('offers no absences link without settings.clinic.manage', async () => {
    permissions(['users.manage']);
    show();
    await screen.findByText('Jana Nová');
    expect(screen.queryByRole('link', { name: /Nepřítomnost/ })).toBeNull();
  });

  it('says the list could not be loaded and offers another try', async () => {
    list.mockRejectedValue(new Error('down'));
    show();
    expect(await screen.findByText('Seznam účtů se nepodařilo načíst.')).toBeInTheDocument();
    list.mockResolvedValue([account()]);
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Jana Nová')).toBeInTheDocument();
  });

  it('says there are no accounts rather than drawing an empty table', async () => {
    list.mockResolvedValue([]);
    show();
    expect(await screen.findByText('Žádné účty')).toBeInTheDocument();
  });

  it('an empty team offers Přidat zaměstnance as the next step, and it opens the form', async () => {
    const user = userEvent.setup();
    list.mockResolvedValue([]);
    show();
    await screen.findByText('Žádné účty');
    await user.click(within(screen.getByRole('region', { name: 'Tým' })).getByRole('button', { name: 'Přidat zaměstnance' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Přidat zaměstnance');
  });

  it('draws Přehled and Tým as shelves, with the invitations nobody has used yet', async () => {
    list.mockResolvedValue([owner, account({ mustChangePassword: true })]);
    show();
    await screen.findByText('Jana Nová');
    expect(within(screen.getByRole('region', { name: 'Tým' })).getByLabelText('Počet: 2')).toBeInTheDocument();
    const invited = within(screen.getByRole('region', { name: 'Přehled' })).getByText('Pozvánky').closest('[data-card="metric"]') as HTMLElement;
    expect(invited).toHaveTextContent('1');
  });
});
