import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
        row={buildClubRow(c, [], blocks, '2099-10-01')} clubs={[c]} allBlocks={blocks} priceOf={() => null} pricesReady focusBlockId={null} today="2099-10-01"
        onReload={vi.fn()} onInvoice={vi.fn()} onNewReservation={vi.fn()} {...handlers}
      />
    </Wrap>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  summaryMock.mockResolvedValue(summary);
  listMock.mockResolvedValue([
    { id: 'o1', clubId: 'club-1', serviceName: 'Prohlídka', totalSeats: 20, status: 'Confirmed', requestedRanges: [], blocks: [], activitySeats: [] },
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
    expect(screen.getByRole('region', { name: 'Bloky klubu' })).toBeInTheDocument();
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
