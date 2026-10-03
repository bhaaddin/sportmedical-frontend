/*
 * The public club terms: the minimum shows only when the clinic set one, and a
 * failure of any kind reads as "none" - never as a number of our own.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const get = vi.hoisted(() => vi.fn());
vi.mock('../web/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../web/http')>();
  return { ...actual, webHttp: { get: (...args: unknown[]) => get(...args) } };
});

const { fetchClubTerms, normalizeClubTerms, useClubTerms } = await import('./publicClubTerms');

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

beforeEach(() => { get.mockReset(); });

describe('normalizeClubTerms', () => {
  it('reads a number, a null, the envelope, and anything else as no minimum', () => {
    expect(normalizeClubTerms({ minimumPlayers: 18 })).toEqual({ minimumPlayers: 18 });
    expect(normalizeClubTerms({ success: true, data: { minimumPlayers: 18 } })).toEqual({ minimumPlayers: 18 });
    expect(normalizeClubTerms({ minimumPlayers: null })).toEqual({ minimumPlayers: null });
    expect(normalizeClubTerms({ minimumPlayers: '18' })).toEqual({ minimumPlayers: null });
    expect(normalizeClubTerms({ minimumPlayers: 0 })).toEqual({ minimumPlayers: null });
    expect(normalizeClubTerms({})).toEqual({ minimumPlayers: null });
    expect(normalizeClubTerms(null)).toEqual({ minimumPlayers: null });
    expect(normalizeClubTerms([])).toEqual({ minimumPlayers: null });
  });
});

describe('fetchClubTerms', () => {
  it('asks the anonymous endpoint', async () => {
    get.mockResolvedValue({ data: { minimumPlayers: 12 } });
    expect(await fetchClubTerms()).toEqual({ minimumPlayers: 12 });
    expect(get).toHaveBeenCalledWith('/api/public/club-terms');
  });

  it('returns no minimum when the endpoint fails', async () => {
    get.mockRejectedValue(new Error('404'));
    expect(await fetchClubTerms()).toEqual({ minimumPlayers: null });
  });
});

describe('useClubTerms', () => {
  it('starts with no minimum, so a prerender shows nothing, then takes the answer', async () => {
    get.mockResolvedValue({ data: { minimumPlayers: 9 } });
    const { result } = renderHook(() => useClubTerms(), { wrapper });
    expect(result.current.data).toEqual({ minimumPlayers: null });
    await waitFor(() => expect(result.current.data).toEqual({ minimumPlayers: 9 }));
  });

  it('stays at no minimum when the endpoint is down', async () => {
    get.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useClubTerms(), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current.data).toEqual({ minimumPlayers: null });
  });
});
