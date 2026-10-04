/* The club as one whole: summary rendering at the three widths, the fallback when the call fails, and the pure helpers. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';

const { clubSummary } = vi.hoisted(() => ({ clubSummary: vi.fn() }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, clubSummary } };
});

const { ClubSummaryCard } = await import('./ClubSummaryCard');
const { filterOrders, normalizeSummary, statusCounts, termsSummary } = await import('./orderLogic');

const summary = {
  clubId: 'club-1', totalSeats: 80, registered: 41, remaining: 39,
  byService: [{ serviceId: 's-1', serviceName: 'Sportovní prohlídky', seats: 80, registered: 41 }],
  byActivity: [
    { activityId: 'a-1', activityName: 'Základní', serviceName: 'Sportovní prohlídky', seats: 20, registered: 7, remaining: 13 },
    { activityId: 'a-2', activityName: 'Diagnostika', serviceName: 'Sportovní prohlídky', seats: 60, registered: 34, remaining: 26 },
  ],
  ordersByStatus: { Invited: 1, Requested: 2, Confirmed: 3, Completed: 0, Cancelled: 1 },
  bookedMinutes: 2400, usedMinutes: 1800,
};

const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{node}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => { clubSummary.mockReset(); });

describe.each(Object.entries(VIEWPORTS))('club summary at %s (%ipx)', (_n, width) => {
  beforeEach(() => { setViewport(width); });

  it('shows totals, status chips, minutes and a row per service and činnost', async () => {
    clubSummary.mockResolvedValue(summary);
    render(wrap(<ClubSummaryCard clubId="club-1" fallback={<div>zálohový přehled</div>} />));
    const card = await screen.findByTestId('club-summary');
    expect(card).toHaveTextContent('80');
    expect(card).toHaveTextContent('hráčů celkem');
    expect(card).toHaveTextContent('ještě chybí');
    expect(within(card).getByTestId('summary-minutes').textContent?.replace(/\s/g, ' ')).toBe('Obsazeno 1 800 min z 2 400 min');
    expect(within(card).getByTestId('summary-statuses')).toHaveTextContent('Potvrzeno: 3');
    expect(within(card).getAllByTestId('summary-row')).toHaveLength(3);
    expect(within(card).getByRole('table', { name: 'Činnost' })).toHaveTextContent('Diagnostika');
    expect(screen.queryByText('zálohový přehled')).toBeNull();
  });

  it('falls back to the older card when the call fails', async () => {
    clubSummary.mockImplementation(async () => { await Promise.resolve(); throw new Error('500'); });
    render(wrap(<ClubSummaryCard clubId="club-1" fallback={<div>zálohový přehled</div>} />));
    await waitFor(() => expect(clubSummary).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(await screen.findByText('zálohový přehled')).toBeInTheDocument();
    expect(screen.queryByTestId('club-summary')).toBeNull();
  });
});

describe('helpers', () => {
  it('normalizeSummary fills what the server leaves out', () => {
    const s = normalizeSummary({ clubId: 'x', totalSeats: 10, registered: 4 } as never);
    expect(s.remaining).toBe(6);
    expect(s.ordersByStatus.Confirmed).toBe(0);
    expect(s.byActivity).toEqual([]);
  });

  const o = (id: string, status: string, extra: Record<string, unknown> = {}) =>
    toOrder({ id, status, createdAtUtc: `2026-10-0${id}T00:00:00Z`, requestedRanges: [{ fromDate: '2026-11-02', toDate: '2026-11-04' }], ...extra });

  it('counts per status, filters by overlap and writes the first term plus "+n"', () => {
    const orders = [o('1', 'Requested'), o('2', 'Confirmed'), o('3', 'Confirmed', { requestedRanges: [{ fromDate: '2026-12-01', toDate: '2026-12-01' }, { fromDate: '2026-12-08', toDate: '2026-12-08' }] })];
    expect(statusCounts(orders)).toMatchObject({ all: 3, Requested: 1, Confirmed: 2, Invited: 0 });
    expect(filterOrders(orders, 'Confirmed', '', '').map((x) => x.id)).toEqual(['3', '2']);
    expect(filterOrders(orders, 'all', '2026-11-04', '2026-11-30').map((x) => x.id)).toEqual(['2', '1']);
    expect(termsSummary(orders[2])).toBe('1. 12. 2026 +1');
  });
});
