/*
 * R14a on the page: one merged timeline for the order group, filter chips per kind, links to the thing an entry is about,
 * and the same story whichever order of the group the desk opened it from.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { orderCode } from '../../../components/clubs/order/orderFormat';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get } };
});

const { default: ClubOrderHistoryPage } = await import('./ClubOrderHistoryPage');

const ROOT = '80e74a6c-0000-4000-8000-0000000000a1';
const ADD = '80e74a6c-0000-4000-8000-0000000000b2';
const ADD2 = '80e74a6c-0000-4000-8000-0000000000c3';

type Line = { atUtc: string; user: string; text: string; visibleToClub?: boolean };
const summary = (id: string) => ({ id, serviceName: 'Fyzio', status: 'Confirmed', totalSeats: 4, registered: 0, totalCzk: 0 });

const make = (id: string, history: Line[], extra: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id, groupId: ROOT, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Prohlídky', status: 'Confirmed',
    paymentMethod: 'ClubInvoice', activitySeats: [], totalSeats: 0, registered: 0,
    priceQuote: { listTotalCzk: 0, discounts: [], totalCzk: 0 }, requestedRanges: [], note: '', contact: null,
    createdBy: 'Staff', history, addenda: [], blocks: [], ...extra,
  });

const root = make(ROOT, [
  { atUtc: '2026-10-01T08:00:00Z', user: 'Eva', text: 'Objednávka založena. Odkaz na formulář čeká na předání klubu.' },
  { atUtc: '2026-10-02T08:00:00Z', user: 'Eva', text: 'Objednávka potvrzena, v kalendáři vznikly 2 období.' },
  { atUtc: '2026-10-05T08:00:00.002Z', user: 'Eva', text: `Přidán dodatek ${orderCode(ADD)}: Fyzio, 4 míst.` },
  { atUtc: '2026-10-08T09:00:00Z', user: 'Eva', text: 'Vystavena společná faktura 2026-0042 za 2 objednávek skupiny.' },
  { atUtc: '2026-10-09T09:00:00Z', user: 'Eva', text: 'Zpráva ordinace: Přineste doklady.', visibleToClub: true },
], { addenda: [summary(ADD)] });

const addendum = make(ADD, [
  { atUtc: '2026-10-05T08:00:00.001Z', user: 'Eva', text: `Dodatek k objednávce ${orderCode(ROOT)}: Fyzio, 4 míst.` },
  { atUtc: '2026-10-07T08:00:00Z', user: 'Eva', text: 'Počet hráčů změněn: Masáž 4 → 6.', visibleToClub: true },
], { parentOrderId: ROOT });

function Where() {
  const loc = useLocation();
  const state = loc.state as { openOrderId?: string } | null;
  return <div data-testid="where" data-path={loc.pathname} data-open={String(state?.openOrderId ?? '')} />;
}

function mount(openId: string, orders: Record<string, ClubOrderView | Error> = { [ROOT]: root, [ADD]: addendum }, permissions: string[] = ['billing.manage']) {
  window.localStorage.setItem('permissions', JSON.stringify(permissions));
  get.mockReset().mockImplementation(async (id: string) => {
    const found = orders[id];
    if (found === undefined || found instanceof Error) throw found ?? new Error('404');
    return found;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/clubs/objednavky/${openId}/historie`]}>
        <Routes>
          <Route path="/clubs/objednavky/:orderId/historie" element={<ClubOrderHistoryPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const texts = () => within(screen.getByTestId('order-history')).getAllByRole('listitem').map((li) => li.textContent ?? '');

describe.each([['phone'], ['tablet'], ['desktop']] as const)('the merged history · %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('shows the root and its addendum as ONE list, newest first, creation of the addendum once', async () => {
    mount(ROOT);
    await screen.findByTestId('order-history');
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));

    const list = texts();
    expect(list).toHaveLength(6);
    expect(list[0]).toContain('Zpráva ordinace: Přineste doklady.');
    expect(list[1]).toContain('Vystavena společná faktura');
    expect(list[2]).toContain('Počet hráčů změněn');
    expect(list[2]).toContain(`Dodatek ${orderCode(ADD)}`);
    expect(list.filter((t) => t.includes('Dodatek k objednávce'))).toHaveLength(0);
    expect(list.filter((t) => t.includes('Přidán dodatek'))).toHaveLength(1);
    expect(screen.getByText(/včetně dodatků/)).toBeInTheDocument();
  });

  it('reads the same story when the desk opened it from the addendum', async () => {
    mount(ADD);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    expect(texts()).toHaveLength(6);
    expect(get).toHaveBeenCalledWith(ROOT);
  });

  it('each entry says its kind, its time in Prague and who', async () => {
    mount(ROOT);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    const first = within(screen.getByTestId('order-history')).getAllByRole('listitem')[0];
    expect(within(first).getByTestId('history-kind')).toHaveTextContent('Zprávy klubu');
    expect(first).toHaveTextContent(/9\. 10\. 2026/);
    expect(first).toHaveTextContent('Eva');
  });

  it('a chip narrows the list to its kind, another adds to it, "Zrušit filtr" clears them', async () => {
    const user = userEvent.setup();
    mount(ROOT);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));

    await user.click(screen.getByTestId('history-kind-invoice'));
    expect(texts()).toHaveLength(1);
    expect(texts()[0]).toContain('faktura');
    expect(screen.getByTestId('history-kind-invoice')).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByTestId('history-kind-message'));
    expect(texts()).toHaveLength(2);

    await user.click(screen.getByTestId('history-kinds-clear'));
    expect(texts()).toHaveLength(6);
    expect(screen.queryByTestId('history-kinds-clear')).toBeNull();
  });

  it('draws chips only for kinds that exist, each with its count, at a 44 px target', async () => {
    mount(ROOT);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    expect(screen.getByTestId('history-kind-invoice')).toHaveTextContent('Faktury (1)');
    expect(screen.getByTestId('history-kind-addendum')).toHaveTextContent('Dodatky (1)');
    expect(screen.getByTestId('history-kind-players')).toHaveTextContent('Hráči (1)');
    expect(screen.queryByTestId('history-kind-other')).toBeNull();
    expect(getComputedStyle(screen.getByTestId('history-kind-status')).height).toBe('44px');
  });

  it('"Co vidí klub" keeps the chips working inside what the club reads', async () => {
    const user = userEvent.setup();
    mount(ROOT);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    await user.click(screen.getByTestId('history-view-club'));
    expect(texts()).toHaveLength(2);
    expect(screen.queryByTestId('history-kind-invoice')).toBeNull();
    await user.click(screen.getByTestId('history-kind-players'));
    expect(texts()).toHaveLength(1);
    await user.click(screen.getByTestId('history-kind-message'));
    expect(texts()).toHaveLength(2);
  });

  it('an entry about an addendum opens that order, an invoice entry opens Faktury', async () => {
    const user = userEvent.setup();
    mount(ROOT);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    await user.click(screen.getByTestId('history-kind-addendum'));
    await user.click(within(screen.getByTestId('order-history')).getByTestId('history-link'));
    const where = await screen.findByTestId('where');
    expect(where).toHaveAttribute('data-path', '/clubs/objednavky');
    expect(where).toHaveAttribute('data-open', ADD);
  });

  it('the invoice link goes to Faktury, and is not offered to somebody who may not bill', async () => {
    const user = userEvent.setup();
    const { unmount } = mount(ROOT);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    await user.click(screen.getByTestId('history-kind-invoice'));
    await user.click(within(screen.getByTestId('order-history')).getByTestId('history-link'));
    expect(await screen.findByTestId('where')).toHaveAttribute('data-path', '/billing');
    unmount();

    mount(ROOT, { [ROOT]: root, [ADD]: addendum }, []);
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (6)'));
    await userEvent.setup().click(screen.getByTestId('history-kind-invoice'));
    expect(within(screen.getByTestId('order-history')).queryByTestId('history-link')).toBeNull();
  });

  it('an addendum that cannot be read does not hide the rest', async () => {
    mount(ROOT, { [ROOT]: root, [ADD]: new Error('boom') });
    expect(await screen.findByTestId('history-partial')).toHaveTextContent('Historii jednoho dodatku se nepodařilo načíst');
    expect(texts().length).toBeGreaterThanOrEqual(4);
  });

  it('a single order without addenda is shown as before, with no group labels', async () => {
    const single = make(ROOT, [{ atUtc: '2026-10-01T08:00:00Z', user: 'Eva', text: 'Objednávka potvrzena' }]);
    mount(ROOT, { [ROOT]: single });
    await screen.findByTestId('order-history');
    expect(texts()).toHaveLength(1);
    expect(texts()[0]).not.toContain('Objednávka KO-');
    expect(screen.queryByText(/včetně dodatků/)).toBeNull();
  });

  it('an order of a group of three still merges every addendum', async () => {
    const r = make(ROOT, [{ atUtc: '2026-10-01T08:00:00Z', user: '', text: 'Objednávka potvrzena' }], { addenda: [summary(ADD), summary(ADD2)] });
    const a2 = make(ADD2, [{ atUtc: '2026-10-03T08:00:00Z', user: '', text: 'Objednávka zrušena. Důvod: x' }], { parentOrderId: ROOT });
    mount(ROOT, { [ROOT]: r, [ADD]: addendum, [ADD2]: a2 });
    await waitFor(() => expect(screen.getByTestId('history-view-all')).toHaveTextContent('Vše (3)'));
    expect(texts().some((t) => t.includes('Důvod: x'))).toBe(true);
  });
});
