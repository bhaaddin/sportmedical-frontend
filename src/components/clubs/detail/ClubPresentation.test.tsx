import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import type { ClubBlockView } from '../../../api/clubBlocks';
import type { Club } from '../../../api/clubs';

const summaryMock = vi.fn();
const listMock = vi.fn();

vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { get: vi.fn(), update: vi.fn(), cancel: vi.fn(), calculate: vi.fn().mockResolvedValue({}), create: vi.fn(), list: vi.fn() },
    fetchBlockableActivities: vi.fn().mockResolvedValue([]),
  };
});
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, clubSummary: summaryMock, list: listMock } };
});
vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubSettingsApi: { get: vi.fn().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null }), put: vi.fn() } };
});
vi.mock('../../../api/partnerOrders', () => ({ partnerOrdersApi: { list: vi.fn(), setItems: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({ appointmentsApi: { range: vi.fn().mockResolvedValue([]) } }));

const { ClubPresentation } = await import('./ClubPresentation');
const { buildClubRow } = await import('../../../pages/clubs/clubRow');
const { toOrder } = await import('../../../api/clubOrders');

const club = {
  id: 'club-1', name: 'Dukla Jižní Město', ico: '12345678', dic: 'CZ12345678', city: 'Praha', address: 'Sportovní 1', postalCode: '14900',
  contactPerson: 'Karel Trenér', contactEmail: 'k@dukla.cz', contactPhone: '+420777111222', paymentTermsDays: 14, discountPercent: 10, colorHex: '#2E7D6B', isActive: true,
} as unknown as Club;

const block: ClubBlockView = {
  id: 'b-1', clubId: 'club-1', clubName: 'Dukla Jižní Město', colorHex: '#2E7D6B', name: null, calendarIds: [], activityIds: ['a-1'],
  fromDate: '2099-10-26', toDate: '2099-11-03', dailyFrom: null, dailyTo: null, playerCount: 10, seats: 10, registered: 3,
  status: 'Active', registrationToken: 'tok1', registrationUrl: 'https://app.test/klub/tok1', note: null, createdAtUtc: null, athletes: [],
};

const summary = {
  clubId: 'club-1', totalSeats: 40, registered: 15, remaining: 25,
  byService: [{ serviceId: 's1', serviceName: 'Prohlídka', seats: 40, registered: 15 }],
  byActivity: [{ activityId: 'a1', activityName: 'Základní', serviceName: 'Prohlídka', seats: 40, registered: 15, remaining: 25 }],
  ordersByStatus: { Invited: 0, Requested: 1, Confirmed: 2, Completed: 0, Cancelled: 0 }, bookedMinutes: 600, usedMinutes: 200,
};

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

const handlers = { onBack: vi.fn(), onEdit: vi.fn(), onDeactivate: vi.fn(), onNewOrder: vi.fn(), onOpenOrder: vi.fn() };

function open(blocks: ClubBlockView[] = [block], c: Club = club) {
  return render(
    <Wrap>
      <ClubPresentation
        row={buildClubRow(c, [], blocks, '2099-10-01')} priceOf={() => null} pricesReady focusBlockId={null} today="2099-10-01"
        onReload={vi.fn()} onInvoice={vi.fn()} onNewReservation={vi.fn()} {...handlers}
      />
    </Wrap>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  summaryMock.mockResolvedValue(summary);
  listMock.mockResolvedValue([
    toOrder({ id: 'o1', clubId: 'club-1', serviceName: 'Prohlídka', totalSeats: 20, status: 'Confirmed', requestedRanges: [], blocks: [], activitySeats: [] }),
  ]);
});

describe.each([
  ['phone', 1],
  ['tablet', 1],
  ['desktop', 2],
] as const)('ClubPresentation at %s', (name, columns) => {
  it('shows the hero, the figures and the stacked cards', async () => {
    setViewport(VIEWPORTS[name]);
    open();
    expect(screen.getByRole('heading', { level: 1, name: 'Dukla Jižní Město' })).toBeInTheDocument();
    expect(screen.getByTestId('club-hero-accent')).toBeInTheDocument();
    expect(screen.getByText('Praha')).toBeInTheDocument();
    expect(screen.getByText('Aktivní')).toBeInTheDocument();
    expect(screen.getByTestId('club-detail')).toHaveAttribute('data-columns', String(columns));
    await waitFor(() => expect(screen.getByTestId('club-figures')).toHaveTextContent('40'));
    expect(screen.getByTestId('club-figures')).toHaveTextContent('Potvrzeno: 2');
    expect(screen.getByRole('region', { name: 'Kontakt a fakturační údaje' })).toHaveTextContent('CZ12345678');
    expect(screen.getByRole('region', { name: 'Nadcházející okna v kalendáři' })).toBeInTheDocument();
    expect(await screen.findByTestId('club-order-link')).toBeInTheDocument();
    expect(await screen.findAllByTestId('breakdown-row')).toHaveLength(2);
    /* The block has no order: it is a legacy reservation and keeps its own panel under its own heading. */
    expect(screen.getByRole('region', { name: 'Starší rezervace (bez objednávky)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deaktivovat klub/ })).toBeInTheDocument();
  });

  it('is capped, not fixed: no pixel width in inline styles', () => {
    setViewport(VIEWPORTS[name]);
    open();
    const root = screen.getByTestId('club-detail');
    expect(root.getAttribute('style') ?? '').not.toMatch(/(^|[^-])width:\s*\d+px/);
  });
});

describe('ClubPresentation behaviour', () => {
  it('keeps every action reachable', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    open();
    const actions = screen.getByTestId('club-actions');
    await user.click(within(actions).getByRole('button', { name: 'Nová objednávka klubu' }));
    await user.click(within(actions).getByRole('button', { name: 'Upravit klub' }));
    await user.click(within(actions).getByRole('button', { name: /Deaktivovat klub/ }));
    await user.click(screen.getByRole('button', { name: 'Zpět na kluby' }));
    expect(handlers.onNewOrder).toHaveBeenCalled();
    expect(handlers.onEdit).toHaveBeenCalled();
    expect(handlers.onDeactivate).toHaveBeenCalled();
    expect(handlers.onBack).toHaveBeenCalled();
    await user.click(await screen.findByTestId('club-order-link'));
    expect(handlers.onOpenOrder).toHaveBeenCalledWith('o1');
  });

  it('says so when the club has no orders, no windows and no breakdown', async () => {
    setViewport(VIEWPORTS.desktop);
    listMock.mockResolvedValue([]);
    summaryMock.mockResolvedValue({ ...summary, totalSeats: 0, registered: 0, remaining: 0, byService: [], byActivity: [] });
    open([]);
    expect(await screen.findByText('Zatím žádná objednávka')).toBeInTheDocument();
    expect(screen.getByText('Klub nemá žádné nadcházející okno.')).toBeInTheDocument();
    expect(await screen.findByTestId('club-breakdown-empty')).toBeInTheDocument();
  });

  it('shows an error with retry per card when the calls fail, and hides Deaktivovat for an inactive club', async () => {
    setViewport(VIEWPORTS.phone);
    summaryMock.mockRejectedValue(new Error('500'));
    listMock.mockRejectedValue(new Error('500'));
    open([block], { ...club, isActive: false });
    expect(await screen.findByText('Souhrn klubu se nepodařilo načíst.')).toBeInTheDocument();
    expect(await screen.findByText('Objednávky klubu se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByText('Neaktivní')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deaktivovat klub/ })).toBeNull();
  });

  it('shows loading placeholders first', () => {
    setViewport(VIEWPORTS.tablet);
    summaryMock.mockReturnValue(new Promise(() => undefined));
    open();
    expect(screen.getByTestId('figures-loading')).toBeInTheDocument();
  });
});

/* ── Etapa 10: one order = one card ── */

const ORDER_ID = 'o1-1111-2222-3333-444455556666';
const win = (id: string, from: string, to: string, over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  ...block, id, clubOrderId: ORDER_ID, fromDate: from, toDate: to, dailyFrom: '08:00', dailyTo: '12:00', calendarIds: ['cal-1'], ...over,
});
const orderBlocks = [win('w1', '2099-10-26', '2099-10-27'), win('w2', '2099-10-29', '2099-10-29'), win('w3', '2099-11-10', '2099-11-10')];
const fullOrder = toOrder({
  id: ORDER_ID, clubId: 'club-1', clubName: 'Dukla Jižní Město', serviceId: 's1', serviceName: 'Prohlídka', status: 'Confirmed',
  paymentMethod: 'ClubInvoice', totalSeats: 22, registered: 7, requestedRanges: [], parentOrderId: null, addenda: [], note: '', createdAtUtc: '2099-10-01T10:00:00Z',
  priceQuote: { listTotalCzk: 4000, discounts: [], totalCzk: 3600 },
  activitySeats: [
    { activityId: 'a1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 12, registered: 4, unitPriceCzk: 200 },
    { activityId: 'a2', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 10, registered: 3, unitPriceCzk: 400 },
  ],
  blocks: orderBlocks,
});

describe.each([['phone'], ['tablet'], ['desktop']] as const)('one order, one card at %s', (name) => {
  beforeEach(() => {
    listMock.mockResolvedValue([fullOrder]);
  });

  it('shows the order once with all its windows and no block panels for them; the legacy block keeps its panel', async () => {
    setViewport(VIEWPORTS[name]);
    const legacy = { ...block, id: 'legacy-1', clubOrderId: null };
    open([...orderBlocks, legacy]);

    const cards = await screen.findAllByTestId('club-order-card');
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card).toHaveTextContent('Objednávka KO-55556666');
    expect(card).toHaveTextContent('Potvrzeno');
    expect(card).toHaveTextContent('Základní prohlídka 4/12 · Komplexní prohlídka 3/10 (22 hráčů)');
    expect(card).toHaveTextContent('3 600');
    expect(within(card).getAllByTestId('order-window')).toHaveLength(3);
    expect(within(card).getByText('Termíny (3 termíny)')).toBeInTheDocument();
    /* ONE button row for the whole order. */
    for (const label of ['Přidat hráče / rozšířit', 'Odebrat hráče', 'Upravit termíny', 'Zrušit objednávku', 'Otevřít']) {
      expect(within(card).getByRole('button', { name: label })).toBeInTheDocument();
    }

    /* Only the legacy block (no order) has a block panel; the order's three windows have none. */
    const legacyRegion = screen.getByRole('region', { name: 'Starší rezervace (bez objednávky)' });
    expect(within(legacyRegion).getAllByRole('button', { name: 'Zrušit blok' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Zrušit blok' })).toHaveLength(1);
  });

  it('lists the upcoming windows once per order, with its dates, not once per window', async () => {
    setViewport(VIEWPORTS[name]);
    open([...orderBlocks, { ...block, id: 'legacy-1', clubOrderId: null }]);
    const rows = await screen.findAllByTestId('club-window');
    /* one row for the order, one for the legacy block */
    expect(rows).toHaveLength(2);
    const orderRow = rows.find((r) => r.getAttribute('data-order-id') === ORDER_ID) as HTMLElement;
    expect(orderRow).toHaveTextContent('26.–27. 10. · 08:00–12:00');
    expect(orderRow).toHaveTextContent('Čt 29. 10. · 08:00–12:00');
    expect(orderRow).toHaveTextContent('Út 10. 11. · 08:00–12:00');
    await waitFor(() => expect(orderRow).toHaveTextContent('7 / 22'));
  });

  it('has no legacy heading when every window belongs to an order', async () => {
    setViewport(VIEWPORTS[name]);
    open(orderBlocks);
    await screen.findByTestId('club-order-card');
    expect(screen.queryByRole('region', { name: 'Starší rezervace (bez objednávky)' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zrušit blok' })).toBeNull();
  });

  it('opens the order from its card', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    open(orderBlocks);
    const card = await screen.findByTestId('club-order-card');
    await user.click(within(card).getByRole('button', { name: 'Otevřít' }));
    expect(handlers.onOpenOrder).toHaveBeenCalledWith(ORDER_ID);
  });

  it('opens "Přidat hráče / rozšířit" from the card', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    open(orderBlocks);
    const card = await screen.findByTestId('club-order-card');
    await user.click(within(card).getByRole('button', { name: 'Přidat hráče / rozšířit' }));
    expect(await screen.findByTestId('change-players-dialog')).toBeInTheDocument();
  });

  it('asks before cancelling the whole order from the card', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    open(orderBlocks);
    const card = await screen.findByTestId('club-order-card');
    await user.click(within(card).getByRole('button', { name: 'Zrušit objednávku' }));
    expect(await screen.findByRole('dialog', { name: 'Zrušit objednávku?' })).toBeInTheDocument();
  });
});

describe('cancelled orders', () => {
  it('stay a compact row, not a card with buttons', async () => {
    setViewport(VIEWPORTS.desktop);
    listMock.mockResolvedValue([fullOrder, toOrder({ ...fullOrder, id: 'o2-aaaa-bbbb-cccc-ddddeeeeffff', status: 'Cancelled', blocks: [] })]);
    open(orderBlocks);
    await screen.findByTestId('club-order-card');
    expect(await screen.findAllByTestId('club-order-card')).toHaveLength(1);
    expect(screen.getAllByTestId('club-order-cancelled')).toHaveLength(1);
  });
});

/* ── Vedení klubu (Etapa 12): read-only near the contact block, hidden when nobody is listed ── */
describe.each(['phone', 'tablet', 'desktop'] as const)('Vedení klubu at %s', (name) => {
  it('lists the people with role and contact, marks the ARES rows, and is absent when the list is empty', () => {
    setViewport(VIEWPORTS[name]);
    const withManagement = {
      ...club,
      management: [
        { id: 'm1', fullName: 'Jan Novák', role: 'předseda', phone: '+420 600 000 001', email: null, source: 'ares' as const },
        { id: 'm2', fullName: 'Petr Ruční', role: 'správce', phone: null, email: 'petr@dukla.cz', source: 'manual' as const },
      ],
    };
    const { unmount } = open([block], withManagement);
    const region = screen.getByRole('region', { name: 'Vedení klubu' });
    const rows = within(region).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Jan Novák');
    expect(rows[0]).toHaveTextContent('předseda');
    expect(rows[0]).toHaveTextContent('+420 600 000 001');
    expect(rows[0]).toHaveTextContent('z ARES');
    expect(rows[1]).toHaveTextContent('petr@dukla.cz');
    expect(rows[1]).not.toHaveTextContent('z ARES');
    unmount();

    open([block], { ...club, management: [] });
    expect(screen.queryByRole('region', { name: 'Vedení klubu' })).not.toBeInTheDocument();
    cleanup();

    /* An older server that sends nothing at all. */
    open([block], club);
    expect(screen.queryByRole('region', { name: 'Vedení klubu' })).not.toBeInTheDocument();
  });
});
