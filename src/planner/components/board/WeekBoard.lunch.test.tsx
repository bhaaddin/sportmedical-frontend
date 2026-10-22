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
import { BoardConfigProvider } from './boardConfig';
import { boardSettings } from './boardSettings';

/*
 * R17 on the board: the OBĚD band opens a pop-out (Přesunout / Smazat jen dnes / Objednat pacienta sem / Vrátit), can be dragged, says
 * "přesunut" / "smazán dnes" - one-day exceptions, written per calendar, shown only when the server has the lunch routes.
 */

const lunchApi = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn(), restore: vi.fn(), bookIntoLunch: vi.fn() }));
let stage2: { singleWorkerAtATime?: boolean; workerExceptions?: string[] } = { singleWorkerAtATime: false, workerExceptions: [] };
vi.mock('../../../api/lunchExceptions', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/lunchExceptions')>();
  return { ...actual, lunchExceptionsApi: lunchApi };
});
vi.mock('../../../api/bookingSlots', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/bookingSlots')>();
  /* a Stage 2 server: the booking-slots answer carries the shared-worker fields (which is how the board knows the lunch routes exist) */
  return { ...actual, readBookingSlots: vi.fn(async () => ({ settings: { examinationPauseMinutes: 0, ...stage2 }, defaults: { examinationPauseMinutes: 0 }, minMinutes: 0, maxMinutes: 240 })) };
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
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: Record<string, unknown>) => <div role="dialog" aria-label="Nová objednávka" data-testid="new-appointment" data-props={JSON.stringify(props)} />,
}));
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
const BOARD_WIDTH = 700;
const DAY_W = BOARD_WIDTH / 7;

const cal = (id: string, name: string, sortOrder: number, clinicServiceId: string): Calendar => ({
  id, name, color: '#0EA5E9', location: '', displayStepMinutes: 30, isActive: true, sortOrder, clinicServiceId,
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const appt = (id: string, calendarId: string, startUtc: string, endUtc: string): DayAppointment => ({
  id, calendarId, patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null,
});
let appointments: DayAppointment[] = [];

/* the planner's day marks: Wednesday plain, Thursday's lunch moved, Friday's removed (what a Stage 2 server's previews say) */
class Marks extends DemoDataSource {
  async listDayMarks(range: { from: string; to: string }) {
    const marks = await super.listDayMarks(range);
    return marks.map((m) => {
      if (m.date === '2026-12-10') return { ...m, lunch: { from: '13:00', to: '13:30', moved: true, original: { from: '12:00', to: '12:30' } } };
      if (m.date === '2026-12-11') return { ...m, lunch: null, lunchRemoved: { from: '12:00', to: '12:30' } };
      return m;
    });
  }
}

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

function mount() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BoardConfigProvider value={{ realCalendar: true, mode: 'standard', excludeClubId: null, nowMinute: 10 * 60 }}>
        <PlannerProviders source={new Marks({ today: TODAY })} today={TODAY} initialDate={TODAY}>
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

const grant = (...p: string[]) => window.localStorage.setItem('permissions', JSON.stringify(p));
const band = (day: string) => screen.findByTestId(`lunch-${day}`);
/* the band is drawn by the board; the click target over it (its own lazy layer) appears once a Stage 2 server has confirmed the lunch routes */
const clickable = async (day: string) => {
  await band(day);
  return screen.findByTestId(`lunch-hit-${day}`);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-09T08:15:00Z'));
  window.localStorage.clear();
  grant('bookings.create', 'bookings.edit');
  boardSettings.reset();
  stage2 = { singleWorkerAtATime: false, workerExceptions: [] };
  appointments = [];
  stubLayout();
  vi.mocked(calendarsApi.list).mockResolvedValue([cal('c1', 'Lékařské prohlídky', 1, 's1'), cal('c2', 'Sportovní diagnostika', 2, 's2')]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Prohlídky', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null },
    { id: 's2', name: 'Diagnostika', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: null },
  ] as never);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({
        date: d, isOpen: true, closedBecause: null, startTime: '07:00:00', endTime: '19:00:00', breakStart: '12:00:00', breakEnd: '12:30:00',
        workerUserId: `u-${_id}`, workerDisplayName: 'Anna', isChangedByOverride: false, offeredActivityIds: ['a1'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockImplementation(async () => appointments);
  vi.mocked(appointmentsApi.blocks).mockResolvedValue([]);
  lunchApi.list.mockReset().mockResolvedValue([]);
  lunchApi.set.mockReset().mockImplementation(async (calendarId: string, date: string, input: { kind: 'moved' | 'removed' }) => ({ calendarId, date, kind: input.kind }));
  lunchApi.restore.mockReset().mockResolvedValue(undefined);
  lunchApi.bookIntoLunch.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('R17: the lunch band is a button only where it can work', () => {
  it('on a server with the lunch routes the band is clickable', async () => {
    mount();
    const el = await clickable('2026-12-09');
    expect(screen.getByTestId('lunch-2026-12-09')).toHaveTextContent('Oběd');
    expect(el).toHaveAttribute('aria-haspopup', 'dialog');
    expect(el).toHaveAttribute('aria-label', 'Oběd, 12:00–12:30');
  });

  it('an older server (booking-slots has no Stage 2 fields) keeps the band as it was and is never asked for the lunch routes', async () => {
    stage2 = {};
    mount();
    await band('2026-12-09');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('lunch-hit-2026-12-09')).toBeNull();
    expect(lunchApi.list).not.toHaveBeenCalled(); // no request that would only 404 into the console
    expect(screen.queryByTestId('lunch-popover')).toBeNull();
  });

  it('a server that has the fields but answers the lunch routes with 404 keeps the band drawn and not clickable', async () => {
    lunchApi.list.mockRejectedValue(new BookingApiError('notFound', 404));
    mount();
    await band('2026-12-09');
    await waitFor(() => expect(lunchApi.list).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('lunch-hit-2026-12-09')).toBeNull();
  });

  it('every working weekday of the week carries the band, Friday included', async () => {
    mount();
    for (const day of ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11']) {
      await waitFor(() => expect(screen.getByTestId(`lunch-${day}`)).toBeInTheDocument());
    }
    /* Saturday and Sunday are not working days: no lunch there */
    expect(screen.queryByTestId('lunch-2026-12-12')).toBeNull();
    expect(screen.queryByTestId('lunch-2026-12-13')).toBeNull();
  });

  it('a user who may neither edit nor book sees the band only', async () => {
    grant('patients.view');
    mount();
    await band('2026-12-09');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('lunch-hit-2026-12-09')).toBeNull();
  });
});

describe('R17: the pop-out of a click on the lunch', () => {
  it('moves the lunch for THIS day, in every open calendar, to any time of the day (same length)', async () => {
    mount();
    fireEvent.click(await clickable('2026-12-09'));
    const popover = await screen.findByTestId('lunch-popover');
    expect(popover).toHaveAttribute('data-state', 'weekly');
    expect(within(popover).getByText(/Platí jen pro tento den/)).toBeInTheDocument();
    const start = within(popover).getByTestId('lunch-start');
    expect(start).toHaveValue('12:00');
    fireEvent.change(start, { target: { value: '15:30' } });
    fireEvent.click(within(popover).getByTestId('lunch-move-go'));
    await waitFor(() => expect(lunchApi.set).toHaveBeenCalledTimes(2));
    expect(lunchApi.set).toHaveBeenCalledWith('c1', '2026-12-09', { kind: 'moved', startTime: '15:30' });
    expect(lunchApi.set).toHaveBeenCalledWith('c2', '2026-12-09', { kind: 'moved', startTime: '15:30' });
    await waitFor(() => expect(screen.queryByTestId('lunch-popover')).toBeNull());
    expect(await screen.findByTestId('board-notice')).toHaveTextContent('Oběd přesunut jen pro tento den.');
  });

  it('the lunch belongs to the clinic: with ONE služba on screen the change still goes to every open calendar', async () => {
    mount();
    await clickable('2026-12-09');
    fireEvent.click(await screen.findByTestId('calendar-chip-s1'));
    await waitFor(() => expect(boardSettings.getState().ticked?.size).toBe(1));
    fireEvent.click(await clickable('2026-12-09'));
    const popover = await screen.findByTestId('lunch-popover');
    fireEvent.change(within(popover).getByTestId('lunch-start'), { target: { value: '13:00' } });
    fireEvent.click(within(popover).getByTestId('lunch-move-go'));
    await waitFor(() => expect(lunchApi.set).toHaveBeenCalledTimes(2));
    expect(lunchApi.set.mock.calls.map((c) => c[0]).sort()).toEqual(['c1', 'c2']);
  });

  it('refuses a move over a booking before it asks the server', async () => {
    appointments = [appt('b1', 'c1', '2026-12-09T12:00:00Z', '2026-12-09T12:30:00Z')]; // Wednesday 13:00-13:30 (CET)
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.click(await clickable('2026-12-09'));
    const popover = await screen.findByTestId('lunch-popover');
    fireEvent.change(within(popover).getByTestId('lunch-start'), { target: { value: '13:15' } });
    expect(within(popover).getByText('V tomto čase už je rezervace. Přesuňte nejdřív ji, nebo zvolte jiný čas oběda.')).toBeInTheDocument();
    expect(within(popover).getByTestId('lunch-move-go')).toBeDisabled();
    expect(lunchApi.set).not.toHaveBeenCalled();
  });

  it('"Smazat jen dnes" removes the lunch of this day only', async () => {
    mount();
    fireEvent.click(await clickable('2026-12-09'));
    fireEvent.click(await screen.findByTestId('lunch-remove'));
    await waitFor(() => expect(lunchApi.set).toHaveBeenCalledTimes(2));
    expect(lunchApi.set).toHaveBeenCalledWith('c1', '2026-12-09', { kind: 'removed' });
    expect(await screen.findByTestId('board-notice')).toHaveTextContent('Oběd je pro tento den smazán.');
  });

  it('"Objednat pacienta sem" opens the booking dialog on exactly the lunch slot, as an into-lunch booking', async () => {
    mount();
    fireEvent.click(await clickable('2026-12-09'));
    fireEvent.click(await screen.findByTestId('lunch-book'));
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props).toMatchObject({ initialDate: '2026-12-09', initialCalendarId: 'c1', initialStart: '2026-12-09T12:00', initialEnd: '2026-12-09T12:30', intoLunch: true });
    await waitFor(() => expect(screen.queryByTestId('lunch-popover')).toBeNull());
  });

  it('a user who may book but not edit can book into the lunch and cannot move or delete it', async () => {
    grant('bookings.create');
    mount();
    fireEvent.click(await clickable('2026-12-09'));
    const popover = await screen.findByTestId('lunch-popover');
    expect(within(popover).getByTestId('lunch-book')).toBeInTheDocument();
    expect(within(popover).queryByTestId('lunch-move')).toBeNull();
    expect(within(popover).queryByTestId('lunch-remove')).toBeNull();
  });

  it('the refusal of the server is said in words and the pop-out stays', async () => {
    lunchApi.set.mockRejectedValue(new BookingApiError('conflict', 409, undefined, { code: 'lunch.overlaps_club' }));
    mount();
    fireEvent.click(await clickable('2026-12-09'));
    const popover = await screen.findByTestId('lunch-popover');
    fireEvent.change(within(popover).getByTestId('lunch-start'), { target: { value: '14:00' } });
    fireEvent.click(within(popover).getByTestId('lunch-move-go'));
    expect(await within(popover).findByTestId('lunch-error')).toHaveTextContent('Tento čas drží klub.');
  });
});

describe('R17: a day that carries an exception says so and can be put back', () => {
  it('a moved lunch reads "Oběd · přesunut", shows where it was and "Vrátit na původní čas" restores it', async () => {
    mount();
    const el = await clickable('2026-12-10');
    expect(screen.getByTestId('lunch-2026-12-10')).toHaveTextContent('Oběd · přesunut');
    expect(screen.getByTestId('lunch-2026-12-10')).toHaveAttribute('data-lunch', 'moved');
    fireEvent.click(el);
    const popover = await screen.findByTestId('lunch-popover');
    expect(within(popover).getByTestId('lunch-state')).toHaveTextContent('Oběd · přesunut');
    expect(within(popover).getByText('Původně 12:00–12:30')).toBeInTheDocument();
    fireEvent.click(within(popover).getByTestId('lunch-restore'));
    await waitFor(() => expect(lunchApi.restore).toHaveBeenCalledTimes(2));
    expect(lunchApi.restore).toHaveBeenCalledWith('c1', '2026-12-10');
  });

  it('a removed lunch leaves a dashed "smazán dnes" ghost where it was; its pop-out only brings it back', async () => {
    mount();
    const el = await clickable('2026-12-11');
    expect(screen.getByTestId('lunch-2026-12-11')).toHaveTextContent('Oběd · smazán dnes');
    expect(screen.getByTestId('lunch-2026-12-11')).toHaveAttribute('data-lunch', 'removed');
    fireEvent.click(el);
    const popover = await screen.findByTestId('lunch-popover');
    expect(within(popover).queryByTestId('lunch-move')).toBeNull();
    expect(within(popover).queryByTestId('lunch-book')).toBeNull();
    fireEvent.click(within(popover).getByTestId('lunch-restore'));
    await waitFor(() => expect(lunchApi.restore).toHaveBeenCalledWith('c2', '2026-12-11'));
  });
});

describe('R17: the band can be dragged to any other time of the day', () => {
  const drag = async (dy: number) => {
    const el = await clickable('2026-12-09');
    fireEvent.pointerDown(el, { button: 0, pointerType: 'mouse', clientX: 2 * DAY_W + 20, clientY: 100, pointerId: 3 });
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 2 * DAY_W + 20, clientY: 100 + dy, pointerId: 3 });
    return el;
  };

  it('shows the landing time while dragging and writes it on release (snapped to the grid, not opening the pop-out)', async () => {
    mount();
    await drag(60 * ROW); // 60 minutes down
    const ghost = await screen.findByTestId('lunch-drag-ghost');
    expect(ghost).toHaveTextContent('Oběd 13:00');
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 2 * DAY_W + 20, clientY: 100 + 60 * ROW, pointerId: 3 });
    await waitFor(() => expect(lunchApi.set).toHaveBeenCalledTimes(2));
    expect(lunchApi.set).toHaveBeenCalledWith('c1', '2026-12-09', { kind: 'moved', startTime: '13:00' });
    expect(screen.queryByTestId('lunch-popover')).toBeNull();
  });

  it('a drop over a booking is refused with the reason and writes nothing', async () => {
    appointments = [appt('b1', 'c1', '2026-12-09T12:00:00Z', '2026-12-09T12:30:00Z')]; // 13:00-13:30
    mount();
    await screen.findByTestId('board-booking-b1');
    await drag(60 * ROW);
    const ghost = await screen.findByTestId('lunch-drag-ghost');
    expect(ghost).toHaveClass('is-invalid');
    expect(ghost).toHaveTextContent('V tomto čase už je rezervace');
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 2 * DAY_W + 20, clientY: 100 + 60 * ROW, pointerId: 3 });
    expect(await screen.findByTestId('board-notice')).toHaveTextContent('V tomto čase už je rezervace');
    expect(lunchApi.set).not.toHaveBeenCalled();
  });

  it('a plain click (no movement) is not a drag: it opens the pop-out', async () => {
    mount();
    const el = await clickable('2026-12-09');
    fireEvent.pointerDown(el, { button: 0, pointerType: 'mouse', clientX: 2 * DAY_W + 20, clientY: 100, pointerId: 3 });
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 2 * DAY_W + 20, clientY: 100, pointerId: 3 });
    fireEvent.click(el);
    expect(await screen.findByTestId('lunch-popover')).toBeInTheDocument();
    expect(lunchApi.set).not.toHaveBeenCalled();
  });
});
