import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Calendar, DayAppointment, PreviewDay } from '../../../api/bookingContracts';
import { BookingApiError } from '../../../api/apiError';
import { addDaysToDateOnly } from '../../../utils/time';
import { DemoDataSource } from '../../data/DemoDataSource';
import { DialogLayer } from '../DialogLayer';
import { PlannerGate } from '../PlannerGate';
import { PlannerProviders } from '../PlannerProviders';
import { PlannerStage } from '../PlannerStage';
import { WeekBoardPanel } from '../WeekBoardPanel';
import { BoardConfigProvider, type BoardConfig } from './boardConfig';
import { boardSettings } from './boardSettings';

/*
 * R4 on the board: the shared-worker rule draws the clash in the other column and, when the server refuses a move with `worker.busy`,
 * names the clash and lets an owner override it with a reason. (Set-up as in WeekBoard.calendars.test.tsx.)
 */

let rule: { singleWorkerAtATime: boolean; workerExceptions: string[] } = { singleWorkerAtATime: true, workerExceptions: [] };
vi.mock('../../../api/bookingSlots', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/bookingSlots')>();
  return {
    ...actual,
    readBookingSlots: vi.fn(async () => ({ settings: { examinationPauseMinutes: 0, ...rule }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 })),
  };
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
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({ NewAppointmentDialog: () => null }));
vi.mock('../../../components/booking/AppointmentDetail', () => ({ AppointmentDetail: () => null }));
vi.mock('../../../components/booking/calendar/AddToClubOrderDialog', () => ({ AddToClubOrderDialog: () => null }));
vi.mock('../../../components/clubs/order/ClubOrderEntry', () => ({ ClubOrderEntry: () => null }));
vi.mock('../../../components/booking/calendar/ClubBlockPopover', () => ({ ClubBlockPopover: () => null }));

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
const subX = (col: number, sub: number, subs = 2) => col * DAY_W + (sub + 0.5) * (DAY_W / subs);

const cal = (id: string, name: string, sortOrder: number, color: string, clinicServiceId: string): Calendar => ({
  id, name, color, location: '', displayStepMinutes: 30, isActive: true, sortOrder, clinicServiceId,
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const LEK = cal('c1', 'Lékařské prohlídky', 1, '#0EA5E9', 's1');
const DIA = cal('c2', 'Sportovní diagnostika', 2, '#7C3AED', 's2');

const appt = (id: string, calendarId: string, startUtc: string, endUtc: string): DayAppointment => ({
  id, calendarId, patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null,
});
/* December is CET: 09:00 Prague = 08:00Z */
const lek = appt('l1', 'c1', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z');
let appointments: DayAppointment[] = [lek];

function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    if (el.id === 'day-board') return rect(0, 0, BOARD_WIDTH, 455);
    if (el.dataset?.bookingId) return rect(0, Number.parseFloat(el.style.top) || 0, 40, Number.parseFloat(el.style.height) || 0);
    return rect(0, 0, 0, 0);
  });
}

function mount(config: Partial<BoardConfig> = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BoardConfigProvider value={{ realCalendar: true, mode: 'standard', excludeClubId: null, nowMinute: 10 * 60, ...config }}>
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-09T08:15:00Z'));
  window.localStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
  boardSettings.reset();
  rule = { singleWorkerAtATime: true, workerExceptions: [] };
  appointments = [lek];
  stubLayout();
  vi.mocked(calendarsApi.list).mockResolvedValue([LEK, DIA]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Prohlídky', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null },
    { id: 's2', name: 'Diagnostika', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: null },
  ] as never);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  /* the same worker is rostered in both calendars every day */
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_calendarId, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({
        date: d, isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00',
        workerUserId: 'u1', workerDisplayName: 'Anna', isChangedByOverride: false, offeredActivityIds: ['a1'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockImplementation(async () => appointments);
  vi.mocked(appointmentsApi.blocks).mockResolvedValue([]);
  vi.mocked(appointmentsApi.reschedule).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('R4: the shared worker is busy in the other column', () => {
  it("with the rule on, the worker's booking locks the same time in the other column, with the reason", async () => {
    mount();
    const clash = await screen.findByTestId('clash-c2-2026-12-09-l1');
    expect(clash.style.getPropertyValue('--sub')).toBe('1'); // the second služba's column; the booking is in the first
    expect(clash).toHaveAttribute('title', expect.stringContaining('Anna: Prohlídka 09:00–09:30 (Lékařské prohlídky)'));
    expect(clash).toHaveTextContent('Zaneprázdněn');
    expect(clash).not.toHaveTextContent('Pacient l1'); // no patient in the reason
  });

  it('with the rule off, or for a worker on the exception list, nothing is drawn', async () => {
    rule = { singleWorkerAtATime: false, workerExceptions: [] };
    mount();
    await screen.findByTestId('board-booking-l1');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('board-clashes')).toBeNull();
    cleanup();
    boardSettings.reset();
    rule = { singleWorkerAtATime: true, workerExceptions: ['u1'] };
    mount();
    await screen.findByTestId('board-booking-l1');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('board-clashes')).toBeNull();
  });
});

describe('R4: a move the server refuses with worker.busy', () => {
  const busy = (overridable: boolean) =>
    new BookingApiError('conflict', 409, 'Pracovník je v tuto dobu zaneprázdněn.', {
      code: 'worker.busy',
      details: { conflictKind: 'appointment', calendarName: 'Diagnostika', activityName: 'Spiroergometrie', startUtc: '2026-12-10T08:00:00Z', endUtc: '2026-12-10T08:45:00Z', overridable },
    });
  const dragLekToThursday = async () => {
    rule = { singleWorkerAtATime: false, workerExceptions: [] };
    mount();
    const card = await screen.findByTestId('board-booking-l1');
    fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: subX(2, 0), clientY: Number.parseFloat(card.style.top) + 2, pointerId: 7 });
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: subX(3, 0), clientY: yOf(10 * 60) + 2, pointerId: 7 });
    await screen.findByTestId('move-ghost');
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: subX(3, 0), clientY: yOf(10 * 60) + 2, pointerId: 7 });
    fireEvent.click(await screen.findByRole('button', { name: /Přesunout|Potvrdit/ }));
  };

  it('names the clash in a dialog; an owner may repeat the move with a reason', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));
    vi.mocked(appointmentsApi.reschedule).mockRejectedValueOnce(busy(true)).mockResolvedValue(null);
    await dragLekToThursday();
    const dialog = await screen.findByTestId('worker-busy-dialog');
    expect(within(dialog).getByTestId('worker-busy-message')).toHaveTextContent('Spiroergometrie v kalendáři Diagnostika');
    fireEvent.change(within(dialog).getByLabelText('Důvod výjimky'), { target: { value: 'Telefonát od pacienta' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesto potvrdit (správce)' }));
    await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(2));
    expect(vi.mocked(appointmentsApi.reschedule).mock.calls[1]![3]).toBe('Telefonát od pacienta');
    await waitFor(() => expect(screen.queryByTestId('worker-busy-dialog')).toBeNull());
  });

  it('a receptionist sees the clash and no override', async () => {
    vi.mocked(appointmentsApi.reschedule).mockRejectedValue(busy(true));
    await dragLekToThursday();
    const dialog = await screen.findByTestId('worker-busy-dialog');
    expect(within(dialog).queryByTestId('worker-busy-override')).toBeNull();
    expect(within(dialog).getByText('Přepsat zaneprázdněného pracovníka smí jen správce.')).toBeInTheDocument();
  });

  it('403 worker.busy.override_forbidden after an override is shown as the refusal', async () => {
    window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));
    const forbidden = new BookingApiError('forbidden', 403, undefined, { code: 'worker.busy.override_forbidden' });
    vi.mocked(appointmentsApi.reschedule).mockRejectedValueOnce(busy(true)).mockRejectedValueOnce(forbidden);
    await dragLekToThursday();
    const dialog = await screen.findByTestId('worker-busy-dialog');
    fireEvent.change(within(dialog).getByLabelText('Důvod výjimky'), { target: { value: 'x' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesto potvrdit (správce)' }));
    expect(await within(dialog).findByTestId('worker-busy-forbidden')).toBeInTheDocument();
  });
});
