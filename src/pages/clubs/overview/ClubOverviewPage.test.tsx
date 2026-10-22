/*
 * A club's own PAGE (`/clubs/:clubId`, Stage 5a): every block with its loading / empty / error state, the links out of it
 * (the calendar, an order, its history, the players), the warm-up on the Kalendář button, the permission-less invoices,
 * and the deep links (the page and the calendar are two different routes; the order history is neither).
 * A source that cannot be read is said - a dash and the reason - never drawn as zero.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder, type ClubOrderView } from '../../../api/clubOrders';
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { Club } from '../../../api/clubs';

const { getById, listOrders, getOrder, clubSummary, listBlocks, getInvoices, prefetchClubScreen } = vi.hoisted(() => ({
  getById: vi.fn(), listOrders: vi.fn(), getOrder: vi.fn(), clubSummary: vi.fn(), listBlocks: vi.fn(), getInvoices: vi.fn(), prefetchClubScreen: vi.fn(),
}));

vi.mock('../../../api/clubs', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/clubs')>()), clubsApi: { getById } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list: listOrders, get: getOrder, clubSummary } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../api/clubBlocks')>()), clubBlocksApi: { list: listBlocks } }));
vi.mock('../../../api/billing', () => ({ billingApi: { getInvoices } }));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}), readPublicClinic: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../api/warmReads', () => ({ prefetchClubScreen }));
vi.mock('../PayerDialog', () => ({ PayerDialog: (p: { editing: { id: string }; onClose: () => void }) => <div role="dialog" aria-label="Upravit klub" data-club={p.editing.id}><button type="button" onClick={p.onClose}>zavřít</button></div> }));
vi.mock('../../../components/clubs/order/ClubOrderEntry', () => ({
  ClubOrderEntry: (p: { defaultClubId?: string; onPhone: () => void }) => <div role="dialog" aria-label="Nová klubová objednávka" data-club={p.defaultClubId}><button type="button" onClick={p.onPhone}>Vyplním sám</button></div>,
}));

const { default: ClubOverviewPage } = await import('./ClubOverviewPage');

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const inDays = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const A = '80e74a6c-0000-4000-8000-00000000000a';
const B = '80e74a6c-0000-4000-8000-00000000000b';

const CLUB: Club = {
  id: 'club-1', name: 'FK Slaný', ico: '25596641', address: 'Sportovní 1', city: 'Slaný', postalCode: '27401', contactPerson: 'Jan Trenér',
  contactPhone: '+420 603 221 004', contactEmail: 'klub@fkslany.cz', bankAccount: '123456789', bankCode: '0800', paymentTermsDays: 14,
  discountPercent: null, colorHex: '#2a7fff', isActive: true, createdAt: '2026-01-01T00:00:00Z',
};

const order = (id: string, over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id, groupId: id, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Sportovní prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 20, registered: 7, unitPriceCzk: 200 }],
    totalSeats: 20, registered: 7, priceQuote: { listTotalCzk: 4000, discounts: [], totalCzk: 3600 }, requestedRanges: [], note: '', contact: null,
    createdBy: 'Staff', createdAtUtc: '2026-10-01T08:00:00Z', addenda: [], blocks: [],
    history: [{ atUtc: '2026-10-02T09:00:00Z', user: 'Jana', text: 'Objednávka potvrzena' }],
    portalUrl: '/klub-objednavka/tok-portal', formUrl: '/klub-objednavka/tok-form', registrationUrl: '/klub/tok-players', ...over,
  });

const win = (id: string, from: string): ClubBlockView => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['c1'], activityIds: [], fromDate: from, toDate: from, dailyFrom: '08:00', dailyTo: '12:00',
  playerCount: 0, seats: 20, registered: 7, status: 'Active', registrationToken: null, registrationUrl: null, note: null, createdAtUtc: null, athletes: [], clubOrderId: A,
}) as ClubBlockView;

const SUMMARY = {
  clubId: 'club-1', totalSeats: 20, registered: 7, remaining: 13, byService: [], byActivity: [],
  ordersByStatus: { Invited: 0, Requested: 0, Confirmed: 1, Completed: 0, Cancelled: 0 }, bookedMinutes: 0, usedMinutes: 0,
};

const INVOICES = [{ id: 'i1', status: 'Issued', totalCzk: 3600, paidCzk: 1000, remainingCzk: 2600, clubId: 'club-1' }];

function Where() {
  const l = useLocation();
  return <output data-testid="where" data-path={l.pathname} data-search={l.search}>{JSON.stringify(l.state)}</output>;
}

function mount(path = '/clubs/club-1', client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/clubs/:clubId" element={<ClubOverviewPage />} />
          <Route path="/clubs/:clubId/kalendar" element={<div data-testid="planner-stub" />} />
          <Route path="*" element={<div data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId('where');
const shelf = (id: string) => document.querySelector(`[data-shelf="${id}"]`) as HTMLElement;

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['billing.manage']));
  getById.mockReset().mockResolvedValue(CLUB);
  /* the list answers carry NO history (measured on the dev API); an order's own answer does */
  listOrders.mockReset().mockResolvedValue([order(A, { history: [] })]);
  getOrder.mockReset().mockImplementation(async (id: string) => order(id, { history: [{ atUtc: '2026-10-02T09:00:00Z', user: 'Jana', text: 'Objednávka potvrzena' }] }));
  clubSummary.mockReset().mockResolvedValue(SUMMARY);
  listBlocks.mockReset().mockResolvedValue([win('w1', inDays(5)), win('w2', inDays(9)), win('w3', inDays(12)), win('w4', inDays(30)), win('past', '2020-01-01')]);
  getInvoices.mockReset().mockResolvedValue(INVOICES);
  prefetchClubScreen.mockReset();
  setViewport(VIEWPORTS.desktop);
});

describe('the club page, ready', () => {
  it('shows the club in its header: name, who to call, status, and the one prominent Kalendář button', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'FK Slaný' })).toBeInTheDocument();
    expect(screen.getByText('Jan Trenér · +420 603 221 004 · klub@fkslany.cz')).toBeInTheDocument();
    expect(screen.getByTestId('club-status')).toHaveTextContent('Aktivní');
    expect(screen.getByTestId('club-avatar')).toHaveAttribute('data-color', '#2a7fff');
    const calendar = screen.getByRole('link', { name: 'Kalendář' });
    expect(calendar).toHaveAttribute('href', '/clubs/club-1/kalendar');
    expect(screen.getByTestId('club-new-order')).toBeInTheDocument();
    expect(screen.getByTestId('club-edit')).toHaveTextContent('Upravit údaje');
  });

  it('is an ordinary page: it is not the planner (no stage, no deck)', async () => {
    mount();
    await screen.findByRole('heading', { name: 'FK Slaný' });
    expect(document.querySelector('.sm-planner')).toBeNull();
    expect(screen.queryByTestId('club-overview-deck')).toBeNull();
    expect(screen.queryByTestId('planner-stub')).toBeNull();
  });

  it('the statistics shelf: exactly six figures with the numbers of the data', async () => {
    mount();
    const stats = await waitFor(() => {
      const el = shelf('club-stats');
      expect(within(el).getAllByText(/Hráči|Termíny|Objednávky|Objednáno|Fakturováno|Zaplaceno/).length).toBeGreaterThan(0);
      return el;
    });
    await waitFor(() => expect(within(stats).getAllByRole('listitem')).toHaveLength(6));
    const cards = within(stats).getAllByRole('listitem');
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining('7 / 20'),
      expect.stringContaining('4 / 5'),
      expect.stringContaining('1'),
      expect.stringMatching(/3\s600\sKč/u),
      expect.stringMatching(/3\s600\sKč/u),
      expect.stringMatching(/1\s000\sKč/u),
    ]);
    expect(within(stats).getByRole('link', { name: /^Hráči: 7 \/ 20/ })).toHaveAttribute('href', '/clubs/hraci?clubId=club-1');
  });

  it('the orders shelf: a card per order with status, code, players and price; it opens the order panel of the orders page', async () => {
    mount();
    const orders = await waitFor(() => {
      const el = shelf('club-orders');
      expect(within(el).getAllByRole('listitem')).toHaveLength(1);
      return el;
    });
    const card = within(orders).getByRole('listitem');
    expect(card).toHaveTextContent('Potvrzeno');
    expect(card).toHaveTextContent('Hráči 7 / 20');
    expect(card).toHaveTextContent('Sportovní prohlídky');
    fireEvent.click(within(card).getByRole('link', { name: /Objednávka KO-0000000A/ }));
    await waitFor(() => expect(where().dataset.path).toBe('/clubs/objednavky'));
    expect(JSON.parse(where().textContent ?? 'null')).toEqual({ openOrderId: A });
  });

  it('the Historie button of an order goes to that order\'s history page', async () => {
    mount();
    const button = await screen.findByRole('button', { name: 'Historie objednávky KO-0000000A' });
    await userEvent.click(button);
    await waitFor(() => expect(where().dataset.path).toBe(`/clubs/objednavky/${A}/historie`));
  });

  it('all the orders: the shelf links to the orders page filtered to this club', async () => {
    mount();
    await screen.findByRole('heading', { name: 'FK Slaný' });
    const link = await within(shelf('club-orders')).findByRole('link', { name: /Všechny objednávky/ });
    expect(link).toHaveAttribute('href', '/clubs/objednavky?clubId=club-1');
  });

  it('the next three terms, soonest first, past ones left out', async () => {
    mount();
    const rows = await screen.findAllByTestId('club-next-term');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Objednávka KO-0000000A');
    expect(rows[0]).toHaveTextContent('7 / 20');
  });

  it("recent changes: read from the orders' own answers (the list carries none), with a link to the whole history", async () => {
    mount();
    const rows = await screen.findAllByTestId('club-change');
    expect(getOrder).toHaveBeenCalledWith(A);
    expect(rows[0]).toHaveTextContent('Objednávka potvrzena');
    expect(rows[0]).toHaveTextContent('Jana');
    const all = within(shelf('club-changes')).getByRole('link', { name: /Celá historie/ });
    expect(all).toHaveAttribute('href', `/clubs/objednavky/${A}/historie`);
  });

  it('recent changes: only the few orders touched last are read, not every order of the club', async () => {
    const many = Array.from({ length: 9 }, (_, i) => order(`80e74a6c-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`, { createdAtUtc: `2026-10-0${i + 1}T08:00:00Z`, history: [] }));
    listOrders.mockResolvedValue(many);
    mount();
    await screen.findAllByTestId('club-change');
    expect(getOrder).toHaveBeenCalledTimes(3);
    expect(getOrder.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([many[8].id, many[7].id, many[6].id]));
  });

  it('recent changes that cannot be read are an error with a retry - not "nothing changed" - and the rest of the page stays', async () => {
    getOrder.mockRejectedValue(new Error('500'));
    mount();
    const shelfEl = await waitFor(() => {
      const el = shelf('club-changes');
      expect(within(el).getByRole('alert')).toBeInTheDocument();
      return el;
    });
    expect(within(shelfEl).getByText('Historii objednávek se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.queryByText('Zatím se nic nezměnilo.')).toBeNull();
    expect(within(shelf('club-orders')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('a history that is only partly readable shows what it has and says so', async () => {
    listOrders.mockResolvedValue([order(A, { history: [] }), order(B, { history: [], createdAtUtc: '2026-09-01T08:00:00Z' })]);
    getOrder.mockImplementation(async (id: string) => {
      if (id === B) throw new Error('500');
      return order(id, { history: [{ atUtc: '2026-10-02T09:00:00Z', user: 'Jana', text: 'Objednávka potvrzena' }] });
    });
    mount();
    expect(await screen.findAllByTestId('club-change')).toHaveLength(1);
    expect(shelf('club-changes').textContent).toContain('Část historie se nepodařilo načíst.');
  });

  it('a club whose orders have no history yet says nothing changed (a real empty, the read worked)', async () => {
    getOrder.mockImplementation(async (id: string) => order(id, { history: [] }));
    mount();
    expect(await screen.findByText('Zatím se nic nezměnilo.')).toBeInTheDocument();
  });

  it('players: the count and "Zobrazit hráče" filtered to this club', async () => {
    mount();
    const body = await screen.findByTestId('club-players-body');
    expect(body).toHaveTextContent('7 z 20 míst je obsazeno');
    expect(within(shelf('club-players')).getByRole('link', { name: /Zobrazit hráče/ })).toHaveAttribute('href', '/clubs/hraci?clubId=club-1');
  });

  it('links: the club\'s portal link and the players\' link in full, each with a copy button beside it', async () => {
    mount();
    const portal = await screen.findByTestId('club-portal-url');
    expect(portal.dataset.url).toMatch(/^https?:\/\/[^/]+\/klub-objednavka\/tok-portal$/);
    expect(screen.getByTestId('players-url').dataset.url).toMatch(/^https?:\/\/[^/]+\/klub\/tok-players$/);
    expect(screen.getByTestId('club-portal-url-copy')).toBeInTheDocument();
    expect(screen.getByTestId('players-url-copy')).toBeInTheDocument();
  });

  it('a club with an invitation shows the form link and no players link yet', async () => {
    listOrders.mockResolvedValue([order(A, { status: 'Invited', registrationUrl: '' })]);
    mount();
    expect((await screen.findByTestId('club-portal-url')).dataset.url).toMatch(/\/klub-objednavka\/tok-portal$/);
    expect(screen.queryByTestId('players-url')).toBeNull();
  });
});

describe('the way into the calendar', () => {
  it('Kalendář opens the planner of this club', async () => {
    mount();
    await userEvent.click(await screen.findByRole('link', { name: 'Kalendář' }));
    expect(await screen.findByTestId('planner-stub')).toBeInTheDocument();
    expect(where().dataset.path).toBe('/clubs/club-1/kalendar');
  });

  it('resting the pointer on Kalendář warms the calendar - once, however often it is touched', async () => {
    mount();
    const button = await screen.findByRole('link', { name: 'Kalendář' });
    expect(prefetchClubScreen).not.toHaveBeenCalled();
    fireEvent.pointerEnter(button);
    await waitFor(() => expect(prefetchClubScreen).toHaveBeenCalledTimes(1));
    expect(prefetchClubScreen.mock.calls[0][1]).toBe('club-1');
    fireEvent.pointerEnter(button);
    fireEvent.focus(button);
    await new Promise((r) => setTimeout(r, 30));
    expect(prefetchClubScreen).toHaveBeenCalledTimes(1);
  });

  it('Nová objednávka opens the order entry for this club; "Vyplním sám" goes straight to the calendar with the setup form', async () => {
    mount();
    await userEvent.click(await screen.findByTestId('club-new-order'));
    const dialog = await screen.findByRole('dialog', { name: 'Nová klubová objednávka' });
    expect(dialog).toHaveAttribute('data-club', 'club-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Vyplním sám' }));
    await waitFor(() => expect(where().dataset.path).toBe('/clubs/club-1/kalendar'));
    expect(JSON.parse(where().textContent ?? 'null')).toEqual({ pickOrder: { clubId: 'club-1' } });
  });

  it('Upravit údaje opens the club\'s data as a pop-out', async () => {
    mount();
    await userEvent.click(await screen.findByTestId('club-edit'));
    expect(await screen.findByRole('dialog', { name: 'Upravit klub' })).toHaveAttribute('data-club', 'club-1');
  });
});

describe('billing data', () => {
  it('a club that cannot be invoiced is marked in the header, and the mark opens the data to fill in', async () => {
    getById.mockResolvedValue({ ...CLUB, bankAccount: null, iban: null });
    mount();
    const mark = await screen.findByTestId('club-billing-warning');
    expect(mark).toHaveTextContent('Chybí fakturační údaje');
    await userEvent.click(mark);
    expect(await screen.findByRole('dialog', { name: 'Upravit klub' })).toBeInTheDocument();
  });

  it('a club with complete data has no warning', async () => {
    mount();
    await screen.findByRole('heading', { name: 'FK Slaný' });
    expect(screen.queryByTestId('club-billing-warning')).toBeNull();
  });
});

describe('without the permission to bill', () => {
  it('the invoices are not even asked for, and the money cards say why they are blank', async () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    mount();
    const stats = await waitFor(() => {
      const el = shelf('club-stats');
      expect(within(el).getAllByRole('listitem')).toHaveLength(6);
      return el;
    });
    expect(getInvoices).not.toHaveBeenCalled();
    const text = stats.textContent ?? '';
    expect(text.match(/Bez oprávnění k fakturaci\./g)).toHaveLength(2);
    expect(within(stats).getByRole('link', { name: 'Fakturováno: bez údaje' })).toBeInTheDocument();
  });
});

describe('states: loading, empty, error - a failed source is never zero', () => {
  it('while the club is being read the page says so', () => {
    getById.mockReturnValue(new Promise(() => undefined));
    mount();
    expect(screen.getByTestId('club-page-loading')).toHaveAttribute('aria-busy', 'true');
  });

  it('a club that does not exist says so and leads back to the list', async () => {
    getById.mockRejectedValue(Object.assign(new Error('nope'), { response: { status: 404 } }));
    mount();
    expect(await screen.findByText('Tento klub neexistuje.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zpět na kluby' })).toHaveAttribute('href', '/clubs');
  });

  it('a club that cannot be read can be retried', async () => {
    getById.mockRejectedValueOnce(new Error('offline'));
    mount();
    expect(await screen.findByText('Klub se nepodařilo načíst.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
  });

  it('a club with nothing yet: every shelf says what is missing and the next action', async () => {
    listOrders.mockResolvedValue([]);
    listBlocks.mockResolvedValue([]);
    clubSummary.mockResolvedValue({ ...SUMMARY, totalSeats: 0, registered: 0, remaining: 0 });
    getInvoices.mockResolvedValue([]);
    mount();
    expect(await screen.findByText('Klub zatím nemá žádnou objednávku.')).toBeInTheDocument();
    expect(await screen.findByText('Klub nemá žádný nadcházející termín.')).toBeInTheDocument();
    expect(screen.getByText('Zatím se nic nezměnilo.')).toBeInTheDocument();
    expect(screen.getByText('Odkazy vzniknou s první objednávkou klubu.')).toBeInTheDocument();
    expect(screen.getByTestId('club-players-body')).toHaveTextContent('Klub zatím nemá žádná místa.');
    /* the empty orders shelf offers the order, and it opens the entry */
    await userEvent.click(within(shelf('club-orders')).getByRole('button', { name: 'Nová objednávka' }));
    expect(await screen.findByRole('dialog', { name: 'Nová klubová objednávka' })).toBeInTheDocument();
  });

  it('orders that cannot be read: an error with a retry, and the figures are dashes, not zeros', async () => {
    listOrders.mockRejectedValue(new Error('500'));
    mount();
    const orders = await waitFor(() => {
      const el = shelf('club-orders');
      expect(within(el).getByRole('alert')).toBeInTheDocument();
      return el;
    });
    expect(within(orders).getByText('Objednávky klubu se nepodařilo načíst.')).toBeInTheDocument();
    expect(within(orders).getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
    const stats = shelf('club-stats');
    expect(within(stats).getByRole('link', { name: 'Objednávky: bez údaje' })).toBeInTheDocument();
    expect(within(stats).getByRole('link', { name: 'Objednáno: bez údaje' })).toBeInTheDocument();
    expect(within(shelf('club-changes')).getByRole('alert')).toBeInTheDocument();
    expect(within(shelf('club-links')).getByRole('alert')).toBeInTheDocument();
  });

  it('the summary that cannot be read: the players shelf is an error, the players figure a dash', async () => {
    clubSummary.mockRejectedValue(new Error('500'));
    mount();
    const players = await waitFor(() => {
      const el = shelf('club-players');
      expect(within(el).getByRole('alert')).toBeInTheDocument();
      return el;
    });
    expect(within(players).getByText('Hráče klubu se nepodařilo načíst.')).toBeInTheDocument();
    expect(within(shelf('club-stats')).getByRole('link', { name: 'Hráči: bez údaje' })).toBeInTheDocument();
  });

  it('invoices that cannot be read: dashes with the reason, the rest of the page unharmed', async () => {
    getInvoices.mockRejectedValue(new Error('500'));
    mount();
    await waitFor(() => expect(within(shelf('club-stats')).getByRole('link', { name: 'Fakturováno: bez údaje' })).toBeInTheDocument());
    expect(shelf('club-stats').textContent).toContain('Nepodařilo se načíst.');
    expect(within(shelf('club-orders')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('everything failing at once is one error on the statistics with one retry that asks again', async () => {
    listOrders.mockRejectedValue(new Error('500'));
    clubSummary.mockRejectedValue(new Error('500'));
    listBlocks.mockRejectedValue(new Error('500'));
    mount();
    const stats = await waitFor(() => {
      const el = shelf('club-stats');
      expect(within(el).getByRole('alert')).toHaveTextContent('Statistiky klubu se nepodařilo načíst.');
      return el;
    });
    const before = listOrders.mock.calls.length;
    await userEvent.click(within(stats).getByRole('button', { name: 'Zkusit znovu' }));
    await waitFor(() => expect(listOrders.mock.calls.length).toBeGreaterThan(before));
  });
});

describe('three layouts', () => {
  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('%s: every shelf and the Kalendář button are there', async (_name, width) => {
    setViewport(width);
    mount();
    await screen.findByRole('heading', { name: 'FK Slaný' });
    for (const id of ['club-stats', 'club-orders', 'club-next-terms', 'club-changes', 'club-players', 'club-links']) expect(shelf(id)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Kalendář' })).toHaveLength(1);
  });

  it('the shelves are not in a pair on a phone and a tablet (one column), and are on a desktop', async () => {
    setViewport(VIEWPORTS.phone);
    const { unmount } = mount();
    await screen.findByRole('heading', { name: 'FK Slaný' });
    const columns = (): string[] => [...document.querySelectorAll('[data-shelf-pair]')].map((e) => getComputedStyle(e as HTMLElement).gridTemplateColumns);
    expect(columns().every((c) => !c.includes('repeat'))).toBe(true);
    unmount();
    setViewport(VIEWPORTS.desktop);
    mount();
    await screen.findByRole('heading', { name: 'FK Slaný' });
    expect(document.querySelectorAll('[data-shelf-pair]')).toHaveLength(2);
    expect(columns().every((c) => c.includes('repeat'))).toBe(true);
  });
});

describe('deep links', () => {
  it('/clubs/:clubId is the page (an old bookmark keeps working)', async () => {
    mount('/clubs/club-1');
    expect(await screen.findByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
    expect(screen.queryByTestId('planner-stub')).toBeNull();
  });

  it('/clubs/:clubId/kalendar is the calendar, not the page', async () => {
    mount('/clubs/club-1/kalendar');
    expect(await screen.findByTestId('planner-stub')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'FK Slaný' })).toBeNull();
  });

  it('the history of an order is neither', async () => {
    mount(`/clubs/objednavky/${B}/historie`);
    expect(await screen.findByTestId('elsewhere')).toBeInTheDocument();
    expect(getById).not.toHaveBeenCalled();
  });

  it('the application registers exactly these two club routes, the page lazily and as its own chunk', () => {
    const source = readFileSync('src/StaffApp.tsx', 'utf8');
    expect(source).toMatch(/<Route path="\/clubs\/:clubId" element=\{<ClubOverviewPage \/>\} \/>/);
    expect(source).toMatch(/<Route path="\/clubs\/:clubId\/kalendar" element=\{<ClubPlannerPage \/>\} \/>/);
    expect(source).toMatch(/const ClubOverviewPage = lazy\(\(\) => import\('\.\/pages\/clubs\/overview\/ClubOverviewPage'\)\)/);
    expect(TODAY_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
