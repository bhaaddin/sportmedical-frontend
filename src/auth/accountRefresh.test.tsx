/*
 * The permissions on screen follow the server, not the sign-in.
 *
 * A stale login hid menu items: the list was read once at sign-in and a grant
 * or revocation reached the screen only after signing in again. These pin the
 * three moments the list is read again - start, focus, a 403 - and that a
 * component asking usePermission redraws when it changes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

const get = vi.fn();
const forbiddenListeners = new Set<() => void>();
vi.mock('../api/client', () => ({
  client: { get },
  onForbidden: (listener: () => void) => {
    forbiddenListeners.add(listener);
    return () => forbiddenListeners.delete(listener);
  },
}));

const { refreshAccount, useAccountRefresh, resetAccountRefreshForTests } = await import('./accountRefresh');
const { usePermission } = await import('./usePermission');

function account(permissions: string[]) {
  return {
    data: {
      account: { userId: 'u1', email: 'recepce@example.test', displayName: 'Jana Nová', role: 'Staff' },
      permissions,
    },
  };
}

function Probe() {
  useAccountRefresh();
  const mayManage = usePermission('settings.clinic.manage');
  return <span>{mayManage ? 'smí nastavovat' : 'nesmí nastavovat'}</span>;
}

beforeEach(() => {
  get.mockReset();
  forbiddenListeners.clear();
  resetAccountRefreshForTests();
  localStorage.setItem('token', 't');
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('refreshAccount', () => {
  it('stores the permissions and the name the server answers', async () => {
    get.mockResolvedValue(account(['patients.view', 'settings.clinic.manage']));

    await refreshAccount({ force: true });

    expect(get).toHaveBeenCalledWith('/api/v1/account');
    expect(JSON.parse(localStorage.getItem('permissions')!)).toEqual(['patients.view', 'settings.clinic.manage']);
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ firstName: 'Jana', lastName: 'Nová' });
  });

  it('asks nothing when nobody is signed in', async () => {
    localStorage.removeItem('token');

    await refreshAccount({ force: true });

    expect(get).not.toHaveBeenCalled();
  });

  it('keeps what it had when the server cannot answer', async () => {
    get.mockRejectedValue(new Error('Network Error'));

    await refreshAccount({ force: true });

    expect(JSON.parse(localStorage.getItem('permissions')!)).toEqual(['patients.view']);
  });

  it('does not re-read on every focus', async () => {
    get.mockResolvedValue(account(['patients.view']));

    await refreshAccount();
    await refreshAccount();

    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('useAccountRefresh', () => {
  it('reads the account on start and redraws what the permission hides', async () => {
    get.mockResolvedValue(account(['patients.view', 'settings.clinic.manage']));

    render(<Probe />);

    expect(await screen.findByText('smí nastavovat')).toBeInTheDocument();
  });

  it('reads it again when the window gets focus back, and follows a revocation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get.mockResolvedValue(account(['patients.view', 'settings.clinic.manage']));
    render(<Probe />);
    expect(await screen.findByText('smí nastavovat')).toBeInTheDocument();

    // The owner took it away while the tab was in the background.
    get.mockResolvedValue(account(['patients.view']));
    vi.advanceTimersByTime(11_000);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => expect(screen.getByText('nesmí nastavovat')).toBeInTheDocument());
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('reads it again after a refusal', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get.mockResolvedValue(account(['patients.view']));
    render(<Probe />);
    expect(await screen.findByText('nesmí nastavovat')).toBeInTheDocument();

    // Granted meanwhile; the next thing this person tried was refused on the old list.
    get.mockResolvedValue(account(['patients.view', 'settings.clinic.manage']));
    vi.advanceTimersByTime(3_000);
    await act(async () => {
      forbiddenListeners.forEach((listener) => listener());
    });

    expect(await screen.findByText('smí nastavovat')).toBeInTheDocument();
  });
});
