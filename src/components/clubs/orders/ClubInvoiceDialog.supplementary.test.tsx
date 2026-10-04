/*
 * Etapa 7: the "dodatečná faktura" - an addendum added after the group was invoiced is billed on its own. The dialog lists
 * only the new lines, names the invoice already issued and says how the tier is applied; the order detail shows the
 * invoice number of each order and offers "Vystavit dodatečnou fakturu". Three layouts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { ClubOrderError, toInvoiceDraft, toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';

const { get, invoiceDraft, createInvoice, toastSuccess } = vi.hoisted(() => ({
  get: vi.fn(), invoiceDraft: vi.fn(), createInvoice: vi.fn(), toastSuccess: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: vi.fn() } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get, invoiceDraft, createInvoice } };
});
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { ClubOrderDetailPanel } = await import('./ClubOrderDetailPanel');

const ROOT_ID = '80e74a6c-0000-4000-8000-000000000001';
const ADD_ID = '8bb3517c-0000-4000-8000-000000000002';

const make = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: ROOT_ID, groupId: ROOT_ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a-1', activityName: 'VO2max', durationMinutes: 30, seats: 5, registered: 0, unitPriceCzk: 1000 }],
    totalSeats: 5, registered: 0, priceQuote: { listTotalCzk: 5000, discounts: [], totalCzk: 4750 },
    requestedRanges: [], blocks: [], note: '', contact: null, createdBy: 'Staff', history: [],
    addenda: [{ id: ADD_ID, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 2520 }],
    groupTotals: { totalSeats: 9, registered: 0, listTotalCzk: 7800, discountCzk: 780, totalCzk: 7020 },
    invoiceId: 'inv-1',
    ...over,
  });

const orders: Record<string, ClubOrderView> = {
  [ROOT_ID]: make(),
  [ADD_ID]: make({
    id: ADD_ID, parentOrderId: ROOT_ID, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, addenda: [], invoiceId: null,
    priceQuote: { listTotalCzk: 2800, discounts: [], totalCzk: 2520 },
  }),
};

/** The server's answer for a late addendum: only its line, the tier of nine players, the root's invoice named. */
const SUPPLEMENTARY = toInvoiceDraft({
  clubId: 'club-1', groupId: ROOT_ID, paymentMethod: 'ClubInvoice', headcount: 9,
  lines: [{ orderId: ADD_ID, serviceName: 'Fyzioterapie', activityName: 'Masáž', quantity: 4, unitPriceCzk: 700, totalCzk: 2800 }],
  discounts: [{ kind: 'Tier', label: 'Skupinová sleva (od 6 osob)', percent: 10, amountCzk: 280 }],
  listTotalCzk: 2800, totalCzk: 2520, note: 'Dodatečná faktura ke klubové objednávce KO-00000001: dodatek KO-00000002.',
  invoiceId: null, supplementary: true,
  alreadyInvoiced: [{ orderId: ROOT_ID, invoiceId: 'inv-1', invoiceNumber: 'INV-20261004-0001' }],
});

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{location.pathname} {JSON.stringify(location.state)}</div>;
}

function mount(orderId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/clubs/objednavky']}>
        <Routes>
          <Route path="/clubs/objednavky" element={<ClubOrderDetailPanel orderId={orderId} onClose={() => undefined} />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockImplementation(async (id: string) => orders[id]);
  invoiceDraft.mockReset().mockResolvedValue(SUPPLEMENTARY);
  createInvoice.mockReset();
  toastSuccess.mockClear();
});

describe('toInvoiceDraft', () => {
  it('reads the supplementary fields and defaults them for an old answer', () => {
    expect(SUPPLEMENTARY.supplementary).toBe(true);
    expect(SUPPLEMENTARY.alreadyInvoiced).toEqual([{ orderId: ROOT_ID, invoiceId: 'inv-1', invoiceNumber: 'INV-20261004-0001' }]);
    const old = toInvoiceDraft({ lines: [], discounts: [] });
    expect(old.supplementary).toBe(false);
    expect(old.alreadyInvoiced).toEqual([]);
  });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const)('dodatečná faktura · %s', (_name, width) => {
  beforeEach(() => setViewport(width));

  const openDialog = async () => {
    const user = userEvent.setup();
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    await user.click(await screen.findByRole('button', { name: 'Vystavit dodatečnou fakturu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dodatečná faktura' });
    return { user, dialog };
  };

  it('the dialog lists only the new lines, names the earlier invoice and explains the tier', async () => {
    const { dialog } = await openDialog();
    const lines = await within(dialog).findAllByTestId('invoice-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveTextContent('Fyzioterapie — Masáž');
    expect(within(dialog).getByTestId('invoice-draft-total')).toHaveTextContent(/2\s520\sKč/);
    expect(within(dialog).getByTestId('invoice-already-number')).toHaveTextContent('INV-20261004-0001');
    expect(within(dialog).getByTestId('invoice-tier-note')).toHaveTextContent('aktuálního počtu hráčů celé skupiny (9)');
    expect(within(dialog).getByText(/Skupinová sleva/)).toBeInTheDocument();
    expect(createInvoice).not.toHaveBeenCalled();
  });

  it('creates the supplementary invoice for the order that is being billed and shows its number', async () => {
    createInvoice.mockResolvedValue({
      invoiceId: 'inv-2', invoiceNumber: 'INV-20261004-0002', status: 'Issued', totalCzk: 2520, clubId: 'club-1', groupId: ROOT_ID,
      created: true, supplementary: true,
    });
    const { user, dialog } = await openDialog();
    await within(dialog).findAllByTestId('invoice-line');
    await user.click(within(dialog).getByRole('button', { name: 'Vystavit dodatečnou fakturu' }));
    expect(createInvoice).toHaveBeenCalledWith(ADD_ID);
    expect(await within(dialog).findByTestId('invoice-number')).toHaveTextContent('INV-20261004-0002');
    expect(within(dialog).getByTestId('invoice-created')).toHaveTextContent('Dodatečná faktura je vystavena');
    expect(toastSuccess).toHaveBeenCalledWith('Dodatečná faktura INV-20261004-0002 je vystavena');
    await user.click(within(dialog).getByRole('button', { name: 'Otevřít ve Fakturaci' }));
    expect(await screen.findByTestId('state')).toHaveTextContent('/billing {"invoiceId":"inv-2"}');
  });

  it('a repeat (200) says the supplementary invoice already exists', async () => {
    createInvoice.mockResolvedValue({
      invoiceId: 'inv-2', invoiceNumber: 'INV-20261004-0002', status: 'Issued', totalCzk: 2520, clubId: 'club-1', groupId: ROOT_ID,
      created: false, supplementary: true,
    });
    const { user, dialog } = await openDialog();
    await within(dialog).findAllByTestId('invoice-line');
    await user.click(within(dialog).getByRole('button', { name: 'Vystavit dodatečnou fakturu' }));
    expect(await within(dialog).findByTestId('invoice-created')).toHaveTextContent('už byla vystavena');
  });

  it('nothing left to bill (409) is shown in the server words', async () => {
    createInvoice.mockRejectedValue(new ClubOrderError('Skupina nemá žádnou objednávku, která by čekala na fakturu.', 409, 'club_order.nothing_to_invoice'));
    const { user, dialog } = await openDialog();
    await within(dialog).findAllByTestId('invoice-line');
    await user.click(within(dialog).getByRole('button', { name: 'Vystavit dodatečnou fakturu' }));
    await waitFor(() => expect(within(dialog).getByTestId('invoice-error')).toHaveTextContent('která by čekala na fakturu'));
  });

  it('the order detail shows the invoice number of each order and what still waits', async () => {
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    const own = await screen.findByTestId('order-invoice');
    expect(within(own).getByTestId('order-invoice-number')).toHaveTextContent('INV-20261004-0001');
    expect(screen.getByTestId('group-invoice-row')).toHaveTextContent('KO-00000001 · faktura INV-20261004-0001');
    expect(screen.getByTestId('group-invoice-pending')).toHaveTextContent('KO-00000002 · čeká na dodatečnou fakturu');
  });

  it('the addendum itself shows that it waits for an invoice', async () => {
    mount(ADD_ID);
    await screen.findByTestId('order-detail');
    expect(await screen.findByTestId('order-invoice-pending')).toHaveTextContent('zatím není vyfakturovaná');
  });
});

describe('everything invoiced', () => {
  it('offers the invoice numbers instead of a create button', async () => {
    invoiceDraft.mockResolvedValue(toInvoiceDraft({
      clubId: 'club-1', groupId: ROOT_ID, headcount: 9, lines: [], discounts: [], listTotalCzk: 0, totalCzk: 0, note: '',
      invoiceId: 'inv-2', supplementary: true,
      alreadyInvoiced: [
        { orderId: ROOT_ID, invoiceId: 'inv-1', invoiceNumber: 'INV-1' },
        { orderId: ADD_ID, invoiceId: 'inv-2', invoiceNumber: 'INV-2' },
      ],
    }));
    const user = userEvent.setup();
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    await user.click(await screen.findByRole('button', { name: 'Faktura klubu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Jedna faktura klubu' });
    expect(await within(dialog).findByTestId('invoice-exists')).toBeInTheDocument();
    expect(within(dialog).getAllByTestId('invoice-already-number').map((n) => n.textContent)).toEqual(['INV-1', 'INV-2']);
    expect(within(dialog).queryByRole('button', { name: /Vystavit/ })).toBeNull();
  });
});
