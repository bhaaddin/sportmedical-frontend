/*
 * Etapa 5: the order detail of a group - the root and its addenda as stacked rows, "Celkem za celou objednávku",
 * "Přidat další službu / další hráče" (hands the parent to the calendar), cancelling a root with live addenda (409
 * and the explicit retry) and the one invoice of the group (draft first, then create; every refusal in the server's words).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { ClubOrderError, toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';

const { get, cancel, invoiceDraft, createInvoice, toastSuccess, toastError } = vi.hoisted(() => ({
  get: vi.fn(), cancel: vi.fn(), invoiceDraft: vi.fn(), createInvoice: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get, cancel, invoiceDraft, createInvoice } };
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
    totalSeats: 5, registered: 0,
    priceQuote: { listTotalCzk: 5000, discounts: [], totalCzk: 5000 },
    requestedRanges: [], blocks: [], note: '', contact: null, createdBy: 'Staff', history: [],
    registrationUrl: 'https://app.test/klub/rt',
    addenda: [{ id: ADD_ID, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 2660 }],
    groupTotals: { totalSeats: 9, registered: 0, listTotalCzk: 7800, discountCzk: 780, totalCzk: 7020 },
    ...over,
  });

const root = make();
const addendum = make({
  id: ADD_ID, parentOrderId: ROOT_ID, groupId: ROOT_ID, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4,
  priceQuote: { listTotalCzk: 2800, discounts: [], totalCzk: 2660 }, addenda: [],
});
const orders: Record<string, ClubOrderView> = { [ROOT_ID]: root, [ADD_ID]: addendum };

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{location.pathname} {JSON.stringify(location.state)}</div>;
}

function mount(orderId: string, ui?: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/clubs/objednavky']}>
        <Routes>
          <Route path="/clubs/objednavky" element={ui ?? <ClubOrderDetailPanel orderId={orderId} onClose={() => undefined} />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const DRAFT = {
  clubId: 'club-1', groupId: ROOT_ID, paymentMethod: 'ClubInvoice', headcount: 9,
  lines: [
    { orderId: ROOT_ID, serviceName: 'Sportovní prohlídky', activityName: 'VO2max', quantity: 5, unitPriceCzk: 1000, totalCzk: 5000 },
    { orderId: ADD_ID, serviceName: 'Fyzioterapie', activityName: 'Masáž', quantity: 4, unitPriceCzk: 700, totalCzk: 2800 },
  ],
  discounts: [{ kind: 'Tier', label: 'Skupinová sleva (od 6 osob)', percent: 10, amountCzk: 780 }],
  listTotalCzk: 7800, totalCzk: 7020, note: 'Klubová objednávka KO-00000001.', invoiceId: null,
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  get.mockReset().mockImplementation(async (id: string) => orders[id]);
  cancel.mockReset().mockResolvedValue(root);
  invoiceDraft.mockReset().mockResolvedValue(DRAFT);
  createInvoice.mockReset();
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const)('group of a root · %s', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the root, its addenda and the totals of the whole order', async () => {
    mount(ROOT_ID);
    const group = await screen.findByTestId('order-group');
    const rows = within(group).getAllByTestId('group-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Sportovní prohlídky');
    expect(rows[0]).toHaveTextContent('KO-00000001');
    expect(rows[1]).toHaveTextContent('Fyzioterapie');
    expect(rows[1]).toHaveTextContent('Dodatek KO-00000002');
    expect(rows[1]).toHaveTextContent('4 míst');
    expect(rows[1]).toHaveTextContent('Odesláno klubem');
    expect(rows[1]).toHaveTextContent(/2\s660\sKč/);
    const totals = within(group).getByTestId('group-totals');
    expect(totals).toHaveTextContent('Celkem za celou objednávku');
    expect(within(totals).getByTestId('group-seats')).toHaveTextContent('9');
    expect(within(totals).getByTestId('group-discount')).toHaveTextContent(/780\sKč/);
    expect(within(totals).getByTestId('group-total')).toHaveTextContent(/7\s020\sKč/);
  });

  it('a lone order has no group block', async () => {
    orders.lone = make({ id: 'lone', groupId: 'lone', addenda: [] });
    mount('lone');
    await screen.findByTestId('order-detail');
    expect(screen.queryByTestId('order-group')).toBeNull();
  });
});

describe('an addendum', () => {
  it('says which order it belongs to, shows the root row and opens it', async () => {
    const user = userEvent.setup();
    mount(ADD_ID);
    expect(await screen.findByTestId('addendum-of')).toHaveTextContent('Dodatek k objednávce KO-00000001');
    const rows = await waitFor(() => {
      const r = screen.getAllByTestId('group-row');
      expect(r).toHaveLength(2);
      return r;
    });
    expect(rows[1]).toHaveAttribute('data-current', 'true');
    await user.click(within(rows[0]).getByRole('button', { name: 'Otevřít' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith(ROOT_ID));
    await waitFor(() => expect(screen.queryByTestId('addendum-of')).toBeNull());
  });
});

describe('Přidat další službu / další hráče', () => {
  it('hands the parent order to the calendar (club and payment locked there)', async () => {
    const user = userEvent.setup();
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    await user.click(screen.getByRole('button', { name: 'Přidat další službu / další hráče' }));
    const probe = await screen.findByTestId('state');
    expect(probe).toHaveTextContent('/planovani');
    expect(probe).toHaveTextContent(
      JSON.stringify({ pickOrder: { clubId: 'club-1', parent: { orderId: ROOT_ID, clubId: 'club-1', clubName: 'FK Slaný', paymentMethod: 'ClubInvoice' } } }),
    );
  });

  it('is not offered for a cancelled order', async () => {
    orders.cx = make({ id: 'cx', groupId: 'cx', status: 'Cancelled', addenda: [] });
    mount('cx');
    await screen.findByTestId('order-detail');
    expect(screen.queryByRole('button', { name: 'Přidat další službu / další hráče' })).toBeNull();
  });
});

describe('cancelling a root with live addenda', () => {
  it('lists the addenda on the 409 and retries with cancelAddenda on "Zrušit i dodatky"', async () => {
    const user = userEvent.setup();
    cancel.mockRejectedValueOnce(Object.assign(new ClubOrderError('Objednávka má dodatky.', 409, 'club_order.addenda_live'), {
      addenda: [{ id: ADD_ID, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 2660 }],
    }));
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    await user.click(within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Zrušit objednávku?' })).getByRole('button', { name: 'Ano, zrušit' }));
    expect(cancel).toHaveBeenLastCalledWith(ROOT_ID, false, false);

    const live = await screen.findByTestId('addenda-live-dialog');
    expect(within(live).getByTestId('addenda-live-list')).toHaveTextContent('KO-00000002 · Fyzioterapie · 4 míst');
    expect(toastError).not.toHaveBeenCalled();
    await user.click(within(live).getByRole('button', { name: 'Zrušit i dodatky' }));
    await waitFor(() => expect(cancel).toHaveBeenLastCalledWith(ROOT_ID, false, true));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Objednávka zrušena'));
  });

  it('keeps "Ponechat": nothing more is sent', async () => {
    const user = userEvent.setup();
    cancel.mockRejectedValueOnce(Object.assign(new ClubOrderError('x', 409, 'club_order.addenda_live'), { addenda: [] }));
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    await user.click(within(screen.getByTestId('order-actions')).getByRole('button', { name: 'Zrušit objednávku' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Zrušit objednávku?' })).getByRole('button', { name: 'Ano, zrušit' }));
    const live = await screen.findByTestId('addenda-live-dialog');
    await user.click(within(live).getByRole('button', { name: 'Ponechat' }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});

describe('Vystavit jednu fakturu klubu', () => {
  const openDraft = async () => {
    const user = userEvent.setup();
    mount(ROOT_ID);
    await screen.findByTestId('order-detail');
    await user.click(screen.getByRole('button', { name: 'Vystavit jednu fakturu klubu' }));
    const dialog = await screen.findByRole('dialog', { name: 'Jedna faktura klubu' });
    return { user, dialog };
  };

  it('shows the draft lines first and creates only on the button', async () => {
    createInvoice.mockResolvedValue({ invoiceId: 'inv-1', invoiceNumber: 'INV-20261004-0001', status: 'Issued', totalCzk: 7020, clubId: 'club-1', groupId: ROOT_ID, created: true });
    const { user, dialog } = await openDraft();
    expect(invoiceDraft).toHaveBeenCalledWith(ROOT_ID);
    const lines = await within(dialog).findAllByTestId('invoice-line');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toHaveTextContent('Fyzioterapie — Masáž');
    expect(within(dialog).getByTestId('invoice-draft-total')).toHaveTextContent(/7\s020\sKč/);
    expect(within(dialog).getByText(/Skupinová sleva/)).toBeInTheDocument();
    expect(createInvoice).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Vystavit fakturu' }));
    expect(createInvoice).toHaveBeenCalledWith(ROOT_ID);
    expect(await within(dialog).findByTestId('invoice-number')).toHaveTextContent('INV-20261004-0001');
    await user.click(within(dialog).getByRole('button', { name: 'Otevřít ve Fakturaci' }));
    expect(await screen.findByTestId('state')).toHaveTextContent('/billing {"invoiceId":"inv-1"}');
  });

  it('an existing invoice (200, created:false) is shown as such', async () => {
    createInvoice.mockResolvedValue({ invoiceId: 'inv-1', invoiceNumber: 'INV-1', status: 'Issued', totalCzk: 7020, clubId: 'club-1', groupId: ROOT_ID, created: false });
    const { user, dialog } = await openDraft();
    await within(dialog).findAllByTestId('invoice-line');
    await user.click(within(dialog).getByRole('button', { name: 'Vystavit fakturu' }));
    expect(await within(dialog).findByTestId('invoice-created')).toHaveTextContent('už fakturu má');
  });

  it('shows the server message of a 409 per person and of a 422 not quotable, and stays open', async () => {
    const { user, dialog } = await openDraft();
    await within(dialog).findAllByTestId('invoice-line');
    createInvoice.mockRejectedValueOnce(new ClubOrderError('Skupina platí po osobách.', 409, 'club_order.invoice_per_person'));
    await user.click(within(dialog).getByRole('button', { name: 'Vystavit fakturu' }));
    expect(await within(dialog).findByTestId('invoice-error')).toHaveTextContent('Skupina platí po osobách.');
    createInvoice.mockRejectedValueOnce(new ClubOrderError('Činnost Masáž nemá v ceníku cenu.', 422, 'club_order.invoice_not_quotable'));
    await user.click(within(dialog).getByRole('button', { name: 'Vystavit fakturu' }));
    await waitFor(() => expect(within(dialog).getByTestId('invoice-error')).toHaveTextContent('Činnost Masáž nemá v ceníku cenu.'));
  });

  it('a draft the server cannot quote (422) shows its message and offers no create button', async () => {
    invoiceDraft.mockRejectedValue(new ClubOrderError('Činnost Masáž nemá cenu.', 422, 'club_order.invoice_not_quotable'));
    const { dialog } = await openDraft();
    expect(await within(dialog).findByTestId('invoice-draft-error')).toHaveTextContent('Činnost Masáž nemá cenu.');
    expect(within(dialog).queryByRole('button', { name: 'Vystavit fakturu' })).toBeNull();
  });

  it('a group that already has its invoice offers the link instead of the button', async () => {
    invoiceDraft.mockResolvedValue({ ...DRAFT, invoiceId: 'inv-9' });
    const { dialog } = await openDraft();
    expect(await within(dialog).findByTestId('invoice-exists')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Vystavit fakturu' })).toBeNull();
  });

  it('is disabled with the explanation when the group pays per person', async () => {
    orders.pp = make({ id: 'pp', groupId: 'pp', paymentMethod: 'PerPerson', addenda: [] });
    mount('pp');
    await screen.findByTestId('order-detail');
    const button = screen.getByTestId('club-invoice');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('invoice-per-person-hint')).toHaveTextContent('Skupina platí po osobách');
    expect(button).toHaveAttribute('aria-describedby', 'invoice-per-person-hint');
  });
});
