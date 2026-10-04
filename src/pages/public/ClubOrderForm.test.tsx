/*
 * /klub-objednavka/:token — the club's order form: service → činnosti → counts, terms, payment, contact,
 * a live server-side price, a REQUEST that the clinic processes. Rendered at the three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { OrderForm, OrderQuote } from '../../api/publicClubOrder';
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
const { ClubOrderLinkError, ClubOrderValidationError } = await import('../../api/publicClubOrder');

const FUTURE = '2099-03-04';
const PAST = '2020-01-02';

const offer = (over: Partial<OrderForm> = {}): OrderForm => ({
  clubName: 'FK Slaný',
  status: 'Invited',
  services: [
    { serviceId: 's1', serviceName: 'Diagnostika', activities: [
      { activityId: 'a1', name: 'Spiroergometrie', durationMinutes: 45, unitPriceCzk: 1200 },
      { activityId: 'a2', name: 'InBody', durationMinutes: 15, unitPriceCzk: 300 },
    ] },
    { serviceId: 's2', serviceName: 'Fyzioterapie', activities: [
      { activityId: 'b1', name: 'Masáž', durationMinutes: 30, unitPriceCzk: 700 },
    ] },
  ],
  paymentMethods: ['ClubInvoice', 'PerPerson'],
  draft: null,
  minimumPlayers: null,
  ...over,
});

const quote = (over: Partial<OrderQuote> = {}): OrderQuote => ({
  listTotalCzk: 5000,
  discounts: [{ kind: 'club', label: 'Klubová sleva', percent: 10, amountCzk: 500 }],
  totalCzk: 4500,
  totalSeats: 5,
  neededMinutes: 90,
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

const loaded = async () => { await screen.findByRole('heading', { level: 1, name: /Objednávka pro klub FK Slaný/ }); };
const plus = (name: string) => screen.getByRole('button', { name: `Přidat hráče: ${name}` });
const submitBtn = () => screen.getByRole('button', { name: 'Odeslat objednávku' });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
  await user.click(plus('Spiroergometrie'));
  await user.click(plus('Spiroergometrie'));
  fireEvent.change(screen.getByLabelText('Datum termínu 1'), { target: { value: FUTURE } });
  fireEvent.change(screen.getByLabelText('Čas od, termín 1'), { target: { value: '09:00' } });
  fireEvent.change(screen.getByLabelText('Čas do, termín 1'), { target: { value: '12:00' } });
  await user.click(screen.getByRole('radio', { name: 'Faktura klubu' }));
  await user.type(screen.getByLabelText(/Jméno a příjmení/), 'Petr Trenér');
  await user.type(screen.getByRole('textbox', { name: /^Telefon/ }), '773539001');
  await user.type(screen.getByLabelText(/E-mail/), 'petr@klub.cz');
}

beforeEach(() => {
  vi.clearAllMocks();
  getOrderForm.mockResolvedValue(offer());
  quoteOrder.mockResolvedValue(quote());
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('ClubOrderForm at %s', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the club, the next-step sentence, the clinic phone and "—" before anything is chosen', async () => {
    renderPage();
    await loaded();
    expect(screen.getByText(/Je to žádost/)).toBeInTheDocument();
    expect(screen.getAllByText('606 785 271').length).toBeGreaterThan(0);
    expect(screen.getByTestId('sum-total')).toHaveTextContent('—');
    expect(screen.getByTestId('sum-players')).toHaveTextContent('—');
    expect(submitBtn()).toBeDisabled();
    const pinned = document.querySelector('[data-pinned]');
    expect(pinned?.getAttribute('data-pinned')).toBe(width === VIEWPORTS.phone ? 'true' : 'false');
  });

  it('choosing another service resets the činnosti and counts', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    expect(screen.getByLabelText('Počet hráčů: Spiroergometrie')).toHaveValue('1');
    await user.click(screen.getByRole('radio', { name: 'Fyzioterapie' }));
    expect(screen.queryByLabelText('Počet hráčů: Spiroergometrie')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Počet hráčů: Masáž')).toHaveValue('');
    expect(screen.getByTestId('sum-total')).toHaveTextContent('—');
  });

  it('steppers add and remove, never below zero; the unit price is the server\'s', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    expect(screen.getByRole('button', { name: 'Ubrat hráče: InBody' })).toBeDisabled();
    await user.click(plus('InBody'));
    await user.click(plus('InBody'));
    await user.click(screen.getByRole('button', { name: 'Ubrat hráče: InBody' }));
    expect(screen.getByLabelText('Počet hráčů: InBody')).toHaveValue('1');
    fireEvent.change(screen.getByLabelText('Počet hráčů: InBody'), { target: { value: '12' } });
    expect(screen.getByLabelText('Počet hráčů: InBody')).toHaveValue('12');
    expect(screen.getAllByText(/15 min/).length).toBeGreaterThan(0);
  });

  it('debounces the quote, cancels the older request and shows the server\'s discounts and totals', async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    quoteOrder.mockImplementation((_t: string, _b: unknown, signal: AbortSignal) => { signals.push(signal); return Promise.resolve(quote()); });
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    await user.click(plus('Spiroergometrie'));
    await user.click(plus('Spiroergometrie'));
    await waitFor(() => expect(quoteOrder).toHaveBeenCalledTimes(1));
    expect(quoteOrder.mock.calls[0][1]).toEqual({ serviceId: 's1', activitySeats: [{ activityId: 'a1', seats: 3 }] });
    await waitFor(() => expect(screen.getByTestId('sum-total')).toHaveTextContent('4 500'));
    expect(screen.getByText(/Klubová sleva \(10 %\)/)).toBeInTheDocument();
    expect(screen.getByTestId('sum-time')).toHaveTextContent('01:30');
    expect(screen.getByTestId('sum-players')).toHaveTextContent('5');
    await user.click(plus('Spiroergometrie'));
    await waitFor(() => expect(quoteOrder).toHaveBeenCalledTimes(2));
    expect(signals[0].aborted).toBe(true);
  });

  it('shows the minimum hint only when the server sends one', async () => {
    renderPage();
    await loaded();
    expect(screen.queryByText(/Nejmenší počet hráčů/)).not.toBeInTheDocument();
  });

  it('adds and removes terms and refuses a past date inline', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    expect(screen.queryByRole('button', { name: /Odebrat termín/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Přidat další termín/ }));
    expect(screen.getByRole('group', { name: 'Termín 2' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Datum termínu 2'), { target: { value: PAST } });
    expect(screen.getByText('Datum už je v minulosti.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Odebrat termín 2' }));
    expect(screen.queryByRole('group', { name: 'Termín 2' })).not.toBeInTheDocument();
  });

  it('keeps the button disabled without a payment method, then submits the exact payload and shows the confirmation', async () => {
    const user = userEvent.setup();
    submitOrder.mockResolvedValue({ status: 'Requested', reference: 'KO-2026-0042' });
    renderPage();
    await loaded();
    await fillValid(user);
    await waitFor(() => expect(screen.getByTestId('sum-total')).toHaveTextContent('4 500'));
    expect(submitBtn()).toBeEnabled();
    // payment is required: un-selecting is not possible, so check a fresh page
    await user.click(submitBtn());
    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1));
    expect(submitOrder.mock.calls[0][0]).toBe('tok-1');
    const body = submitOrder.mock.calls[0][1];
    expect(body.serviceId).toBe('s1');
    expect(body.activitySeats).toEqual([{ activityId: 'a1', seats: 2 }]);
    expect(body.ranges).toEqual([{ fromDate: FUTURE, toDate: FUTURE, dailyFrom: '09:00', dailyTo: '12:00' }]);
    expect(body.paymentMethod).toBe('ClubInvoice');
    expect(body.contact.name).toBe('Petr Trenér');
    expect(body.contact.email).toBe('petr@klub.cz');
    expect(body.contact.phone.replace(/\D/g, '')).toContain('773539001');
    expect(await screen.findByText('Děkujeme, objednávku jsme přijali')).toBeInTheDocument();
    expect(screen.getByTestId('order-reference')).toHaveTextContent('KO-2026-0042');
    expect(screen.getByText(/Ozveme se vám na uvedený kontakt/)).toBeInTheDocument();
  });

  it('does not enable submit while the payment method is missing', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    fireEvent.change(screen.getByLabelText('Datum termínu 1'), { target: { value: FUTURE } });
    fireEvent.change(screen.getByLabelText('Čas od, termín 1'), { target: { value: '09:00' } });
    fireEvent.change(screen.getByLabelText('Čas do, termín 1'), { target: { value: '12:00' } });
    await user.type(screen.getByLabelText(/Jméno a příjmení/), 'Petr');
    await user.type(screen.getByRole('textbox', { name: /^Telefon/ }), '773539001');
    await user.type(screen.getByLabelText(/E-mail/), 'petr@klub.cz');
    expect(submitBtn()).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Platí jednotlivé osoby' }));
    expect(submitBtn()).toBeEnabled();
  });

  it('puts the server\'s field errors under the fields and keeps what was typed', async () => {
    const user = userEvent.setup();
    submitOrder.mockRejectedValue(new ClubOrderValidationError({ 'contact.email': ['E-mail je neplatný.'], activitySeats: ['Málo hráčů.'] }));
    renderPage();
    await loaded();
    await fillValid(user);
    await user.click(submitBtn());
    expect(await screen.findByText('E-mail je neplatný.')).toBeInTheDocument();
    expect(screen.getByText('Málo hráčů.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Jméno a příjmení/)).toHaveValue('Petr Trenér');
    expect(screen.getByLabelText('Počet hráčů: Spiroergometrie')).toHaveValue('2');
  });

  it('answers a 409 on submit with the calm "call us" page and the clinic phone', async () => {
    const user = userEvent.setup();
    submitOrder.mockRejectedValue(new ClubOrderLinkError('processed'));
    renderPage();
    await loaded();
    await fillValid(user);
    await user.click(submitBtn());
    expect(await screen.findByText('Tuto objednávku už zpracováváme. Zavolejte nám prosím.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /606 785 271/ })[0]).toHaveAttribute('href', 'tel:606785271');
  });
});

describe('ClubOrderForm link states and draft', () => {
  beforeEach(() => setViewport(VIEWPORTS.phone));

  it('says so for an unknown link (404) and a cancelled one (410)', async () => {
    getOrderForm.mockRejectedValueOnce(new ClubOrderLinkError('notFound'));
    const first = renderPage();
    expect(await screen.findByRole('heading', { name: 'Odkaz neplatí' })).toBeInTheDocument();
    first.unmount();
    getOrderForm.mockRejectedValueOnce(new ClubOrderLinkError('gone'));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Objednávka byla zrušena' })).toBeInTheDocument();
  });

  it('shows the processed page when the order is no longer open', async () => {
    getOrderForm.mockResolvedValue(offer({ status: 'Confirmed' }));
    renderPage();
    expect(await screen.findByText('Tuto objednávku už zpracováváme. Zavolejte nám prosím.')).toBeInTheDocument();
  });

  it('opens filled from a worker\'s draft and shows the minimum hint when the server has one', async () => {
    getOrderForm.mockResolvedValue(offer({
      minimumPlayers: 8,
      draft: {
        serviceId: 's2',
        activitySeats: [{ activityId: 'b1', seats: 4 }],
        ranges: [{ fromDate: FUTURE, toDate: FUTURE, dailyFrom: '10:00', dailyTo: '11:00' }],
        paymentMethod: 'PerPerson',
        contact: { name: 'Jana', phone: '+420773539001', email: 'jana@klub.cz' },
        note: 'Pozn.',
      },
    }));
    renderPage();
    await loaded();
    expect(screen.getByRole('radio', { name: 'Fyzioterapie' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Počet hráčů: Masáž')).toHaveValue('4');
    expect(screen.getByLabelText('Datum termínu 1')).toHaveValue(FUTURE);
    expect(screen.getByRole('radio', { name: 'Platí jednotlivé osoby' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Jméno a příjmení/)).toHaveValue('Jana');
    expect(screen.getByText('Nejmenší počet hráčů v objednávce je 8.')).toBeInTheDocument();
    await waitFor(() => expect(quoteOrder).toHaveBeenCalled());
    expect(within(screen.getByRole('complementary')).getByTestId('sum-players')).toBeInTheDocument();
  });
});

describe('ClubOrderForm source', () => {
  it('hard-codes no price: no number followed by Kč in the page files', () => {
    const dir = join(__dirname, 'clubOrder');
    const files = [join(__dirname, 'ClubOrderForm.tsx'), join(__dirname, '..', '..', 'api', 'publicClubOrder.ts'),
      ...readdirSync(dir).filter((f) => /\.tsx?$/.test(f)).map((f) => join(dir, f))];
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/\d[\d\s.,]*\s?Kč/);
    }
  });
});
