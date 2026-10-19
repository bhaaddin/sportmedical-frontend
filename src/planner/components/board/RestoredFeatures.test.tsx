import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import type { ClubOrderView } from '../../../api/clubOrders';
import { setViewport } from '../../../test/viewport';
import { addDaysToDateOnly } from '../../../utils/time';
import { DemoDataSource } from '../../data/DemoDataSource';
import { usePlannerActions } from '../../state/PlannerStoreProvider';
import { DialogLayer } from '../DialogLayer';
import { Toast } from '../Toast';
import { PlannerGate } from '../PlannerGate';
import { PlannerProviders } from '../PlannerProviders';
import { PlannerStage, type PlannerLayout } from '../PlannerStage';
import { WeekBoardPanel } from '../WeekBoardPanel';
import { BoardConfigProvider, type BoardConfig } from './boardConfig';
import { boardSettings } from './boardSettings';

/*
 * The three features the new planner took over from the old calendar and that were lost on the way:
 *   1. club inquiries (a club order that blocks no time yet) marked on the days it asks for,
 *   2. the month: Ctrl-drag selection of days and "Zablokovat celé dny" from that selection,
 *   3. the phone's list (the day's bookings as an agenda, the month as a list of days).
 * The clinic's calendar API is mocked as in WeekBoard.test.tsx; everything else is the real board.
 */

vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({
  appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn() },
}));
vi.mock('../../../api/clubOrders', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/clubOrders')>();
  return { ...actual, clubOrdersApi: { ...actual.clubOrdersApi, list: vi.fn() } };
});
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { getById: vi.fn() } }));
vi.mock('../../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: { ...actual.CALENDAR_DISPLAY_OFFLINE }, loaded: true })) };
});
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: Record<string, unknown>) => (
    <div role="dialog" aria-label="Nová objednávka" data-testid="new-appointment" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock('../../../components/booking/AppointmentDetail', () => ({
  AppointmentDetail: (props: { appointmentId: string }) => <div role="dialog" aria-label="Detail rezervace" data-testid="appointment-detail" data-id={props.appointmentId} />,
}));
vi.mock('../../../components/booking/calendar/AddToClubOrderDialog', () => ({
  AddToClubOrderDialog: (props: { marked: unknown }) => <div role="dialog" aria-label="Přidat do objednávky klubu" data-testid="add-to-club" data-marked={JSON.stringify(props.marked)} />,
}));
vi.mock('../../../components/clubs/order/ClubOrderEntry', () => ({ ClubOrderEntry: () => null }));
vi.mock('../../../components/booking/calendar/ClubBlockPopover', () => ({
  ClubBlockPopover: (props: { pick: unknown }) => (props.pick ? <div role="dialog" aria-label="Blok klubu" data-testid="club-popover" data-pick={JSON.stringify(props.pick)} /> : null),
}));

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';
import { clubOrdersApi } from '../../../api/clubOrders';
import { activitiesApi } from '../../../api/activities';

const TODAY = '2026-12-09'; // Wednesday

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};
const calendar2: Calendar = { ...calendar, id: 'c2', name: 'Ordinace 2', sortOrder: 1 };

const appt = (id: string, startUtc: string, endUtc: string, extra: Partial<DayAppointment> = {}): DayAppointment => ({
  id, calendarId: 'c1', patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null, ...extra,
});
/* December is CET: 09:00 Prague = 08:00Z. */
const b1 = appt('b1', '2026-12-08T08:00:00Z', '2026-12-08T08:30:00Z'); // Tuesday 09:00-09:30
const b2 = appt('b2', '2026-12-09T09:00:00Z', '2026-12-09T09:30:00Z', { activityId: 'a2', activityName: 'Fyzio' }); // Wednesday 10:00-10:30

const order = (o: Partial<ClubOrderView>): ClubOrderView => ({ id: 'o1', clubName: 'Dukla', status: 'Requested', requestedRanges: [], ...o }) as ClubOrderView;

let blocks: TimeBlock[] = [];
let appointments: DayAppointment[] = [b1, b2];
let clubOrders: ClubOrderView[] = [];
let calendars: Calendar[] = [calendar];

function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    return (this as HTMLElement).id === 'day-board' ? rect(0, 0, 700, 455) : rect(0, 0, 0, 0);
  });
  /* jsdom has no hit testing: the day under a pointer is the one the test says. */
  (document as { elementFromPoint?: unknown }).elementFromPoint = vi.fn((x: number) => document.querySelector(`[data-day="${hoverDay(x)}"]`));
}
/** Test coordinates: x = 1000 + day-of-month, so a pointer "over a tile" is a number. */
const hoverDay = (x: number) => `2026-12-${String(x - 1000).padStart(2, '0')}`;
const over = (day: string) => 1000 + Number(day.slice(8, 10));

let actions: ReturnType<typeof usePlannerActions> | null = null;
function Grab() {
  actions = usePlannerActions();
  return null;
}
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location" data-path={location.pathname} data-state={JSON.stringify(location.state)} />;
}
const lastLocation = () => {
  const el = screen.getByTestId('location');
  return { path: el.dataset.path, state: JSON.parse(el.dataset.state ?? 'null') as Record<string, unknown> | null };
};

function mount(opts: { layout?: PlannerLayout; config?: Partial<BoardConfig>; initialDate?: string } = {}) {
  const { layout = 'desktop', config = {}, initialDate = TODAY } = opts;
  if (layout === 'phone') setViewport(390, 844);
  else if (layout === 'tablet') setViewport(834, 1112);
  else setViewport(1440, 900);
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/' }]}>
      <LocationProbe />
      <BoardConfigProvider value={{ realCalendar: true, mode: 'standard', excludeClubId: null, nowMinute: 10 * 60, ...config }}>
        <PlannerProviders source={new DemoDataSource({ today: TODAY })} today={TODAY} initialDate={initialDate}>
          <PlannerStage scale={1} layout={layout}>
            <PlannerGate>
              <WeekBoardPanel />
              <DialogLayer />
              <Toast />
              <Grab />
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
  window.sessionStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));
  boardSettings.reset();
  blocks = [];
  appointments = [b1, b2];
  clubOrders = [];
  calendars = [calendar];
  stubLayout();
  vi.mocked(calendarsApi.list).mockImplementation(async () => calendars);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 2, calendars: 1, colorHex: null },
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      rows.push({
        date: d, isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00',
        workerUserId: 'u1', workerDisplayName: 'Anna Černá', isChangedByOverride: false, offeredActivityIds: ['a1', 'a2'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockImplementation(async () => appointments);
  vi.mocked(appointmentsApi.blocks).mockImplementation(async () => blocks);
  vi.mocked(clubOrdersApi.list).mockImplementation(async () => clubOrders);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const alternate = () => screen.getByTestId('alternate-view');

/* ------------------------------------------------------------------------ */
/* 1. club inquiries                                                          */
/* ------------------------------------------------------------------------ */

describe('club inquiries on the days they ask for', () => {
  beforeEach(() => {
    clubOrders = [
      order({ id: 'o1', clubName: 'Dukla', status: 'Requested', requestedDates: ['2026-12-10', '2026-12-11'] }),
      order({ id: 'o2', clubName: 'Slavia', status: 'Invited', offeredDates: ['2026-12-10', '2026-12-17'] }),
      order({ id: 'o3', clubName: 'Sparta', status: 'Confirmed', requestedDates: ['2026-12-10'] }), // blocks time already: no mark
    ];
  });

  it('flags the day heading of the week: one inquiry opens its order, several ask which', async () => {
    mount();
    const two = await screen.findByTestId('day-inquiry-2026-12-10');
    expect(two).toHaveTextContent('Poptávka ×2');
    const one = screen.getByTestId('day-inquiry-2026-12-11');
    expect(one).toHaveTextContent('Poptávka');
    expect(one).not.toHaveTextContent('×');
    expect(screen.queryByTestId('day-inquiry-2026-12-09')).toBeNull();
    expect(screen.queryByTestId('day-inquiry-2026-12-17')).toBeNull(); // next week

    fireEvent.click(one);
    expect(lastLocation()).toMatchObject({ path: '/clubs/objednavky', state: { openOrderId: 'o1' } });
  });

  it('a day with several inquiries lists them in a popover, each opens its own order', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('day-inquiry-2026-12-10'));
    const pop = await screen.findByTestId('inquiry-popover');
    expect(within(pop).getAllByRole('button').map((b) => b.textContent)).toEqual(['Poptávka · Dukla', 'Poptávka · Slavia']);
    fireEvent.click(within(pop).getByTestId('inquiry-pop-o2'));
    expect(lastLocation()).toMatchObject({ state: { openOrderId: 'o2' } });
  });

  it('the month tile names the clubs that ask for the day; a confirmed order is not an inquiry', async () => {
    mount();
    await screen.findByTestId('day-inquiry-2026-12-10');
    click('Měsíc');
    expect(screen.getByTestId('tile-inquiry-2026-12-10')).toHaveTextContent('Poptávka · Dukla, Slavia');
    expect(screen.getByTestId('tile-inquiry-2026-12-11')).toHaveTextContent('Poptávka · Dukla');
    expect(screen.getByTestId('tile-inquiry-2026-12-17')).toHaveTextContent('Poptávka · Slavia');
    expect(screen.queryByTestId('tile-inquiry-2026-12-12')).toBeNull();
    expect(alternate().querySelector('[data-day="2026-12-10"]')).toHaveAttribute('data-inquiry', 'true');
  });

  it('the day list shows each inquiry as a dashed chip that opens the order', async () => {
    mount({ initialDate: '2026-12-10' });
    await screen.findByTestId('day-inquiry-2026-12-10');
    click('Den');
    const list = screen.getByTestId('day-inquiries');
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual(['Poptávka · Dukla', 'Poptávka · Slavia']);
    fireEvent.click(within(list).getByTestId('inquiry-chip-o1'));
    expect(lastLocation()).toMatchObject({ path: '/clubs/objednavky', state: { openOrderId: 'o1' } });
  });

  it('the order being processed reads "Klub žádá" on its days', async () => {
    mount({ config: { inquiryOrderId: 'o1' } });
    expect(await screen.findByTestId('day-inquiry-2026-12-11')).toHaveTextContent('Klub žádá');
  });

  it('a failed read of the orders draws no mark and does not break the board', async () => {
    vi.mocked(clubOrdersApi.list).mockRejectedValue(new Error('offline'));
    mount();
    await screen.findByTestId('board-booking-b1');
    expect(screen.queryByTestId('day-inquiry-2026-12-10')).toBeNull();
  });
});

void act;
void waitFor;
void calendar2;
