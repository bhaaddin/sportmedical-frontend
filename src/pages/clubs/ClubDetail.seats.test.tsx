/*
 * The club counted as one whole (Etapa 3, FE-Y2): "Místa klubu" over all of the
 * club's active blocks - one legacy block (only playerCount) and one with
 * activitySeats - and the per-činnost bars/filter in the block panel, at all
 * three widths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import type { ClubBlockView } from '../../api/clubBlocks';
import type { Club } from '../../api/clubs';
import { blockSeatTotals, clubActivitySeats, seatsSentence, totalsLine } from '../../components/clubs/panel/seats';

const getBlock = vi.fn();
const fetchActivities = vi.fn();

vi.mock('../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubBlocks')>();
  return {
    ...actual,
    clubBlocksApi: { get: getBlock, update: vi.fn(), cancel: vi.fn(), calculate: vi.fn().mockResolvedValue({}), create: vi.fn(), list: vi.fn() },
    fetchBlockableActivities: fetchActivities,
  };
});
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clubs')>();
  return { ...actual, clubSettingsApi: { get: vi.fn().mockResolvedValue({ registrationLinkValidityDays: 14, minimumPlayers: null }), put: vi.fn() } };
});
vi.mock('../../api/partnerOrders', () => ({ partnerOrdersApi: { list: vi.fn(), setItems: vi.fn() } }));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { range: vi.fn().mockResolvedValue([]) } }));

const { ClubDetail } = await import('./ClubDetail');
const { ClubCard } = await import('./ClubCard');
const { buildClubRow } = await import('./clubRow');

const club: Club = {
  id: 'club-1', name: 'FK Slaný', ico: '', contactPerson: '', contactPhone: '', contactEmail: 'klub@fkslany.cz', discountPercent: 0, isActive: true,
} as unknown as Club;

const base: ClubBlockView = {
  id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: [], activityIds: ['a-1'],
  fromDate: '2099-10-26', toDate: '2099-11-03', dailyFrom: null, dailyTo: null, playerCount: 10, seats: 10, registered: 3,
  status: 'Active', registrationToken: 'tok1', registrationUrl: 'https://app.test/klub/tok1', note: null, createdAtUtc: null, athletes: [],
};
const legacy: ClubBlockView = { ...base };
const seated = {
  ...base,
  id: 'b-2', name: 'Podzim', activityIds: ['a-1', 'a-2'], playerCount: 70, seats: 70, registered: 38, registrationToken: 'tok2', registrationUrl: 'https://app.test/klub/tok2',
  activitySeats: [
    { activityId: 'a-1', activityName: 'Základní sportovní prohlídka', seats: 10, registered: 4 },
    { activityId: 'a-2', activityName: 'Diagnostika', seats: 60, registered: 34 },
  ],
  athletes: [
    { id: 'p1', name: 'Jan Novák', activityId: 'a-1', activityName: 'Základní sportovní prohlídka', startUtc: '2099-10-26T09:00:00Z', endUtc: null, status: 'Booked', phone: null },
    { id: 'p2', name: 'Petr Malý', activityId: 'a-2', activityName: 'Diagnostika', startUtc: '2099-10-26T10:00:00Z', endUtc: null, status: 'Booked', phone: null },
  ],
} as ClubBlockView;
const blocks = [legacy, seated];

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

const rowOf = () => buildClubRow(club, [], blocks, '2099-10-01');

const openDetail = () =>
  render(
    <Wrap>
      <ClubDetail
        row={rowOf()} clubs={[club]} allBlocks={blocks} priceOf={() => null} pricesReady focusBlockId={null}
        onBack={vi.fn()} onEdit={vi.fn()} onDeactivate={vi.fn()} onReload={vi.fn()} onInvoice={vi.fn()} onNewReservation={vi.fn()} onNewBlock={vi.fn()}
      />
    </Wrap>,
  );

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getBlock.mockReset().mockImplementation(async (id: string) => blocks.find((b) => b.id === id));
  fetchActivities.mockReset().mockResolvedValue([
    { id: 'a-1', name: 'Základní sportovní prohlídka', durationMinutes: 30, clinicServiceId: 's', colorHex: '#000', parallelCapacity: 1 },
    { id: 'a-2', name: 'Diagnostika', durationMinutes: 60, clinicServiceId: 's', colorHex: '#000', parallelCapacity: 1 },
  ]);
});

describe('seat arithmetic', () => {
  it('sums a legacy block and a block with activitySeats per činnost', () => {
    expect(blockSeatTotals(legacy)).toEqual({ seats: 10, registered: 3, free: 7 });
    expect(blockSeatTotals(seated)).toEqual({ seats: 70, registered: 38, free: 32 });
    const rows = clubActivitySeats(blocks, (id) => (id === 'a-1' ? 'Základní sportovní prohlídka' : ''));
    expect(rows.map((r) => [r.activityId, r.seats, r.registered])).toEqual([['a-1', 20, 7], ['a-2', 60, 34]]);
    expect(seatsSentence(rows[0])).toBe('Základní sportovní prohlídka: 20 míst, 13 volných');
    expect(totalsLine({ seats: 80, registered: 41, free: 39 })).toBe('Celkem 80 míst · 41 zapsáno · 39 volno');
  });

  it('says "10 míst, 3 volná" the Czech way and "obsazeno" when nothing is left', () => {
    expect(seatsSentence({ activityId: 'x', activityName: 'Základní sportovní prohlídka', seats: 10, registered: 7 })).toBe('Základní sportovní prohlídka: 10 míst, 3 volná');
    expect(seatsSentence({ activityId: 'x', activityName: 'Diagnostika', seats: 5, registered: 5 })).toBe('Diagnostika: 5 míst, obsazeno');
  });
});

describe.each(Object.entries(VIEWPORTS))('club overview at %s (%ipx)', (_name, width) => {
  beforeEach(() => setViewport(width));

  it('shows the whole club: a row per činnost, bars and a total row', async () => {
    openDetail();
    const card = await screen.findByTestId('club-seats-card');
    expect(within(card).getByTestId('club-seats-total')).toHaveTextContent('Celkem 80 míst · 41 zapsáno · 39 volno');
    await waitFor(() => expect(within(card).getAllByTestId('club-seats-row')).toHaveLength(2));
    const rows = within(card).getAllByTestId('club-seats-row');
    expect(rows[0]).toHaveTextContent('Základní sportovní prohlídka');
    expect(within(rows[0]).getAllByRole('cell').map((c) => c.textContent).slice(1, 4)).toEqual(['20', '7', '13']);
    expect(within(rows[1]).getAllByRole('cell').map((c) => c.textContent).slice(1, 4)).toEqual(['60', '34', '26']);
    expect(Number(within(rows[1]).getByRole('progressbar').getAttribute('aria-valuenow'))).toBeCloseTo(56.67, 1);
    expect(within(within(card).getByTestId('club-seats-sum')).getAllByRole('cell').map((c) => c.textContent).slice(0, 4)).toEqual(['Celkem', '80', '41', '39']);
    const analysis = within(card).getByTestId('club-seats-analysis');
    expect(analysis).toHaveTextContent('Základní sportovní prohlídka: 20 míst, 13 volných');
    expect(analysis).toHaveTextContent('Diagnostika: 60 míst, 26 volných');
  });

  it('the block with activitySeats draws one bar per činnost and filters the athletes', async () => {
    const user = userEvent.setup();
    openDetail();
    const panel = (await screen.findAllByTestId('club-block-panel')).find((p) => p.getAttribute('data-block-id') === 'b-2')!;
    const bars = within(panel).getAllByTestId('seat-bar');
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveTextContent('4 / 10');
    expect(bars[1]).toHaveTextContent('34 / 60');
    expect(within(panel).getByTestId('block-seats-summary')).toHaveTextContent('Obsazeno 38 z 70 míst');

    await waitFor(() => expect(within(panel).getAllByTestId('block-athlete')).toHaveLength(2));
    const group = within(panel).getByRole('group', { name: 'Filtr činnosti' });
    expect(within(group).getByRole('button', { name: 'Vše' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(group).getByRole('button', { name: 'Diagnostika' }));
    const left = within(panel).getAllByTestId('block-athlete');
    expect(left).toHaveLength(1);
    expect(left[0]).toHaveTextContent('Petr Malý');
    expect(within(panel).getByRole('button', { name: /Stáhnout seznam/ })).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Vše' }));
    expect(within(panel).getAllByTestId('block-athlete')).toHaveLength(2);
  });

  it('the legacy block keeps its single bar and has no činnost filter', async () => {
    openDetail();
    const panel = (await screen.findAllByTestId('club-block-panel')).find((p) => p.getAttribute('data-block-id') === 'b-1')!;
    expect(within(panel).getByText('Obsazeno 3 z 10 míst')).toBeInTheDocument();
    expect(within(panel).queryByTestId('seat-bar')).toBeNull();
    expect(within(panel).queryByRole('group', { name: 'Filtr činnosti' })).toBeNull();
  });
});

describe('club card', () => {
  it('shows the club total of registered / seats', () => {
    render(<Wrap><ClubCard row={rowOf()} ordersLoading={false} onOpen={vi.fn()} /></Wrap>);
    expect(screen.getByText('41 / 80')).toBeInTheDocument();
    expect(screen.getByText('zapsáno / míst')).toBeInTheDocument();
  });
});
