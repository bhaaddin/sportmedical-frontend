/*
 * Etapa 10: everything stays in step. One order change (a window taken out of the order, from the order detail)
 * refreshes the club page card, the order detail and what the calendar reads (the restricted-window label) at once,
 * without a reload - and the card keeps its place (same element, no skeleton) while the list is refetching.
 * `invalidateClubWorld` is the single helper every club/order mutation uses.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, keepPreviousData, useQuery } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { toOrder } from '../../api/clubOrders';
import type { ClubOrderView } from '../../api/clubOrders';

const { list, get, update, fetchActivities, invoiceDraft } = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), update: vi.fn(), fetchActivities: vi.fn(), invoiceDraft: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list, get, update, invoiceDraft, cancel: vi.fn() } };
});
vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: fetchActivities };
});
vi.mock('../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('./order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { ClubOrderCard } = await import('./detail/ClubOrderCard');
const { ClubOrderDetailPanel } = await import('./orders/ClubOrderDetailPanel');
const { useWindowRestrictions } = await import('../booking/calendar/windowRestrictions');
const { CLUB_WORLD_KEYS, invalidateClubWorld } = await import('./clubWorld');

const ID = '80e74a6c-0000-4000-8000-0000000000dd';
const win = (id: string, from: string, activityIds: string[]) => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['cal-1'], activityIds, fromDate: from, toDate: from,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: ID,
});

const make = (blocks: ReturnType<typeof win>[]): ClubOrderView =>
  toOrder({
    id: ID, groupId: ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Sportovní prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 4, registered: 0, unitPriceCzk: 200 },
      { activityId: 'a-2', activityName: 'Spiroergometrie', durationMinutes: 60, seats: 2, registered: 0, unitPriceCzk: 400 },
    ],
    totalSeats: 6, registered: 0, requestedRanges: [], note: '', createdBy: 'Staff', history: [], registrationUrl: 'https://app.test/klub/rt', addenda: [],
    blocks,
  });

const W1 = win('w1', '2099-10-26', ['a-2']);
const W2 = win('w2', '2099-10-27', ['a-1', 'a-2']);
const W3 = win('w3', '2099-10-28', ['a-1']);

/* The "server": what the next read answers. */
let server: ClubOrderView = make([W1, W2, W3]);

/** The club page's order list (the same query as ClubPresentation) and the calendar's reading of the windows. */
function ClubPageAndCalendar() {
  const query = useQuery({ queryKey: ['club-orders', 'club-1', '', ''], queryFn: () => list({ clubId: 'club-1' }), placeholderData: keepPreviousData });
  const restricted = useWindowRestrictions();
  const orders: ClubOrderView[] = query.data ?? [];
  return (
    <div>
      {orders.map((o) => (
        <ClubOrderCard key={o.id} order={o} today="2099-10-01" onOpen={() => undefined} onChanged={() => undefined} />
      ))}
      <div data-testid="calendar-restricted">{[...restricted.values()].join(' | ') || 'none'}</div>
    </div>
  );
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ClubPageAndCalendar />
        <ClubOrderDetailPanel orderId={ID} onClose={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  server = make([W1, W2, W3]);
  list.mockReset().mockImplementation(async () => [server]);
  get.mockReset().mockImplementation(async () => server);
  update.mockReset().mockImplementation(async () => {
    server = make([W1, W2]);
    return server;
  });
  fetchActivities.mockReset().mockResolvedValue([]);
  invoiceDraft.mockReset().mockResolvedValue({ clubId: 'club-1', groupId: ID, paymentMethod: 'ClubInvoice', headcount: 6, lines: [], discounts: [], listTotalCzk: 0, totalCzk: 0, note: '', invoiceId: null, supplementary: false, alreadyInvoiced: [] });
});

describe('one change, everywhere at once', () => {
  it('taking a window out of the order refreshes the club card, the order detail and the calendar without a reload', async () => {
    const user = userEvent.setup();
    mount();
    const card = await screen.findByTestId('club-order-card');
    const detail = await screen.findByTestId('confirmed-windows');
    expect(within(card).getAllByTestId('order-window')).toHaveLength(3);
    expect(within(detail).getAllByTestId('order-window')).toHaveLength(3);
    await waitFor(() => expect(screen.getByTestId('calendar-restricted')).toHaveTextContent('Spiroergometrie | Základní prohlídka'));

    await user.click(within(detail).getByRole('button', { name: /Odebrat termín St 28\. 10\./ }));
    await user.click(await screen.findByRole('button', { name: 'Odebrat termín' }));

    await waitFor(() => expect(within(screen.getByTestId('confirmed-windows')).getAllByTestId('order-window')).toHaveLength(2));
    expect(within(screen.getByTestId('club-order-card')).getAllByTestId('order-window')).toHaveLength(2);
    expect(screen.getByTestId('calendar-restricted')).toHaveTextContent(/^Spiroergometrie$/);
    /* The restricted window kept its činnost in what was sent: the order is saved as ONE update with both windows. */
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][1].ranges).toEqual([
      { fromDate: '2099-10-26', toDate: '2099-10-26', dailyFrom: '08:00', dailyTo: '12:00', activityIds: ['a-2'] },
      { fromDate: '2099-10-27', toDate: '2099-10-27', dailyFrom: '08:00', dailyTo: '12:00' },
    ]);
  });

  it('the order card keeps its place while the list refetches: the same element, no skeleton, no blank', async () => {
    const client = mount();
    const card = await screen.findByTestId('club-order-card');
    const releases: ((orders: ClubOrderView[]) => void)[] = [];
    const before = list.mock.calls.length;
    list.mockImplementation(() => new Promise<ClubOrderView[]>((resolve) => { releases.push(resolve); }));
    const refetching = invalidateClubWorld(client);
    /* the club page list and the calendar's own read both go out again */
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(before));
    /* The list is in flight: the card is still there, untouched, and nothing replaced it with a placeholder. */
    expect(screen.getByTestId('club-order-card')).toBe(card);
    expect(within(card).getAllByTestId('order-window')).toHaveLength(3);
    expect(document.querySelector('.MuiSkeleton-root')).toBeNull();
    server = make([W1, W2]);
    for (const release of releases) release([server]);
    await refetching;
    await waitFor(() => expect(within(screen.getByTestId('club-order-card')).getAllByTestId('order-window')).toHaveLength(2));
    expect(screen.getByTestId('club-order-card')).toBe(card);
  });

  it('invalidateClubWorld touches every key a club change can affect (orders, windows, calendar)', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await invalidateClubWorld(client);
    const keys = spy.mock.calls.map((c) => (c[0]?.queryKey as string[])[0]);
    expect(keys).toEqual([...CLUB_WORLD_KEYS]);
    for (const key of ['club-order', 'club-orders', 'club-summary', 'club-stats', 'club-blocks', 'blocks', 'day-range', 'grid-preview', 'clubs']) {
      expect(keys).toContain(key);
    }
  });
});
