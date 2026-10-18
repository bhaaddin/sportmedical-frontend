/* The club list asks for all summaries once and seeds each club's single-summary cache entry. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { fetchSummaries, clubSummary } = vi.hoisted(() => ({ fetchSummaries: vi.fn(), clubSummary: vi.fn() }));
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubSummariesApi: { fetch: fetchSummaries } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, clubSummary } };
});

const { useClubSummaries, useClubSummary, clubSummaryKey } = await import('./ClubSummaryCard');

const summary = (clubId: string, totalSeats: number) => ({
  clubId, totalSeats, registered: 1, byService: [], byActivity: [], ordersByStatus: { confirmed: 2 }, bookedMinutes: 60, usedMinutes: 30,
});

type Seeded = { totalSeats: number; remaining: number; ordersByStatus: Record<string, number> };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchSummaries.mockReset();
  clubSummary.mockReset();
});

describe('useClubSummaries', () => {
  it('asks once, seeds each club under its single-summary key (normalized) and ends in batch mode', async () => {
    fetchSummaries.mockResolvedValue([summary('b', 20), summary('a', 10)]);
    const { result } = renderHook(() => useClubSummaries(['a', 'b']), { wrapper });
    expect(result.current).toBe('pending');
    await waitFor(() => expect(result.current).toBe('batch'));

    expect(fetchSummaries).toHaveBeenCalledTimes(1);
    expect(fetchSummaries).toHaveBeenCalledWith(['a', 'b']);
    const a = client.getQueryData<Seeded>(clubSummaryKey('a'));
    expect(a?.totalSeats).toBe(10);
    expect(a?.remaining).toBe(9); /* normalized: remaining worked out when the row has none */
    expect(a?.ordersByStatus.Confirmed).toBe(2);
    expect(client.getQueryData<Seeded>(clubSummaryKey('b'))?.totalSeats).toBe(20);
  });

  it('matches rows without a clubId by position (the answer is in the order asked)', async () => {
    fetchSummaries.mockResolvedValue([{ totalSeats: 7 }, { totalSeats: 8 }]);
    const { result } = renderHook(() => useClubSummaries(['a', 'b']), { wrapper });
    await waitFor(() => expect(result.current).toBe('batch'));
    expect(client.getQueryData<Seeded>(clubSummaryKey('a'))?.totalSeats).toBe(7);
    expect(client.getQueryData<Seeded>(clubSummaryKey('b'))?.totalSeats).toBe(8);
  });

  it('a club screen reading the single summary afterwards makes no request', async () => {
    fetchSummaries.mockResolvedValue([summary('a', 10)]);
    const batch = renderHook(() => useClubSummaries(['a']), { wrapper });
    await waitFor(() => expect(batch.result.current).toBe('batch'));

    const single = renderHook(() => useClubSummary('a'), { wrapper });
    expect(single.result.current.data?.totalSeats).toBe(10);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(clubSummary).not.toHaveBeenCalled();
  });

  it('falls back to single mode when the server has no batch route (null) or the call fails', async () => {
    fetchSummaries.mockResolvedValue(null);
    const missing = renderHook(() => useClubSummaries(['a']), { wrapper });
    await waitFor(() => expect(missing.result.current).toBe('single'));
    expect(client.getQueryData(clubSummaryKey('a'))).toBeUndefined();

    fetchSummaries.mockReset().mockRejectedValue(new Error('500'));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const failing = renderHook(() => useClubSummaries(['a']), { wrapper });
    await waitFor(() => expect(failing.result.current).toBe('single'));
  });

  it('asks nothing when there is no active club', () => {
    const { result } = renderHook(() => useClubSummaries([]), { wrapper });
    expect(result.current).toBe('batch');
    expect(fetchSummaries).not.toHaveBeenCalled();
  });
});
