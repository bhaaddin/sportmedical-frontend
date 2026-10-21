/*
 * The history of one club order on a page of its own: the two views (everything / what the club sees), newest first,
 * the plain empty and error states, and the way back to the order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView, OrderHistoryItem } from '../../../api/clubOrders';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get } };
});

const { default: ClubOrderHistoryPage, newestFirst, historyEntries } = await import('./ClubOrderHistoryPage');

const ID = '80e74a6c-0000-4000-8000-000000000001';

const make = (history: unknown[]): ClubOrderView =>
  toOrder({
    id: ID, groupId: ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Confirmed', paymentMethod: 'ClubInvoice', activitySeats: [], totalSeats: 0, registered: 0,
    priceQuote: { listTotalCzk: 0, discounts: [], totalCzk: 0 }, requestedRanges: [], note: '', contact: null,
    createdBy: 'Staff', history, addenda: [], blocks: [],
  });

const HISTORY = [
  { atUtc: '2026-10-01T08:00:00Z', user: 'Eva', text: 'Objednávka potvrzena', visibleToClub: true },
  { atUtc: '2026-10-02T08:00:00Z', user: 'Eva', text: 'Interní poznámka k faktuře', visibleToClub: false },
  { atUtc: '2026-10-03T08:00:00Z', user: 'Eva', text: 'Termín 29. 10. odebrán', visibleToClub: true },
  { atUtc: '2026-10-04T08:00:00Z', user: 'Eva', text: 'Bez příznaku' },
];

function Where() {
  const loc = useLocation();
  const state = loc.state as { openOrderId?: string } | null;
  return <div data-testid="where" data-path={loc.pathname} data-open={String(state?.openOrderId ?? '')} />;
}

function mount(order: ClubOrderView | Error) {
  if (order instanceof Error) get.mockReset().mockRejectedValue(order);
  else get.mockReset().mockResolvedValue(order);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/clubs/objednavky/${ID}/historie`]}>
        <Routes>
          <Route path="/clubs/objednavky/:orderId/historie" element={<ClubOrderHistoryPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('history model', () => {
  const item = (atUtc: string, text: string, visibleToClub?: boolean): OrderHistoryItem => ({
    atUtc, user: '', text, ...(visibleToClub === undefined ? {} : { visibleToClub }),
  });

  it('newestFirst sorts by time, puts undated entries last and keeps the order of equal times', () => {
    const list = [item('2026-10-01T08:00:00Z', 'a'), item('', 'undated'), item('2026-10-03T08:00:00Z', 'c'), item('2026-10-03T08:00:00Z', 'd'), item('junk', 'junk')];
    expect(newestFirst(list).map((h) => h.text)).toEqual(['c', 'd', 'a', 'undated', 'junk']);
  });

  it('does not change the list it is given', () => {
    const list = [item('2026-10-01T08:00:00Z', 'a'), item('2026-10-02T08:00:00Z', 'b')];
    newestFirst(list);
    expect(list.map((h) => h.text)).toEqual(['a', 'b']);
  });

  it('the club view holds only the entries flagged visibleToClub, newest first', () => {
    const list = [item('2026-10-01T08:00:00Z', 'a', true), item('2026-10-02T08:00:00Z', 'b', false), item('2026-10-03T08:00:00Z', 'c', true), item('2026-10-04T08:00:00Z', 'd')];
    expect(historyEntries(list, 'club').map((h) => h.text)).toEqual(['c', 'a']);
    expect(historyEntries(list, 'all').map((h) => h.text)).toEqual(['d', 'c', 'b', 'a']);
  });

  it.each([[[] as OrderHistoryItem[]], [[item('', 'x')]]])('handles %j without throwing', (list) => {
    expect(() => historyEntries(list, 'club')).not.toThrow();
    expect(() => historyEntries(list, 'all')).not.toThrow();
  });
});

describe.each([['phone'], ['tablet'], ['desktop']] as const)('the order history page · %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('shows the whole history newest first, tells which entries the club sees, and names the order', async () => {
    mount(make(HISTORY));
    const list = await screen.findByTestId('order-history');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent('Bez příznaku');
    expect(items[3]).toHaveTextContent('Objednávka potvrzena');
    expect(within(list).getAllByText('Vidí klub')).toHaveLength(2);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Historie objednávky');
    expect(screen.getByText(/FK Slaný · KO-/)).toBeInTheDocument();
    expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (4)');
    expect(screen.getByTestId('history-view-club')).toHaveTextContent('Co vidí klub (2)');
  });

  it('"Co vidí klub" lists exactly what the club reads and hides the internal entries', async () => {
    const user = userEvent.setup();
    mount(make(HISTORY));
    await user.click(await screen.findByTestId('history-view-club'));
    const items = within(screen.getByTestId('order-history')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Termín 29. 10. odebrán');
    expect(items[1]).toHaveTextContent('Objednávka potvrzena');
    expect(screen.queryByText('Interní poznámka k faktuře')).not.toBeInTheDocument();
    expect(screen.getByText('Takto změny vidí klub ve svém portálu.')).toBeInTheDocument();
    await user.click(screen.getByTestId('history-view-all'));
    expect(within(screen.getByTestId('order-history')).getAllByRole('listitem')).toHaveLength(4);
  });

  it('says plainly when there is nothing, per view', async () => {
    const user = userEvent.setup();
    mount(make([]));
    expect(await screen.findByTestId('history-empty')).toHaveTextContent('Bez záznamů.');
    await user.click(screen.getByTestId('history-view-club'));
    expect(screen.getByTestId('history-empty')).toHaveTextContent('Klub zatím nevidí žádné změny.');
  });

  it('"Zpět na objednávku" returns to the orders page with this order open', async () => {
    const user = userEvent.setup();
    mount(make(HISTORY));
    await user.click(await screen.findByTestId('history-back'));
    const where = await screen.findByTestId('where');
    expect(where).toHaveAttribute('data-path', '/clubs/objednavky');
    expect(where).toHaveAttribute('data-open', ID);
  });

  it('a failed read says so and can be retried', async () => {
    const user = userEvent.setup();
    mount(new Error('boom'));
    expect(await screen.findByText('Historii se nepodařilo načíst.')).toBeInTheDocument();
    get.mockResolvedValue(make(HISTORY));
    await user.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    await waitFor(() => expect(screen.getByTestId('order-history')).toBeInTheDocument());
  });
});
