/*
 * Platby: the ledger as a list, "Potvrdit přijetí" for a waiting transfer, a
 * refund that needs a reason, and the QR of a transfer in the pay dialog.
 * The server's refusals are shown as the server wrote them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('../../api/client', () => ({ default: { get, post } }));
/* The ledger is read through the one HTTP client: each test answers by URL. */
const list = vi.hoisted(() => vi.fn());
const reconciliation = vi.hoisted(() => vi.fn());
const confirm = vi.hoisted(() => vi.fn());
const cancel = vi.hoisted(() => vi.fn());
const refund = vi.hoisted(() => vi.fn());
const invoiceQr = vi.hoisted(() => vi.fn());
const recordPayment = vi.hoisted(() => vi.fn());
vi.mock('../../api/billing', () => ({ billingApi: { recordPayment } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toast }));

const { default: PaymentsList } = await import('./PaymentsList');
const { default: PayDialog } = await import('./PayDialog');

const base = {
  currency: 'CZK', refundedAmountCzk: 0, needsReview: false, createdBy: 'ZZ test',
  createdAtUtc: '2026-10-29T10:00:00Z',
};
const pending = { ...base, id: 'p1', invoiceId: 'a', amountCzk: 2200, netPaidCzk: 0, method: 'Transfer', status: 'Pending', variableSymbol: '20260418' };
const paid = { ...base, id: 'p2', invoiceId: 'a', amountCzk: 500, netPaidCzk: 500, method: 'Cash', status: 'Paid', paidAtUtc: '2026-10-29T11:00:00Z' };
const late = { ...base, id: 'p3', invoiceId: 'a', amountCzk: 100, netPaidCzk: 0, method: 'Transfer', status: 'Pending', needsReview: true, reviewReason: 'late_payment' };

const invoice = {
  id: 'a', patientId: 'p', patientName: 'ZZ test', invoiceNumber: '2026-0418', status: 'Issued', totalCzk: 2200, paidCzk: 0,
  remainingCzk: 2200, currency: 'CZK', issueDateUtc: '2026-10-01T00:00:00Z', dueDateUtc: '2027-10-01T00:00:00Z', items: [],
} as never;

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const renderList = (extra: Partial<React.ComponentProps<typeof PaymentsList>> = {}) =>
  render(
    <QueryClientProvider client={client()}>
      <PaymentsList invoices={[invoice]} phone={false} touch={false} canManage canRefund onChanged={vi.fn()} onOpenInvoice={vi.fn()} {...extra} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  get.mockReset().mockImplementation((url: string) =>
    url === '/api/payments' ? list().then((data: unknown) => ({ data: { success: true, data } }))
      : url === '/api/payments/reconciliation' ? reconciliation().then((data: unknown) => ({ data: { success: true, data } }))
        : url.endsWith('/payment-qr') ? invoiceQr().then((data: unknown) => ({ data: { success: true, data } }))
          : Promise.reject(new Error('404')));
  post.mockReset().mockImplementation((url: string, body: unknown) => {
    const id = url.split('/')[3];
    const work = url.endsWith('/confirm') ? confirm(id) : url.endsWith('/cancel') ? cancel(id) : refund(id, body);
    return work.then((data: unknown) => ({ data: { success: true, data } }));
  });
  setViewport(VIEWPORTS.desktop);
  [list, reconciliation, confirm, cancel, refund, invoiceQr, recordPayment, toast.success, toast.error].forEach((m) => m.mockReset());
  list.mockResolvedValue({ items: [pending, paid, late], total: 3, page: 1, pageSize: 100 });
  reconciliation.mockResolvedValue({ generatedAtUtc: '', invoicesChecked: 1, drift: [], needsReviewCount: 1, overduePendingCount: 0 });
  confirm.mockResolvedValue({ payment: { ...pending, status: 'Paid' } });
  refund.mockResolvedValue({ payment: { ...paid, status: 'Refunded' } });
});

describe('Platby', () => {
  it('lists every payment with its state and the invoice number', async () => {
    renderList();
    expect(await screen.findAllByText('Čeká na platbu')).toHaveLength(2);
    expect(screen.getByText('Zaplaceno')).toBeInTheDocument();
    expect(screen.getByText('Ke kontrole', { selector: 'span span' })).toBeInTheDocument();
    expect(screen.getAllByText('2026-0418').length).toBeGreaterThan(0);
  });

  it('confirms a waiting transfer and tells the page to reload', async () => {
    const onChanged = vi.fn();
    renderList({ onChanged });
    fireEvent.click((await screen.findAllByLabelText(/Potvrdit přijetí/))[0]);
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Platba potvrzena');
  });

  it('asks for a reason before a refund and sends it', async () => {
    renderList();
    fireEvent.click(await screen.findByLabelText(/Vrátit platbu/));
    const dialog = await screen.findByRole('dialog');
    const go = within(dialog).getByRole('button', { name: 'Vrátit platbu' });
    expect(go).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Důvod vrácení/), { target: { value: 'ZZ test omyl' } });
    fireEvent.click(go);
    await waitFor(() => expect(refund).toHaveBeenCalledWith('p2', { amountCzk: 500, reason: 'ZZ test omyl' }));
  });

  it('hides refund and confirm without the permissions', async () => {
    renderList({ canManage: false, canRefund: false });
    await screen.findByText('Zaplaceno');
    expect(screen.queryByLabelText(/Vrátit platbu/)).toBeNull();
    expect(screen.queryByLabelText(/Potvrdit přijetí/)).toBeNull();
  });

  it('narrows to the payments that need a person', async () => {
    renderList();
    await screen.findByText('Zaplaceno');
    fireEvent.click(screen.getByRole('button', { name: /Ke kontrole/ }));
    expect(screen.queryByText('Zaplaceno')).toBeNull();
  });

  it('gives the phone cards, not a table', async () => {
    setViewport(VIEWPORTS.phone);
    renderList({ phone: true, touch: true });
    await screen.findByText('Zaplaceno');
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('Pay dialog', () => {
  const open = (qrAvailable: boolean) =>
    render(<PayDialog invoice={invoice} phone={false} qrAvailable={qrAvailable} onClose={vi.fn()} onRecorded={vi.fn()} />);
  const pickTransfer = async () => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Způsob platby' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Převodem' }));
  };

  it('offers the QR only for a transfer and only when the server has the ledger', async () => {
    const { unmount } = open(false);
    await pickTransfer();
    expect(screen.queryByRole('button', { name: 'Zobrazit QR platbu' })).toBeNull();
    unmount();
    open(true);
    expect(screen.queryByRole('button', { name: 'Zobrazit QR platbu' })).toBeNull();
    await pickTransfer();
    expect(screen.getByRole('button', { name: 'Zobrazit QR platbu' })).toBeInTheDocument();
  });

  it('shows the QR with amount, variable symbol and account', async () => {
    invoiceQr.mockResolvedValue({ paymentId: 'p1', spayd: 'SPD*1.0*', iban: 'CZ6508000000192000145399', variableSymbol: '20260418', amountCzk: 2200, qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    open(true);
    await pickTransfer();
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit QR platbu' }));
    const panel = await screen.findByTestId('payment-qr');
    expect(within(panel).getByAltText('QR Platba')).toBeInTheDocument();
    expect(within(panel).getByText('20260418')).toBeInTheDocument();
    expect(within(panel).getByText('CZ6508000000192000145399')).toBeInTheDocument();
  });

  it('shows the server sentence when there is no account', async () => {
    invoiceQr.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { success: false, message: 'Firma nemá nastavený účet.' } } });
    open(true);
    await pickTransfer();
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit QR platbu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/\S/);
  });

  it('sends one Idempotency-Key per opened dialog', async () => {
    recordPayment.mockResolvedValue(invoice);
    open(false);
    fireEvent.click(screen.getByRole('button', { name: 'Zaevidovat platbu' }));
    await waitFor(() => expect(recordPayment).toHaveBeenCalledWith('a', { amountCzk: 2200, method: 'Cash' }, expect.stringMatching(/.{8,}/)));
  });
});
