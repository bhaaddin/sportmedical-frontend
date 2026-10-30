/*
 * A patient's Faktury as shelves: "K úhradě" only when something is open (the owed sum, the overdue ones as an attention
 * card), "Faktury" with the list, each number a connected link to Fakturace, and an empty state that offers to issue one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

const getInvoices = vi.fn();
vi.mock('../../api/billing', () => ({ billingApi: { getInvoices } }));

const { default: PatientInvoicesPage } = await import('./PatientInvoicesPage');

const yearAhead = new Date(Date.now() + 365 * 86400_000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400_000).toISOString();
const now = new Date().toISOString();

const inv = (over: Record<string, unknown>) => ({
  id: 'a', patientId: 'p1', patientName: 'Jana Marková', invoiceNumber: '2026-0418', status: 'Issued',
  totalCzk: 2200, paidCzk: 0, remainingCzk: 2200, currency: 'CZK', issueDateUtc: now, dueDateUtc: yearAhead,
  items: [{ id: 'l1', description: 'Komplexní prohlídka', serviceCode: 'KP', quantity: 1, unitPriceCzk: 2200, amountCzk: 2200 }],
  ...over,
});

function Where() {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname} ${JSON.stringify(location.state)}`}</div>;
}

function renderAt(width: ViewportName = 'desktop') {
  setViewport(VIEWPORTS[width]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/patients/p1/faktury']}>
        <Routes>
          <Route path="/patients/:id/faktury" element={<PatientInvoicesPage />} />
          <Route path="/billing" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['billing.manage', 'patients.view']));
  getInvoices.mockReset();
});

describe('Faktury karty', () => {
  it('draws K úhradě with the owed sum and the overdue ones, and the list', async () => {
    getInvoices.mockResolvedValue([
      inv({}),
      inv({ id: 'b', invoiceNumber: '2026-0414', totalCzk: 1600, remainingCzk: 1600, dueDateUtc: lastWeek }),
      inv({ id: 'c', invoiceNumber: '2026-0410', status: 'Paid', remainingCzk: 0, paidCzk: 2200 }),
    ]);
    renderAt();
    const due = within(await screen.findByRole('region', { name: 'K úhradě' }));
    expect(due.getByText(/^3\s800 Kč$/)).toBeInTheDocument();
    expect(due.getByText('Faktury po splatnosti')).toBeInTheDocument();
    const list = within(screen.getByRole('region', { name: 'Faktury' }));
    expect(list.getByLabelText('Počet: 3')).toBeInTheDocument();
    expect(getInvoices).toHaveBeenCalledWith({ patientId: 'p1' });
  });

  it('"Otevřít ve Fakturaci" carries the patient so Fakturace can narrow the list', async () => {
    getInvoices.mockResolvedValue([inv({ id: 'b', invoiceNumber: '2026-0414', remainingCzk: 1600, dueDateUtc: lastWeek })]);
    renderAt();
    fireEvent.click(await screen.findByText(/Otevřít ve Fakturaci/));
    expect(screen.getByTestId('where').textContent).toBe('/billing {"filter":"overdue","filterPatientId":"p1"}');
  });

  it('has no K úhradě when everything is paid', async () => {
    getInvoices.mockResolvedValue([inv({ status: 'Paid', remainingCzk: 0, paidCzk: 2200 })]);
    renderAt();
    await screen.findByRole('link', { name: '2026-0418' });
    expect(screen.queryByRole('region', { name: 'K úhradě' })).not.toBeInTheDocument();
  });

  it('a number is a link that opens the invoice on Fakturace', async () => {
    getInvoices.mockResolvedValue([inv({})]);
    renderAt();
    fireEvent.click(await screen.findByRole('link', { name: '2026-0418' }));
    expect(screen.getByTestId('where').textContent).toBe('/billing {"invoiceId":"a"}');
  });

  it('an empty list offers to issue a document for this patient', async () => {
    getInvoices.mockResolvedValue([]);
    renderAt('phone');
    expect(await screen.findByText('Tomuto pacientovi zatím nebyl vystaven žádný doklad.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Vystavit doklad' }));
    expect(screen.getByTestId('where').textContent).toBe('/billing {"patientId":"p1"}');
  });

  it('says what failed, not that there is nothing', async () => {
    getInvoices.mockRejectedValue(new Error('500'));
    renderAt('tablet');
    expect(await screen.findByText('Faktury se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
