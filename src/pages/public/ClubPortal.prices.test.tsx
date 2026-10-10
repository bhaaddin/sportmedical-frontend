/*
 * "Ceny doplnit všude" (10. 10. 2026) in the club's portal: the price per
 * player beside each činnost, the order's list total, discounts and total, the
 * group's total when the order shares an invoice, and where the invoicing
 * stands (hradí klub / k fakturaci / fakturováno), or that each player pays
 * for themselves. A server without `priceQuote` makes the panel say the clinic
 * will add the price - never a broken page. At the three widths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ClubPortal } from '../../api/publicClubOrder';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const getClubPortal = vi.fn();
const getOrderForm = vi.fn();

vi.mock('../../api/publicClubOrder', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicClubOrder')>('../../api/publicClubOrder');
  return { ...actual, getClubPortal, getOrderForm };
});
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return { ...actual, readPublicClinic: vi.fn().mockResolvedValue({ name: 'Klinika', email: 'a@b.cz', phone: '606 785 271', address: '', bookingEnabled: true }) };
});
vi.mock('../../web/data', () => ({
  usePublicClinic: () => ({ name: 'Klinika', email: 'fallback@klinika.cz', phone: '606 000 000', address: '', bookingEnabled: true }),
}));
vi.mock('../../web/http', async () => {
  const actual = await vi.importActual<typeof import('../../web/http')>('../../web/http');
  return { ...actual, webHttp: { get: vi.fn().mockRejectedValue(new Error('offline')), post: vi.fn() } };
});

const { default: ClubOrderForm } = await import('./ClubOrderForm');

const DAY1 = '2099-03-04';

const portal = (over: Partial<ClubPortal> = {}): ClubPortal => ({
  reference: 'KO-2041',
  clubName: 'FK Slaný',
  serviceName: 'Sportovní prohlídky',
  status: 'Confirmed',
  paymentMethod: 'ClubInvoice',
  activities: [
    { activityId: 'a1', name: 'Základní', durationMinutes: 30, seats: 10, registered: 4, priceCzk: 1200 },
    { activityId: 'a2', name: 'Komplexní', durationMinutes: 60, seats: 4, registered: 0, priceCzk: null },
  ],
  windows: [{ date: DAY1, startLocal: '08:00', endLocal: '12:00', activityIds: ['a1', 'a2'], calendarName: 'Ambulance' }],
  athletes: [],
  notices: [],
  registrationUrl: '/klub/reg-9',
  clinic: { phone: '606 785 271', email: 'ordinace@klinika.cz' },
  priceQuote: { listTotalCzk: 12000, discounts: [{ label: 'Skupinová sleva', amountCzk: 1200 }], totalCzk: 10800 },
  groupPriceQuote: null,
  billing: { state: 'None', invoiceNumber: null },
  ...over,
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/klub-objednavka/tok-1']}>
        <Routes><Route path="/klub-objednavka/:token" element={<ClubOrderForm />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  getClubPortal.mockResolvedValue(portal());
  getOrderForm.mockResolvedValue(null);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('portal prices at %s', (name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the price per player beside each činnost, "bez ceny" for an unpriced one', async () => {
    renderPage();
    const root = await screen.findByTestId('club-portal');
    expect(root).toHaveAttribute('data-layout', name);
    const rows = screen.getAllByTestId('portal-progress-row');
    expect(within(rows[0]).getByTestId('portal-progress-price')).toHaveTextContent('1 200 Kč za hráče');
    expect(within(rows[1]).getByTestId('portal-progress-price')).toHaveTextContent('bez ceny');
  });

  it('shows the list total, the discount, the total and that the club is invoiced', async () => {
    renderPage();
    await screen.findByTestId('club-portal');
    expect(screen.getByRole('heading', { name: 'Cena objednávky' })).toBeInTheDocument();
    expect(screen.getByTestId('portal-price-list')).toHaveTextContent('12 000 Kč');
    expect(screen.getByText('Skupinová sleva')).toBeInTheDocument();
    expect(screen.getByText('−1 200 Kč')).toBeInTheDocument();
    expect(screen.getByTestId('portal-price-total')).toHaveTextContent('10 800 Kč');
    expect(screen.queryByTestId('portal-price-group')).toBeNull();
    expect(screen.getByTestId('portal-billing')).toHaveTextContent('Hradí klub — fakturu vystaví ordinace po dokončení.');
    expect(screen.getByTestId('portal-billing')).toHaveAttribute('data-state', 'None');
  });
});

describe('the invoicing state and the group', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('says "k fakturaci" and then "fakturováno" with the invoice number', async () => {
    getClubPortal.mockResolvedValue(portal({ billing: { state: 'ToInvoice', invoiceNumber: null } }));
    renderPage();
    await screen.findByTestId('club-portal');
    expect(screen.getByTestId('portal-billing')).toHaveTextContent('K fakturaci — fakturu vám ordinace pošle.');
    expect(screen.getByTestId('portal-billing')).toHaveAttribute('data-state', 'ToInvoice');
  });

  it('shows the invoice number once invoiced, and the group total when the order shares an invoice', async () => {
    getClubPortal.mockResolvedValue(portal({
      billing: { state: 'Invoiced', invoiceNumber: 'FV-2026-0042' },
      groupPriceQuote: { listTotalCzk: 30000, discounts: [], totalCzk: 27000 },
    }));
    renderPage();
    await screen.findByTestId('club-portal');
    expect(screen.getByTestId('portal-billing')).toHaveTextContent('Fakturováno · FV-2026-0042');
    expect(screen.getByTestId('portal-price-group')).toHaveTextContent('27 000 Kč');
  });

  it('says each player pays for themselves on a per-person order, with the price still shown', async () => {
    getClubPortal.mockResolvedValue(portal({ paymentMethod: 'PerPerson' }));
    renderPage();
    await screen.findByTestId('club-portal');
    expect(screen.getByTestId('portal-price-total')).toHaveTextContent('10 800 Kč');
    expect(screen.getByTestId('portal-billing')).toHaveTextContent('Každý hráč platí za sebe na místě; cena je orientační.');
    expect(screen.getByTestId('portal-billing')).toHaveAttribute('data-state', 'PerPerson');
  });

  it('without a price quote says the clinic will add the price, and still draws the rest', async () => {
    getClubPortal.mockResolvedValue(portal({ priceQuote: null, billing: { state: 'None', invoiceNumber: null } }));
    renderPage();
    await screen.findByTestId('club-portal');
    expect(screen.getByTestId('portal-price-empty')).toHaveTextContent('Cenu doplní ordinace.');
    expect(screen.queryByTestId('portal-price-total')).toBeNull();
    expect(screen.getAllByTestId('portal-progress-row')).toHaveLength(2);
    expect(screen.getByTestId('portal-billing')).toHaveTextContent('Hradí klub');
  });
});
