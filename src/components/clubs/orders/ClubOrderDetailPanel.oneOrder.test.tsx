/*
 * One order per club on the order detail: with the combined view the order reads as ONE order (header, state, days,
 * actions; "Přidat den" hands the club to the calendar, which joins on its own); on a server without the routes (404 ->
 * null) the detail is exactly what it was.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import { combinedSchema } from '../../../api/clubOneOrder';

const { get, invoiceDraft, getSettings, getCombined, closeOrder } = vi.hoisted(() => ({
  get: vi.fn(), invoiceDraft: vi.fn(), getSettings: vi.fn(), getCombined: vi.fn(), closeOrder: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get, invoiceDraft } };
});
vi.mock('../../../api/clubOneOrder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/clubOneOrder')>()), getOneOrderSettings: getSettings, getCombined, closeOrder,
}));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { ClubOrderDetailPanel } = await import('./ClubOrderDetailPanel');

const ID = '80e74a6c-0000-4000-8000-000000000001';
const order = toOrder({
  id: ID, groupId: ID, clubId: 'club-1', clubName: 'AC Sparta', serviceId: 's-1', serviceName: 'Prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
  activitySeats: [{ activityId: 'a-1', activityName: 'VO2max', durationMinutes: 30, seats: 5, registered: 0, unitPriceCzk: 1000 }],
  totalSeats: 5, registered: 0, priceQuote: { listTotalCzk: 5000, discounts: [], totalCzk: 5000 }, requestedRanges: [], blocks: [], note: '', contact: null, createdBy: 'Staff', history: [], addenda: [],
});
const day = (orderId: string, ref: string, over: Record<string, unknown> = {}) => ({ orderId, reference: ref, serviceName: 'Prohlídky', seats: 5, registered: 1, status: 'Confirmed', ranges: [{ fromDate: '2026-11-05', toDate: '2026-11-05' }], ...over });
const combined = (over: Record<string, unknown> = {}) => combinedSchema.parse({
  rootId: ID, reference: 'KO-00000001', clubId: 'club-1', clubName: 'AC Sparta', oneOrderMode: true,
  splitFrom: { orderId: 'x', reference: 'KO-0000CC09' },
  days: [day(ID, 'KO-00000001', { invoiceId: 'i1', invoiceNumber: '2026-0042' }), day('d2', 'KO-00000002')],
  totals: { orders: 2, seats: 10, registered: 2, invoicedOrders: 1 }, clubTotal: { parts: 2, seats: 20, registered: 4 }, ...over,
});

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{location.pathname} {JSON.stringify(location.state)}</div>;
}
const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/clubs/objednavky']}>
      <Routes>
        <Route path="/clubs/objednavky" element={<ClubOrderDetailPanel orderId={ID} onClose={() => undefined} />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  [get, invoiceDraft, getSettings, getCombined, closeOrder].forEach((m) => m.mockReset());
  get.mockResolvedValue(order);
  invoiceDraft.mockResolvedValue({ lines: [], alreadyInvoiced: [], discounts: [] });
  setViewport(VIEWPORTS.desktop);
});

describe('order detail with the combined view', () => {
  it('reads as one order: header, state, tiles, days, split link, who added it', async () => {
    getSettings.mockResolvedValue({ clubIds: ['club-1'] });
    getCombined.mockResolvedValue(combined());
    mount();
    expect(await screen.findByTestId('one-order')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /AC Sparta – objednávka KO-00000001/ })).toBeInTheDocument();
    expect(screen.getByTestId('one-order-state')).toHaveTextContent('Otevřená');
    expect(screen.getByTestId('tile-days')).toHaveTextContent('2');
    expect(screen.getByTestId('tile-invoiced')).toHaveTextContent('1 z 2');
    expect(screen.getByTestId('tile-club')).toHaveTextContent('4 / 20');
    expect(screen.getByTestId('one-order-links')).toHaveTextContent('Rozděleno z');
    const rows = screen.getAllByTestId('one-order-day-invoice');
    expect(rows[0]).toHaveTextContent('Faktura 2026-0042');
    expect(rows[1]).toHaveTextContent('Faktura: zatím ne');
    /* the old group block gives way; the order's own actions stay */
    expect(screen.queryByTestId('order-group')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-addendum')).toBeInTheDocument();
  });

  it('"Přidat den" hands the club (no parent) to the calendar', async () => {
    getSettings.mockResolvedValue({ clubIds: ['club-1'] });
    getCombined.mockResolvedValue(combined());
    mount();
    await userEvent.click(await screen.findByTestId('one-order-add-day'));
    const state = await screen.findByTestId('state');
    expect(state).toHaveTextContent('"pickOrder":{"clubId":"club-1"}');
  });

  it('closing asks first, then closes the root', async () => {
    getSettings.mockResolvedValue({ clubIds: ['club-1'] });
    getCombined.mockResolvedValue(combined());
    closeOrder.mockResolvedValue(undefined);
    mount();
    await userEvent.click(await screen.findByTestId('one-order-toggle'));
    expect(closeOrder).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('one-order-confirm'));
    await waitFor(() => expect(closeOrder).toHaveBeenCalledWith(ID));
  });

  it('a closed order offers "Znovu otevřít" and no "Přidat den"', async () => {
    getSettings.mockResolvedValue({ clubIds: ['club-1'] });
    getCombined.mockResolvedValue(combined({ closedAtUtc: '2026-11-02T10:00:00Z' }));
    mount();
    expect(await screen.findByTestId('one-order-state')).toHaveTextContent('Uzavřená');
    expect(screen.getByTestId('one-order-toggle')).toHaveTextContent('Znovu otevřít');
    expect(screen.queryByTestId('one-order-add-day')).not.toBeInTheDocument();
  });
});

describe('server without the feature (404)', () => {
  it('draws the order exactly as before and never asks for the combined view', async () => {
    getSettings.mockResolvedValue(null);
    mount();
    expect(await screen.findByTestId('order-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('one-order')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'AC Sparta' })).toBeInTheDocument();
    expect(getCombined).not.toHaveBeenCalled();
    expect(screen.getByTestId('club-invoice')).toBeInTheDocument();
  });

  it('a lone order of a club outside the mode stays as before', async () => {
    getSettings.mockResolvedValue({ clubIds: [] });
    getCombined.mockResolvedValue(combined({ oneOrderMode: false, splitFrom: null, days: [day(ID, 'KO-00000001')] }));
    mount();
    await waitFor(() => expect(getCombined).toHaveBeenCalled());
    expect(await screen.findByTestId('order-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('one-order')).not.toBeInTheDocument();
  });
});
