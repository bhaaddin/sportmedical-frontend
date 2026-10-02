/*
 * "Odhlásit se" has to end the session on the server, not only in the browser.
 *
 * Both sign-out buttons used to delete the token from localStorage and do
 * nothing else, so the server kept the session valid for up to eight hours.
 *
 * What would have to break for these to fail: someone drops the DELETE, lets
 * a failed DELETE leave the token in place, or forgets the permissions list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const logout = vi.fn();
vi.mock('../api/auth', () => ({ authApi: { logout } }));

const { signOut } = await import('./signOut');

const originalLocation = window.location;

beforeEach(() => {
  logout.mockReset().mockResolvedValue(undefined);
  localStorage.setItem('token', 't');
  localStorage.setItem('user', '{}');
  localStorage.setItem('permissions', '[]');
  localStorage.setItem('settings.openSection', 'ucet');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: '/settings' },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  localStorage.clear();
});

describe('signOut', () => {
  it('revokes the session on the server', async () => {
    await signOut();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('clears what the sign-in stored, and nothing else', async () => {
    await signOut();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('permissions')).toBeNull();
    expect(localStorage.getItem('settings.openSection')).toBe('ucet');
  });

  it('still signs this browser out when the server cannot be reached', async () => {
    logout.mockRejectedValue(new Error('Network Error'));
    await signOut();
    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('asks the server before clearing the token the request needs', async () => {
    logout.mockImplementation(async () => {
      expect(localStorage.getItem('token')).toBe('t');
    });
    await signOut();
    expect(window.location.href).toBe('/login');
  });
});
