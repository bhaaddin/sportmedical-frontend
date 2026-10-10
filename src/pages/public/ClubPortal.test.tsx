/*
 * Etapa 11: /klub-objednavka/:token as the club's PORTAL once the order is no longer Invited - the status, the
 * calendar of the confirmed windows with the players in them, the progress per činnost, the desk's notices, the link
 * for the players (only when set), the clinic contact; the order form for Invited and when the portal answers 404.
 * Rendered at the three widths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ClubPortal, OrderForm } from '../../api/publicClubOrder';
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

const { default: ClubOrderForm, PORTAL_REFRESH_MS } = await import('./ClubOrderForm');
const { ClubOrderLinkError } = await import('../../api/publicClubOrder');

const DAY1 = '2099-03-04';
const DAY2 = '2099-03-09';
const DAY3 = '2099-04-02';
const HOUR = 60 * 60 * 1000;

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
  priceQuote: { listTotalCzk: 12000, discounts: [{ label: 'Skupinová sleva', amountCzk: 1200 }], totalCzk: 10800 },
  groupPriceQuote: null,
  billing: { state: 'None', invoiceNumber: null },
  windows: [
    { date: DAY1, startLocal: '08:00', endLocal: '12:00', activityIds: ['a1', 'a2'], calendarName: 'Ambulance' },
    { date: DAY1, startLocal: '13:00', endLocal: '15:00', activityIds: ['a1'], calendarName: 'Ambulance' },
    { date: DAY2, startLocal: '09:00', endLocal: '11:00', activityIds: [], calendarName: 'Ambulance' },
    { date: DAY3, startLocal: '09:00', endLocal: '11:00', activityIds: ['a2'], calendarName: 'Ambulance' },
  ],
  athletes: [
    { name: 'Petr Novák', activityName: 'Základní', date: DAY1, startLocal: '08:30', endLocal: '09:00', status: 'Booked' },
    { name: 'Jan Svoboda', activityName: 'Komplexní', date: DAY1, startLocal: '09:00', endLocal: '10:00', status: 'Cancelled' },
    { name: 'Eva Malá', activityName: 'Základní', date: DAY1, startLocal: '13:30', endLocal: '14:00', status: 'Booked' },
  ],
  notices: [
    { atUtc: new Date(Date.now() - 2 * HOUR).toISOString(), text: 'Termín 9. 3. jsme posunuli na 9:00.' },
    { atUtc: new Date(Date.now() - 30 * 24 * HOUR).toISOString(), text: 'Termíny jsme potvrdili.' },
  ],
  registrationUrl: '/klub/reg-9',
  clinic: { phone: '606 785 271', email: 'ordinace@klinika.cz' },
  ...over,
});

const invitedForm = (): OrderForm => ({
  clubName: 'FK Slaný',
  status: 'Invited',
  services: [{ serviceId: 's1', serviceName: 'Diagnostika', activities: [{ activityId: 'a1', name: 'Spiroergometrie', durationMinutes: 45, unitPriceCzk: 1200 }] }],
  paymentMethods: ['ClubInvoice', 'PerPerson'],
  draft: null,
  minimumPlayers: null,
  registrationUrl: null,
  registrationOpen: false,
  offeredDates: [],
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/klub-objednavka/tok-1']}>
        <Routes><Route path="/klub-objednavka/:token" element={<ClubOrderForm />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const portalShown = async () => screen.findByTestId('club-portal');

beforeEach(() => {
  vi.clearAllMocks();
  getClubPortal.mockResolvedValue(portal());
  getOrderForm.mockResolvedValue(invitedForm());
});

afterEach(() => {
  vi.useRealTimers();
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('club portal at %s', (name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the club, service, reference and the status of a confirmed order, and not the form', async () => {
    renderPage();
    const root = await portalShown();
    expect(root).toHaveAttribute('data-layout', name);
    expect(screen.getByRole('heading', { level: 1, name: 'FK Slaný' })).toBeInTheDocument();
    expect(screen.getByText('Sportovní prohlídky · objednávka KO-2041')).toBeInTheDocument();
    expect(screen.getByTestId('portal-status')).toHaveTextContent('Potvrzeno');
    expect(screen.getByTestId('portal-status-text')).toHaveTextContent('Termíny potvrzeny');
    expect(screen.queryByRole('button', { name: 'Odeslat objednávku' })).not.toBeInTheDocument();
    expect(getOrderForm).not.toHaveBeenCalled();
  });

  it.each([
    ['Requested', 'Čeká na potvrzení', 'Čeká na potvrzení ordinací'],
    ['Completed', 'Dokončeno', 'Objednávka je dokončena'],
    ['Cancelled', 'Zrušeno', 'Objednávka byla zrušena ordinací'],
  ] as const)('shows the %s status with its own wording', async (status, chip, sentence) => {
    getClubPortal.mockResolvedValue(portal({ status, registrationUrl: null }));
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-status')).toHaveTextContent(chip);
    expect(screen.getByTestId('portal-status')).toHaveAttribute('data-status', status);
    expect(screen.getByTestId('portal-status-text')).toHaveTextContent(sentence);
    expect(getOrderForm).not.toHaveBeenCalled();
  });

  it('keeps the order form for an Invited order', async () => {
    getClubPortal.mockResolvedValue(portal({ status: 'Invited' }));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: /Objednávka pro klub FK Slaný/ })).toBeInTheDocument();
    expect(screen.queryByTestId('club-portal')).not.toBeInTheDocument();
    expect(getOrderForm).toHaveBeenCalledTimes(1);
  });

  it('highlights exactly the days with a window and shows a day with its windows and players when tapped', async () => {
    const user = userEvent.setup();
    renderPage();
    await portalShown();
    /* the calendar opens on the month of the first window (March 2099) */
    expect(screen.getByTestId('portal-month')).toHaveTextContent('Březen 2099');
    const days = screen.getAllByTestId('portal-day');
    expect(days.map((d) => d.getAttribute('data-date'))).toEqual([DAY1, DAY2]);
    expect(screen.getByText('Vyberte den v kalendáři.')).toBeInTheDocument();

    await user.click(days[0]);
    expect(days[0]).toHaveAttribute('aria-pressed', 'true');
    const windows = screen.getAllByTestId('portal-window');
    expect(windows).toHaveLength(2);
    expect(within(windows[0]).getByTestId('portal-window-title')).toHaveTextContent('08:00–12:00 · Základní, Komplexní');
    expect(within(windows[1]).getByTestId('portal-window-title')).toHaveTextContent('13:00–15:00 · Základní');
    /* a player belongs to the window that holds their start */
    expect(within(windows[0]).getByText('Petr Novák')).toBeInTheDocument();
    expect(within(windows[0]).queryByText('Eva Malá')).not.toBeInTheDocument();
    expect(within(windows[1]).getByText('Eva Malá')).toBeInTheDocument();
  });

  it('strikes a cancelled player through and labels them "zrušeno"', async () => {
    const user = userEvent.setup();
    renderPage();
    await portalShown();
    await user.click(screen.getAllByTestId('portal-day')[0]);
    const rows = screen.getAllByTestId('portal-player');
    const cancelled = rows.find((r) => r.getAttribute('data-status') === 'Cancelled');
    expect(cancelled).toBeDefined();
    expect(within(cancelled as HTMLElement).getByText('Jan Svoboda')).toHaveStyle({ textDecoration: 'line-through' });
    expect(within(cancelled as HTMLElement).getByText('zrušeno')).toBeInTheDocument();
    const booked = rows.find((r) => r.getAttribute('data-status') === 'Booked') as HTMLElement;
    expect(within(booked).queryByText('zrušeno')).not.toBeInTheDocument();
    expect(within(booked).getByText('Petr Novák')).not.toHaveStyle({ textDecoration: 'line-through' });
  });

  it('a window without činnosti allows all of them; an empty window says nobody is registered', async () => {
    const user = userEvent.setup();
    renderPage();
    await portalShown();
    await user.click(screen.getAllByTestId('portal-day')[1]);
    expect(screen.getByTestId('portal-window-title')).toHaveTextContent('09:00–11:00 · všechny činnosti');
    expect(screen.getByText('Zatím tu není nikdo zapsaný.')).toBeInTheDocument();
  });

  it('pages to the next month that holds a window', async () => {
    const user = userEvent.setup();
    renderPage();
    await portalShown();
    expect(screen.getByRole('button', { name: 'Předchozí měsíc' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Další měsíc' }));
    expect(screen.getByTestId('portal-month')).toHaveTextContent('Duben 2099');
    expect(screen.getAllByTestId('portal-day').map((d) => d.getAttribute('data-date'))).toEqual([DAY3]);
    expect(screen.getByRole('button', { name: 'Další měsíc' })).toBeDisabled();
  });

  it('shows a calm empty calendar while nothing is confirmed', async () => {
    getClubPortal.mockResolvedValue(portal({ status: 'Requested', windows: [], athletes: [], registrationUrl: null }));
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-cal-empty')).toHaveTextContent('Termíny se tu zobrazí, jakmile je ordinace potvrdí.');
    expect(screen.queryByTestId('portal-calendar')).not.toBeInTheDocument();
  });

  it('shows the progress per činnost with a bar', async () => {
    renderPage();
    await portalShown();
    const rows = screen.getAllByTestId('portal-progress-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Základní 4/10 zapsáno');
    expect(within(rows[0]).getByTestId('portal-progress-bar')).toHaveAttribute('data-percent', '40');
    expect(rows[1]).toHaveTextContent('Komplexní 0/4 zapsáno');
    expect(within(rows[1]).getByTestId('portal-progress-bar')).toHaveAttribute('data-percent', '0');
  });

  it('lists the desk\'s notices newest first and marks those from the last 7 days', async () => {
    renderPage();
    await portalShown();
    const notices = screen.getAllByTestId('portal-notice');
    expect(notices).toHaveLength(2);
    expect(notices[0]).toHaveTextContent('Termín 9. 3. jsme posunuli na 9:00.');
    expect(notices[0]).toHaveAttribute('data-fresh', 'true');
    expect(within(notices[0]).getByText('nové')).toBeInTheDocument();
    expect(notices[1]).toHaveTextContent('Termíny jsme potvrdili.');
    expect(notices[1]).toHaveAttribute('data-fresh', 'false');
    expect(within(notices[1]).queryByText('nové')).not.toBeInTheDocument();
  });

  it('says there are no changes yet when there are no notices', async () => {
    getClubPortal.mockResolvedValue(portal({ notices: [] }));
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-notices-empty')).toHaveTextContent('Zatím žádné změny.');
  });

  it('shows the players\' link card only when the portal has a registration url', async () => {
    const view = renderPage();
    await portalShown();
    const card = screen.getByRole('textbox', { name: 'Odkaz pro hráče a rodiče' });
    expect(card).toHaveValue(`${window.location.origin}/klub/reg-9`);
    expect(screen.getByRole('button', { name: 'Kopírovat odkaz' })).toBeInTheDocument();
    view.unmount();

    getClubPortal.mockResolvedValue(portal({ status: 'Requested', registrationUrl: null }));
    renderPage();
    await portalShown();
    expect(screen.queryByRole('textbox', { name: 'Odkaz pro hráče a rodiče' })).not.toBeInTheDocument();
  });

  it('shows the clinic phone and e-mail as plain selectable text, not links', async () => {
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-phone')).toHaveTextContent('606 785 271');
    expect(screen.getByTestId('portal-email')).toHaveTextContent('ordinace@klinika.cz');
    /* the page footer has its own contact links; the portal's contact block has none */
    expect(screen.getByTestId('portal-phone').closest('a')).toBeNull();
    expect(screen.getByTestId('portal-email').closest('a')).toBeNull();
  });

  it('falls back to the clinic\'s public contact when the portal carries none', async () => {
    getClubPortal.mockResolvedValue(portal({ clinic: { phone: '', email: '' } }));
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-phone')).toHaveTextContent('606 000 000');
    expect(screen.getByTestId('portal-email')).toHaveTextContent('fallback@klinika.cz');
  });

  it('a cancelled order shows the desk\'s message instead of the calendar', async () => {
    getClubPortal.mockResolvedValue(portal({
      status: 'Cancelled',
      registrationUrl: '/klub/reg-9',
      notices: [{ atUtc: new Date(Date.now() - HOUR).toISOString(), text: 'Z provozních důvodů termíny rušíme, ozveme se s novou nabídkou.' }],
    }));
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-cancelled-text')).toHaveTextContent('Z provozních důvodů termíny rušíme');
    expect(screen.queryByTestId('portal-calendar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portal-progress')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Odkaz pro hráče a rodiče' })).not.toBeInTheDocument();
  });

  it('a cancelled order without a message uses the editable default sentence', async () => {
    getClubPortal.mockResolvedValue(portal({ status: 'Cancelled', notices: [], registrationUrl: null }));
    renderPage();
    await portalShown();
    expect(screen.getByTestId('portal-cancelled-text')).toHaveTextContent('Termíny jsme uvolnili.');
  });

  it('falls back to the order form when the portal answers 404, and to "Odkaz neplatí" when the form does too', async () => {
    getClubPortal.mockRejectedValue(new ClubOrderLinkError('notFound'));
    const view = renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: /Objednávka pro klub FK Slaný/ })).toBeInTheDocument();
    view.unmount();

    getOrderForm.mockRejectedValue(new ClubOrderLinkError('notFound'));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Odkaz neplatí' })).toBeInTheDocument();
  });

  it('sets noindex while it is open, removes it afterwards, and never shows the raw token', async () => {
    const view = renderPage();
    await portalShown();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(document.body.textContent).not.toContain('tok-1');
    view.unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});

describe('club portal polling', () => {
  beforeEach(() => setViewport(VIEWPORTS.phone));

  it('re-reads every 60 seconds, keeps the page (and the chosen day) while it loads, then shows the new notice', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();
    await portalShown();
    await user.click(screen.getAllByTestId('portal-day')[0]);
    expect(getClubPortal).toHaveBeenCalledTimes(1);

    let resolveNext: (p: ClubPortal) => void = () => undefined;
    getClubPortal.mockReturnValueOnce(new Promise<ClubPortal>((resolve) => { resolveNext = resolve; }));
    await act(async () => { await vi.advanceTimersByTimeAsync(PORTAL_REFRESH_MS + 100); });
    expect(getClubPortal).toHaveBeenCalledTimes(2);
    /* while the second read is pending the old data is still there */
    expect(screen.getByTestId('portal-day-detail')).toBeInTheDocument();
    expect(screen.getAllByTestId('portal-notice')).toHaveLength(2);

    await act(async () => {
      resolveNext(portal({ notices: [{ atUtc: new Date().toISOString(), text: 'Nová zpráva od ordinace.' }, ...portal().notices] }));
    });
    await waitFor(() => expect(screen.getAllByTestId('portal-notice')).toHaveLength(3));
    expect(screen.getAllByTestId('portal-notice')[0]).toHaveTextContent('Nová zpráva od ordinace.');
    expect(screen.getByTestId('portal-day-detail')).toBeInTheDocument();
  });

  it('keeps the last data and says so when a refresh fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();
    await portalShown();
    expect(screen.queryByTestId('portal-stale')).not.toBeInTheDocument();
    getClubPortal.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await vi.advanceTimersByTimeAsync(PORTAL_REFRESH_MS + 100); });
    await waitFor(() => expect(screen.getByTestId('portal-stale')).toBeInTheDocument());
    expect(screen.getByTestId('portal-status')).toHaveTextContent('Potvrzeno');
  });

  it('does not poll while the order is an open invitation (the form)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getClubPortal.mockResolvedValue(portal({ status: 'Invited' }));
    renderPage();
    await screen.findByRole('heading', { level: 1, name: /Objednávka pro klub FK Slaný/ });
    await act(async () => { await vi.advanceTimersByTimeAsync(PORTAL_REFRESH_MS * 2); });
    expect(getClubPortal).toHaveBeenCalledTimes(1);
  });
});
