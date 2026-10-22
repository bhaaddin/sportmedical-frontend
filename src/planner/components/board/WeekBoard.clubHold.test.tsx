import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import { addDaysToDateOnly } from '../../../utils/time';
import { DemoDataSource } from '../../data/DemoDataSource';
import { DialogLayer } from '../DialogLayer';
import { PlannerGate } from '../PlannerGate';
import { PlannerProviders } from '../PlannerProviders';
import { PlannerStage } from '../PlannerStage';
import { WeekBoardPanel } from '../WeekBoardPanel';
import { BoardConfigProvider } from './boardConfig';
import { boardSettings } from './boardSettings';
import { phoneEntries } from './phoneModel';
import type { BoardWindowModel } from './boardModel';

/*
 * R13 on the main board: a club's held time is drawn hatched with the club's name, the order code, a lock and the hold state in words;
 * booking, blocking and dragging onto it are refused with "Rezervováno pro klub X"; a click hands the block (and the right to release)
 * to the club popover; the month tile says the same. An older server (no hold fields) is drawn as before.
 */

vi.mock('../../../api/bookingSlots', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/bookingSlots')>();
  return { ...actual, readBookingSlots: vi.fn(async () => ({ settings: { examinationPauseMinutes: 0 }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 })) };
});
vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({
  appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn() },
}));
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { getById: vi.fn() } }));
vi.mock('../../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: actual.CALENDAR_DISPLAY_OFFLINE, loaded: true })) };
});
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({ NewAppointmentDialog: () => <div data-testid="new-appointment" /> }));
vi.mock('../../../components/booking/AppointmentDetail', () => ({ AppointmentDetail: () => null }));
vi.mock('../../../components/booking/calendar/AddToClubOrderDialog', () => ({ AddToClubOrderDialog: () => <div data-testid="add-to-club" /> }));
vi.mock('../../../components/clubs/order/ClubOrderEntry', () => ({ ClubOrderEntry: () => null }));
vi.mock('../../../components/booking/calendar/ClubBlockPopover', () => ({
  ClubBlockPopover: (props: { pick: { clubName: string; block?: TimeBlock } | null; mayRelease?: boolean }) =>
    props.pick ? <div data-testid="club-popover" data-club={props.pick.clubName} data-order={props.pick.block?.clubOrderId ?? ''} data-hold={String(props.pick.block?.playersMissing)} data-may-release={String(props.mayRelease)} /> : null,
}));

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';
import { activitiesApi } from '../../../api/activities';

const TODAY = '2026-12-09'; // Wednesday
const ROW = 455 / 720;
const yOf = (minute: number) => (minute - 420) * ROW;
const BOARD_WIDTH = 700;
const DAY_W = BOARD_WIDTH / 7;

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0, clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};
const appt = (id: string, startUtc: string, endUtc: string): DayAppointment => ({
  id, calendarId: 'c1', patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null,
});
/* December is CET: Thursday 10:00-12:00 Prague = 09:00-11:00Z */
const club = (over: Partial<TimeBlock> = {}): TimeBlock =>
  ({ id: 'k1', startUtc: '2026-12-10T09:00:00Z', endUtc: '2026-12-10T11:00:00Z', reason: '', kind: 'club', clubId: 'club-1', clubName: 'FK Slaný', clubBlockId: 'kb1', colorHex: '#2E7D6B', clubOrderId: 'o1', orderCode: 'KO-12AB34CD', orderStatus: 'Confirmed', seats: 22, registered: 7, playersMissing: true, windowEmpty: false, holdExpired: false, ...over }) as TimeBlock;
let blocks: TimeBlock[] = [];
let appointments: DayAppointment[] = [];

function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    if (el.id === 'day-board') return rect(0, 0, BOARD_WIDTH, 455);
    if (el.classList?.contains('board-selection')) return rect(111, 222, 40, 33);
    if (el.dataset?.bookingId) return rect(0, Number.parseFloat(el.style.top) || 0, 40, Number.parseFloat(el.style.height) || 0);
    return rect(0, 0, 0, 0);
  });
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BoardConfigProvider value={{ realCalendar: true, mode: 'standard', excludeClubId: null, nowMinute: 10 * 60 }}>
        <PlannerProviders source={new DemoDataSource({ today: TODAY })} today={TODAY} initialDate={TODAY}>
          <PlannerStage scale={1}>
            <PlannerGate>
              <WeekBoardPanel />
              <DialogLayer />
            </PlannerGate>
          </PlannerStage>
        </PlannerProviders>
      </BoardConfigProvider>
    </MemoryRouter>,
  );
}
const board = () => document.getElementById('day-board') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-09T08:15:00Z'));
  window.localStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
  boardSettings.reset();
  blocks = [club()];
  appointments = [];
  stubLayout();
  vi.mocked(calendarsApi.list).mockResolvedValue([calendar]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([{ id: 's1', name: 'Prohlídky', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null }] as never);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({ date: d, isOpen: true, closedBecause: null, startTime: '07:00:00', endTime: '19:00:00', breakStart: '12:00:00', breakEnd: '12:30:00', workerUserId: 'u1', workerDisplayName: 'Anna', isChangedByOverride: false, offeredActivityIds: ['a1'] });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockImplementation(async () => appointments);
  vi.mocked(appointmentsApi.blocks).mockImplementation(async () => blocks);
  vi.mocked(appointmentsApi.reschedule).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('R13: a club hold in the week', () => {
  it('draws the block locked, with the club, the order code and the hold state in words', async () => {
    mount();
    const win = await screen.findByTestId('board-window-k1-2026-12-10');
    expect(win.querySelector('use')?.getAttribute('href')).toBe('#icon-lock');
    expect(within(win).getByTestId('club-window-code')).toHaveTextContent('KO-12AB34CD');
    expect(within(win).getByTestId('club-window-hold')).toHaveTextContent('Čeká na hráče');
    expect(win).toHaveAttribute('data-hold', 'waiting');
    expect(win).toHaveAttribute('aria-label', expect.stringContaining('objednávka KO-12AB34CD'));
    expect(win).toHaveAttribute('title', expect.stringContaining('7/22 zapsáno'));
    expect(win.style.getPropertyValue('--win-line')).toBeTruthy(); // the club's colour
  });

  it.each([
    [{ playersMissing: false }, 'Obsazeno', 'full'],
    [{ playersMissing: true, windowEmpty: true, holdExpired: true }, 'Hold vypršel', 'expired'],
  ])('says %o as "%s"', async (over, word, hold) => {
    blocks = [club(over as Partial<TimeBlock>)];
    mount();
    const win = await screen.findByTestId('board-window-k1-2026-12-10');
    expect(within(win).getByTestId('club-window-hold')).toHaveTextContent(word);
    expect(win).toHaveAttribute('data-hold', hold);
  });

  it('an older server (no hold fields) is drawn as before: the club and the time, no code, no state', async () => {
    blocks = [{ id: 'k1', startUtc: '2026-12-10T09:00:00Z', endUtc: '2026-12-10T11:00:00Z', reason: '', kind: 'club', clubName: 'FK Slaný', clubBlockId: 'kb1', colorHex: '#2E7D6B' } as TimeBlock];
    mount();
    const win = await screen.findByTestId('board-window-k1-2026-12-10');
    expect(within(win).queryByTestId('club-window-code')).toBeNull();
    expect(within(win).queryByTestId('club-window-hold')).toBeNull();
    expect(win).toHaveTextContent('FK Slaný');
  });

  it('a click hands the block and the right to release to the club popover', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('board-window-k1-2026-12-10'));
    const popover = await screen.findByTestId('club-popover');
    expect(popover).toHaveAttribute('data-order', 'o1');
    expect(popover).toHaveAttribute('data-hold', 'true');
    expect(popover).toHaveAttribute('data-may-release', 'true');
  });
});

describe('R13: nothing can be put onto a club hold', () => {
  const subX = (col: number) => col * DAY_W + DAY_W / 2;

  it('marking free time over it is refused with "Rezervováno pro klub X" and opens no menu', async () => {
    mount();
    await screen.findByTestId('board-window-k1-2026-12-10');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(3), clientY: yOf(10 * 60 + 15), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(3), clientY: yOf(10 * 60 + 15), pointerId: 1 });
    expect(await screen.findByTestId('board-notice')).toHaveTextContent('Rezervováno pro klub FK Slaný');
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByTestId('board-selection')).toBeNull();
  });

  it('a free place beside the hold can still be marked', async () => {
    mount();
    await screen.findByTestId('board-window-k1-2026-12-10');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(3), clientY: yOf(14 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(3), clientY: yOf(14 * 60), pointerId: 1 });
    expect(await screen.findByRole('menuitem', { name: /Objednat pacienta/ })).toBeInTheDocument();
  });

  it('dragging a booking onto it shows and says "Rezervováno pro klub X"', async () => {
    appointments = [appt('b1', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z')];
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: subX(2), clientY: Number.parseFloat(card.style.top) + 2, pointerId: 7 });
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: subX(3), clientY: yOf(10 * 60 + 30) + 2, pointerId: 7 });
    const ghost = await screen.findByTestId('move-ghost');
    expect(ghost).toHaveAttribute('data-refused', 'busy');
    expect(ghost).toHaveTextContent('Rezervováno pro klub FK Slaný');
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: subX(3), clientY: yOf(10 * 60 + 30) + 2, pointerId: 7 });
    expect(await screen.findByTestId('board-notice')).toHaveTextContent('Rezervováno pro klub FK Slaný');
    expect(appointmentsApi.reschedule).not.toHaveBeenCalled();
  });
});

describe('R13: the month and the phone list', () => {
  it('a month tile draws the club day as a locked bar with the code and the hold state', async () => {
    mount();
    await screen.findByTestId('board-window-k1-2026-12-10');
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    const bar = await screen.findByTestId('tile-club-2026-12-10');
    await waitFor(() => expect(bar).toHaveTextContent('FK Slaný · KO-12AB34CD · 10:00–12:00 · Čeká na hráče'));
    expect(bar).toHaveAttribute('data-hold', 'waiting');
    expect(bar.querySelector('use')?.getAttribute('href')).toBe('#icon-lock');
    expect(bar.style.getPropertyValue('--club')).toBe('#2E7D6B');
  });

  it('the phone agenda lists the club window with its order code and hold state', () => {
    const window = {
      key: 'window:c1:k1:2026-12-10', kind: 'club', day: '2026-12-10', start: 600, label: 'FK Slaný', timeLabel: '10:00–12:00', colour: '#2E7D6B', calendarName: 'Ordinace 1', block: club(),
    } as unknown as BoardWindowModel;
    const [entry] = phoneEntries([], [window], '2026-12-10');
    expect(entry).toMatchObject({ kind: 'club', title: 'FK Slaný', sub: 'KO-12AB34CD · Čeká na hráče' });
    const plain = { ...window, block: { ...club(), orderCode: null, playersMissing: null, seats: null, registered: null } } as unknown as BoardWindowModel;
    expect(phoneEntries([], [plain], '2026-12-10')[0]!.sub).toBeNull();
  });
});
