/*
 * "Přidat do objednávky klubu" (Etapa 12): a plain mark in the calendar attached to a club order that already
 * exists. Club first, then one of its live orders (filtered to the calendar's single visible service when there is
 * one), optional per-window routing chips, ONE `update` call that merges the mark into the order's own windows, the
 * same 409-affected-athletes retry as the rest of the order edits, and `invalidateClubWorld` on success.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { ClubOrderError, toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import type { PickedRange } from './multiSelect';

const { getAllClubs, list, update, toastSuccess, toastError, invalidateClubWorld, apptRange, apptAvail, apptResched } = vi.hoisted(() => ({
  apptRange: vi.fn(),
  apptAvail: vi.fn(),
  apptResched: vi.fn(),
  getAllClubs: vi.fn(),
  list: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  invalidateClubWorld: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-hot-toast', () => ({ default: { success: toastSuccess, error: toastError } }));
vi.mock('../../../api/clubs', () => ({ clubsApi: { getAll: getAllClubs } }));
vi.mock('../../../api/clubOrders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list, update } };
});
vi.mock('../../../api/appointments', () => ({ appointmentsApi: { range: apptRange, getAvailability: apptAvail, reschedule: apptResched } }));
vi.mock('../../clubs/clubWorld', () => ({ invalidateClubWorld }));

const { AddToClubOrderDialog } = await import('./AddToClubOrderDialog');

const CALENDARS = [
  { id: 'cal-1', name: 'Sportovní prohlídky', color: '#1565C0', sortOrder: 0, clinicServiceId: 's-1', location: '', displayStepMinutes: 30, isActive: true, publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null },
  { id: 'cal-2', name: 'Sportovní prohlídky 2', color: '#2E7D32', sortOrder: 1, clinicServiceId: 's-1', location: '', displayStepMinutes: 30, isActive: true, publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null },
];

const CLUBS = [
  { id: 'club-1', name: 'FK Slaný', ico: '00000001', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01' },
  { id: 'club-2', name: 'TJ Sokol', ico: '00000002', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01' },
];

const win = (id: string, from: string, to: string, over: Record<string, unknown> = {}) => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['cal-1'], activityIds: [], fromDate: from, toDate: to,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: 'o-1', ...over,
});

const make = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: 'o-1', groupId: 'o-1', clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Sportovní prohlídky',
    status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 4, unitPriceCzk: 200 },
      { activityId: 'a-2', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 4, registered: 0, unitPriceCzk: 400 },
    ],
    totalSeats: 14, registered: 4, priceQuote: null,
    requestedRanges: [], note: '', contact: null, createdBy: 'Staff', history: [], registrationUrl: 'https://app.test/klub/rt', addenda: [],
    blocks: [win('w1', '2026-10-26', '2026-10-26')],
    ...over,
  });

const TODAY = '2026-10-20';
const MARKED_TIME: PickedRange = { id: 'm1', kind: 'time', columnKey: 'cal-2', calendarId: 'cal-2', activityId: null, dayKey: '2026-11-05', range: { start: 9 * 60, end: 10 * 60 } };

function mount(over: Partial<Parameters<typeof AddToClubOrderDialog>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onAdded = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <AddToClubOrderDialog marked={MARKED_TIME} calendars={CALENDARS} serviceId="s-1" today={TODAY} onClose={onClose} onAdded={onAdded} {...over} />
    </QueryClientProvider>,
  );
  return { onClose, onAdded };
}

async function chooseClub(name = 'FK Slaný') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Klub' }));
  await user.click(await screen.findByRole('option', { name }));
  return user;
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getAllClubs.mockReset().mockResolvedValue(CLUBS);
  list.mockReset().mockResolvedValue([make()]);
  update.mockReset().mockResolvedValue(make());
  toastSuccess.mockClear();
  toastError.mockClear();
  invalidateClubWorld.mockClear();
  apptRange.mockReset().mockResolvedValue([]);
  apptAvail.mockReset().mockResolvedValue([]);
  apptResched.mockReset().mockResolvedValue(null);
});

describe('club and order pick', () => {
  it('lists only the club\'s Requested/Confirmed orders of the shown service, as "KO-… · služba · split · N termínů"', async () => {
    list.mockResolvedValue([
      make({ id: 'o-1', status: 'Confirmed' }),
      make({ id: 'o-2', status: 'Cancelled' }),
      make({ id: 'o-3', status: 'Completed' }),
      make({ id: 'o-4', status: 'Requested', serviceId: 's-2', serviceName: 'Fyzioterapie' }),
    ]);
    mount();
    await chooseClub();
    const rows = await screen.findAllByTestId('add-to-club-order-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Sportovní prohlídky');
    expect(rows[0]).toHaveTextContent('1 termín');
    expect(rows[0]).toHaveTextContent('Základní 10 · Komplexní 4');
  });

  it('shows every live order (with its service name) when no single service is shown', async () => {
    list.mockResolvedValue([make({ id: 'o-1' }), make({ id: 'o-4', serviceId: 's-2', serviceName: 'Fyzioterapie' })]);
    mount({ serviceId: null });
    await chooseClub();
    const rows = await screen.findAllByTestId('add-to-club-order-row');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Sportovní prohlídky'), expect.stringContaining('Fyzioterapie')]),
    );
  });

  it('a club with no live order shows a calm empty state, never a false match', async () => {
    list.mockResolvedValue([make({ status: 'Cancelled' })]);
    mount();
    await chooseClub();
    expect(await screen.findByTestId('add-to-club-empty')).toHaveTextContent(
      'Tento klub nemá žádnou otevřenou objednávku. Založte novou přes Klubová objednávka.',
    );
    expect(screen.queryByTestId('add-to-club-order-row')).toBeNull();
    /* Never a path to create one from here - the text only points at the real entry point. */
    expect(screen.queryByRole('button', { name: /Klubová objednávka/i })).toBeNull();
  });

  it('never offers to create a new order from inside this dialog', async () => {
    mount();
    await chooseClub();
    await userEvent.setup().click(await screen.findByTestId('add-to-club-order-row'));
    expect(screen.queryByRole('button', { name: /nebo založit novou/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /telefonická objednávka/i })).toBeNull();
  });
});

describe('activity routing chips', () => {
  it('default to all, "at least one" stays on when the other is toggled off', async () => {
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    const chips = await screen.findByTestId('add-to-club-chips');
    expect(within(chips).getByTestId('add-to-club-chip-all')).toHaveAttribute('aria-pressed', 'true');
    const activityChips = within(chips).getAllByTestId('add-to-club-chip');
    expect(activityChips).toHaveLength(2);
    expect(activityChips.every((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);

    await user.click(activityChips[0]);
    expect(within(chips).getByTestId('add-to-club-chip-all')).toHaveAttribute('aria-pressed', 'false');
    expect(within(chips).getAllByTestId('add-to-club-chip')[0]).toHaveAttribute('aria-pressed', 'false');
    expect(within(chips).getAllByTestId('add-to-club-chip')[1]).toHaveAttribute('aria-pressed', 'true');

    /* The one still on cannot be turned off: a window must allow at least one činnost. */
    await user.click(within(chips).getAllByTestId('add-to-club-chip')[1]);
    expect(within(chips).getAllByTestId('add-to-club-chip')[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('no chips when the order has only one routable činnost', async () => {
    list.mockResolvedValue([make({ activitySeats: [{ activityId: 'a-1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 10, registered: 4, unitPriceCzk: 200 }] })]);
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await screen.findByTestId('add-to-club-selected');
    expect(screen.queryByTestId('add-to-club-chips')).toBeNull();
  });
});

describe('saving the merge', () => {
  it('sends ONE update with the order\'s own window plus the marked range, seats untouched', async () => {
    const { onAdded } = mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await user.click(screen.getByTestId('add-to-club-confirm'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(
      'o-1',
      {
        ranges: [
          { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00' },
          { fromDate: '2026-11-05', toDate: '2026-11-05', dailyFrom: '09:00', dailyTo: '10:00' },
        ],
        calendarIds: ['cal-1', 'cal-2'],
      },
      false,
    );
    await waitFor(() => expect(invalidateClubWorld).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('KO-'));
    expect(onAdded).toHaveBeenCalled();
  });

  it('a window restricted to one činnost sends its activityIds', async () => {
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    const chips = await screen.findByTestId('add-to-club-chips');
    await user.click(within(chips).getAllByTestId('add-to-club-chip')[0]);
    await user.click(screen.getByTestId('add-to-club-confirm'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    const sent = update.mock.calls[0][1] as { ranges: { activityIds?: string[] }[] };
    expect(sent.ranges[1].activityIds).toEqual(['a-2']);
    expect(sent.ranges[0].activityIds).toBeUndefined();
  });

  it('a collision shows the server\'s refusal and names the range', async () => {
    update.mockRejectedValueOnce(new ClubOrderError('V tomto čase je už obsazeno.', 400));
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await user.click(screen.getByTestId('add-to-club-confirm'));
    expect(await screen.findByTestId('add-to-club-failure')).toHaveTextContent('V tomto čase je už obsazeno.');
  });

  it('a 409 with affected athletes lists them; confirming retries with cancelAffectedAthletes', async () => {
    update
      .mockRejectedValueOnce(new ClubOrderError('V termínu jsou zapsaní sportovci.', 409, undefined, [{ name: 'Jan Novák', activityName: 'Základní prohlídka' }]))
      .mockResolvedValue(make());
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await user.click(screen.getByTestId('add-to-club-confirm'));
    const affected = await screen.findByTestId('add-to-club-affected');
    expect(affected).toHaveTextContent('Jan Novák — Základní prohlídka');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][2]).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Potvrdit a zrušit rezervace' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1][2]).toBe(true);
  });

  it('the confirm button is disabled until an order is chosen', async () => {
    mount();
    expect(screen.getByTestId('add-to-club-confirm')).toBeDisabled();
    await chooseClub();
    expect(screen.getByTestId('add-to-club-confirm')).toBeDisabled();
  });
});

describe('R4: the worker is busy (worker.busy) - the owner may go over it with a reason', () => {
  const busyError = (over: Record<string, unknown> = {}) => {
    const e = new ClubOrderError('Pracovník je zaneprázdněn.', 409, 'worker.busy');
    e.details = { conflictKind: 'appointment', calendarName: 'Diagnostika', activityName: 'Spiroergometrie', startUtc: '2026-11-05T08:00:00Z', endUtc: '2026-11-05T08:45:00Z', overridable: true, conflictCount: 1, ...over };
    return e;
  };
  async function reachSave() {
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await user.click(screen.getByTestId('add-to-club-confirm'));
    return user;
  }

  it('names the clash (calendar, činnost, time - never a patient) and, for a user who may, offers the override with a reason', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    update.mockRejectedValueOnce(busyError());
    mount();
    const user = await reachSave();
    expect(await screen.findByTestId('worker-busy-message')).toHaveTextContent('Spiroergometrie v kalendáři Diagnostika');
    expect(screen.queryByTestId('add-to-club-failure')).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Přesto potvrdit (správce)' });
    expect(confirm).toBeDisabled(); // a reason is needed
    await user.type(screen.getByLabelText('Důvod výjimky'), 'dohodnuto s lékařem');
    update.mockResolvedValueOnce(make());
    await user.click(confirm);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(update.mock.calls[1]).toEqual(['o-1', expect.any(Object), false, 'dohodnuto s lékařem']);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(screen.queryByTestId('worker-busy')).toBeNull();
    window.localStorage.removeItem('permissions');
  });

  it('the first save never carries a reason (the override is only ever a second, deliberate step)', async () => {
    update.mockRejectedValueOnce(busyError());
    mount();
    await reachSave();
    await screen.findByTestId('worker-busy');
    expect(update.mock.calls[0]).toHaveLength(3);
  });

  it('somebody who may not override is told to ask the owner and gets no override control', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.edit']));
    update.mockRejectedValueOnce(busyError());
    mount();
    await reachSave();
    await screen.findByTestId('worker-busy');
    expect(screen.queryByTestId('worker-busy-override')).toBeNull();
    expect(screen.getByText('Přepsat zaneprázdněného pracovníka smí jen správce.')).toBeInTheDocument();
    window.localStorage.removeItem('permissions');
  });

  it('a refused override (403 worker.busy.override_forbidden) says so and keeps the clash on screen', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    update.mockRejectedValueOnce(busyError());
    mount();
    const user = await reachSave();
    await user.type(await screen.findByLabelText('Důvod výjimky'), 'důvod');
    update.mockRejectedValueOnce(new ClubOrderError('x', 403, 'worker.busy.override_forbidden'));
    await user.click(screen.getByRole('button', { name: 'Přesto potvrdit (správce)' }));
    expect(await screen.findByTestId('worker-busy-forbidden')).toBeInTheDocument();
    expect(screen.getByTestId('worker-busy-message')).toBeInTheDocument();
    window.localStorage.removeItem('permissions');
  });

  it('a clash the server says is not overridable has no override either', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    update.mockRejectedValueOnce(busyError({ overridable: false }));
    mount();
    await reachSave();
    await screen.findByTestId('worker-busy');
    expect(screen.queryByTestId('worker-busy-override')).toBeNull();
    window.localStorage.removeItem('permissions');
  });
});

describe('R24: bookings stand in the club way - one flow instead of "move them first"', () => {
  /* the marked range: 2026-11-05 09:00-10:00 Prague (CET = 08:00-09:00Z) on cal-2 */
  const booking = (id: string, from: string, to: string, name: string) => ({
    id, calendarId: 'cal-2', patientId: 'p', activityId: 'a-1', activityName: 'Základní prohlídka', startUtc: `2026-11-05T${from}:00Z`, endUtc: `2026-11-05T${to}:00Z`, status: 0, patientName: name,
  });
  const slot = (from: string) => ({ startUtc: `2026-11-05T${from}:00Z`, endUtc: `2026-11-05T${from}:00Z` });
  const refuse = () => update.mockRejectedValueOnce(new ClubOrderError('Čas je už obsazený.', 409, 'scheduling.booking.time_taken'));

  async function openConflict() {
    refuse();
    apptRange.mockResolvedValueOnce([]); /* the look BEFORE saving finds nothing; the server's own 409 is what sends the staff to the step */
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await user.click(screen.getByTestId('add-to-club-confirm'));
    await screen.findByTestId('club-conflict');
    return user;
  }

  it('lists the colliding bookings (name, činnost) with a proposed slot each, and moves nothing before the button', async () => {
    apptRange.mockResolvedValue([booking('b1', '08:00', '08:30', 'Jana Nováková'), booking('b2', '08:30', '09:00', 'Petr Svoboda'), booking('far', '12:00', '12:30', 'Mimo Čas')]);
    apptAvail.mockResolvedValue([slot('09:00'), slot('10:00'), slot('11:00'), slot('07:00')]);
    await openConflict();
    const list = await screen.findByTestId('club-conflict-list');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(list).toHaveTextContent('Jana Nováková');
    expect(list).toHaveTextContent('Petr Svoboda');
    expect(list).toHaveTextContent('Základní prohlídka');
    expect(list).not.toHaveTextContent('Mimo Čas');
    await screen.findByTestId('club-conflict-to-b1');
    expect(screen.getByTestId('club-conflict-to-b2')).toBeInTheDocument();
    expect(apptResched).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('"Přesunout a pokračovat" reschedules each with its own notify choice, then places the club again', async () => {
    apptRange.mockResolvedValue([booking('b1', '08:00', '08:30', 'Jana Nováková'), booking('b2', '08:30', '09:00', 'Petr Svoboda')]);
    apptAvail.mockResolvedValue([slot('07:00'), slot('07:30'), slot('10:00')]);
    const user = await openConflict();
    await screen.findByTestId('club-conflict-to-b2');
    const row1 = screen.getByTestId('club-conflict-b1');
    const box1 = within(row1).getByRole('checkbox');
    if (!(box1 as HTMLInputElement).checked) await user.click(box1);
    const box2 = within(screen.getByTestId('club-conflict-b2')).getByRole('checkbox') as HTMLInputElement;
    if (box2.checked) await user.click(box2);
    await user.click(screen.getByTestId('club-conflict-go'));
    await waitFor(() => expect(apptResched).toHaveBeenCalledTimes(2));
    expect(apptResched.mock.calls[0]).toEqual(['cal-2', 'b1', '2026-11-05T07:30:00Z', undefined, { notifyPatient: true }]);
    expect(apptResched.mock.calls[1]).toEqual(['cal-2', 'b2', '2026-11-05T07:00:00Z', undefined, { notifyPatient: false }]);
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  });

  describe('a server that accepts a club over a booking (it answers 200): the step comes BEFORE the save', () => {
    async function pressConfirm() {
      mount();
      const user = await chooseClub();
      await user.click(await screen.findByTestId('add-to-club-order-row'));
      await user.click(screen.getByTestId('add-to-club-confirm'));
      return user;
    }

    it('nobody is overlapped or moved unasked: the step opens, nothing is saved, nothing is rescheduled', async () => {
      apptRange.mockResolvedValue([booking('b1', '08:00', '08:30', 'Jana Nováková')]);
      apptAvail.mockResolvedValue([slot('10:00')]);
      await pressConfirm();
      await screen.findByTestId('club-conflict');
      expect(screen.getByTestId('club-conflict-list')).toHaveTextContent('Jana Nováková');
      await screen.findByTestId('club-conflict-to-b1');
      expect(update).not.toHaveBeenCalled();
      expect(apptResched).not.toHaveBeenCalled();
    });

    it('after "Přesunout a pokračovat" the club is placed with ONE update', async () => {
      apptRange.mockResolvedValue([booking('b1', '08:00', '08:30', 'Jana Nováková')]);
      apptAvail.mockResolvedValue([slot('10:00')]);
      const user = await pressConfirm();
      await screen.findByTestId('club-conflict-to-b1');
      await user.click(screen.getByTestId('club-conflict-go'));
      await waitFor(() => expect(apptResched).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    });

    it('a club player (a booking that has a partner) and a booking outside the marked time are never "in the way"', async () => {
      apptRange.mockResolvedValue([{ ...booking('club-player', '08:00', '08:30', 'Hráč Klubu'), partnerName: 'FK Slaný' }, booking('far', '12:00', '12:30', 'Mimo Čas')]);
      await pressConfirm();
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId('club-conflict')).toBeNull();
    });
  });

  it('a booking with no free slot says so and blocks the step', async () => {
    apptRange.mockResolvedValue([booking('b1', '08:00', '08:30', 'Jana Nováková')]);
    apptAvail.mockResolvedValue([]);
    await openConflict();
    expect(await screen.findByTestId('club-conflict-none-b1')).toBeInTheDocument();
    expect(screen.getByTestId('club-conflict-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('club-conflict-go')).toBeDisabled();
  });

  it('when a move fails it stops, names what already moved, and "Vrátit přesuny" moves it back', async () => {
    apptRange.mockResolvedValue([booking('b1', '08:00', '08:30', 'Jana Nováková'), booking('b2', '08:30', '09:00', 'Petr Svoboda')]);
    apptAvail.mockResolvedValue([slot('07:00'), slot('07:30'), slot('10:00')]);
    apptResched.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Čas je obsazený'));
    const user = await openConflict();
    await screen.findByTestId('club-conflict-to-b2');
    await user.click(screen.getByTestId('club-conflict-go'));
    const failure = await screen.findByTestId('club-conflict-failure');
    expect(failure).toHaveTextContent('Přesun se nepodařil: Čas je obsazený');
    expect(screen.getByTestId('club-conflict-moved')).toHaveTextContent('Jana Nováková');
    expect(update).toHaveBeenCalledTimes(1); /* the club was never placed */
    apptResched.mockClear();
    await user.click(screen.getByTestId('club-conflict-revert'));
    await waitFor(() => expect(apptResched).toHaveBeenCalledTimes(1));
    expect(apptResched.mock.calls[0]![0]).toBe('cal-2');
    expect(apptResched.mock.calls[0]![1]).toBe('b1');
    expect(apptResched.mock.calls[0]![2]).toBe('2026-11-05T08:00:00Z');
    expect(await screen.findByTestId('club-conflict-reverted')).toBeInTheDocument();
  });

  it('a refusal with no booking in the way stays the plain refusal', async () => {
    apptRange.mockResolvedValue([]);
    refuse();
    mount();
    const user = await chooseClub();
    await user.click(await screen.findByTestId('add-to-club-order-row'));
    await user.click(screen.getByTestId('add-to-club-confirm'));
    expect(await screen.findByTestId('add-to-club-failure')).toBeInTheDocument();
    expect(screen.queryByTestId('club-conflict')).toBeNull();
  });
});
