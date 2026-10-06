/*
 * Etapa 10: ONE order = one thing. The order detail shows all its windows once ("Termíny objednávky") and changes
 * them from here: "Změnit hráče" (steppers, what it means for time, the 409 with the athletes and an explicit
 * confirm), "Upravit termíny" (the calendar in pick mode on this order) and a "×" on each upcoming window that
 * takes exactly that window out of the order.
 */
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { ClubOrderError, toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';

const { get, update, invoiceDraft, fetchActivities, toastSuccess, toastError } = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), invoiceDraft: vi.fn(), fetchActivities: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, get, update, invoiceDraft, cancel: vi.fn() } };
});
vi.mock('../../../api/clubBlocks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubBlocks')>();
  return { ...actual, fetchBlockableActivities: fetchActivities };
});
vi.mock('../../../api/clinicSettings', () => ({ readSettings: vi.fn().mockResolvedValue({}) }));
vi.mock('../order/ClubOrderDialog', () => ({ ClubOrderDialog: () => null }));

const { ClubOrderDetailPanel } = await import('./ClubOrderDetailPanel');

const ID = '80e74a6c-0000-4000-8000-000000000001';

const win = (id: string, from: string, to: string, over: Record<string, unknown> = {}) => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['cal-1'], activityIds: [], fromDate: from, toDate: to,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: ID, ...over,
});

const make = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: ID, groupId: ID, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 4, unitPriceCzk: 200 },
      { activityId: 'a-2', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 4, registered: 0, unitPriceCzk: 400 },
    ],
    totalSeats: 14, registered: 4, priceQuote: { listTotalCzk: 4400, discounts: [], totalCzk: 4400 },
    requestedRanges: [], note: '', contact: null, createdBy: 'Staff', history: [], registrationUrl: 'https://app.test/klub/rt', addenda: [],
    blocks: [win('w1', '2099-10-26', '2099-10-27'), win('w2', '2099-10-29', '2099-10-29'), win('w3', '2099-11-10', '2099-11-10')],
    ...over,
  });

function Probe() {
  const location = useLocation();
  return <div data-testid="state">{location.pathname}</div>;
}

let navigated: unknown = null;
function Capture() {
  const location = useLocation();
  useEffect(() => {
    navigated = location.state;
  }, [location.state]);
  return <Probe />;
}

function mount(order: ClubOrderView) {
  get.mockReset().mockResolvedValue(order);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/clubs/objednavky']}>
        <Routes>
          <Route path="/clubs/objednavky" element={<ClubOrderDetailPanel orderId={order.id} onClose={() => undefined} />} />
          <Route path="*" element={<Capture />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ACTIVITIES = [
  { id: 'a-1', name: 'Základní prohlídka', durationMinutes: 30, clinicServiceId: 's-1', colorHex: '#2E7D6B', parallelCapacity: 1 },
  { id: 'a-2', name: 'Komplexní prohlídka', durationMinutes: 60, clinicServiceId: 's-1', colorHex: '#3B6EA8', parallelCapacity: 1 },
  { id: 'a-3', name: 'Rychlá kontrola', durationMinutes: 15, clinicServiceId: 's-1', colorHex: '#999999', parallelCapacity: 1 },
];

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  navigated = null;
  update.mockReset().mockResolvedValue(make());
  invoiceDraft.mockReset().mockResolvedValue({ clubId: 'club-1', groupId: ID, paymentMethod: 'ClubInvoice', headcount: 14, lines: [], discounts: [], listTotalCzk: 0, totalCzk: 0, note: '', invoiceId: null, supplementary: false, alreadyInvoiced: [] });
  fetchActivities.mockReset().mockResolvedValue(ACTIVITIES);
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe.each([['phone'], ['tablet'], ['desktop']] as const)('order detail · %s', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('lists all windows once as "Termíny objednávky", with the two edit buttons up front', async () => {
    mount(make());
    const windows = await screen.findByTestId('confirmed-windows');
    expect(within(windows).getAllByTestId('order-window')).toHaveLength(3);
    expect(windows).toHaveTextContent('26.–27. 10. · 08:00–12:00');
    expect(screen.getByText('Termíny objednávky')).toBeInTheDocument();
    expect(screen.queryByText('Potvrzená okna v kalendáři')).toBeNull();
    const buttons = screen.getByTestId('order-edit-buttons');
    expect(within(buttons).getByRole('button', { name: 'Změnit hráče' })).toBeInTheDocument();
    expect(within(buttons).getByRole('button', { name: 'Upravit termíny' })).toBeInTheDocument();
    /* No "cancel block" for an order-owned window anywhere. */
    expect(screen.queryByRole('button', { name: /Zrušit blok/ })).toBeNull();
  });

  it('"Upravit termíny" opens pick mode on this order with every window', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByRole('button', { name: 'Upravit termíny' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('/planovani'));
    const start = (navigated as { pickOrder: { start: { editOrder: { mode: string; orderId: string; blocks: { id: string }[] }; activities: { activityId: string; seats: number; minutesPerSeat: number }[]; serviceId: string } } }).pickOrder.start;
    expect(start.editOrder.mode).toBe('edit');
    expect(start.editOrder.orderId).toBe(ID);
    expect(start.editOrder.blocks.map((b) => b.id)).toEqual(['w1', 'w2', 'w3']);
    expect(start.serviceId).toBe('s-1');
    expect(start.activities.map((a) => [a.activityId, a.seats, a.minutesPerSeat])).toEqual([['a-1', 10, 30], ['a-2', 4, 60]]);
  });

  it('a "×" on one window keeps the order and sends the other windows in ONE update', async () => {
    const user = userEvent.setup();
    mount(make());
    await user.click(await screen.findByRole('button', { name: /Odebrat termín Čt 29. 10./ }));
    const dialog = await screen.findByTestId('remove-window-dialog');
    expect(dialog).toHaveTextContent('Objednávka zůstane jedna');
    await user.click(within(dialog).getByRole('button', { name: 'Odebrat termín' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(
      ID,
      {
        ranges: [
          { fromDate: '2099-10-26', toDate: '2099-10-27', dailyFrom: '08:00', dailyTo: '12:00' },
          { fromDate: '2099-11-10', toDate: '2099-11-10', dailyFrom: '08:00', dailyTo: '12:00' },
        ],
        calendarIds: ['cal-1'],
      },
      false,
    );
  });

  it('the "×" of the athlete-affecting window shows them and needs an explicit confirm', async () => {
    const user = userEvent.setup();
    update
      .mockRejectedValueOnce(new ClubOrderError('V termínu jsou zapsaní sportovci.', 409, undefined, [{ name: 'Jan Novák', activityName: 'Základní prohlídka' }, { name: 'Eva Malá' }]))
      .mockResolvedValue(make());
    mount(make());
    await user.click(await screen.findByRole('button', { name: /Odebrat termín Čt 29. 10./ }));
    await user.click(within(await screen.findByTestId('remove-window-dialog')).getByRole('button', { name: 'Odebrat termín' }));
    const affected = await screen.findByTestId('remove-window-affected');
    expect(affected).toHaveTextContent('Jan Novák — Základní prohlídka');
    expect(affected).toHaveTextContent('Eva Malá');
    expect(update).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Zrušit rezervace těchto hráčů a odebrat termín' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][2]).toBe(true);
  });

  it('the last window has no usable "×" (cancel the order instead)', async () => {
    mount(make({ blocks: [win('w1', '2099-10-26', '2099-10-26')] }));
    const x = await screen.findByRole('button', { name: /Odebrat termín Po 26\. 10\./ });
    expect(x).toBeDisabled();
  });

  it('a window that is over has no "×"', async () => {
    mount(make({ blocks: [win('old', '2020-01-06', '2020-01-06'), win('w1', '2099-10-26', '2099-10-26'), win('w2', '2099-10-27', '2099-10-27')] }));
    await screen.findByTestId('confirmed-windows');
    expect(screen.getAllByRole('button', { name: /Odebrat termín/ })).toHaveLength(2);
  });
});

describe('Změnit hráče', () => {
  const openDialog = async (order = make()) => {
    const user = userEvent.setup();
    mount(order);
    await user.click(await screen.findByRole('button', { name: 'Změnit hráče' }));
    const dialog = await screen.findByTestId('change-players-dialog');
    await within(dialog).findByLabelText('Počet hráčů, Základní prohlídka');
    return { user, dialog };
  };

  it('steps a činnost, shows the live total and what happens to time, and saves ONE update', async () => {
    const { user, dialog } = await openDialog();
    expect(within(dialog).getByTestId('change-players-total')).toHaveTextContent('Celkem 14 hráčů');
    expect(within(dialog).getByTestId('change-players-time')).toHaveTextContent('Potřeba času se nemění (540 min)');

    await user.click(within(dialog).getByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    await user.click(within(dialog).getByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    expect(within(dialog).getByLabelText('Počet hráčů, Základní prohlídka')).toHaveValue('12');
    expect(within(dialog).getByTestId('change-players-total')).toHaveTextContent('Celkem 16 hráčů');
    expect(within(dialog).getByTestId('change-players-time')).toHaveTextContent('Potřeba času se změní z 540 min na 600 min');
    expect(within(dialog).getByTestId('change-players-enough')).toHaveTextContent('stačí');

    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(ID, { activitySeats: [{ activityId: 'a-1', seats: 12 }, { activityId: 'a-2', seats: 4 }] }, false);
  });

  it('adds and removes a činnost of the same služba', async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('checkbox', { name: /Komplexní prohlídka/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /Rychlá kontrola/ }));
    await user.type(within(dialog).getByLabelText('Počet hráčů, Rychlá kontrola'), '6');
    expect(within(dialog).getByTestId('change-players-total')).toHaveTextContent('Celkem 16 hráčů');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][1]).toEqual({ activitySeats: [{ activityId: 'a-1', seats: 10 }, { activityId: 'a-3', seats: 6 }] });
  });

  it('says how many more slots to add when the windows hold less than needed, and offers "Upravit termíny" with the new numbers', async () => {
    const { user, dialog } = await openDialog();
    const field = within(dialog).getByLabelText('Počet hráčů, Základní prohlídka');
    await user.clear(field);
    await user.type(field, '40');
    const short = await within(dialog).findByTestId('change-players-short');
    expect(short).toHaveTextContent('Termíny objednávky drží 960 min — chybí ještě 12 slotů');
    await user.click(within(short).getByRole('button', { name: 'Upravit termíny' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('/planovani'));
    const start = (navigated as { pickOrder: { start: { activities: { activityId: string; seats: number }[]; editOrder: { mode: string } } } }).pickOrder.start;
    expect(start.editOrder.mode).toBe('edit');
    expect(start.activities.map((a) => [a.activityId, a.seats])).toEqual([['a-1', 40], ['a-2', 4]]);
    /* Nothing was saved by opening the calendar. */
    expect(update).not.toHaveBeenCalled();
  });

  it('below the registered players: the server lists the athletes, an explicit confirm retries with cancelAffectedAthletes', async () => {
    update
      .mockRejectedValueOnce(new ClubOrderError('Počet je nižší než zapsaní hráči.', 409, undefined, [{ name: 'Jan Novák', activityName: 'Základní prohlídka' }, { name: 'Petr Malý', activityName: 'Základní prohlídka' }]))
      .mockResolvedValue(make());
    const { user, dialog } = await openDialog();
    const field = within(dialog).getByLabelText('Počet hráčů, Základní prohlídka');
    await user.clear(field);
    await user.type(field, '2');
    expect(within(dialog).getAllByTestId("seats-registered")[0]).toHaveTextContent("zruší se 2 z 4 zapsaných");
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));

    const affected = await within(dialog).findByTestId('change-players-affected');
    expect(affected).toHaveTextContent('Jan Novák — Základní prohlídka');
    expect(affected).toHaveTextContent('Petr Malý — Základní prohlídka');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][2]).toBe(false);

    await user.click(within(dialog).getByRole('button', { name: 'Zrušit rezervace těchto hráčů a snížit' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]).toEqual([ID, { activitySeats: [{ activityId: 'a-1', seats: 2 }, { activityId: 'a-2', seats: 4 }] }, true]);
  });

  it('changing the numbers after the 409 withdraws the confirmation', async () => {
    update.mockRejectedValueOnce(new ClubOrderError('Nižší než zapsaní.', 409, undefined, [{ name: 'Jan Novák' }]));
    const { user, dialog } = await openDialog();
    const field = within(dialog).getByLabelText('Počet hráčů, Základní prohlídka');
    await user.clear(field);
    await user.type(field, '2');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await within(dialog).findByTestId('change-players-affected');
    await user.click(within(dialog).getByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    expect(within(dialog).queryByTestId('change-players-affected')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Zrušit rezervace těchto hráčů a snížit' })).toBeNull();
  });

  it('nothing to save until a number changes', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('any other refusal is shown in the server\'s words', async () => {
    update.mockRejectedValueOnce(new ClubOrderError('Objednávka už je zrušená.', 400));
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'Přidat hráče, Základní prohlídka' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByTestId('change-players-failure')).toHaveTextContent('Objednávka už je zrušená.');
  });
});

describe('what each status offers', () => {
  it('a Requested order can change players but has no "Upravit termíny" (it is processed instead)', async () => {
    mount(make({ status: 'Requested', blocks: [], requestedRanges: [{ fromDate: '2099-10-26', toDate: '2099-10-26', dailyFrom: '08:00', dailyTo: '12:00' }] }));
    expect(await screen.findByRole('button', { name: 'Změnit hráče' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upravit termíny' })).toBeNull();
    expect(screen.getByText('Požadované termíny')).toBeInTheDocument();
  });

  it('a Completed order offers neither', async () => {
    mount(make({ status: 'Completed' }));
    await screen.findByTestId('order-detail');
    expect(screen.queryByRole('button', { name: 'Změnit hráče' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upravit termíny' })).toBeNull();
  });
});
