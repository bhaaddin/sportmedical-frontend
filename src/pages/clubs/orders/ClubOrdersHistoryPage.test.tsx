/*
 * Kluby > Objednávky > Historie (R21): the special view of the cancelled orders, at 390 / 834 / 1440 - only cancelled
 * orders, search by club or code, the club and the cancelled-day filters, the empty states in Czech, "Otevřít" shows the
 * order READ-ONLY, "Zpět na objednávky" leaves; and the two routes (`/clubs/objednavky/historie` vs
 * `/clubs/objednavky/:orderId/historie`) never meet.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';

const { list, get, getAllClubs } = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), getAllClubs: vi.fn() }));

vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list, get } };
});
vi.mock('../../../api/clubs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubs')>();
  return { ...actual, clubsApi: { ...actual.clubsApi, getAll: getAllClubs } };
});
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../components/clubs/order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { default: ClubOrdersHistoryPage } = await import('./ClubOrdersHistoryPage');

const make = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: 'o-1', groupId: 'o-1', clubId: 'club-1', clubName: 'FK Slaný', clubColorHex: '#2E7D6B', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Cancelled', paymentMethod: 'ClubInvoice',
    activitySeats: [{ activityId: 'a-1', activityName: 'Základní', durationMinutes: 30, seats: 20, registered: 0, unitPriceCzk: 1000 }],
    totalSeats: 20, registered: 0, priceQuote: null,
    requestedRanges: [{ fromDate: '2026-11-02', toDate: '2026-11-04' }], blocks: [], note: '', contact: null,
    formToken: 'ft', formUrl: 'https://app.test/klub-objednavka/ft', registrationToken: 'rt', registrationUrl: 'https://app.test/klub/rt',
    createdBy: 'Staff', createdAtUtc: '2026-10-01T10:00:00Z',
    history: [
      { atUtc: '2026-10-01T10:00:00Z', user: 'Jana', text: 'Objednávka vytvořena' },
      { atUtc: '2026-10-05T14:30:00Z', user: 'Jana', text: 'Objednávka zrušena: klub změnil termín' },
    ],
    ...over,
  });

const orders = [
  make(),
  make({ id: 'o-2', groupId: 'o-2', clubId: 'club-2', clubName: 'HC Kladno', createdAtUtc: '2026-10-02T10:00:00Z', history: [{ atUtc: '2026-10-12T08:00:00Z', user: 'Eva', text: 'Zrušeno' }] }),
  make({ id: 'o-3', groupId: 'o-3', status: 'Confirmed', clubName: 'FK Slaný' }),
  make({ id: 'o-4', groupId: 'o-4', status: 'Requested', clubId: 'club-2', clubName: 'HC Kladno' }),
];

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{location.pathname}{location.search}</div>;
}

function Wrap({ children, entry = '/clubs/objednavky/historie' }: { children: ReactNode; entry?: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/clubs/objednavky/historie" element={children} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  list.mockReset().mockResolvedValue(orders);
  get.mockReset().mockImplementation(async (id: string) => orders.find((o) => o.id === id));
  getAllClubs.mockReset().mockResolvedValue([
    { id: 'club-1', name: 'FK Slaný', ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '' },
    { id: 'club-2', name: 'HC Kladno', ico: '2', paymentTermsDays: 14, isActive: true, createdAt: '' },
  ]);
});

describe.each([
  ['phone', VIEWPORTS.phone, 'history-card'],
  ['tablet', VIEWPORTS.tablet, 'history-card'],
  ['desktop', VIEWPORTS.desktop, 'history-row'],
] as const)('the view at %s', (device, width, testId) => {
  beforeEach(() => setViewport(width));

  it('lists the cancelled orders only, with the day and the reason', async () => {
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    const items = await screen.findAllByTestId(testId);
    expect(items).toHaveLength(2);
    expect(screen.getByTestId('club-orders-history')).toHaveAttribute('data-layout', device);
    /* the newest cancellation first: HC Kladno (12. 10.) before FK Slaný (5. 10.) once their answers are read */
    await waitFor(() => expect(screen.getAllByTestId(testId)[0]).toHaveTextContent('HC Kladno'));
    const text = screen.getAllByTestId(testId).map((i) => i.textContent).join(' | ');
    expect(text).toContain('klub změnil termín');
    expect(text).toContain('Zrušeno');
    expect(text).not.toContain('Odesláno klubem');
  });
});

describe('filters', () => {
  it('searches by club name, accent-insensitive', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    await screen.findAllByTestId('history-row');
    await user.type(screen.getByLabelText('Hledat klub nebo kód'), 'slany');
    expect(screen.getAllByTestId('history-row')).toHaveLength(1);
    expect(screen.getByTestId('history-row')).toHaveTextContent('FK Slaný');
  });

  it('filters by the day it was cancelled', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    await screen.findAllByTestId('history-row');
    await waitFor(() => expect(screen.getAllByTestId('history-row')[0]).toHaveTextContent('HC Kladno'));
    await user.type(screen.getByLabelText('Zrušeno od'), '2026-10-10');
    await waitFor(() => expect(screen.getAllByTestId('history-row')).toHaveLength(1));
    expect(screen.getByTestId('history-row')).toHaveTextContent('HC Kladno');
    await user.type(screen.getByLabelText('Zrušeno do'), '2026-10-11');
    expect(await screen.findByText('Tomuto filtru neodpovídá žádná zrušená objednávka.')).toBeInTheDocument();
  });

  it('?clubId= pre-filters to that club (the club page link)', async () => {
    render(<Wrap entry="/clubs/objednavky/historie?clubId=club-1"><ClubOrdersHistoryPage /></Wrap>);
    await screen.findAllByTestId('history-row');
    expect(list).toHaveBeenCalledWith({ clubId: 'club-1' }, expect.anything());
  });
});

describe('empty and failing', () => {
  it('no cancelled order at all: "Žádné zrušené objednávky."', async () => {
    list.mockResolvedValue([orders[2], orders[3]]);
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    expect(await screen.findByText('Žádné zrušené objednávky.')).toBeInTheDocument();
  });

  it('a failed read says so and retries', async () => {
    list.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    await user.click(await screen.findByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findAllByTestId('history-row')).toHaveLength(2);
  });
});

describe('opening and leaving', () => {
  it('"Otevřít" shows the cancelled order read-only: no actions, only its history', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    await screen.findAllByTestId('history-row');
    await user.click(screen.getAllByRole('button', { name: /^Otevřít objednávku/ })[0]);
    const detail = await screen.findByTestId('order-detail');
    expect(detail).toHaveAttribute('data-status', 'Cancelled');
    expect(within(detail).getByTestId('order-readonly')).toBeInTheDocument();
    expect(screen.queryByTestId('order-actions')).toBeNull();
    expect(screen.getByTestId('order-history-button')).toBeInTheDocument();
  });

  it('a handed-over { openOrderId } opens that order at once', async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[{ pathname: '/clubs/objednavky/historie', state: { openOrderId: 'o-1' } }]}>
          <Routes><Route path="/clubs/objednavky/historie" element={<ClubOrdersHistoryPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('order-detail')).toHaveAttribute('data-status', 'Cancelled');
  });

  it('"Zpět na objednávky" returns to the live list', async () => {
    const user = userEvent.setup();
    render(<Wrap><ClubOrdersHistoryPage /></Wrap>);
    await user.click(await screen.findByRole('button', { name: 'Zpět na objednávky' }));
    expect(await screen.findByTestId('state')).toHaveTextContent('/clubs/objednavky');
  });
});

describe('the two routes never meet', () => {
  function Which() {
    const { orderId } = useParams();
    return <div data-testid="which">{orderId === undefined ? 'cancelled-list' : `one-order:${orderId}`}</div>;
  }
  const at = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clubs/objednavky/historie" element={<Which />} />
        <Route path="/clubs/objednavky/:orderId/historie" element={<Which />} />
        <Route path="/clubs/:clubId" element={<div data-testid="which">club-page</div>} />
        <Route path="/clubs/:clubId/kalendar" element={<div data-testid="which">calendar</div>} />
      </Routes>
    </MemoryRouter>,
  );

  it.each([
    ['/clubs/objednavky/historie', 'cancelled-list'],
    ['/clubs/objednavky/abc-123/historie', 'one-order:abc-123'],
    ['/clubs/objednavky/historie/historie', 'one-order:historie'],
  ])('%s is %s', (path, expected) => {
    at(path);
    expect(screen.getByTestId('which')).toHaveTextContent(expected);
  });

  it('StaffApp declares both addresses, the cancelled-list one before the :orderId one', () => {
    const source = readFileSync('src/StaffApp.tsx', 'utf8');
    const first = source.indexOf('path="/clubs/objednavky/historie"');
    const second = source.indexOf('path="/clubs/objednavky/:orderId/historie"');
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
  });
});
