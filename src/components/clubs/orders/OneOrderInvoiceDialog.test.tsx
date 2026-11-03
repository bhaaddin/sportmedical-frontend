import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { combinedSchema } from '../../../api/clubOneOrder';
import { toInvoiceDraft, toCreatedInvoice } from '../../../api/clubOrders';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const { invoiceDraft, createInvoice } = vi.hoisted(() => ({ invoiceDraft: vi.fn(), createInvoice: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, invoiceDraft, createInvoice } };
});
const { OneOrderInvoiceDialog } = await import('./OneOrderInvoiceDialog');

const day = (orderId: string, date: string, over: Record<string, unknown> = {}) => ({ orderId, reference: `KO-${orderId}`, serviceName: 'Prohlídka', seats: 5, status: 'Confirmed', ranges: [{ fromDate: date, toDate: date }], ...over });
const combined = combinedSchema.parse({ rootId: 'r', reference: 'KO-r', days: [day('r', '2026-11-05'), day('a', '2026-11-20'), day('b', '2026-12-02'), day('inv', '2026-11-01', { invoiceId: 'i' })] });
const draft = toInvoiceDraft({ lines: [{ orderId: 'a', serviceName: 'Prohlídka', activityName: 'Spiro', quantity: 5, unitPriceCzk: 100, totalCzk: 500 }], totalCzk: 500, listTotalCzk: 500, headcount: 5 });

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><OneOrderInvoiceDialog combined={combined} onClose={() => {}} /></MemoryRouter>
  </QueryClientProvider>,
);
const choose = async (testId: string, option: RegExp) => {
  await userEvent.click(within(screen.getByTestId(testId)).getByRole('combobox'));
  await userEvent.click(await screen.findByRole('option', { name: option }));
};

beforeEach(() => { invoiceDraft.mockReset().mockResolvedValue(draft); createInvoice.mockReset(); setViewport(VIEWPORTS.desktop); });

describe('OneOrderInvoiceDialog', () => {
  it('starts on "Vše zbývající" with no subset and shows lines and total', async () => {
    mount();
    expect(await screen.findByTestId('invoice-draft-total')).toBeInTheDocument();
    expect(invoiceDraft).toHaveBeenCalledWith('r', undefined);
    expect(screen.getAllByTestId('invoice-line')).toHaveLength(1);
  });

  it('one day asks for that order only and creates exactly it', async () => {
    createInvoice.mockResolvedValue(toCreatedInvoice({ invoiceId: 'i9', invoiceNumber: '2026009', totalCzk: 500 }, 201));
    mount();
    await screen.findByTestId('invoice-draft-total');
    await userEvent.click(screen.getByTestId('invoice-scope-day'));
    expect(screen.queryByTestId('invoice-draft')).not.toBeInTheDocument();
    await choose('invoice-day-pick', /20\. 11\. 2026/);
    await waitFor(() => expect(invoiceDraft).toHaveBeenLastCalledWith('r', { orderIds: ['a'] }));
    await userEvent.click(await screen.findByTestId('invoice-create'));
    await waitFor(() => expect(createInvoice).toHaveBeenCalledWith('r', { orderIds: ['a'] }));
    expect(await screen.findByTestId('invoice-number')).toHaveTextContent('2026009');
  });

  it('a month offers only months with something left and sends it', async () => {
    mount();
    await screen.findByTestId('invoice-draft-total');
    await userEvent.click(screen.getByTestId('invoice-scope-month'));
    await userEvent.click(within(screen.getByTestId('invoice-month-pick')).getByRole('combobox'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    await userEvent.click(screen.getByRole('option', { name: /prosinec/ }));
    await waitFor(() => expect(invoiceDraft).toHaveBeenLastCalledWith('r', { month: '2026-12' }));
  });

  it('shows the server refusal on create', async () => {
    createInvoice.mockRejectedValue(new Error('Nic k fakturaci.'));
    mount();
    await userEvent.click(await screen.findByTestId('invoice-create'));
    expect(await screen.findByTestId('invoice-error')).toHaveTextContent('Nic k fakturaci.');
  });
});
