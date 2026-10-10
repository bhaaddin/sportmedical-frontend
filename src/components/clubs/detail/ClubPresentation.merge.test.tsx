/*
 * Etapa 12: the club page shows ONE card per group (root + addenda) and offers "Sloučit do jedné objednávky" when the
 * club has two or more live root orders. Three layouts.
 */
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
const mergeMock = vi.fn();

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
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, clubSummary: summaryMock, list: listMock, merge: mergeMock } };
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
const { toOrder, ClubOrderError } = await import('../../../api/clubOrders');

const club = {
  id: 'club-1', name: 'FK Slaný', ico: '12345678', dic: 'CZ12345678', city: 'Slaný', address: 'Sportovní 1', postalCode: '27401',
  contactPerson: 'Karel Trenér', contactEmail: 'k@slany.cz', contactPhone: '+420777111222', paymentTermsDays: 14, discountPercent: 10, colorHex: '#2E7D6B', isActive: true,
} as unknown as Club;

const summary = {
  clubId: 'club-1', totalSeats: 49, registered: 0, remaining: 49, byService: [], byActivity: [],
  ordersByStatus: { Invited: 0, Requested: 0, Confirmed: 3, Completed: 0, Cancelled: 0 }, bookedMinutes: 0, usedMinutes: 0,
};

const ROOT = 'aaaa0000-0000-0000-0000-0000fb9c0686';
const ADD_1 = 'bbbb0000-0000-0000-0000-00009b70b687';
const ADD_2 = 'cccc0000-0000-0000-0000-0000a7da3ffe';

const win = (id: string, orderId: string, from: string, to = from): ClubBlockView => ({
  id, clubId: 'club-1', clubOrderId: orderId, clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['cal-1'], activityIds: [],
  fromDate: from, toDate: to, dailyFrom: '08:00', dailyTo: '12:00', playerCount: 10, seats: 10, registered: 0,
  status: 'Active', registrationToken: 't', registrationUrl: 'https://app.test/klub/t', note: null, createdAtUtc: null, athletes: [],
});

const base = { clubId: 'club-1', clubName: 'FK Slaný', status: 'Confirmed', paymentMethod: 'ClubInvoice', requestedRanges: [], note: '', registered: 0 };
const root = toOrder({
  ...base, id: ROOT, serviceName: 'Sportovní lékařské prohlídky', totalSeats: 27, createdAtUtc: '2099-09-01T10:00:00Z', parentOrderId: null, groupId: ROOT,
  addenda: [{ id: ADD_1, serviceName: 'Sportovní diagnostika', status: 'Confirmed', totalSeats: 16, registered: 0, totalCzk: 8000 }],
  priceQuote: { listTotalCzk: 20000, discounts: [], totalCzk: 18000 },
  activitySeats: [
    { activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 9, registered: 0, unitPriceCzk: 500 },
    { activityId: 'a2', activityName: 'Komplexní', durationMinutes: 60, seats: 7, registered: 0, unitPriceCzk: 1000 },
    { activityId: 'a3', activityName: 'Spiroergometrie', durationMinutes: 60, seats: 11, registered: 0, unitPriceCzk: 1000 },
  ],
  blocks: [win('w1', ROOT, '2099-11-10'), win('w2', ROOT, '2099-11-20')],
});
const addendum = toOrder({
  ...base, id: ADD_1, serviceName: 'Sportovní diagnostika', totalSeats: 16, createdAtUtc: '2099-09-02T10:00:00Z', parentOrderId: ROOT, groupId: ROOT, addenda: [],
  priceQuote: { listTotalCzk: 9000, discounts: [], totalCzk: 8000 },
  activitySeats: [{ activityId: 'd1', activityName: 'Diagnostika', durationMinutes: 45, seats: 16, registered: 0, unitPriceCzk: 500 }],
  blocks: [win('w3', ADD_1, '2099-11-05'), win('w4', ADD_1, '2099-11-15')],
});
const other = toOrder({
  ...base, id: ADD_2, serviceName: 'Sportovní lékařské prohlídky', totalSeats: 6, createdAtUtc: '2099-09-03T10:00:00Z', parentOrderId: null, groupId: ADD_2, addenda: [],
  priceQuote: { listTotalCzk: 3000, discounts: [], totalCzk: 3000 },
  activitySeats: [{ activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 6, registered: 0, unitPriceCzk: 500 }],
  blocks: [win('w5', ADD_2, '2099-12-01')],
});

function Wrap({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

const handlers = { onBack: vi.fn(), onEdit: vi.fn(), onDeactivate: vi.fn(), onNewOrder: vi.fn(), onOpenOrder: vi.fn(), onReload: vi.fn() };

function open() {
  return render(
    <Wrap>
      <ClubPresentation
        row={buildClubRow(club, [], [], '2099-10-01')} priceOf={() => null} pricesReady focusBlockId={null} today="2099-10-01"
        onInvoice={vi.fn()} onNewReservation={vi.fn()} {...handlers}
      />
    </Wrap>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  summaryMock.mockResolvedValue(summary);
});

describe.each(['phone', 'tablet', 'desktop'] as const)('one group, one card at %s', (name) => {
  it('folds the root and its addendum into one card: services listed, pills merged in date order, totals summed', async () => {
    setViewport(VIEWPORTS[name]);
    listMock.mockResolvedValue([addendum, root, other]);
    open();
    const cards = await screen.findAllByTestId('club-order-card');
    /* two groups: the root with its addendum, and the lone order - never a card for the addendum */
    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.getAttribute('data-order-id'))).toEqual([ROOT, ADD_2]);

    const card = cards[0];
    expect(card).toHaveAttribute('data-addenda', '1');
    expect(within(card).getByText('Objednávka KO-FB9C0686')).toBeInTheDocument();
    expect(card).toHaveTextContent('Potvrzeno');
    const services = within(card).getAllByTestId('order-card-service');
    expect(services.map((s) => s.textContent)).toEqual([
      'Sportovní lékařské prohlídky · Základní 0/9 · Komplexní 0/7 · Spiroergometrie 0/11 (27 hráčů)',
      'Sportovní diagnostika · Diagnostika 0/16 (16 hráčů)',
    ]);
    expect(within(card).getByTestId('order-card-payment')).toHaveTextContent('Platba: Platí klub (jedna faktura) · 26 000 Kč');
    expect(within(card).getByText('Termíny (4 termíny)')).toBeInTheDocument();
    const pills = within(card).getAllByTestId('order-window').map((p) => p.textContent);
    expect(pills).toEqual(['Čt 5. 11. · 08:00–12:00', 'Út 10. 11. · 08:00–12:00', 'Ne 15. 11. · 08:00–12:00', 'Pá 20. 11. · 08:00–12:00']);
    /* one button row, for the root */
    for (const label of ['Přidat hráče / rozšířit', 'Odebrat hráče', 'Upravit termíny', 'Zrušit objednávku', 'Otevřít']) {
      expect(within(card).getAllByRole('button', { name: label })).toHaveLength(1);
    }

    /* the lone order keeps the single-order card */
    expect(cards[1]).toHaveAttribute('data-addenda', '0');
    expect(within(cards[1]).getByTestId('order-card-seats')).toHaveTextContent('Základní 0/6 (6 hráčů)');
  });

  it('hides "Sloučit do jedné objednávky" with a single live group and shows it from two', async () => {
    setViewport(VIEWPORTS[name]);
    listMock.mockResolvedValue([root, addendum]);
    const { unmount } = open();
    await screen.findByTestId('club-order-card');
    expect(screen.queryByTestId('merge-orders-button')).toBeNull();
    unmount();

    listMock.mockResolvedValue([root, addendum, other]);
    open();
    await screen.findAllByTestId('club-order-card');
    expect(screen.getByRole('button', { name: 'Sloučit do jedné objednávky' })).toBeInTheDocument();
  });

  it('merges from the page: the oldest Confirmed root is the main one, the body carries the ticked ids, success reloads', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    listMock.mockResolvedValue([other, root, addendum]);
    mergeMock.mockResolvedValue({ ...root, addenda: [...root.addenda, { id: ADD_2, serviceName: 'Sportovní lékařské prohlídky', status: 'Confirmed', totalSeats: 6, registered: 0, totalCzk: 3000 }] });
    open();
    await user.click(await screen.findByRole('button', { name: 'Sloučit do jedné objednávky' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sloučit do jedné objednávky' });
    expect(within(dialog).getByRole('radio', { name: 'Hlavní objednávka KO-FB9C0686' })).toBeChecked();
    /* the addendum is not offered - only roots are */
    expect(within(dialog).queryByText(/KO-9B70B687/)).toBeNull();
    const confirm = within(dialog).getByRole('button', { name: 'Sloučit' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Sloučit KO-A7DA3FFE' }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(mergeMock).toHaveBeenCalledWith(ROOT, [ADD_2]));
    await waitFor(() => expect(handlers.onReload).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Sloučit do jedné objednávky' })).toBeNull());
  });

  it('shows the server\'s Czech refusal next to the order it names and keeps the dialog open', async () => {
    setViewport(VIEWPORTS[name]);
    const user = userEvent.setup();
    listMock.mockResolvedValue([root, addendum, other]);
    const refused = new ClubOrderError('Objednávka už je vyfakturovaná, sloučit ji nelze.', 409, 'club_order.merge_invoiced');
    refused.orderId = ADD_2;
    mergeMock.mockRejectedValue(refused);
    open();
    await user.click(await screen.findByRole('button', { name: 'Sloučit do jedné objednávky' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sloučit do jedné objednávky' });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Sloučit KO-A7DA3FFE' }));
    await user.click(within(dialog).getByRole('button', { name: 'Sloučit' }));
    const rowError = await within(dialog).findByTestId('merge-row-error');
    expect(rowError).toHaveTextContent('Objednávka už je vyfakturovaná, sloučit ji nelze.');
    expect(within(dialog).getByTestId('merge-pick-row')).toContainElement(rowError);
    expect(handlers.onReload).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Sloučit do jedné objednávky' })).toBeInTheDocument();
  });
});
