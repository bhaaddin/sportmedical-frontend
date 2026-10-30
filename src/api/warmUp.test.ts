import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetWarmUpForTests, warmUpServer } from './warmUp';

afterEach(() => {
  vi.unstubAllGlobals();
  resetWarmUpForTests();
});

describe('warmUpServer: opening any page starts waking a sleeping server', () => {
  it('asks /health/live once, anonymously and uncached, however many times it is called', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    warmUpServer();
    warmUpServer();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/health\/live$/);
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'omit' });
  });

  it('never throws and never leaves an unhandled rejection when the server does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(() => warmUpServer()).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing where fetch does not exist', () => {
    vi.stubGlobal('fetch', undefined);
    expect(() => warmUpServer()).not.toThrow();
  });
});

describe('server state (speed-fe-6)', () => {
  it('is idle (nothing waits) until warmUpServer is called, ready once /health/live answers', async () => {
    const { getServerState, whenServerReady } = await import('./warmUp');
    expect(getServerState()).toBe('idle');
    await whenServerReady();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    warmUpServer();
    await vi.waitFor(() => expect(getServerState()).toBe('ready'));
  });

  it('polls every 2 s while the server sleeps, then releases whoever waits', async () => {
    vi.useFakeTimers();
    try {
      const { getServerState, whenServerReady, POLL_MS } = await import('./warmUp');
      const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('x')).mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);
      warmUpServer();
      const waited = whenServerReady();
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
      await waited;
      expect(getServerState()).toBe('ready');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
