/*
 * Reads are retried when nobody answered or the server failed; a refusal is
 * an answer and is never retried; writes are never retried at all.
 */
import { describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';
import { shouldRetryQuery, createQueryClient, QUERY_RETRIES } from './queryClient';
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

  it('never retries a refusal', () => {
    for (const status of [400, 401, 403, 404, 409]) {
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
