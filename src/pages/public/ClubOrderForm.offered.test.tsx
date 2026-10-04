/*
 * Etapa 8: /klub-objednavka/:token when the clinic offered days. Only the offered days are tappable, at least one is
 * required, the chosen days go out as ranges (consecutive days merged) and the summary names them. Without an offer
 * the free "Termín od–do" block is untouched (covered by ClubOrderForm.test.tsx; one check repeated here).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { OrderForm } from '../../api/publicClubOrder';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const getOrderForm = vi.fn();
const quoteOrder = vi.fn();
const submitOrder = vi.fn();

vi.mock('../../api/publicClubOrder', async () => {
  const actual = await vi.importActual<typeof import('../../api/publicClubOrder')>('../../api/publicClubOrder');
  return { ...actual, getOrderForm, quoteOrder, submitOrder };
});
vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return { ...actual, readPublicClinic: vi.fn().mockResolvedValue({ name: 'Klinika', email: 'a@b.cz', phone: '606 785 271', address: '', bookingEnabled: true }) };
});
vi.mock('../../web/data', () => ({
  usePublicClinic: () => ({ name: 'Klinika', email: 'a@b.cz', phone: '606 785 271', address: '', bookingEnabled: true }),
}));
vi.mock('../../web/http', async () => {
  const actual = await vi.importActual<typeof import('../../web/http')>('../../web/http');
  return { ...actual, webHttp: { get: vi.fn().mockRejectedValue(new Error('offline')), post: vi.fn() } };
});

const { default: ClubOrderForm } = await import('./ClubOrderForm');

const OFFERED = ['2099-10-12', '2099-10-13', '2099-10-15', '2099-10-20'];

const offer = (over: Partial<OrderForm> = {}): OrderForm => ({
  clubName: 'FK Slaný',
  status: 'Invited',
  services: [{ serviceId: 's1', serviceName: 'Diagnostika', activities: [{ activityId: 'a1', name: 'Spiroergometrie', durationMinutes: 45, unitPriceCzk: 1200 }] }],
  paymentMethods: ['ClubInvoice', 'PerPerson'],
  draft: null,
  minimumPlayers: null,
  registrationUrl: null,
  registrationOpen: false,
  offeredDates: OFFERED,
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

const day = (iso: string) => document.querySelector(`[data-date="${iso}"]`) as HTMLButtonElement;
const submitBtn = () => screen.getByRole('button', { name: 'Odeslat objednávku' });
const loaded = async () => { await screen.findByRole('heading', { level: 1, name: /Objednávka pro klub FK Slaný/ }); };

async function fillRest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Platí klub (jedna faktura klubu)' }));
  await user.click(screen.getByRole('button', { name: 'Přidat hráče: Spiroergometrie' }));
  await user.type(screen.getByLabelText(/Jméno a příjmení/), 'Petr Trenér');
  await user.type(screen.getByRole('textbox', { name: /^Telefon/ }), '773539001');
  await user.type(screen.getByLabelText(/E-mail/), 'petr@klub.cz');
}

beforeEach(() => {
  vi.clearAllMocks();
  getOrderForm.mockResolvedValue(offer());
  quoteOrder.mockResolvedValue({ listTotalCzk: 1200, discounts: [], totalCzk: 1200, totalSeats: 1, neededMinutes: 45 });
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('club form with offered days at %s', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('shows the day picker instead of the free term; only offered days are tappable', async () => {
    renderPage();
    await loaded();
    expect(screen.getByText(/Vyberte dny, které vám vyhovují/)).toBeInTheDocument();
    expect(screen.getByText('Ordinace vám potvrdí konkrétní dny z vašeho výběru.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Termín od')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Preferovaný čas')).not.toBeInTheDocument();
    expect(day('2099-10-12')).toBeEnabled();
    expect(day('2099-10-14')).toBeDisabled();
    expect(day('2099-10-12')).toHaveAttribute('data-state', 'offered');
    expect(screen.getByTestId('club-days-count')).toHaveTextContent('Vybráno dní: 0');
  });

  it('requires at least one day, then sends the chosen days as ranges (consecutive days merged) and names them', async () => {
    const user = userEvent.setup();
    submitOrder.mockResolvedValue({ status: 'Requested', reference: 'KO-1' });
    renderPage();
    await loaded();
    await fillRest(user);
    expect(submitBtn()).toBeDisabled();

    expect(day('2099-10-14')).toBeDisabled(); // not offered: inert
    expect(screen.getByTestId('club-days-count')).toHaveTextContent('Vybráno dní: 0');
    for (const d of ['2099-10-12', '2099-10-13', '2099-10-15']) await user.click(day(d));
    expect(screen.getByTestId('club-days-count')).toHaveTextContent('Vybráno dní: 3');
    expect(screen.getByTestId('club-days-list')).toHaveTextContent('12., 13., 15. října 2099');
    await waitFor(() => expect(screen.getByRole('complementary')).toHaveTextContent(/vybrané dny 12., 13., 15. října 2099/));
    expect(submitBtn()).toBeEnabled();

    await user.click(day('2099-10-13')); // untick
    expect(screen.getByTestId('club-days-count')).toHaveTextContent('Vybráno dní: 2');
    await user.click(day('2099-10-13'));

    await user.click(submitBtn());
    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1));
    expect(submitOrder.mock.calls[0][1].ranges).toEqual([
      { fromDate: '2099-10-12', toDate: '2099-10-13' },
      { fromDate: '2099-10-15', toDate: '2099-10-15' },
    ]);
    expect(submitOrder.mock.calls[0][1].note).toBeUndefined();
    expect(await screen.findByText('Děkujeme, objednávku jsme přijali')).toBeInTheDocument();
    expect(screen.getByText(/12., 13., 15. října 2099/)).toBeInTheDocument();
  });

  it('keeps the old free term block when nothing is offered', async () => {
    getOrderForm.mockResolvedValue(offer({ offeredDates: [] }));
    renderPage();
    await loaded();
    expect(screen.getByLabelText('Termín od')).toBeInTheDocument();
    expect(screen.getByLabelText('Preferovaný čas')).toBeInTheDocument();
    expect(screen.queryByTestId('club-days-calendar')).not.toBeInTheDocument();
  });
});
