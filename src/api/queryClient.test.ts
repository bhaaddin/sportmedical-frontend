/*
 * Reads are retried when nobody answered or the server failed; a refusal is
 * an answer and is never retried; writes are never retried at all.
 */
import { describe, it, expect, vi } from 'vitest';
import { AxiosError } from 'axios';
import { QueryObserver } from '@tanstack/react-query';
import {
  shouldRetryQuery,
  createQueryClient,
  markStaleAfterWrite,
  QUERY_RETRIES,
  DEFAULT_STALE_MS,
  REFERENCE_STALE_MS,
  HOLIDAYS_STALE_MS,
  CACHE_KEEP_MS,
} from './queryClient';
import { reconnectDelayMs } from '../services/socketService';

function refused(status: number) {
  return new AxiosError('x', 'ERR_BAD_RESPONSE', undefined, {}, {
    status, statusText: '', headers: {}, data: {}, config: {} as never,
  });
}

describe('shouldRetryQuery', () => {
  it('retries a read that got no answer, up to the limit', () => {
    const noAnswer = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(shouldRetryQuery(0, noAnswer)).toBe(true);
    expect(shouldRetryQuery(QUERY_RETRIES, noAnswer)).toBe(false);
  });

  it('retries a server failure', () => {
    expect(shouldRetryQuery(0, refused(500))).toBe(true);
    expect(shouldRetryQuery(0, refused(503))).toBe(true);
  });

  it('never retries a refusal, and not a 429 either: the HTTP client has waited already', () => {
    for (const status of [400, 401, 403, 404, 409, 429]) {
      expect(shouldRetryQuery(0, refused(status))).toBe(false);
    }
  });
});

describe('createQueryClient', () => {
  it('does not retry writes and refetches after a reconnect', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
  });
});

describe('reconnectDelayMs', () => {
  it('backs off and never gives up', () => {
    expect(reconnectDelayMs(0, 0)).toBe(1_000);
    expect(reconnectDelayMs(3, 0)).toBe(8_000);
    expect(reconnectDelayMs(50, 0)).toBe(30_000);
    expect(reconnectDelayMs(50, 0.99)).toBeLessThan(31_000);
  });
});

describe('the defaults', () => {
  it('count ordinary data as current for 30 s, keep it 30 min and do not refetch on every focus', () => {
    const q = createQueryClient().getDefaultOptions().queries;
    expect(q?.staleTime).toBe(DEFAULT_STALE_MS);
    expect(DEFAULT_STALE_MS).toBe(30_000);
    expect(q?.gcTime).toBe(CACHE_KEEP_MS);
    expect(CACHE_KEEP_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
    expect(q?.refetchOnWindowFocus).toBe(false);
  });

  it('count what the clinic configures as current for minutes, holidays longer still', () => {
    const client = createQueryClient();
    for (const key of ['calendars', 'activities', 'clinic-services', 'services', 'settings', 'club-block-activities']) {
      expect(client.getQueryDefaults([key, 'x']).staleTime).toBe(REFERENCE_STALE_MS);
    }
    expect(REFERENCE_STALE_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(client.getQueryDefaults(['holidays', 2026]).staleTime).toBe(HOLIDAYS_STALE_MS);
    expect(client.getQueryDefaults(['patients', 'x']).staleTime).toBeUndefined();
  });

  it('keep the live data honest on focus, and free slots always asked again', () => {
    const client = createQueryClient();
    for (const key of ['day-range', 'blocks', 'club-blocks', 'club-orders', 'partner-orders']) {
      expect(client.getQueryDefaults([key]).refetchOnWindowFocus).toBe(true);
    }
    expect(client.getQueryDefaults(['calendars']).refetchOnWindowFocus).toBeUndefined();
    expect(client.getQueryDefaults(['availability', 'c', 'a']).staleTime).toBe(0);
  });
});

describe('two screens, one request', () => {
  it('a second screen asking the same key inside the window reads the cache and does not fetch', async () => {
    const client = createQueryClient();
    const fetchBlocks = vi.fn().mockResolvedValue([{ id: 'b1' }]);
    const clubsPage = new QueryObserver(client, { queryKey: ['club-blocks', 'list'], queryFn: fetchBlocks });
    const playersPage = new QueryObserver(client, { queryKey: ['club-blocks', 'list'], queryFn: fetchBlocks });

    const first = await clubsPage.refetch();
    const second = await playersPage.getCurrentQuery().state.data;

    expect(first.data).toEqual([{ id: 'b1' }]);
    expect(second).toEqual([{ id: 'b1' }]);
    const unsubscribe = playersPage.subscribe(() => undefined);
    await Promise.resolve();
    expect(fetchBlocks).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe('a write marks cached data stale without fetching', () => {
  const seed = () => {
    const client = createQueryClient();
    client.setQueryData(['day-range', 'a', 'b', 'c'], [1]);
    client.setQueryData(['club-orders', '', '', ''], [1]);
    client.setQueryData(['calendars'], [1]);
    client.setQueryData(['settings', 'company'], [1]);
    return client;
  };
  const stale = (client: ReturnType<typeof seed>, key: unknown[]) => client.getQueryState(key)?.isInvalidated === true;

  it('an ordinary booking write leaves reference data alone but marks the rest', () => {
    const client = seed();
    markStaleAfterWrite(client, { method: 'post', url: '/api/calendars/c1/appointments' });
    expect(stale(client, ['day-range', 'a', 'b', 'c'])).toBe(true);
    expect(stale(client, ['club-orders', '', '', ''])).toBe(true);
    expect(stale(client, ['calendars'])).toBe(false);
    expect(stale(client, ['settings', 'company'])).toBe(false);
  });

  it('a configuration write marks reference data too', () => {
    const client = seed();
    markStaleAfterWrite(client, { method: 'put', url: '/api/v1/settings/company' });
    expect(stale(client, ['settings', 'company'])).toBe(true);
    expect(stale(client, ['calendars'])).toBe(true);
    expect(stale(client, ['day-range', 'a', 'b', 'c'])).toBe(true);
  });

  it('a question asked with POST (free slots, a price) changes nothing', () => {
    const client = seed();
    markStaleAfterWrite(client, { method: 'post', url: '/api/availability' });
    markStaleAfterWrite(client, { method: 'post', url: '/api/v1/billing/price-quote' });
    expect(stale(client, ['day-range', 'a', 'b', 'c'])).toBe(false);
  });

  it('signing in empties the cache', () => {
    const client = seed();
    markStaleAfterWrite(client, { method: 'post', url: '/api/v1/session' });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
