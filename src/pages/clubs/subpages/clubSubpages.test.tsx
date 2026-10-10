/*
 * Kluby > Rezervace / Hráči / Statistiky / Fakturace at phone (390), tablet (834) and desktop (1440): layout,
 * filters, the players CSV, the stats KPI arithmetic, the invoice navigation state and the empty / error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { ClubOrderStats, ClubOrderView } from '../../../api/clubOrders';
import type { Invoice } from '../../../api/billing';
import { statsKpis } from '../../../components/clubs/stats/statsMath';

const { blocksList, ordersList, ordersStats, invoiceDraft, calendarsList, getInvoices, navigate, downloadCsv } = vi.hoisted(() => ({
  invoiceDraft: vi.fn(),
  blocksList: vi.fn(),
  ordersList: vi.fn(),
  ordersStats: vi.fn(),
  calendarsList: vi.fn(),
  getInvoices: vi.fn(),
  navigate: vi.fn(),
  downloadCsv: vi.fn(),
}));

vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { list: blocksList } };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { list: ordersList, stats: ordersStats, invoiceDraft } };
});
vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: calendarsList } }));
vi.mock('../../../api/billing', () => ({ billingApi: { getInvoices } }));
vi.mock('../../statistics/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../statistics/csv')>();
  return { ...actual, downloadCsv };
});
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

const { default: ReservationsPage } = await import('../ClubReservationsPage');
const { default: PlayersPage } = await import('../ClubPlayersPage');
const { default: StatsPage } = await import('../ClubStatsPage');
const { default: BillingPage } = await import('../ClubBillingPage');

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (offset: number) => iso(new Date(Date.now() + offset * 86_400_000));

const block = (over: Partial<ClubBlockView>): ClubBlockView => ({
  id: 'b1', clubId: 'c1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['cal1'], activityIds: ['a1'],
  fromDate: day(0), toDate: day(0), dailyFrom: '08:00', dailyTo: '12:00', playerCount: 10, seats: 10, registered: 4,
  status: 'Active', registrationToken: null, registrationUrl: null, note: null, createdAtUtc: null, athletes: [], ...over,
});

const blocks: ClubBlockView[] = [
  block({
    id: 'b1',
    athletes: [
      { id: 'p1', name: 'Jan Novák', activityName: 'Diagnostika', startUtc: '2026-10-26T09:00:00Z', endUtc: '2026-10-26T09:30:00Z', status: 'Booked', phone: '+420 777 111 222', agreedPriceCzk: 1200, listPriceCzk: 1600 },
      { id: 'p2', name: 'Petr Černý', activityName: 'Základní prohlídka', startUtc: '2026-10-26T10:00:00Z', endUtc: null, status: 'NoShow', phone: null, agreedPriceCzk: null, listPriceCzk: 1600 },
    ],
  }),
  block({
    id: 'b2', clubId: 'c2', clubName: 'SK Kladno', colorHex: '#9B3B1B', status: 'Cancelled', seats: 20, registered: 0,
    athletes: [{ id: 'p3', name: 'Ondřej Dvořák', activityName: 'Diagnostika', startUtc: '2026-10-27T09:00:00Z', endUtc: null, status: 'Attended', phone: '608 000 000' }],
  }),
];

const order = (over: Partial<ClubOrderView>): ClubOrderView => ({
  id: 'o1', clubId: 'c1', clubName: 'FK Slaný', clubColorHex: null, serviceId: 's1', serviceName: 'Prohlídky', status: 'Confirmed',
  paymentMethod: 'ClubInvoice', activitySeats: [{ activityId: 'a1', activityName: 'Diagnostika', durationMinutes: 30, seats: 10, registered: 4, unitPriceCzk: 500 }],
  totalSeats: 12, registered: 4, priceQuote: { listTotalCzk: 6000, discounts: [], totalCzk: 6000 }, requestedRanges: [], blocks: [blocks[0]], note: '', contact: null,
  formToken: '', formUrl: '', registrationToken: '', registrationUrl: '', releaseDaysBefore: null, effectiveReleaseDaysBefore: null,
  createdBy: 'Staff', createdAtUtc: '', submittedAtUtc: null, confirmedAtUtc: null, history: [],
  parentOrderId: null, groupId: 'o1', addenda: [], invoiceId: null, groupTotals: { totalSeats: 12, registered: 4, listTotalCzk: 6000, discountCzk: 0, totalCzk: 6000 }, ...over,
});

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'i1', patientId: '', patientName: '', invoiceNumber: '2026-001', status: 'Issued', totalCzk: 10000, paidCzk: 4000, remainingCzk: 6000,
  currency: 'CZK', issueDateUtc: '2026-10-01T10:00:00Z', dueDateUtc: '2999-10-15T10:00:00Z', items: [], clubId: 'c1', clubName: 'FK Slaný',
  recipientType: 'Team', recipientName: 'FK Slaný', ...over,
});

const stats: ClubOrderStats = {
  totals: {
    clubId: '', totalSeats: 70, registered: 38, remaining: 32, byService: [], byActivity: [],
    ordersByStatus: { Invited: 1, Requested: 2, Confirmed: 3, Completed: 1, Cancelled: 4 }, bookedMinutes: 600, usedMinutes: 450,
  },
  byClub: [
    { clubId: 'c1', clubName: 'FK Slaný', totalSeats: 70, registered: 38, remaining: 32, byService: [], byActivity: [], ordersByStatus: { Invited: 0, Requested: 0, Confirmed: 2, Completed: 0, Cancelled: 0 }, bookedMinutes: 600, usedMinutes: 450 },
    { clubId: 'c2', clubName: 'SK Kladno', totalSeats: 0, registered: 0, remaining: 0, byService: [], byActivity: [], ordersByStatus: { Invited: 1, Requested: 0, Confirmed: 0, Completed: 0, Cancelled: 0 }, bookedMinutes: 0, usedMinutes: 0 },
  ],
  byService: [{ serviceId: 's1', serviceName: 'Prohlídky', seats: 70, registered: 38 }],
  byActivity: [
    { activityId: 'a1', activityName: 'Základní prohlídka', serviceName: 'Prohlídky', seats: 10, registered: 4, remaining: 6 },
    { activityId: 'a2', activityName: 'Diagnostika', serviceName: 'Prohlídky', seats: 60, registered: 34, remaining: 26 },
  ],
};

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}
const mount = (ui: ReactNode) => render(<Wrap>{ui}</Wrap>);

/** Text outside the filter <option>s, which repeat club and činnost names. */
const shown = (text: string) => screen.queryAllByText(text).filter((e) => e.tagName !== 'OPTION');

const layoutOf = (name: keyof typeof VIEWPORTS) => ({ phone: 'cards', tablet: 'table-3', desktop: 'table' })[name];

beforeEach(() => {
  vi.clearAllMocks();
  setViewport(VIEWPORTS.desktop);
  blocksList.mockResolvedValue(blocks);
  ordersList.mockResolvedValue([order({})]);
  ordersStats.mockResolvedValue(stats);
  invoiceDraft.mockResolvedValue({ clubId: 'c1', groupId: 'o1', paymentMethod: 'ClubInvoice', headcount: 12, lines: [{ orderId: 'o1', serviceName: 'Prohlídky', activityName: 'VO2max', quantity: 12, unitPriceCzk: 500, totalCzk: 6000 }], discounts: [], listTotalCzk: 6000, totalCzk: 6000, note: '', invoiceId: null, supplementary: false, alreadyInvoiced: [] });
  calendarsList.mockResolvedValue([{ id: 'cal1', name: 'Ambulance 1' }]);
  getInvoices.mockResolvedValue([invoice({}), invoice({ id: 'i2', invoiceNumber: '2026-002', recipientType: 'Person', clubId: null, clubName: null, patientName: 'Pacient' })]);
});

describe.each(['phone', 'tablet', 'desktop'] as const)('layouts at %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('Rezervace draws its list in the width\'s own layout', async () => {
    const { container } = mount(<ReservationsPage />);
    await screen.findByText('Rezervace klubů');
    await waitFor(() => expect(container.querySelector(`[data-layout="${layoutOf(name)}"]`)).not.toBeNull());
    expect(shown('FK Slaný').length).toBeGreaterThan(0);
  });

  it('Hráči draws its list in the width\'s own layout', async () => {
    const { container } = mount(<PlayersPage />);
    await screen.findByText('Jan Novák');
    expect(container.querySelector(`[data-layout="${layoutOf(name)}"]`)).not.toBeNull();
  });

  it('Statistiky shows the six KPI cards and the per-club list', async () => {
    const { container } = mount(<StatsPage />);
    const kpis = await screen.findByTestId('club-kpis');
    expect(within(kpis).getAllByText(/Kluby|Objednávky|Hráči celkem|Zapsáno|Ještě chybí|Obsazená kapacita/)).toHaveLength(6);
    expect(container.querySelector(`[data-layout="${layoutOf(name)}"]`)).not.toBeNull();
  });

  it('Fakturace lists the Tým invoices only', async () => {
    mount(<BillingPage />);
    expect(await screen.findAllByText(/2026-001/)).not.toHaveLength(0);
    expect(screen.queryByText(/2026-002/)).toBeNull();
  });
});

describe('Rezervace', () => {
  it('filters by club and status, and links to the order and the calendar', async () => {
    const user = userEvent.setup();
    mount(<ReservationsPage />);
    await waitFor(() => expect(shown('SK Kladno').length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: /^Vše/ }));
    await user.selectOptions(screen.getByLabelText('Stav'), 'Cancelled');
    expect(shown('FK Slaný')).toHaveLength(0);
    await user.selectOptions(screen.getByLabelText('Stav'), '');
    await user.selectOptions(screen.getByLabelText('Klub'), 'c1');
    expect(shown('SK Kladno')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /^Objednávka KO-/ }));
    expect(navigate).toHaveBeenCalledWith('/clubs/objednavky', { state: { openOrderId: 'o1' } });
    await user.click(screen.getByRole('button', { name: 'Zobrazit v kalendáři' }));
    expect(navigate).toHaveBeenCalledWith('/planovani', { state: { date: day(0) } });
  });

  it.each(['phone', 'tablet', 'desktop'] as const)('shows the window\'s worth and the order\'s total on every row at %s; "bez ceny" without an order (Etapa 12)', async (name) => {
    setViewport(VIEWPORTS[name]);
    ordersList.mockResolvedValue([order({ activitySeats: [{ activityId: 'a1', activityName: 'Diagnostika', durationMinutes: 30, seats: 12, registered: 4, unitPriceCzk: 500 }], priceQuote: { listTotalCzk: 6000, discounts: [], totalCzk: 5400 } })]);
    blocksList.mockResolvedValue([
      { ...blocks[0], activitySeats: [{ activityId: 'a1', activityName: 'Diagnostika', seats: 10, registered: 4 }] },
      blocks[1],
    ]);
    mount(<ReservationsPage />);
    await screen.findByText('Rezervace klubů');
    await waitFor(() => expect(shown('SK Kladno').length).toBeGreaterThan(0));
    const prices = screen.queryAllByTestId('reservation-price');
    /* tablet keeps its three columns (club, term, seats); the phone card and the desktop table carry the price */
    if (name === 'tablet') {
      expect(prices).toHaveLength(0);
      return;
    }
    expect(prices).toHaveLength(2);
    /* b1: the order's 5 400 Kč, under it the window's 10 seats × 500 Kč at the list price; b2 has no order */
    expect(prices[0]).toHaveTextContent(/objednávka 5\s400\sKč/);
    expect(prices[0]).toHaveTextContent(/okno 5\s000\sKč v ceníku/);
    expect(prices[1]).toHaveTextContent('bez ceny');
  });

  it('shows the empty state and the retry on an error', async () => {
    blocksList.mockResolvedValueOnce([]);
    const view = mount(<ReservationsPage />);
    expect(await screen.findByText('V tomto období nejsou žádné rezervace klubů.')).toBeInTheDocument();
    view.unmount();
    blocksList.mockRejectedValueOnce(new Error('boom'));
    mount(<ReservationsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Zkusit znovu' }));
    expect(blocksList).toHaveBeenCalledTimes(3);
  });
});

describe('Hráči', () => {
  it('lists athletes from blocks and orders once, with a tel: link', async () => {
    mount(<PlayersPage />);
    await screen.findByText('Jan Novák');
    expect(screen.getByText('Ondřej Dvořák')).toBeInTheDocument();
    expect(screen.getAllByText('Jan Novák')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '+420 777 111 222' })).toHaveAttribute('href', 'tel:+420777111222');
  });

  it('filters by club, činnost, status and name (diacritics-insensitive)', async () => {
    const user = userEvent.setup();
    mount(<PlayersPage />);
    await screen.findByText('Jan Novák');
    await user.selectOptions(screen.getByLabelText('Klub'), 'c2');
    expect(screen.queryByText('Jan Novák')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Klub'), '');
    await user.selectOptions(screen.getByLabelText('Činnost'), 'Diagnostika');
    expect(screen.queryByText('Petr Černý')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Činnost'), '');
    await user.selectOptions(screen.getByLabelText('Stav'), 'NoShow');
    expect(screen.getByText('Petr Černý')).toBeInTheDocument();
    expect(screen.queryByText('Jan Novák')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Stav'), '');
    await user.type(screen.getByLabelText('Hledat jméno'), 'dvorak');
    expect(screen.getByText('Ondřej Dvořák')).toBeInTheDocument();
    expect(screen.queryByText('Jan Novák')).toBeNull();
  });

  it('"Stáhnout seznam" exports the filtered list with the club column', async () => {
    const user = userEvent.setup();
    mount(<PlayersPage />);
    await screen.findByText('Jan Novák');
    await user.selectOptions(screen.getByLabelText('Klub'), 'c1');
    await user.click(screen.getByRole('button', { name: 'Stáhnout seznam' }));
    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, csv] = downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('hraci-klubu.csv');
    const lines = csv.replace('﻿', '').trimEnd().split('\r\n');
    expect(lines[0]).toBe('Jméno;Klub;Činnost;Začátek;Konec;Stav;Telefon;Cena;Cena upravena');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Jan Novák;FK Slaný;Diagnostika;26. 10. 2026 10:00;26. 10. 2026 10:30;Zaregistrován;+420 777 111 222;1200;Ano');
    expect(lines[2]).toContain('Petr Černý;FK Slaný;Základní prohlídka;26. 10. 2026 11:00;;Nedostavil se;;1600;');
  });

  it.each(['phone', 'tablet', 'desktop'] as const)('shows every player\'s price at %s - agreed "(upraveno)", list, or "bez ceny" (Etapa 12)', async (name) => {
    setViewport(VIEWPORTS[name]);
    mount(<PlayersPage />);
    await screen.findByText('Jan Novák');
    const prices = screen.getAllByTestId('player-price').map((p) => (p.textContent ?? '').replace(/ /g, ' '));
    expect(prices).toContain('1 200 Kč (upraveno)');
    expect(prices).toContain('1 600 Kč');
    expect(prices).toContain('bez ceny');
    expect(prices).toHaveLength(3);
  });

  it('shows the empty state', async () => {
    blocksList.mockResolvedValue([]);
    ordersList.mockResolvedValue([]);
    mount(<PlayersPage />);
    expect(await screen.findByText('Zatím se nikdo přes odkazy klubů nezaregistroval.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stáhnout seznam' })).toBeDisabled();
  });
});

describe('Statistiky', () => {
  it('KPI math from the stats answer', () => {
    expect(statsKpis(stats)).toEqual({ clubs: 2, orders: 7, players: 70, registered: 38, remaining: 32, occupancy: 75 });
  });

  it('KPI math tolerates an empty answer', () => {
    expect(statsKpis({ totals: {} as never, byClub: [], byService: [], byActivity: [] })).toEqual({ clubs: 0, orders: 0, players: 0, registered: 0, remaining: 0, occupancy: null });
  });

  it('renders the figures and exports a CSV', async () => {
    const user = userEvent.setup();
    mount(<StatsPage />);
    const kpis = await screen.findByTestId('club-kpis');
    expect(within(kpis).getByText('70')).toBeInTheDocument();
    expect(within(kpis).getByText('38')).toBeInTheDocument();
    expect(within(kpis).getByText('32')).toBeInTheDocument();
    expect(within(kpis).getByText('75 %')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Export CSV' })[0]);
    const csv = downloadCsv.mock.calls[0][1] as string;
    expect(csv).toContain('FK Slaný;70;38;32;75;6000');
    expect(csv).toContain('Diagnostika;Prohlídky;60;34;26');
  });

  it.each(['phone', 'tablet', 'desktop'] as const)('puts the live orders\' money next to the counts at %s (Etapa 12)', async (name) => {
    setViewport(VIEWPORTS[name]);
    ordersList.mockResolvedValue([order({}), order({ id: 'o2', status: 'Cancelled', priceQuote: { listTotalCzk: 9000, discounts: [], totalCzk: 9000 } })]);
    mount(<StatsPage />);
    await screen.findByTestId('club-kpis');
    /* the cancelled order does not count; the Confirmed one's 6 000 Kč does */
    await waitFor(() => expect(screen.getByTestId('revenue-total')).toHaveTextContent(/6\s000\sKč/));
    /* the per-club money is on the phone card and in the tablet's three columns and the desktop table alike */
    const rows = screen.getAllByTestId('club-revenue').map((r) => r.textContent ?? '');
    expect(rows.some((t) => /6\s000\sKč/.test(t))).toBe(true);
    /* SK Kladno has no priced live order */
    expect(rows.some((t) => t.includes('bez ceny'))).toBe(true);
  });

  it('keeps the counts and says "—" for the money when the orders list fails', async () => {
    ordersList.mockRejectedValue(new Error('boom'));
    mount(<StatsPage />);
    await screen.findByTestId('club-kpis');
    await waitFor(() => expect(screen.getByTestId('revenue-total')).toHaveTextContent('—'));
    expect(within(screen.getByTestId('club-kpis')).getByText('70')).toBeInTheDocument();
  });

  it('asks the server for the chosen range', async () => {
    const user = userEvent.setup();
    mount(<StatsPage />);
    await screen.findByTestId('club-kpis');
    expect(ordersStats).toHaveBeenLastCalledWith({});
    await user.click(screen.getByRole('button', { name: 'Tento měsíc' }));
    await waitFor(() => expect(ordersStats).toHaveBeenLastCalledWith({ from: expect.stringMatching(/^\d{4}-\d{2}-01$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });

  it('shows the empty state and the error state with a retry', async () => {
    ordersStats.mockResolvedValueOnce({ totals: {}, byClub: [], byService: [], byActivity: [] });
    const view = mount(<StatsPage />);
    expect(await screen.findByText('V tomto období nejsou žádná data klubů.')).toBeInTheDocument();
    view.unmount();
    ordersStats.mockRejectedValueOnce(new Error('boom'));
    mount(<StatsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByTestId('club-kpis')).toBeInTheDocument();
  });
});

describe('Fakturace', () => {
  it('computes per-club totals', async () => {
    mount(<BillingPage />);
    const row = (await screen.findByRole('table', { name: 'Součty podle klubu' })).querySelector('tbody tr') as HTMLElement;
    expect(within(row).getByText('FK Slaný')).toBeInTheDocument();
    expect(row.textContent).toMatch(/10\s000\sKč/);
    expect(row.textContent).toMatch(/4\s000\sKč/);
    expect(row.textContent).toMatch(/6\s000\sKč/);
  });

  it('offers "Vystavit fakturu" for a confirmed ClubInvoice order without an invoice and opens the one-invoice dialog', async () => {
    const user = userEvent.setup();
    ordersList.mockResolvedValue([order({}), order({ id: 'o2', paymentMethod: 'PerPerson' }), order({ id: 'o3', status: 'Requested' })]);
    mount(<BillingPage />);
    const buttons = await screen.findAllByRole('button', { name: 'Vystavit fakturu' });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);
    expect(await screen.findByRole('dialog', { name: 'Jedna faktura klubu' })).toBeInTheDocument();
    expect(invoiceDraft).toHaveBeenCalledWith('o1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('hides the action once an invoice carries the order id, and opens an invoice in /billing', async () => {
    const user = userEvent.setup();
    getInvoices.mockResolvedValue([{ ...invoice({}), clubOrderId: 'o1' }]);
    ordersList.mockResolvedValue([order({})]);
    mount(<BillingPage />);
    await screen.findAllByText('2026-001');
    expect(screen.queryByRole('button', { name: 'Vystavit fakturu' })).toBeNull();
    await user.click(screen.getAllByText('2026-001')[0]);
    expect(navigate).toHaveBeenCalledWith('/billing', { state: { invoiceId: 'i1' } });
  });

  it('shows the empty state and the error state', async () => {
    getInvoices.mockResolvedValueOnce([]);
    const view = mount(<BillingPage />);
    expect(await screen.findByText('Zatím žádné faktury klubům.')).toBeInTheDocument();
    view.unmount();
    getInvoices.mockRejectedValueOnce(new Error('boom'));
    mount(<BillingPage />);
    expect(await screen.findByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });
});
