/*
 * The one HTTP client decides three things for the whole application:
 *   - a 401 ends the session cleanly and says why on the sign-in screen,
 *   - a 403 asks for the permissions again (they may have changed),
 *   - no answer at all raises "Server je nedostupný" until the server is back.
 *
 * Driven through the client's own interceptors with a fake adapter, so what
 * is tested is what every screen actually goes through.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

const stop = vi.fn();
vi.mock('../services/socketService', () => ({ socketService: { stop } }));

const { client, onForbidden, resetClientStateForTests, SESSION_EXPIRED_PATH } = await import('./client');
const { connection, resetConnectionForTests } = await import('./connection');

const originalAdapter = client.defaults.adapter;
const originalLocation = window.location;

function answer(status: number, data: unknown = {}): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const response = { data, status, statusText: '', headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return response;
    throw new AxiosError('refused', 'ERR_BAD_RESPONSE', config, {}, response);
  };
}

function noAnswer(): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config, {});
  };
}

beforeEach(() => {
  stop.mockReset();
  resetClientStateForTests();
  resetConnectionForTests();
  localStorage.setItem('token', 't');
  localStorage.setItem('user', '{}');
  localStorage.setItem('permissions', '["patients.view"]');
  localStorage.setItem('settings.openSection', 'ucet');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: '/patients', pathname: '/patients' },
  });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
});

afterEach(() => {
  client.defaults.adapter = originalAdapter;
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe('401', () => {
  it('clears the session, stops the live connection and sends the person to sign in with a reason', async () => {
    client.defaults.adapter = answer(401);

    await expect(client.get('/api/patients')).rejects.toBeInstanceOf(AxiosError);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('permissions')).toBeNull();
    expect(localStorage.getItem('settings.openSection')).toBe('ucet');
    expect(stop).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe(SESSION_EXPIRED_PATH);
  });

  it('leaves a public page alone when nobody was signed in', async () => {
    localStorage.removeItem('token');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '/objednat', pathname: '/objednat' },
    });
    client.defaults.adapter = answer(401);

    await expect(client.get('/api/public/clinic')).rejects.toBeInstanceOf(AxiosError);

    expect(window.location.href).toBe('/objednat');
    expect(stop).not.toHaveBeenCalled();
  });

  it('does not treat a wrong password at sign-in as an expired session', async () => {
    client.defaults.adapter = answer(401);

    await expect(client.post('/api/v1/session', {})).rejects.toBeInstanceOf(AxiosError);

    expect(localStorage.getItem('token')).toBe('t');
    expect(window.location.href).toBe('/patients');
  });
});

describe('403', () => {
  it('tells the account refresh, and keeps the session', async () => {
    const refused = vi.fn();
    onForbidden(refused);
    client.defaults.adapter = answer(403, { code: 'access.denied' });

    await expect(client.get('/api/audit')).rejects.toBeInstanceOf(AxiosError);

    expect(refused).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('token')).toBe('t');
  });
});

describe('no answer', () => {
  it('marks the server unreachable, keeps retrying, and announces the recovery', async () => {
    vi.useFakeTimers();
    const recovered = vi.fn();
    connection.onRecovered(recovered);
    client.defaults.adapter = noAnswer();

    await expect(client.get('/api/patients')).rejects.toBeInstanceOf(AxiosError);
    expect(connection.getState()).toBe('unreachable');
    expect(localStorage.getItem('token')).toBe('t');

    // First probe fails: still unreachable, and it asks again.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(connection.getState()).toBe('unreachable');

    // The server is back.
    vi.mocked(fetch).mockResolvedValue(new Response('ok', { status: 200 }));
    await vi.advanceTimersByTimeAsync(4_000);

    expect(connection.getState()).toBe('online');
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it('counts a proxy saying the API is down as no answer', async () => {
    client.defaults.adapter = answer(502);

    await expect(client.get('/api/patients')).rejects.toBeInstanceOf(AxiosError);

    expect(connection.getState()).toBe('unreachable');
  });

  it('is cleared by the next request that gets any answer', async () => {
    client.defaults.adapter = noAnswer();
    await expect(client.get('/api/patients')).rejects.toBeInstanceOf(AxiosError);
    const recovered = vi.fn();
    connection.onRecovered(recovered);

    client.defaults.adapter = answer(200, { success: true, data: [] });
    await client.get('/api/patients');

    expect(connection.getState()).toBe('online');
    expect(recovered).toHaveBeenCalledTimes(1);
  });
});

describe('the client itself', () => {
  it('has a timeout, so a hung server becomes "no answer" rather than a spinner', () => {
    expect(client.defaults.timeout).toBeGreaterThan(0);
  });

  it('sends the stored token', async () => {
    let seen: string | undefined;
    client.defaults.adapter = async (config) => {
      seen = AxiosHeaders.from(config.headers).get('Authorization') as string | undefined;
      return { data: {}, status: 200, statusText: '', headers: {}, config, request: {} };
    };

    await client.get('/api/v1/account');

    expect(seen).toBe('Bearer t');
  });
});
