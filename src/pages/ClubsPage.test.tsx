/*
 * Kluby a týmy, clicked through.
 *
 * `clubs/clubOrders.test.ts` holds the arithmetic. What only the screen can
 * show: that every club gets a card with its reservation state, its headcount
 * and the band that headcount lands in; that the filters narrow the grid; that
 * opening a card goes to the club's own screen (`/clubs/:clubId`, the planner in
 * club mode - tested in planner/club); the hand-offs other screens send land there.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { addDaysToDateOnly, pragueWallClockToInstant, toDateOnly } from '../utils/time';
import { setViewport, VIEWPORTS } from '../test/viewport';
import type { ClubBlockView } from '../api/clubBlocks';

const getAll = vi.fn();
const update = vi.fn();
const listOrders = vi.fn();
const range = vi.fn();
const listBlocks = vi.fn();
const getBlock = vi.fn();
const createBlock = vi.fn();
const createClub = vi.fn();
const fetchActivities = vi.fn();
const fetchSummaries = vi.fn();
const clubSummary = vi.fn();

vi.mock('../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clubs')>();
  return {
    ...actual,
    clubsApi: { getAll, create: createClub, update, deactivate: vi.fn() },
    clubSummariesApi: { fetch: fetchSummaries },
    clubSettingsApi: { get: vi.fn().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null }), put: vi.fn() },
  };
});
vi.mock('../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { list: listBlocks, get: getBlock, create: createBlock, update: vi.fn(), cancel: vi.fn(), calculate: vi.fn().mockResolvedValue({
      fitsHorizon: true, perDay: [],
      analysis: { totalSeats: 0, perActivity: [], totalNeededMinutes: 0, availableMinutes: 0, remainingMinutes: 0, fits: true, byRange: [], capacityNote: null },
    }) },
    fetchBlockableActivities: fetchActivities,
  };
});
vi.mock('../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, clubSummary, list: vi.fn().mockResolvedValue([]), get: vi.fn() } };
});
vi.mock('../api/calendars', () => ({
  calendarsApi: {
    list: vi.fn().mockResolvedValue([
      { id: 'c-1', name: 'Prohlídky', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: null },
      { id: 'c-off', name: 'Starý', color: '#000', location: '', displayStepMinutes: 15, isActive: false, sortOrder: 1, clinicServiceId: null },
    ]),
  },
}));
vi.mock('../api/partnerOrders', () => ({
  partnerOrdersApi: { list: listOrders, setItems: vi.fn() },
}));
vi.mock('../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [{ id: 'a-1', name: 'Komplexní prohlídka', durationMinutes: 15, isActive: true, priceCzk: 2200 }],
      warnings: [],
    }),
  },
}));
vi.mock('../api/appointments', () => ({ appointmentsApi: { range } }));

const { default: ClubsPage } = await import('./ClubsPage');

const today = toDateOnly(new Date());
const day1 = addDaysToDateOnly(today, 20);
const day2 = addDaysToDateOnly(today, 21);

const slany = {
  id: 'club-1', name: 'FK Slaný', ico: '25596641', address: 'Sportovní 1', city: 'Slaný', postalCode: '27401',
  contactPerson: 'Jan Trenér', contactPhone: '+420 603 221 004', contactEmail: 'klub@fkslany.cz',
  bankAccount: '123456', bankCode: '0100', iban: '', paymentTermsDays: 14, discountPercent: 10, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};
const kladno = {
  id: 'club-2', name: 'HC Kladno', ico: '00000019', contactPerson: 'Eva Vedoucí', contactPhone: '+420 602 554 117',
  paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};

const window1 = { id: 'w-1', date: day1, startTime: '11:00:00', endTime: '12:00:00', coveredMinutes: 60, releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true };
const window2 = { id: 'w-2', date: day2, startTime: '09:00:00', endTime: '10:00:00', coveredMinutes: 60, releaseDate: null, warnDate: null, partnerReminderDate: null, releasedAt: null, isExclusive: true };

const slanyOrder = {
  id: 'o-1', calendarId: 'c-1', partnerName: 'FK Slaný', partnerType: 0, note: '', contactEmail: null,
  linkSentAt: null, expiresAt: pragueWallClockToInstant(addDaysToDateOnly(today, 19), '12:00').toISOString(), isRevoked: false,
  requestedCount: 12, bookedCount: 4, requiredMinutes: 180, coveredMinutes: 120, missingMinutes: 60,
  items: [{ activityId: 'a-1', activityName: 'Komplexní prohlídka', durationMinutes: 15, requestedCount: 12, bookedCount: 4, remaining: 8, requiredMinutes: 180 }],
  windows: [window1, window2],
  clubId: 'club-1', token: 'fk-slany-rijen26', clubDiscountPercent: 10,
};

const appt = (id: string, date: string, time: string, name: string, ready = true) => ({
  id, calendarId: 'c-1', patientId: '', activityId: 'a-1', activityName: 'Komplexní prohlídka',
  startUtc: pragueWallClockToInstant(date, time).toISOString(),
  endUtc: pragueWallClockToInstant(date, time).toISOString(),
  status: 0, isRunningLate: false, checkedInUtc: null,
  paperwork: ready ? { ready: true, missing: [] } : { ready: false, missing: ['questionnaire'] },
  patientName: name,
});

function StateProbe() {
  const location = useLocation();
  return <div data-testid="state">{JSON.stringify(location.state)}</div>;
}

function PathProbe() {
  const location = useLocation();
  return <div data-testid="elsewhere">{location.pathname}{location.search} {JSON.stringify(location.state)}</div>;
}

function Wrap({ children, state = null }: { children: ReactNode; state?: unknown }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/clubs', state }]}>
        <Routes>
          <Route path="/clubs" element={<>{children}<StateProbe /></>} />
          <Route path="*" element={<PathProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const block = (over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id: 'b-1', clubId: 'club-2', clubName: 'HC Kladno', colorHex: '#2E7D6B', name: null, calendarIds: ['c-1'], activityIds: ['a-1'],
  fromDate: day1, toDate: day2, dailyFrom: null, dailyTo: null, playerCount: 40, seats: 40, registered: 3, status: 'Active',
  registrationToken: 'kladno-tok', registrationUrl: 'https://app.test/klub/kladno-tok', note: null, createdAtUtc: null, athletes: [], ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  listBlocks.mockReset().mockResolvedValue([]);
  getBlock.mockReset().mockImplementation(async (id: string) => block({ id }));
  createBlock.mockReset();
  createClub.mockReset();
  /* An older server: no batch route, the cards ask per club (and that fails here - they draw from the block totals). */
  fetchSummaries.mockReset().mockResolvedValue(null);
  clubSummary.mockReset().mockRejectedValue(new Error('500'));
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Komplexní prohlídka', durationMinutes: 15, clinicServiceId: null, colorHex: '#2E7D6B', parallelCapacity: 1 },
  ]);
  getAll.mockReset().mockResolvedValue([slany, kladno]);
  update.mockReset().mockResolvedValue(slany);
  listOrders.mockReset().mockResolvedValue([slanyOrder]);
  range.mockReset().mockResolvedValue([
    appt('p1', day1, '11:00', 'Jan Novák'),
    appt('p2', day1, '11:15', 'Petr Malý'),
    appt('p3', day2, '09:00', 'Adam Říha', false),
    appt('p4', day2, '09:15', 'Lukáš Beran'),
  ]);
});

describe('ClubsPage', () => {
  it("draws one card per club with its state, headcount and the administrator's discount", async () => {
    render(<Wrap><ClubsPage /></Wrap>);

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);

    const first = within(cards[0]);
    expect(first.getByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
    await waitFor(() => expect(first.getByText('Aktivní rezervace')).toBeInTheDocument());
    expect(first.getByText('Jan Trenér · +420 603 221 004')).toBeInTheDocument();
    expect(first.getByText('12')).toBeInTheDocument();
    expect(first.getByText('−10 %')).toBeInTheDocument();

    const second = within(cards[1]);
    await waitFor(() => expect(second.getByText('Bez objednávky')).toBeInTheDocument());
    /* sportovců, sleva and (Etapa 12) k fakturaci - nothing is known about a club without an order */
    expect(second.getAllByText('—')).toHaveLength(3);
    expect(second.getByTestId('club-card-billable')).toHaveTextContent('k fakturaci');

    /* Only the active calendar's orders were asked for. */
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(listOrders).toHaveBeenCalledWith('c-1');
  });

  it('narrows the grid with the chips and the search box', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    await screen.findAllByRole('listitem');
    await screen.findByText('Aktivní rezervace');

    await user.click(screen.getByRole('button', { name: /Bez objednávky/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'HC Kladno' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Všechny/ }));
    await user.type(screen.getByRole('textbox', { name: 'Hledat klub' }), 'trenér');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
  });

  it("opens the club's own screen, `/clubs/:clubId` - the planner in club mode, not a page of stacked cards", async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    const cards = await screen.findAllByRole('listitem');
    await screen.findByText('Aktivní rezervace');

    await user.click(cards[0]);

    expect(await screen.findByTestId('elsewhere')).toHaveTextContent('/clubs/club-1');
    /* the list stays where it was: nothing of the old detail page is drawn here any more */
    expect(screen.queryByTestId('club-detail')).toBeNull();
  });


  /*
   * `/api/clubs` is the one required read. Everything else is an enrichment:
   * when it fails the cards still draw and one note says what is missing. The
   * morning of 3. 10. 2026 the page said only "Kluby se nepodařilo načíst".
   */
  it("keeps the cards when a calendar's partner orders fail, and says which part is missing", async () => {
    listOrders.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'FK Slaný' })).toBeInTheDocument();
    expect(screen.queryByText('Kluby se nepodařilo načíst.')).not.toBeInTheDocument();

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent('Nepodařilo se načíst: rezervace kalendářů Prohlídky');
    expect(within(cards[0]).getByText('Bez objednávky')).toBeInTheDocument();

    listOrders.mockResolvedValue([slanyOrder]);
    await user.click(within(note).getByRole('button', { name: 'Zkusit znovu' }));
    await waitFor(() => expect(within(cards[0]).getByText('Aktivní rezervace')).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Etapa 12: the "k fakturaci" tile is the club\'s live orders\' totals, from ONE orders list for the whole page', async () => {
    const { clubOrdersApi, toOrder } = await import('../api/clubOrders');
    vi.mocked(clubOrdersApi.list).mockResolvedValue([
      toOrder({ id: 'o-live', clubId: 'club-1', status: 'Confirmed', priceQuote: { listTotalCzk: 4000, discounts: [], totalCzk: 3600 } }),
      toOrder({ id: 'o-req', clubId: 'club-1', status: 'Requested', priceQuote: { listTotalCzk: 1000, discounts: [], totalCzk: 1000 } }),
      toOrder({ id: 'o-gone', clubId: 'club-1', status: 'Cancelled', priceQuote: { listTotalCzk: 99999, discounts: [], totalCzk: 99999 } }),
    ]);
    try {
      render(<Wrap><ClubsPage /></Wrap>);
      const cards = await screen.findAllByRole('listitem');
      await waitFor(() => expect(within(cards[0]).getByTestId('club-card-billable')).toHaveTextContent(/4\s600\sKč/));
      expect(within(cards[1]).getByTestId('club-card-billable')).toHaveTextContent('—');
      expect(clubOrdersApi.list).toHaveBeenCalledTimes(1);
      expect(clubOrdersApi.list).toHaveBeenCalledWith({});
    } finally {
      /* the module mock is shared by the whole file: back to "no club orders" for the tests after this one */
      vi.mocked(clubOrdersApi.list).mockResolvedValue([]);
    }
  });

  it('shows no discount for a club the administrator gave none, whatever its headcount', async () => {
    getAll.mockResolvedValue([{ ...slany, discountPercent: null }, kladno]);
    listOrders.mockResolvedValue([{ ...slanyOrder, clubDiscountPercent: null }]);
    render(<Wrap><ClubsPage /></Wrap>);

    const cards = await screen.findAllByRole('listitem');
    await waitFor(() => expect(within(cards[0]).getByText('Aktivní rezervace')).toBeInTheDocument());
    expect(within(cards[0]).getByText('12')).toBeInTheDocument();
    /* no discount, and (Etapa 12) nothing to invoice without a club order */
    expect(within(cards[0]).getAllByText('—')).toHaveLength(2);
  });

  it('saves the discount the administrator types, as a number', async () => {
    const user = userEvent.setup();
    /* the payer record is edited from the club's screen ("Upravit údaje"); the dialog itself is the same one */
    const { PayerDialog } = await import('./clubs/PayerDialog');
    render(<Wrap><PayerDialog editing={kladno as never} onClose={vi.fn()} onSaved={vi.fn()} /></Wrap>);
    const dialog = await screen.findByRole('dialog');
    const discount = within(dialog).getByLabelText('Sleva klubu (%)');
    expect(discount).toHaveValue('');

    await user.type(discount, '12,345');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Sleva je číslo od 0 do 100, nejvýše dvě desetinná místa.')).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();

    await user.clear(discount);
    await user.type(discount, '7,5');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('club-2', expect.objectContaining({ discountPercent: 7.5 })));
  });

  it('shows the one required failure with a retry when the clubs themselves cannot be read', async () => {
    getAll.mockRejectedValue(new Error('404'));
    render(<Wrap><ClubsPage /></Wrap>);
    expect(await screen.findByText('Kluby se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkusit znovu' })).toBeInTheDocument();
  });

});

/* ── Etapa 2: three layouts, club blocks and the router state ── */

describe('ClubsPage in three layouts', () => {
  it.each([
    ['phone', VIEWPORTS.phone, '1'],
    ['tablet', VIEWPORTS.tablet, '2'],
    ['desktop', VIEWPORTS.desktop, '3'],
  ])('draws the %s list with %s column(s) of cards', async (device, width, columns) => {
    setViewport(width);
    render(<Wrap><ClubsPage /></Wrap>);
    const list = await screen.findByTestId('clubs-list');
    expect(list).toHaveAttribute('data-layout', device);
    expect(list).toHaveAttribute('data-columns', columns);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('puts the actions in the header on a desktop', async () => {
    render(<Wrap><ClubsPage /></Wrap>);
    await screen.findAllByRole('listitem');
    expect(screen.queryByTestId('pinned-actions')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nový blok' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nový klub' })).toBeInTheDocument();
  });

  it('pins "Nová objednávka" and "Nový klub" on a phone, and keeps the header free of them', async () => {
    setViewport(VIEWPORTS.phone);
    render(<Wrap><ClubsPage /></Wrap>);
    await screen.findAllByRole('listitem');
    const bar = screen.getByTestId('pinned-actions');
    expect(within(bar).getByRole('button', { name: 'Nová objednávka' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Nový klub' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Nová objednávka' })).toHaveLength(1);
  });

  it.each([
    ['phone', VIEWPORTS.phone],
    ['tablet', VIEWPORTS.tablet],
    ['desktop', VIEWPORTS.desktop],
  ])("a card opens the club's own screen in the %s layout", async (_device, width) => {
    setViewport(width);
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    const cards = await screen.findAllByRole('listitem');
    await user.click(cards[1]);
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent('/clubs/club-2');
  });
});

describe('ClubsPage with club blocks', () => {
  it("draws the club's colour as its avatar and counts a block's players when there is no order", async () => {
    listBlocks.mockResolvedValue([block()]);
    render(<Wrap><ClubsPage /></Wrap>);
    const cards = await screen.findAllByRole('listitem');
    await waitFor(() => expect(within(cards[1]).getByText('Aktivní rezervace')).toBeInTheDocument());
    expect(within(cards[1]).getByTestId('club-avatar')).toHaveAttribute('data-color', '#2E7D6B');
    expect(within(cards[1]).getByText('40')).toBeInTheDocument();
    /* A club with no block and no colour known gets the neutral chip, not an invented colour. */
    expect(within(cards[0]).getByTestId('club-avatar')).toHaveAttribute('data-color', '');
  });



  it('keeps the cards and names the missing part when the blocks cannot be read', async () => {
    listBlocks.mockRejectedValue(new Error('500'));
    render(<Wrap><ClubsPage /></Wrap>);
    await screen.findAllByRole('listitem');
    expect(await screen.findByRole('alert')).toHaveTextContent('Nepodařilo se načíst: bloky klubů');
  });

  it('has no way left to create a loose block: a newBlock hand-off opens nothing', async () => {
    render(<Wrap state={{ newBlock: true }}><ClubsPage /></Wrap>);
    expect(await screen.findByRole('heading', { name: 'Kluby a týmy' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Nový blok pro klub/)).toBeNull();
    expect(createBlock).not.toHaveBeenCalled();
  });
});

describe('ClubsPage router state', () => {
  it("sends a club window's hand-off to the club's screen, landing on that block", async () => {
    listBlocks.mockResolvedValue([block({ id: 'b-1', clubId: 'club-2' }), block({ id: 'b-2', clubId: 'club-2', fromDate: day2, toDate: day2 })]);
    render(<Wrap state={{ clubId: 'club-2', clubBlockId: 'b-2' }}><ClubsPage /></Wrap>);
    const where = await screen.findByTestId('elsewhere');
    expect(where).toHaveTextContent('/clubs/club-2');
    expect(where).toHaveTextContent('{"clubBlockId":"b-2"}');
  });

  it('finds the club from the block when only the block id is given', async () => {
    listBlocks.mockResolvedValue([block({ id: 'b-7', clubId: 'club-2' })]);
    render(<Wrap state={{ clubBlockId: 'b-7' }}><ClubsPage /></Wrap>);
    const where = await screen.findByTestId('elsewhere');
    expect(where).toHaveTextContent('/clubs/club-2');
    expect(where).toHaveTextContent('{"clubBlockId":"b-7"}');
  });

  it('still opens a club straight away from the older { clubId } hand-off', async () => {
    render(<Wrap state={{ clubId: 'club-1' }}><ClubsPage /></Wrap>);
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent('/clubs/club-1');
  });
});

describe('ClubsPage order router state (Etapa 4)', () => {
  it('opens the order named by openOrderId in the detail drawer and spends the state', async () => {
    const { clubOrdersApi, toOrder } = await import('../api/clubOrders');
    vi.mocked(clubOrdersApi.get).mockResolvedValue(toOrder({ id: 'o-7', clubName: 'FK Slaný', status: 'Requested', totalSeats: 12 }));
    render(<Wrap state={{ openOrderId: 'o-7' }}><ClubsPage /></Wrap>);
    expect(await screen.findByTestId('order-detail')).toHaveAttribute('data-status', 'Requested');
    expect(clubOrdersApi.get).toHaveBeenCalledWith('o-7');
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'));
  });

  it('spends a newOrder handoff', async () => {
    render(<Wrap state={{ newOrder: { clubId: 'club-1' } }}><ClubsPage /></Wrap>);
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('null'));
  });
});

describe('"Nová objednávka" in the list (Etapa 5)', () => {
  it('opens the two-way chooser, and the phone choice goes to the calendar setup', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    await user.click(await screen.findByRole('button', { name: 'Nová objednávka' }));
    const entry = await screen.findByTestId('club-order-entry');
    expect(within(entry).getAllByRole('button')).toHaveLength(2);
    await user.click(within(entry).getByTestId('entry-phone'));
    const where = await screen.findByTestId('elsewhere');
    expect(where).toHaveTextContent('/planovani');
  });

  it('is the same chooser as everywhere (one flow, no term form)', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubsPage /></Wrap>);
    await user.click(await screen.findByRole('button', { name: 'Nová objednávka' }));
    const entry = await screen.findByTestId('club-order-entry');
    expect(within(entry).getByTestId('entry-phone')).toBeInTheDocument();
    expect(within(entry).getByTestId('entry-link')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Denně od/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Automatický návrh/)).not.toBeInTheDocument();
  });
});

describe('ClubsPage summaries', () => {
  const summary = (clubId: string, totalSeats: number, registered: number) => ({
    clubId, totalSeats, registered, remaining: totalSeats - registered, byService: [], byActivity: [], ordersByStatus: {}, bookedMinutes: 0, usedMinutes: 0,
  });

  it('asks for the summaries of the ACTIVE clubs once and the cards read that, with no per-club request', async () => {
    getAll.mockResolvedValue([slany, { ...kladno, id: 'club-off', name: 'Starý klub', isActive: false }, kladno]);
    fetchSummaries.mockResolvedValue([summary('club-1', 30, 12), summary('club-2', 20, 5)]);
    render(<Wrap><ClubsPage /></Wrap>);

    await screen.findByText('12 / 30');
    expect(screen.getByText('5 / 20')).toBeInTheDocument();
    expect(fetchSummaries).toHaveBeenCalledTimes(1);
    expect(fetchSummaries).toHaveBeenCalledWith(['club-1', 'club-2']);
    expect(clubSummary).not.toHaveBeenCalled();
  });

  it('goes back to one request per club when the server has no batch route', async () => {
    clubSummary.mockImplementation(async (id: string) => summary(id, id === 'club-1' ? 30 : 20, 1));
    render(<Wrap><ClubsPage /></Wrap>);

    await screen.findByText('1 / 30');
    expect(screen.getByText('1 / 20')).toBeInTheDocument();
    expect(fetchSummaries).toHaveBeenCalledTimes(1);
    expect(clubSummary).toHaveBeenCalledTimes(2);
  });
});
