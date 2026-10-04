/*
 * /klub-objednavka/:token — the club's order form: who pays → service → činnosti → counts, term, contact, note,
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
  registrationUrl: null,
  registrationOpen: false,
  offeredDates: [],
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
const CLUB = { name: 'Platí klub (jedna faktura klubu)' };
const PERSON = { name: 'Platí rodiče / hráči sami (každý za sebe)' };
const submitBtn = () => screen.getByRole('button', { name: 'Odeslat objednávku' });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', CLUB));
  await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
  await user.click(plus('Spiroergometrie'));
  await user.click(plus('Spiroergometrie'));
  fireEvent.change(screen.getByLabelText('Termín od'), { target: { value: FUTURE } });
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

  it('asks first who pays, as a required two-card choice with a sentence each', async () => {
    renderPage();
    await loaded();
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAccessibleName(CLUB.name);
    expect(radios[1]).toHaveAccessibleName(PERSON.name);
    expect(screen.getByRole('radiogroup', { name: /Kdo platí/ })).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText(/Klub dostane jednu fakturu/)).toBeInTheDocument();
    expect(screen.getByText(/zaplatí svou prohlídku na místě/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat další termín/ })).not.toBeInTheDocument();
  });

  it('validates the term per field: past date and end before start, in Czech', async () => {
    renderPage();
    await loaded();
    fireEvent.change(screen.getByLabelText('Termín od'), { target: { value: PAST } });
    expect(screen.getByText('Datum už je v minulosti.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Termín od'), { target: { value: FUTURE } });
    fireEvent.change(screen.getByLabelText('Termín do'), { target: { value: '2099-03-01' } });
    expect(screen.getByText('Konec termínu musí být po začátku.')).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });

  it('keeps submit disabled while the contact is invalid', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', CLUB));
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    fireEvent.change(screen.getByLabelText('Termín od'), { target: { value: FUTURE } });
    await user.type(screen.getByLabelText(/Jméno a příjmení/), 'Petr');
    await user.type(screen.getByRole('textbox', { name: /^Telefon/ }), '773539001');
    await user.type(screen.getByLabelText(/E-mail/), 'nonsense');
    expect(submitBtn()).toBeDisabled();
    await user.clear(screen.getByLabelText(/E-mail/));
    await user.type(screen.getByLabelText(/E-mail/), 'petr@klub.cz');
    expect(submitBtn()).toBeEnabled();
  });

  it('writes the plain sentence for "klub platí" and keeps the total as a price', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', CLUB));
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    fireEvent.change(screen.getByLabelText('Termín od'), { target: { value: FUTURE } });
    fireEvent.change(screen.getByLabelText('Termín do'), { target: { value: '2099-03-06' } });
    const sentence = await screen.findByTestId('order-sentence');
    await waitFor(() => expect(sentence.textContent).toMatch(/Celkem 4\s500 Kč, platí klub\./));
    expect(sentence).toHaveTextContent(/Objednáváte 5 hráčů \(Spiroergometrie 1×\)/);
    expect(sentence).toHaveTextContent('termín 4. 3. 2099 – 6. 3. 2099');
    expect(screen.getByText('Cena celkem')).toBeInTheDocument();
    expect(screen.getAllByText(/za hráče/).length).toBeGreaterThan(0);
  });

  it('writes the sentence for "platí rodiče" with "cena za osobu" and an informational total', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', PERSON));
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    const sentence = await screen.findByTestId('order-sentence');
    await waitFor(() => expect(sentence.textContent).toMatch(/Orientační cena celkem 4\s500 Kč, platí rodiče \/ hráči sami, každý za sebe\./));
    expect(screen.getByText('Orientační cena celkem')).toBeInTheDocument();
    expect(screen.getAllByText(/cena za osobu/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Cena celkem')).not.toBeInTheDocument();
  });

  it('asks to choose who pays in the sentence while that is still open', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    expect(await screen.findByTestId('order-sentence')).toHaveTextContent('Vyberte, kdo platí.');
  });

  it('puts the preferred time at the head of the note and keeps the typed note', async () => {
    const user = userEvent.setup();
    submitOrder.mockResolvedValue({ status: 'Requested', reference: 'KO-1' });
    renderPage();
    await loaded();
    await fillValid(user);
    await user.type(screen.getByLabelText('Preferovaný čas'), 'dopoledne');
    await user.type(screen.getByRole('textbox', { name: /^Poznámka$/ }), 'Přijedeme autobusem');
    await user.click(submitBtn());
    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1));
    expect(submitOrder.mock.calls[0][1].note).toBe('Preferovaný čas: dopoledne\nPřijedeme autobusem');
  });

  it('hides the service step when the clinic offers one service and selects it', async () => {
    const user = userEvent.setup();
    getOrderForm.mockResolvedValue(offer({ services: [offer().services[0]] }));
    renderPage();
    await loaded();
    expect(screen.queryByRole('radiogroup', { name: /Služba/ })).not.toBeInTheDocument();
    await user.click(plus('Spiroergometrie'));
    await waitFor(() => expect(quoteOrder.mock.calls[0][1].serviceId).toBe('s1'));
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
    expect(body.ranges).toEqual([{ fromDate: FUTURE, toDate: FUTURE }]);
    expect(body.note).toBeUndefined();
    expect(body.paymentMethod).toBe('ClubInvoice');
    expect(body.contact.name).toBe('Petr Trenér');
    expect(body.contact.email).toBe('petr@klub.cz');
    expect(body.contact.phone.replace(/\D/g, '')).toContain('773539001');
    expect(await screen.findByText('Děkujeme, objednávku jsme přijali')).toBeInTheDocument();
    expect(screen.getByTestId('order-reference')).toHaveTextContent('KO-2026-0042');
    expect(screen.getByText(/Ozveme se vám na uvedený kontakt/)).toBeInTheDocument();
    expect(screen.getByTestId('order-link-note')).toHaveTextContent('Odkaz pro hráče a rodiče vám pošleme, jakmile ordinace potvrdí termín.');
  });

  it('does not enable submit while the payment method is missing', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();
    await user.click(screen.getByRole('radio', { name: 'Diagnostika' }));
    await user.click(plus('Spiroergometrie'));
    fireEvent.change(screen.getByLabelText('Termín od'), { target: { value: FUTURE } });
    await user.type(screen.getByLabelText(/Jméno a příjmení/), 'Petr');
    await user.type(screen.getByRole('textbox', { name: /^Telefon/ }), '773539001');
    await user.type(screen.getByLabelText(/E-mail/), 'petr@klub.cz');
    expect(submitBtn()).toBeDisabled();
    await user.click(screen.getByRole('radio', PERSON));
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

  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])(
    'a confirmed order shows the absolute link for the players with a copy button (%s)',
    async (_n, width) => {
      setViewport(width);
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      getOrderForm.mockResolvedValue(offer({ status: 'Confirmed', registrationUrl: '/klub/tok-reg', registrationOpen: true }));
      renderPage();

      expect(await screen.findByRole('heading', { name: 'Odkaz pro hráče a rodiče' })).toBeInTheDocument();
      expect(screen.getByText('Pošlete tento odkaz rodičům a hráčům — každý si vybere svůj termín.')).toBeInTheDocument();
      const url = `${window.location.origin}/klub/tok-reg`;
      expect(screen.getByRole('textbox', { name: 'Odkaz pro hráče a rodiče' })).toHaveValue(url);
      await userEvent.click(screen.getByRole('button', { name: 'Kopírovat odkaz' }));
      expect(writeText).toHaveBeenCalledWith(url);
      expect(await screen.findByRole('button', { name: 'Zkopírováno' })).toBeInTheDocument();
    },
  );

  it('a confirmed order without a link falls back to the processed page', async () => {
    getOrderForm.mockResolvedValue(offer({ status: 'Requested' }));
    renderPage();
    expect(await screen.findByText('Tuto objednávku už zpracováváme. Zavolejte nám prosím.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kopírovat odkaz' })).not.toBeInTheDocument();
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
    expect(screen.getByLabelText('Termín od')).toHaveValue(FUTURE);
    expect(screen.getByRole('radio', PERSON)).toHaveAttribute('aria-checked', 'true');
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
