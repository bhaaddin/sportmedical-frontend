import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Calendar, PreviewDay } from '../../api/bookingContracts';
import type { ClubBlockView } from '../../api/clubBlocks';
import type { PickSession } from '../../components/clubs/order/pickSession';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { addDaysToDateOnly } from '../../utils/time';
import { boardSettings } from '../components/board/boardSettings';
import { DemoDataSource } from '../data/DemoDataSource';

/*
 * A club's own screen, `/clubs/:clubId`: the planner in club mode. What it reads (the club, its orders folded into
 * groups), which group is on the stage, the order switcher, the empty deck for a club with nothing to plan, and that
 * every action the old club page had is reachable from the overview dialog. The dialogs the actions open are the
 * existing ones; they are stubbed here to see that they get the right order and intent.
 */

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn() } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../../api/partnerOrders', () => ({ partnerOrdersApi: { list: vi.fn() } }));
vi.mock('../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: actual.CALENDAR_DISPLAY_OFFLINE, loaded: true })) };
});
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubsApi: { getById: vi.fn(), getAll: vi.fn(), deactivate: vi.fn() } };
});
vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return { ...actual, clubBlocksApi: { list: vi.fn() }, fetchBlockableActivities: vi.fn() };
});
vi.mock('../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list: vi.fn(), clubSummary: vi.fn() } };
});

/* the application's own dialogs: stubs that show what they were given */
vi.mock('../../components/clubs/order/ClubOrderEntry', () => ({
  ClubOrderEntry: (p: { open: boolean; defaultClubId?: string; onPhone: (id?: string) => void; onClose: () => void }) =>
    p.open ? (
      <div role="dialog" aria-label="Nová klubová objednávka" data-testid="entry-stub" data-club={p.defaultClubId ?? ''}>
        <button type="button" onClick={() => p.onPhone(p.defaultClubId)}>Vyplním sám</button>
      </div>
    ) : null,
}));
vi.mock('../../components/clubs/orders/ChangePlayersDialog', () => ({
  ChangePlayersDialog: (p: { order: { id: string }; intent: string; onEditTerms?: (a: unknown[]) => void }) => (
    <div role="dialog" aria-label="Hráči" data-testid="players-stub" data-order={p.order.id} data-intent={p.intent}>
      {p.onEditTerms ? <button type="button" onClick={() => p.onEditTerms?.([{ activityId: 'a1', name: 'Základní', seats: 14, minutesPerSeat: 30, parallelCapacity: 1 }])}>Upravit termíny</button> : null}
    </div>
  ),
}));
vi.mock('../../components/clubs/orders/CancelOrderDialog', () => ({
  CancelOrderDialog: (p: { order: { id: string } }) => <div role="dialog" aria-label="Zrušit" data-testid="cancel-stub" data-order={p.order.id} />,
}));
vi.mock('../../components/clubs/orders/ClubOrderDetailPanel', () => ({
  ClubOrderDetailPanel: (p: { orderId: string }) => <div role="dialog" aria-label="Objednávka" data-testid="panel-stub" data-order={p.orderId} />,
}));
vi.mock('../../components/clubs/detail/MergeOrdersDialog', () => ({
  MergeOrdersDialog: (p: { orders: { id: string }[] }) => <div role="dialog" aria-label="Sloučit" data-testid="merge-stub" data-orders={p.orders.map((o) => o.id).join(',')} />,
}));
vi.mock('../../components/clubs/ClubBlockPanel', () => ({
  ClubBlockPanel: (p: { block: { id: string } }) => <div data-testid="block-stub" data-block-id={p.block.id} />,
}));
vi.mock('../../components/clubs/detail/LegacyReservation', () => ({
  LegacyReservation: () => <div data-testid="legacy-stub" />,
}));
vi.mock('../../components/clubs/orders/ClubLinksBlock', () => ({
  ClubLinksBlock: (p: { order: { id: string } }) => <div data-testid="links-stub" data-order={p.order.id} />,
}));
vi.mock('../../pages/clubs/PayerDialog', () => ({
  PayerDialog: (p: { editing: { id: string } }) => <div role="dialog" aria-label="Upravit klub" data-testid="payer-stub" data-club={p.editing.id} />,
}));

const apiSource = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[], source: null as unknown }));
vi.mock('../api/useApiDataSource', () => ({
  useApiDataSource: (options: Record<string, unknown>) => {
    apiSource.calls.push(options);
    return apiSource.source;
  },
}));

import { calendarsApi } from '../../api/calendars';
import { clinicServicesApi } from '../../api/clinicServices';
import { workingHoursApi } from '../../api/workingHours';
import { appointmentsApi } from '../../api/appointments';
import { activitiesApi } from '../../api/activities';
import { clubsApi } from '../../api/clubs';
import { clubBlocksApi, fetchBlockableActivities } from '../../api/clubBlocks';
import { clubOrdersApi, toOrder, type ClubOrderView } from '../../api/clubOrders';
import { partnerOrdersApi } from '../../api/partnerOrders';
import ClubPlannerPage from '../ClubPlannerPage';

/** Demo data with no činnost to plan: what the real source gives a club's screen without an editable order. */
class EmptyDeckSource extends DemoDataSource {
  override async getOrder() {
    return { id: '', clubId: 'club-1', demands: [], baselineSessions: [], club: true, clubName: 'FK Slaný' };
  }
}

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};

const club = {
  id: 'club-1', name: 'FK Slaný', ico: '25596641', address: 'Sportovní 1', city: 'Slaný', postalCode: '27401',
  contactPerson: 'Jan Trenér', contactPhone: '+420 603 221 004', contactEmail: 'klub@fkslany.cz',
  paymentTermsDays: 14, discountPercent: null, isActive: true, createdAt: '2026-01-01T00:00:00Z',
};

const A = 'aaaa0000-0000-0000-0000-00000000aa01';
const A2 = 'aaaa0000-0000-0000-0000-00000000aa02';
const B = 'bbbb0000-0000-0000-0000-00000000bb01';
const I = 'cccc0000-0000-0000-0000-00000000cc01';
const X = 'dddd0000-0000-0000-0000-00000000dd01';

const win = (id: string, orderId: string, from: string): ClubBlockView => ({
  id, clubId: 'club-1', clubOrderId: orderId, clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['c1'], activityIds: [],
  fromDate: from, toDate: from, dailyFrom: '08:00', dailyTo: '12:00', playerCount: 10, seats: 10, registered: 0,
  status: 'Active', registrationToken: 't', registrationUrl: 'https://app.test/klub/t', note: null, createdAtUtc: null, athletes: [],
});

const base = { clubId: 'club-1', clubName: 'FK Slaný', serviceName: 'Sportovní lékařské prohlídky', paymentMethod: 'ClubInvoice', requestedRanges: [], note: '', registered: 0, totalSeats: 10, priceQuote: null };
const seats = [{ activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 10, registered: 0, unitPriceCzk: 500 }];
const orderA = toOrder({ ...base, priceQuote: { listTotalCzk: 5000, discounts: [], totalCzk: 4500 }, id: A, groupId: A, status: 'Confirmed', parentOrderId: null, addenda: [], createdAtUtc: '2026-09-01T10:00:00Z', activitySeats: seats, blocks: [win('wa', A, '2099-11-05')] });
const orderA2 = toOrder({ ...base, priceQuote: { listTotalCzk: 3000, discounts: [], totalCzk: 3000 }, id: A2, serviceName: 'Sportovní diagnostika', groupId: A, status: 'Confirmed', parentOrderId: A, addenda: [], createdAtUtc: '2026-09-02T10:00:00Z', activitySeats: seats, blocks: [win('wa2', A2, '2099-11-07')] });
const orderB = toOrder({ ...base, id: B, groupId: B, status: 'Confirmed', serviceName: 'Sportovní diagnostika', parentOrderId: null, addenda: [], createdAtUtc: '2026-09-03T10:00:00Z', activitySeats: seats, blocks: [win('wb', B, '2099-12-01')] });
const orderI = toOrder({ ...base, id: I, groupId: I, status: 'Invited', parentOrderId: null, addenda: [], createdAtUtc: '2026-09-04T10:00:00Z', activitySeats: [], totalSeats: 0, blocks: [] });
const orderX = toOrder({ ...base, id: X, groupId: X, status: 'Cancelled', parentOrderId: null, addenda: [], createdAtUtc: '2026-08-01T10:00:00Z', activitySeats: seats, blocks: [] });

const summary = {
  clubId: 'club-1', totalSeats: 49, registered: 7, remaining: 42, byService: [], byActivity: [],
  ordersByStatus: { Invited: 1, Requested: 0, Confirmed: 3, Completed: 0, Cancelled: 1 }, bookedMinutes: 0, usedMinutes: 0,
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location" data-path={location.pathname} data-search={location.search} data-state={JSON.stringify(location.state)} />;
}

function mount(entry: { pathname?: string; search?: string; state?: unknown } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/clubs/club-1', ...entry }]}>
        <LocationProbe />
        <Routes>
          <Route path="/clubs/:clubId" element={<ClubPlannerPage />} />
          <Route path="/clubs" element={<div data-testid="clubs-list" />} />
          <Route path="*" element={<div data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lastOptions = () => apiSource.calls.at(-1) as { session: PickSession | null; clubContext?: { clubId: string }; id?: string };
const where = () => screen.getByTestId('location');

async function openSwitcher() {
  fireEvent.click(await screen.findByTestId('club-order-switch-button'));
  return screen.findByTestId('club-order-menu');
}
async function openOverview() {
  const menu = await openSwitcher();
  fireEvent.click(within(menu).getByTestId('club-order-overview'));
  return screen.findByTestId('club-overview');
}

function seed(orders: ClubOrderView[] = [orderA, orderA2, orderB, orderI, orderX], blocks: ClubBlockView[] = []) {
  vi.mocked(clubsApi.getById).mockResolvedValue(club as never);
  vi.mocked(clubOrdersApi.list).mockResolvedValue(orders);
  vi.mocked(clubOrdersApi.clubSummary).mockResolvedValue(summary);
  vi.mocked(clubBlocksApi.list).mockResolvedValue(blocks);
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
  boardSettings.reset();
  apiSource.calls = [];
  apiSource.source = new DemoDataSource({ today: '2026-11-10' });
  seed();
  vi.mocked(fetchBlockableActivities).mockResolvedValue([
    { id: 'a1', name: 'Základní', durationMinutes: 30, clinicServiceId: 's1', colorHex: '#2E7D6B', parallelCapacity: 1 },
  ] as never);
  vi.mocked(calendarsApi.list).mockResolvedValue([calendar]);
  vi.mocked(partnerOrdersApi.list).mockResolvedValue([]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: '#1565C0' },
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({ date: d, isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00', breakStart: null, breakEnd: null, workerUserId: 'u1', workerDisplayName: 'Anna', isChangedByOverride: false, offeredActivityIds: ['a1'] });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockResolvedValue([]);
  vi.mocked(appointmentsApi.blocks).mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('/clubs/:clubId - the planner in club mode', () => {
  it("opens the club's own screen: club mode, the club's header, the club as the source's context", async () => {
    mount();
    const page = await screen.findByTestId('planner-page');
    expect(page).toHaveAttribute('data-mode', 'club');
    expect(await screen.findByTestId('club-header')).toHaveAttribute('data-mode', 'club');
    expect(lastOptions().clubContext).toMatchObject({ clubId: 'club-1', clubName: 'FK Slaný' });
    expect(lastOptions().id).toMatch(/^api:club:club-1:/);
    await screen.findByTestId('week-board-panel');
    expect(document.getElementById('day-board')).toHaveAttribute('data-board-mode', 'club');
  });

  it("puts the live group with the nearest window on the stage: the root's edit session, nothing else", async () => {
    mount();
    await screen.findByTestId('planner-page');
    const session = lastOptions().session;
    expect(session?.editOrder).toMatchObject({ mode: 'edit', orderId: A });
    expect(session?.editOrder?.blocks.map((b) => b.id)).toEqual(['wa']);
    expect(session?.activities).toEqual([expect.objectContaining({ activityId: 'a1', seats: 10, minutesPerSeat: 30 })]);
  });

  it('`?order=` names another group - by its root or by an addendum of it', async () => {
    mount({ search: `?order=${B}` });
    await screen.findByTestId('planner-page');
    expect(lastOptions().session?.editOrder?.orderId).toBe(B);
    cleanup();
    apiSource.calls = [];
    mount({ search: `?order=${A2}` });
    await screen.findByTestId('planner-page');
    expect(lastOptions().session?.editOrder?.orderId).toBe(A);
  });

  it('a window handed over by the calendar (`clubBlockId`) opens the group that owns it', async () => {
    mount({ state: { clubBlockId: 'wb' } });
    await screen.findByTestId('planner-page');
    expect(lastOptions().session?.editOrder?.orderId).toBe(B);
  });

  it('a club that does not exist says so, with the way back', async () => {
    vi.mocked(clubsApi.getById).mockRejectedValue(Object.assign(new Error('404'), { status: 404 }));
    mount();
    expect(await screen.findByTestId('club-planner-error')).toHaveTextContent('Tento klub neexistuje.');
    expect(screen.getByRole('link', { name: 'Zpět na kluby' })).toHaveAttribute('href', '/clubs');
  });

  it('a router-state session (a new order being set up) is what the stage plans; the switcher says so', async () => {
    const draft: PickSession = { clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika', activities: [], paymentMethod: 'ClubInvoice', note: '' };
    mount({ state: { pickOrder: { start: draft } } });
    await screen.findByTestId('planner-page');
    expect(lastOptions().session).toEqual(draft);
    expect(await screen.findByTestId('club-order-switch-button')).toHaveTextContent('Nová objednávka');
    const menu = await openSwitcher();
    expect(within(menu).getByTestId('club-order-new-draft')).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getAllByTestId('club-order-option').every((o) => o.getAttribute('aria-checked') === 'false')).toBe(true);
  });

  it('the setup form is asked for on this screen: a { clubId } hand-off, no session yet', async () => {
    mount({ state: { pickOrder: { clubId: 'club-1' } } });
    await screen.findByTestId('planner-page');
    expect(where().dataset.path).toBe('/clubs/club-1');
  });
});

describe('the order switcher', () => {
  it('lists the club\'s groups - code, služba, players, status - and marks the one on the stage', async () => {
    mount();
    const menu = await openSwitcher();
    const options = within(menu).getAllByTestId('club-order-option');
    /* the cancelled order is not a group; the addendum folds into its root */
    expect(options.map((o) => o.getAttribute('data-group-id'))).toEqual([A, B, I]);
    expect(options[0]).toHaveTextContent('KO-0000AA01 · Sportovní lékařské prohlídky');
    expect(options[0]).toHaveTextContent('20 hráčů · Potvrzeno');
    expect(options[0]).toHaveTextContent('+1 dodatek');
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
    expect(options[1]).toHaveAttribute('aria-checked', 'false');
    expect(options[2]).toHaveAttribute('data-editable', 'false');
    expect(options[2]).toHaveTextContent('Čeká na formulář');
    expect(screen.getByTestId('club-order-switch-button')).toHaveTextContent('Objednávka KO-0000AA01');
  });

  it('choosing another group puts it on the stage (`?order=`) and the order context changes', async () => {
    mount();
    const menu = await openSwitcher();
    fireEvent.click(within(menu).getAllByTestId('club-order-option')[1]);
    await waitFor(() => expect(where().dataset.search).toBe(`?order=${B}`));
    await waitFor(() => expect(lastOptions().session?.editOrder?.orderId).toBe(B));
    expect(lastOptions().session?.editOrder?.blocks.map((b) => b.id)).toEqual(['wb']);
    expect(await screen.findByTestId('club-order-switch-button')).toHaveTextContent('KO-0000BB01');
  });

  it('a group the stage cannot edit opens for reading: no session, the club stays the context', async () => {
    mount();
    const menu = await openSwitcher();
    fireEvent.click(within(menu).getAllByTestId('club-order-option')[2]);
    await waitFor(() => expect(where().dataset.search).toBe(`?order=${I}`));
    await waitFor(() => expect(lastOptions().session).toBeNull());
    expect(lastOptions().clubContext).toMatchObject({ clubId: 'club-1' });
    expect(screen.getByTestId('club-header')).toHaveAttribute('data-mode', 'club');
  });

  it('"Nová objednávka klubu" opens the existing chooser for this club; "Vyplním sám" asks for the setup form here', async () => {
    mount();
    const menu = await openSwitcher();
    fireEvent.click(within(menu).getByTestId('club-order-new'));
    const entry = await screen.findByTestId('entry-stub');
    expect(entry).toHaveAttribute('data-club', 'club-1');
    fireEvent.click(within(entry).getByRole('button', { name: 'Vyplním sám' }));
    await waitFor(() => expect(JSON.parse(where().dataset.state!)).toEqual({ pickOrder: { clubId: 'club-1' } }));
    expect(where().dataset.path).toBe('/clubs/club-1');
    expect(screen.queryByTestId('entry-stub')).toBeNull();
  });

  it('closes with Esc', async () => {
    mount();
    await openSwitcher();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('club-order-menu')).toBeNull());
  });
});

describe('a club with nothing to plan - the same layout, an empty deck', () => {
  beforeEach(() => {
    apiSource.source = new EmptyDeckSource({ today: '2026-11-10' });
  });

  it('a club without any order: club header, the deck says so, "Nová objednávka klubu" is one click away', async () => {
    seed([]);
    mount();
    expect(await screen.findByTestId('club-header')).toHaveAttribute('data-mode', 'club');
    const deck = await screen.findByTestId('deck-empty');
    expect(within(deck).getByTestId('deck-empty-reason')).toHaveTextContent('Klub zatím nemá žádnou objednávku.');
    expect(within(deck).queryByTestId('deck-empty-open')).toBeNull();
    expect(screen.getByTestId('club-order-switch-button')).toHaveTextContent('Žádná objednávka');
    expect(lastOptions().session).toBeNull();
    fireEvent.click(within(deck).getByTestId('deck-empty-new'));
    expect(await screen.findByTestId('entry-stub')).toHaveAttribute('data-club', 'club-1');
  });

  it('a group that is not Confirmed: the reason, and the order\'s own panel behind "Otevřít objednávku"', async () => {
    mount({ search: `?order=${I}` });
    const deck = await screen.findByTestId('deck-empty');
    expect(deck).toHaveAttribute('data-status', 'Invited');
    expect(within(deck).getByTestId('deck-empty-reason')).toHaveTextContent('nevyplnil klub');
    fireEvent.click(within(deck).getByTestId('deck-empty-open'));
    expect(await screen.findByTestId('panel-stub')).toHaveAttribute('data-order', I);
  });

  it('marks a club whose invoice data are missing, in the header\'s identification block', async () => {
    mount();
    const mark = await screen.findByTestId('club-billing-warning');
    expect(mark).toHaveAttribute('aria-label', 'Chybí fakturační údaje');
    expect(mark.closest('.club-head-info')).toHaveAttribute('aria-label', 'Identifikační údaje klubu');
  });

  it('draws no mark for a club that can be invoiced', async () => {
    vi.mocked(clubsApi.getById).mockResolvedValue({ ...club, bankAccount: '123456', bankCode: '0100' } as never);
    mount();
    await screen.findByTestId('club-header');
    expect(screen.queryByTestId('club-billing-warning')).toBeNull();
  });
});

describe('everything the old club page offered is reachable from the overview', () => {
  it('shows the figures, the orders by status and the billing facts', async () => {
    mount();
    const overview = await openOverview();
    const figures = within(overview).getByTestId('club-figures');
    await waitFor(() => expect(figures).toHaveTextContent('49'));
    expect(figures).toHaveTextContent('Zapsáno7');
    expect(figures).toHaveTextContent('Zbývá42');
    expect(within(overview).getByTestId('summary-statuses')).toHaveTextContent('Potvrzeno3');
    expect(within(overview).getByTestId('summary-statuses')).toHaveTextContent('Čeká na formulář1');
    expect(figures).toHaveTextContent('Chybí fakturační údaje');
    expect(figures).toHaveTextContent('Splatnost14 dní');
  });

  it('is the dialog of the order overview: a title that says "klub", and a way back to the list', async () => {
    mount();
    await openOverview();
    const dialog = screen.getByRole('dialog', { name: /Přehled/ });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zpět na kluby' }));
    await waitFor(() => expect(where().dataset.path).toBe('/clubs'));
  });

  it('one row per group with its actions; Přidat hráče / Odebrat hráče / Zrušit / Otevřít open the existing dialogs for the root', async () => {
    mount();
    const overview = await openOverview();
    const rows = within(overview).getAllByTestId('club-order-row');
    expect(rows.map((r) => r.getAttribute('data-order-id'))).toEqual([A, B, I]);
    expect(rows[0]).toHaveAttribute('data-addenda', '1');
    expect(rows[0]).toHaveTextContent('NA PLÁNOVAČI');
    expect(within(overview).getByTestId('club-orders-cancelled')).toHaveTextContent('KO-0000DD01');

    fireEvent.click(within(rows[0]).getByTestId('order-card-add-players'));
    expect(await screen.findByTestId('players-stub')).toMatchObject({});
    expect(screen.getByTestId('players-stub')).toHaveAttribute('data-order', A);
    expect(screen.getByTestId('players-stub')).toHaveAttribute('data-intent', 'add');
    cleanup();
    mount();
    const again = await openOverview();
    fireEvent.click(within(within(again).getAllByTestId('club-order-row')[1]).getByTestId('order-card-remove-players'));
    expect(await screen.findByTestId('players-stub')).toHaveAttribute('data-intent', 'remove');
    expect(screen.getByTestId('players-stub')).toHaveAttribute('data-order', B);
    cleanup();
    mount();
    const third = await openOverview();
    fireEvent.click(within(within(third).getAllByTestId('club-order-row')[0]).getByTestId('order-card-cancel'));
    expect(await screen.findByTestId('cancel-stub')).toHaveAttribute('data-order', A);
    cleanup();
    mount();
    const fourth = await openOverview();
    fireEvent.click(within(within(fourth).getAllByTestId('club-order-row')[1]).getByTestId('club-order-link'));
    expect(await screen.findByTestId('panel-stub')).toHaveAttribute('data-order', B);
  });

  it('a group reads as ONE row: a line per služba, the payment with the group total, the windows of all its orders in date order', async () => {
    mount();
    const overview = await openOverview();
    const row = within(overview).getAllByTestId('club-order-row')[0];
    const text = (e: HTMLElement) => (e.textContent ?? '').replace(/ /g, ' ');
    expect(within(row).getAllByTestId('order-card-service').map(text)).toEqual([
      'Sportovní lékařské prohlídky · Základní 0/10 · 500 Kč (10 hráčů) · 4 500 Kč',
      'Sportovní diagnostika · Základní 0/10 · 500 Kč (10 hráčů) · 3 000 Kč',
    ]);
    expect(text(within(row).getByTestId('order-card-payment'))).toBe('Platba: Platí klub (jedna faktura) · Celkem 7 500 Kč · ceník 8 000 Kč · sleva 500 Kč');
    expect(within(row).getAllByTestId('order-window')).toHaveLength(2);
    expect(row).toHaveTextContent('Termíny (2 termíny)');
  });

  it('only live orders offer the player actions, only a Confirmed one "Upravit termíny"', async () => {
    mount();
    const overview = await openOverview();
    const invited = within(overview).getAllByTestId('club-order-row')[2];
    expect(within(invited).queryByTestId('order-card-add-players')).toBeNull();
    expect(within(invited).queryByTestId('order-card-edit-terms')).toBeNull();
    expect(within(invited).getByTestId('order-card-cancel')).toBeInTheDocument();
    expect(within(invited).getByTestId('club-order-link')).toBeInTheDocument();
  });

  it('"Upravit termíny" of another group arms the stage on it', async () => {
    mount();
    const overview = await openOverview();
    fireEvent.click(within(within(overview).getAllByTestId('club-order-row')[1]).getByTestId('order-card-edit-terms'));
    await waitFor(() => expect(where().dataset.search).toBe(`?order=${B}`));
    await waitFor(() => expect(lastOptions().session?.editOrder?.orderId).toBe(B));
  });

  it('"Upravit termíny" from the players dialog opens the stage with the new numbers (the order\'s baseline stays)', async () => {
    mount();
    const overview = await openOverview();
    fireEvent.click(within(within(overview).getAllByTestId('club-order-row')[0]).getByTestId('order-card-add-players'));
    const stub = await screen.findByTestId('players-stub');
    fireEvent.click(within(stub).getByRole('button', { name: 'Upravit termíny' }));
    await waitFor(() => expect(lastOptions().session?.activities[0]).toMatchObject({ seats: 14 }));
    expect(lastOptions().session?.editOrder).toMatchObject({ orderId: A });
    expect(lastOptions().session?.editOrder?.baseline?.[0]).toMatchObject({ seats: 10 });
    expect(screen.getByTestId('club-order-switch-button')).toHaveTextContent('KO-0000AA01');
  });

  it('"Sloučit do jedné objednávky" is offered with two live roots and gets exactly those', async () => {
    mount();
    const overview = await openOverview();
    fireEvent.click(within(overview).getByTestId('merge-orders-button'));
    expect(await screen.findByTestId('merge-stub')).toHaveAttribute('data-orders', `${A},${B}`);
  });

  it('no merge with a single live root', async () => {
    seed([orderA, orderA2, orderX]);
    mount();
    const overview = await openOverview();
    expect(within(overview).queryByTestId('merge-orders-button')).toBeNull();
  });

  it('the selected order\'s links (the club\'s portal) and history are there', async () => {
    mount();
    const overview = await openOverview();
    const section = within(overview).getByTestId('club-selected-order');
    expect(section).toHaveTextContent('KO-0000AA01');
    expect(within(section).getByTestId('links-stub')).toHaveAttribute('data-order', A);
    expect(section).toHaveTextContent('Historie objednávky');
  });

  it('lists the windows ahead, and the older blocks without an order with the older reservation', async () => {
    const legacy: ClubBlockView = { ...win('wl', '', '2099-10-02'), clubOrderId: undefined as never };
    seed(undefined, [...[orderA, orderA2, orderB].flatMap((o) => o.blocks), legacy]);
    vi.mocked(partnerOrdersApi.list).mockResolvedValue([]);
    mount();
    const overview = await openOverview();
    expect(within(overview).getAllByTestId('club-window').length).toBeGreaterThanOrEqual(3);
    const blocks = await within(overview).findByTestId('club-legacy-blocks');
    expect(within(blocks).getByTestId('block-stub')).toHaveAttribute('data-block-id', 'wl');
  });

  it('the club\'s actions: new order, reservation, athletes, edit, deactivate', async () => {
    mount();
    let overview = await openOverview();
    const actions = within(overview).getByTestId('club-actions');
    fireEvent.click(within(actions).getByRole('button', { name: 'Nová objednávka klubu' }));
    expect(await screen.findByTestId('entry-stub')).toHaveAttribute('data-club', 'club-1');
    cleanup();

    mount();
    overview = await openOverview();
    fireEvent.click(within(within(overview).getByTestId('club-actions')).getByRole('button', { name: 'Vytvořit rezervaci' }));
    await waitFor(() => expect(JSON.parse(where().dataset.state!)).toEqual({ pickOrder: { clubId: 'club-1' } }));
    cleanup();

    mount();
    overview = await openOverview();
    fireEvent.click(within(within(overview).getByTestId('club-actions')).getByRole('button', { name: 'Sportovci klubů' }));
    await waitFor(() => expect(where().dataset.path).toBe('/clubs/hraci'));
    cleanup();

    apiSource.source = new DemoDataSource({ today: '2026-11-10', profile: { clubId: 'club-1' } });
    mount();
    overview = await openOverview();
    fireEvent.click(within(within(overview).getByTestId('club-actions')).getByRole('button', { name: 'Upravit údaje klubu' }));
    expect(await screen.findByTestId('payer-stub')).toHaveAttribute('data-club', 'club-1');
    cleanup();

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(clubsApi.deactivate).mockResolvedValue(undefined as never);
    mount();
    overview = await openOverview();
    fireEvent.click(within(within(overview).getByTestId('club-actions')).getByRole('button', { name: 'Deaktivovat klub' }));
    await waitFor(() => expect(clubsApi.deactivate).toHaveBeenCalledWith('club-1'));
    await waitFor(() => expect(where().dataset.path).toBe('/clubs'));
    confirm.mockRestore();
  });

  it('"Všechny objednávky" goes to the orders page filtered to this club', async () => {
    mount();
    const overview = await openOverview();
    fireEvent.click(within(overview).getByRole('button', { name: 'Všechny objednávky' }));
    await waitFor(() => expect(where().dataset.path).toBe('/clubs/objednavky'));
    expect(where().dataset.search).toBe('?clubId=club-1');
  });

  it('without a live order the overview is the club\'s whole dialog and says the club has none yet', async () => {
    seed([]);
    apiSource.source = new EmptyDeckSource({ today: '2026-11-10' });
    mount();
    const overview = await openOverview();
    expect(within(overview).getByTestId('club-empty')).toHaveTextContent('Tento klub zatím nemá hromadnou rezervaci.');
    expect(within(overview).getByTestId('club-orders-list')).toHaveTextContent('Zatím žádná objednávka');
    expect(screen.getByRole('dialog', { name: 'Přehled klubu a objednávek' })).toBeInTheDocument();
  });
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('the club screen at %s', (_name, width) => {
  it('has the switcher and the overview in every layout', async () => {
    setViewport(width);
    mount();
    expect(await screen.findByTestId('planner-page')).toHaveAttribute('data-mode', 'club');
    const overview = await openOverview();
    expect(within(overview).getAllByTestId('club-order-row')).toHaveLength(3);
  });
});
