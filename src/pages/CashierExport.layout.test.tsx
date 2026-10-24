/*
 * Pokladna and Účetní export at the three widths (Etapa 2 brief, rules 3, 8).
 *
 * Phone: the day's transactions / the export history are cards, the main
 * action (Nová platba / Exportovat) is pinned at the bottom and drawn once.
 * Tablet: three columns. Desktop: every column. Both have a placeholder that
 * holds the space, an empty state, and an error state with "Zkusit znovu".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../test/viewport';

const getDashboard = vi.fn();
const getTransactions = vi.fn();
const getServices = vi.fn();
const clientGet = vi.fn();

vi.mock('../services/cashierApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/cashierApi')>()),
  cashierApi: { getDashboard, getTransactions, createTransaction: vi.fn(), cancelTransaction: vi.fn() },
}));
vi.mock('../api/services', () => ({ servicesApi: { getAll: getServices } }));
vi.mock('../api/client', () => ({ default: { get: clientGet, post: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const getPatient = vi.fn();
vi.mock('../api/patients', () => ({ patientsApi: { getById: getPatient } }));
vi.mock('../components/patients/PatientPicker', () => ({ default: () => <div>Výběr pacienta</div> }));

const { default: CashierPage } = await import('./CashierPage');
const { default: AccountingExportPage } = await import('./AccountingExportPage');

const WIDTHS: ViewportName[] = ['phone', 'tablet', 'desktop'];

function renderAt(width: ViewportName, ui: React.ReactElement) {
  setViewport(VIEWPORTS[width]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const headers = () => screen.queryAllByRole('columnheader').map((h) => h.textContent);
const NBSP = String.fromCharCode(0xa0);

const tx = (id: string, status: string, price: number) => ({
  id, serviceId: 's1', patientId: 'p1', originalPrice: price, discountAmount: 0, finalPrice: price, vatRate: 0,
  paymentMethod: 0, status, createdAt: '2026-10-03T08:15:00Z',
});

beforeEach(() => {
  [getDashboard, getTransactions, getServices, clientGet].forEach((m) => m.mockReset());
  getDashboard.mockResolvedValue({
    todayRevenue: 3800, transactionsCount: 2, cashTransactions: 1, cardTransactions: 1,
    clubBillingTransactions: 0, averageTransaction: 1900, totalDiscounts: 0,
  });
  getServices.mockResolvedValue([]);
  setViewport(VIEWPORTS.desktop);
});

/* ───────── Pokladna ───────── */
describe('Pokladna', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the transactions out for that width', async () => {
      getTransactions.mockResolvedValue([tx('t1', 'Completed', 1600), tx('t2', 'Pending', 2200)]);
      const { container } = renderAt(width, <CashierPage />);
      await screen.findAllByText(/1\s600\sKč/);

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
        /* A refund / cancel is a full-width 44 px button on the card. */
        expect(screen.getByRole('button', { name: 'Refundovat' })).toHaveStyle({ minHeight: '44px' });
      } else if (width === 'tablet') {
        expect(container.querySelector('[data-layout="table-3"]')).not.toBeNull();
        expect(headers()).toEqual(['Položka', 'Částka', 'Stav']);
        /* The refund stays reachable on the three-column table. */
        expect(screen.getByRole('button', { name: 'Refundovat' })).toBeInTheDocument();
      } else {
        expect(headers()).toEqual(['Čas', 'Položka', 'Částka', 'Platba', 'Stav', 'Akce']);
      }
      expect(container.querySelector('[data-pinned="true"]') !== null).toBe(width === 'phone');
      expect(screen.getAllByRole('button', { name: /Nová platba/ })).toHaveLength(1);
    });
  });

  it('names what was paid for and links who paid, read from the patient record', async () => {
    localStorage.setItem('permissions', JSON.stringify(['billing.manage', 'patients.view']));
    getServices.mockResolvedValue([{ id: 's1', name: 'Komplexní prohlídka', code: 'KP', priceCzk: 1600, isActive: true }]);
    getPatient.mockReset().mockResolvedValue({ id: 'p1', firstName: 'Jana', lastName: 'Marková' });
    getTransactions.mockResolvedValue([tx('t1', 'Completed', 1600), tx('t2', 'Completed', 1600)]);
    renderAt('desktop', <CashierPage />);
    expect((await screen.findAllByText('Komplexní prohlídka')).length).toBe(2);
    const links = await screen.findAllByRole('link', { name: 'Jana Marková' });
    expect(links[0]).toHaveAttribute('href', '/patients/p1');
    /* One request per patient, not per row. */
    expect(getPatient).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('region', { name: 'Dnešní tržba' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dnešní transakce' })).toBeInTheDocument();
    localStorage.clear();
  });

  it('asks for no patient without the permission to open one', async () => {
    localStorage.clear();
    getPatient.mockReset();
    getTransactions.mockResolvedValue([tx('t1', 'Completed', 1600)]);
    renderAt('desktop', <CashierPage />);
    await screen.findAllByText(/1\s600\sKč/);
    expect(getPatient).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Karta pacienta|Jana/ })).toBeNull();
  });

  it('writes money with a non-breaking space before Kč', async () => {
    getTransactions.mockResolvedValue([tx('t1', 'Completed', 1600)]);
    renderAt('desktop', <CashierPage />);
    const amounts = await screen.findAllByText(/1\s600\sKč/);
    expect(amounts[0].textContent).toMatch(new RegExp(`${NBSP}Kč$`));
  });

  it('says so when there are no payments today', async () => {
    getTransactions.mockResolvedValue([]);
    renderAt('phone', <CashierPage />);
    expect(await screen.findByText('Zatím žádné platby.')).toBeInTheDocument();
  });

  it('holds the space while loading', () => {
    getTransactions.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('tablet', <CashierPage />);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
  });

  it('shows what failed and retries - not "no payments"', async () => {
    getTransactions.mockRejectedValueOnce(new Error('503')).mockResolvedValue([tx('t1', 'Completed', 1600)]);
    renderAt('phone', <CashierPage />);
    expect(await screen.findByText(/Dnešní transakce se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.queryByText('Zatím žádné platby.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findAllByText(/1\s600\sKč/)).not.toHaveLength(0);
  });

  it('opens the new-payment form full-screen on a phone', async () => {
    getTransactions.mockResolvedValue([]);
    renderAt('phone', <CashierPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Nová platba/ }));
    expect(document.querySelector('[data-layout="fullscreen"]')).not.toBeNull();
  });
});

/* ───────── Účetní export ───────── */
const exported = (id: string, name: string) => ({
  id, format: 0, type: 0, dateFrom: '2026-09-01', dateTo: '2026-09-30', recordCount: 12, filePath: '/x',
  fileName: name, fileSize: 100, exportedAt: '2026-10-01T10:00:00Z',
});

const serve = (history: unknown) =>
  clientGet.mockImplementation((url: string) => {
    if (url.endsWith('/formats')) {
      return Promise.resolve({ data: [{ format: 0, name: 'CSV', contentType: 'text/csv' }] });
    }
    if (url.endsWith('/history')) {
      return history instanceof Error ? Promise.reject(history) : Promise.resolve({ data: history });
    }
    return Promise.resolve({ data: [] });
  });

describe('Účetní export', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the history out for that width and draws Exportovat once', async () => {
      serve([exported('e1', 'faktury-2026-09.csv'), exported('e2', 'platby-2026-09.csv')]);
      const { container } = renderAt(width, <AccountingExportPage />);
      await screen.findByText('faktury-2026-09.csv');

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
        expect(screen.getAllByRole('button', { name: 'Stáhnout' })[0]).toHaveStyle({ minHeight: '44px' });
      } else if (width === 'tablet') {
        expect(headers()).toEqual(['Soubor', 'Vytvořeno', 'Akce']);
        expect(container.querySelector('[data-pinned="false"]')).not.toBeNull();
      } else {
        expect(headers()).toEqual(['Soubor', 'Záznamů', 'Vytvořeno', 'Akce']);
      }
      expect(screen.getAllByRole('button', { name: 'Exportovat' })).toHaveLength(1);
    });
  });

  it('says so when there are no exports', async () => {
    serve([]);
    renderAt('phone', <AccountingExportPage />);
    expect(await screen.findByText('Zatím žádné exporty.')).toBeInTheDocument();
  });

  it('holds the space while loading', () => {
    clientGet.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('desktop', <AccountingExportPage />);
    expect(container.querySelector('[data-state="loading"]')).not.toBeNull();
  });

  it('shows what failed and retries', async () => {
    serve(new Error('500'));
    renderAt('tablet', <AccountingExportPage />);
    expect(await screen.findByText(/Historii exportů se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.queryByText('Zatím žádné exporty.')).toBeNull();
    serve([exported('e1', 'faktury-2026-09.csv')]);
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('faktury-2026-09.csv')).toBeInTheDocument();
  });

  it('says what the chosen period holds before anything is exported', async () => {
    const today = new Date().toISOString();
    clientGet.mockImplementation((url: string) => {
      if (url.endsWith('/history')) return Promise.resolve({ data: [] });
      if (url === '/api/billing/invoices') {
        return Promise.resolve({ data: [
          { id: 'i1', invoiceNumber: '1', status: 'Issued', totalCzk: 1600, issueDateUtc: today },
          { id: 'i2', invoiceNumber: '2', status: 'Paid', totalCzk: 2200, issueDateUtc: today },
          { id: 'i3', invoiceNumber: '3', status: 'Cancelled', totalCzk: 900, issueDateUtc: today },
        ] });
      }
      return Promise.resolve({ data: [] });
    });
    renderAt('desktop', <AccountingExportPage />);
    expect(await screen.findByText(/^V období vystaveno 2 doklady za 3\s800\sKč\.$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Faktury' })).toHaveAttribute('href', '/billing');
    expect(screen.getByRole('region', { name: 'Nový export' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Poslední exporty' })).toBeInTheDocument();
  });

  it('stacks the form fields one per row on a phone', async () => {
    serve([]);
    renderAt('phone', <AccountingExportPage />);
    await screen.findByText('Zatím žádné exporty.');
    for (const label of ['Formát', 'Typ', 'Od', 'Do']) {
      const cell = screen.getByLabelText(label).closest('.MuiGrid-root');
      expect(cell?.className).toContain('MuiGrid-grid-xs-12');
    }
  });
});
