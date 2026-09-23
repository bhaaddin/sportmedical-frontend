/*
 * Tým a účty: the login account is the employee.
 *
 * The screen used to list a second "staff member" record per person and pair
 * it with the account by e-mail. "Smazat" archived that record and left the
 * login working, so a dismissed employee could still sign in; and rows that
 * had no such record showed a hardcoded "Účet aktivní" with values in the
 * wrong columns.
 *
 * What would have to break for these to fail: listing anything but the
 * accounts, a switch-off that does not reach the account, or an access state
 * that is not the account's own.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const list = vi.fn();
const setActive = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('../api/userAccounts', async () => {
  const actual = await vi.importActual<typeof import('../api/userAccounts')>('../api/userAccounts');
  return {
    ...actual,
    userAccountsApi: { list, setActive, create, update, resetPassword: vi.fn(), assignRole: vi.fn() },
  };
});
vi.mock('../components/admin/UserPermissionsDialog', () => ({ UserPermissionsDialog: () => null }));
vi.mock('../components/admin/WhereSomebodyWorksDialog', () => ({ WhereSomebodyWorksDialog: () => null }));

const { default: StaffManagement } = await import('./StaffManagement');

const account = (over: Record<string, unknown>) => ({
  userId: 'u1',
  email: 'jana@ordinace.cz',
  displayName: 'Jana Nová',
  role: 'Staff',
  isActive: true,
  mustChangePassword: false,
  createdAtUtc: '2026-09-01T10:00:00Z',
  lastLoginAtUtc: null,
  ...over,
});

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['users.manage']));
  list.mockReset().mockResolvedValue([
    account({}),
    account({ userId: 'u2', email: 'petr@ordinace.cz', displayName: 'Petr Starý', isActive: false }),
  ]);
  setActive.mockReset().mockResolvedValue(account({ isActive: false }));
  create.mockReset();
  update.mockReset().mockResolvedValue(account({ displayName: 'Jana Horáková' }));
});

const rowOf = async (name: string) => {
  const cell = await screen.findByText(name);
  return within(cell.closest('tr') as HTMLElement);
};

describe('the team', () => {
  it('shows each account with its own e-mail, role and access', async () => {
    render(<StaffManagement />);

    const jana = await rowOf('Jana Nová');
    expect(jana.getByText('jana@ordinace.cz')).toBeInTheDocument();
    expect(jana.getByText('Personál')).toBeInTheDocument();
    expect(jana.getByText('Aktivní')).toBeInTheDocument();

    const petr = await rowOf('Petr Starý');
    expect(petr.getByText('Vypnutý')).toBeInTheDocument();
    expect(petr.queryByText('Aktivní')).not.toBeInTheDocument();
  });

  it('switches the login off, not a separate record', async () => {
    const user = userEvent.setup();
    render(<StaffManagement />);

    await user.click(await screen.findByLabelText('Vypnout přístup Jana Nová'));
    await user.click(screen.getByRole('button', { name: 'Vypnout přístup' }));

    await waitFor(() => expect(setActive).toHaveBeenCalledWith('u1', false));
  });

  it('offers the permissions and the rota on every account', async () => {
    render(<StaffManagement />);

    expect(await screen.findByLabelText('Co smí Jana Nová')).toBeInTheDocument();
    expect(screen.getByLabelText('Kde pracuje Petr Starý')).toBeInTheDocument();
  });

  it('does not offer the Owner role to somebody who may not manage roles', async () => {
    const user = userEvent.setup();
    render(<StaffManagement />);

    await user.click(await screen.findByRole('button', { name: 'Přidat zaměstnance' }));
    await user.click(screen.getByLabelText('Role'));

    expect(screen.getByRole('option', { name: 'Personál' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Vlastník' })).not.toBeInTheDocument();
  });
});

describe('editing an employee', () => {
  it('changes the name and the sign-in e-mail through PUT /api/v1/users/{id}', async () => {
    const user = userEvent.setup();
    render(<StaffManagement />);

    await user.click(await screen.findByLabelText('Upravit Jana Nová'));
    const name = screen.getByLabelText('Jméno a příjmení');
    await user.clear(name);
    await user.type(name, 'Jana Horáková');
    const email = screen.getByLabelText('E-mail');
    await user.clear(email);
    await user.type(email, ' jana.horakova@ordinace.cz ');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('u1', {
        displayName: 'Jana Horáková',
        email: 'jana.horakova@ordinace.cz',
      }),
    );
    expect(await screen.findByText('Údaje zaměstnance uloženy.')).toBeInTheDocument();
  });

  it('says in Czech when the e-mail belongs to somebody else', async () => {
    update.mockRejectedValue({ response: { status: 409, data: { code: 'account.email_already_exists' } } });
    const user = userEvent.setup();
    render(<StaffManagement />);

    await user.click(await screen.findByLabelText('Upravit Jana Nová'));
    const email = screen.getByLabelText('E-mail');
    await user.clear(email);
    await user.type(email, 'petr@ordinace.cz');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Účet s tímto e-mailem už existuje.')).toBeInTheDocument();
  });
});
