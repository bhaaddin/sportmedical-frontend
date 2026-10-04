/*
 * Etapa 5 on the orders list: the "+2 dodatky" chip on a group's root, "Dodatek" on an addendum, and the optional
 * `?clubId=` filter the club page's "Všechny objednávky" points at - at 390 / 834 / 1440.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';

const { list, getAllClubs } = vi.hoisted(() => ({ list: vi.fn(), getAllClubs: vi.fn() }));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list } };
});
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../components/clubs/order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { default: ClubOrdersPage } = await import('./ClubOrdersPage');

const make = (over: Record<string, unknown>) =>
  toOrder({
    clubId: 'club-1', clubName: 'FK Slaný', serviceName: 'Prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [], totalSeats: 5, registered: 0, createdAtUtc: '2026-10-01T10:00:00Z', ...over,
  });

const addendum = (id: string) => ({ id, serviceName: 'Fyzioterapie', status: 'Requested', totalSeats: 4, registered: 0, totalCzk: 100 });

const orders = [
  make({ id: 'root', groupId: 'root', addenda: [addendum('a1'), addendum('a2')], createdAtUtc: '2026-10-03T10:00:00Z' }),
  make({ id: 'a1', parentOrderId: 'root', groupId: 'root', createdAtUtc: '2026-10-02T10:00:00Z' }),
  make({ id: 'one', clubId: 'club-2', clubName: 'HC Kladno', groupId: 'one', addenda: [addendum('b1')], createdAtUtc: '2026-10-01T10:00:00Z' }),
  make({ id: 'lone', clubId: 'club-2', clubName: 'HC Kladno', groupId: 'lone', createdAtUtc: '2026-09-30T10:00:00Z' }),
];

function mount(search = '') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/clubs/objednavky${search}`]}>
        <ClubOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  list.mockReset().mockResolvedValue(orders);
  getAllClubs.mockReset().mockResolvedValue([
    { id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' },
    { id: 'club-2', name: 'HC Kladno', ico: '2', paymentTermsDays: 14, isActive: true, createdAt: '' },
  ]);
});

describe.each([
  ['phone', VIEWPORTS.phone, 'order-card'],
  ['tablet', VIEWPORTS.tablet, 'order-card'],
  ['desktop', VIEWPORTS.desktop, 'order-row'],
] as const)('group chips · %s', (_name, width, rowId) => {
  beforeEach(() => setViewport(width));

  it('marks a root with its addenda count, an addendum with "Dodatek" and leaves a lone order bare', async () => {
    mount();
    const rows = await screen.findAllByTestId(rowId);
    expect(rows).toHaveLength(4);
    const byClub = (text: string) => rows.filter((r) => r.textContent?.includes(text));
    const chips = rows.map((r) => within(r).queryByTestId('group-chip')?.textContent ?? '');
    expect(chips.filter((c) => c === '+2 dodatky')).toHaveLength(1);
    expect(chips.filter((c) => c === '+1 dodatek')).toHaveLength(1);
    expect(chips.filter((c) => c === 'Dodatek')).toHaveLength(1);
    expect(chips.filter((c) => c === '')).toHaveLength(1);
    expect(byClub('HC Kladno')).toHaveLength(2);
  });
});

describe('?clubId=', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('asks the server for that club only and shows it in the club filter', async () => {
    mount('?clubId=club-2');
    await screen.findAllByTestId('order-row');
    expect(list).toHaveBeenCalledWith({ clubId: 'club-2' });
  });

  it('without it the list is not filtered', async () => {
    mount();
    await screen.findAllByTestId('order-row');
    expect(list).toHaveBeenCalledWith({});
  });
});
