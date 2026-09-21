/*
 * What one member of staff may do.
 *
 * The owner asked for this per employee — "co může vidět, co může upravovat,
 * zda může rušit rezervace" — and what existed was a switch over three roles in
 * the source: every receptionist had identical powers, for ever, and the only
 * way to give one of them something extra was to make her an administrator.
 *
 * The part worth testing is the third state. "Podle role" is not the same as
 * "ne": it means this person keeps following the role when its defaults change,
 * and a screen that sent `false` for it would silently freeze everybody on
 * today's defaults the first time anybody touched a switch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const list = vi.fn();
const set = vi.fn();

vi.mock('../../api/userPermissions', async () => {
  const actual = await vi.importActual<typeof import('../../api/userPermissions')>(
    '../../api/userPermissions',
  );

  return { ...actual, userPermissionsApi: { list, set } };
});

const { UserPermissionsDialog } = await import('./UserPermissionsDialog');

const row = (over: Record<string, unknown> = {}) => ({
  permission: 'bookings.cancel',
  fromRole: true,
  effective: true,
  isOverridden: false,
  ...over,
});

beforeEach(() => {
  list.mockReset().mockResolvedValue([row()]);
  set.mockReset().mockResolvedValue([row({ effective: false, isOverridden: true })]);
});

const open = (props: Partial<Parameters<typeof UserPermissionsDialog>[0]> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

  const ui: ReactNode = (
    <QueryClientProvider client={client}>
      <UserPermissionsDialog
        userId="u1"
        userName="Petra Nováková"
        isOwner={false}
        onClose={() => {}}
        {...props}
      />
    </QueryClientProvider>
  );

  return render(ui);
};

describe('what one member of staff may do', () => {
  it('shows the permission in Czech, not as a dotted identifier', async () => {
    open();

    expect(await screen.findByText('Rušit rezervace')).toBeInTheDocument();
    expect(screen.getByText('Zrušit už objednaný termín.')).toBeInTheDocument();
  });

  it('revokes one thing without touching the rest', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: /^Zakázat:/ }));

    await waitFor(() => expect(set).toHaveBeenCalled());
    expect(set.mock.calls[0]).toEqual(['u1', 'bookings.cancel', false]);
  });

  it('puts a permission back on the role, which is not the same as refusing it', async () => {
    list.mockResolvedValue([row({ effective: false, isOverridden: true })]);

    open();

    await userEvent.click(await screen.findByRole('button', { name: /^Podle role:/ }));

    await waitFor(() => expect(set).toHaveBeenCalled());
    expect(set.mock.calls[0][2]).toBeNull();
  });

  it('says which permissions were decided by hand', async () => {
    list.mockResolvedValue([row({ effective: false, isOverridden: true })]);

    open();

    expect(await screen.findByText('Nastaveno ručně')).toBeInTheDocument();
  });

  it('does not offer to adjust the owner, and says why', async () => {
    open({ isOwner: true });

    expect(
      await screen.findByText(/Majitel má vždy všechna práva/),
    ).toBeInTheDocument();

    expect(list).not.toHaveBeenCalled();
  });
});
