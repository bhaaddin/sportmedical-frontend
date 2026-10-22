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
  (document as { elementFromPoint?: unknown }).elementFromPoint = vi.fn((x: number) => document.querySelector(`[data-range-day="${hoverDay(x)}"]`));
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
    /* the month matrix is a lazy view: it appears a moment after the click */
    expect(await screen.findByTestId('tile-inquiry-2026-12-10')).toHaveTextContent('Poptávka · Dukla, Slavia');
    expect(screen.getByTestId('tile-inquiry-2026-12-11')).toHaveTextContent('Poptávka · Dukla');
    expect(screen.getByTestId('tile-inquiry-2026-12-17')).toHaveTextContent('Poptávka · Slavia');
    expect(screen.queryByTestId('tile-inquiry-2026-12-12')).toBeNull();
    expect(alternate().querySelector('[data-day="2026-12-10"]')).toHaveAttribute('data-inquiry', 'true');
  });

  it('the day list shows each inquiry as a dashed chip that opens the order', async () => {
    mount({ initialDate: '2026-12-10' });
    await screen.findByTestId('day-inquiry-2026-12-10');
    click('Den');
    const list = await screen.findByTestId('day-inquiries');
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

/* ------------------------------------------------------------------------ */
/* 2. the month: several days at once, "Zablokovat celé dny"                  */
/* ------------------------------------------------------------------------ */

const tile = (day: string) => alternate().querySelector<HTMLElement>(`[data-day="${day}"]`)!;
/** A mouse press on a tile, travelling to `to`, let go there. */
function dragDays(from: string, to: string, init: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) {
  fireEvent.pointerDown(tile(from), { button: 0, pointerType: 'mouse', clientX: over(from), clientY: 10, pointerId: 1, ...init });
  fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: over(to), clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: over(to), clientY: 10, pointerId: 1 });
  fireEvent.click(tile(to), init);
}
async function openMonth() {
  mount();
  await screen.findByTestId('board-booking-b1');
  click('Měsíc');
  await screen.findByTestId('month-matrix');
}

describe('the month: marking days', () => {
  it('a drag across days opens the popover for the run: book from its first day, block, hand to a club order', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16');
    const menu = await screen.findByRole('menu', { name: 'Akce pro vybraný čas' });
    const paper = menu.closest('[role="presentation"]') as HTMLElement;
    expect(within(paper).getByText('14. 12. – 16. 12.')).toBeInTheDocument();
    expect(within(paper).getByText('3 dny')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Objednat pacienta/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Zablokovat čas/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Přidat do objednávky klubu/ })).toBeInTheDocument();
    expect(alternate()).toHaveTextContent('Prosinec 2026'); // the drag did not open a day
    for (const day of ['2026-12-14', '2026-12-15', '2026-12-16']) expect(tile(day)).toHaveAttribute('data-picked', 'true');
    expect(tile('2026-12-17')).not.toHaveAttribute('data-picked');
    expect(screen.getByTestId('range-pill')).toHaveTextContent('14. 12. – 16. 12. · 3 dny');
  });

  it('the run lights up while it is dragged', async () => {
    await openMonth();
    fireEvent.pointerDown(tile('2026-12-14'), { button: 0, pointerType: 'mouse', clientX: over('2026-12-14'), clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: over('2026-12-15'), clientY: 10, pointerId: 1 });
    expect(tile('2026-12-15')).toHaveAttribute('data-picked', 'true');
    expect(screen.getByTestId('month-matrix')).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: over('2026-12-15'), clientY: 10, pointerId: 1 });
  });

  it('"Objednat pacienta" opens the booking on the first day of the run, in the first calendar', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props).toMatchObject({ initialDate: '2026-12-14', initialCalendarId: 'c1' });
  });

  it('"Přidat do objednávky klubu" hands the run to the club order dialog as whole days', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Přidat do objednávky klubu/ }));
    expect(JSON.parse((await screen.findByTestId('add-to-club')).dataset.marked!)).toMatchObject({ kind: 'days', from: '2026-12-14', to: '2026-12-16' });
  });

  it('"Zablokovat čas" on the run asks for the reason and blocks whole days, midnight to midnight, in every calendar ticked', async () => {
    calendars = [calendar, calendar2];
    vi.mocked(appointmentsApi.createBlock).mockResolvedValue({ id: 'new', startUtc: '', endUtc: '', reason: 'Dovolená' } as TimeBlock);
    await openMonth();
    dragDays('2026-12-14', '2026-12-16');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Zablokovat čas/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Zablokovat celé dny' });
    expect(within(dialog).getByTestId('days-block-list')).toHaveTextContent('14. 12. – 16. 12. · 3 dny');
    fireEvent.click(within(dialog).getByLabelText('Ordinace 2')); // not this one
    fireEvent.change(within(dialog).getByLabelText(/Důvod blokace/), { target: { value: 'Dovolená' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    await waitFor(() => expect(appointmentsApi.createBlock).toHaveBeenCalledTimes(1));
    const [calendarId, startUtc, endUtc, reason] = vi.mocked(appointmentsApi.createBlock).mock.calls[0]!;
    expect(calendarId).toBe('c1');
    expect(new Date(startUtc as string).toISOString()).toBe('2026-12-13T23:00:00.000Z'); // 14. 12. 00:00 Prague
    expect(new Date(endUtc as string).toISOString()).toBe('2026-12-16T23:00:00.000Z'); // 17. 12. 00:00 Prague
    expect(reason).toBe('Dovolená');
    expect(await screen.findByText('Zablokováno: 1 místo.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Zablokovat celé dny' })).toBeNull());
    expect(tile('2026-12-14')).not.toHaveAttribute('data-picked');
  });

  it('a plain click on a day still opens it, and Esc drops the marked run', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16');
    await screen.findByRole('menu', { name: 'Akce pro vybraný čas' });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu', { name: 'Akce pro vybraný čas' })).toBeNull());
    expect(tile('2026-12-14')).not.toHaveAttribute('data-picked');
    act(() => { vi.setSystemTime(Date.now() + 500); }); // the click after a drag is over
    dragDays('2026-12-18', '2026-12-18'); // press and release on one day
    expect(screen.queryByRole('menu', { name: 'Akce pro vybraný čas' })).toBeNull();
    expect(alternate()).toHaveTextContent('Pá 18. 12. 2026 · Denní přehled');
  });
});

describe('the month: Ctrl-drag adds places, the tray blocks them all', () => {
  it('Ctrl (or Cmd, Shift) keeps what is marked and adds a place; nothing opens, no day is entered', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16', { ctrlKey: true });
    dragDays('2026-12-21', '2026-12-21', { metaKey: true });
    dragDays('2026-12-30', '2026-12-28', { shiftKey: true });
    expect(screen.queryByRole('menu', { name: 'Akce pro vybraný čas' })).toBeNull();
    const tray = screen.getByTestId('day-tray');
    expect(tray).toHaveTextContent('3 místa');
    expect(within(tray).getAllByTestId('day-tray-chip').map((c) => c.textContent?.replace('×', ''))).toEqual(['14. 12. – 16. 12.', 'Po 21. 12.', '28. 12. – 30. 12.']);
    expect(alternate()).toHaveTextContent('Prosinec 2026');
    expect(tile('2026-12-15')).toHaveAttribute('data-picked', 'true');
    expect(tile('2026-12-29')).toHaveAttribute('data-picked', 'true');
  });

  it('a chip is taken out with its x, "Zrušit výběr" drops them all', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16', { ctrlKey: true });
    dragDays('2026-12-21', '2026-12-21', { ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Odebrat 14. 12. – 16. 12. z výběru' }));
    expect(within(screen.getByTestId('day-tray')).getAllByTestId('day-tray-chip')).toHaveLength(1);
    expect(tile('2026-12-15')).not.toHaveAttribute('data-picked');
    fireEvent.click(screen.getByTestId('day-tray-clear'));
    expect(screen.queryByTestId('day-tray')).toBeNull();
  });

  it('a plain press starts over', async () => {
    await openMonth();
    dragDays('2026-12-14', '2026-12-16', { ctrlKey: true });
    dragDays('2026-12-21', '2026-12-23');
    expect(screen.queryByTestId('day-tray')).toBeNull();
    expect(tile('2026-12-15')).not.toHaveAttribute('data-picked');
  });

  it('"Zablokovat dny" blocks every place in every ticked calendar and says how many it saved', async () => {
    calendars = [calendar, calendar2];
    vi.mocked(appointmentsApi.createBlock).mockResolvedValue({ id: 'new', startUtc: '', endUtc: '', reason: 'Školení' } as TimeBlock);
    await openMonth();
    dragDays('2026-12-14', '2026-12-15', { ctrlKey: true });
    dragDays('2026-12-21', '2026-12-21', { ctrlKey: true });
    fireEvent.click(screen.getByTestId('day-tray-block'));
    const dialog = await screen.findByRole('dialog', { name: 'Zablokovat celé dny' });
    expect(within(dialog).getByTestId('days-block-list')).toHaveTextContent('14. 12. – 15. 12. · 2 dny');
    expect(within(dialog).getByTestId('days-block-list')).toHaveTextContent('Po 21. 12. · 1 den');
    fireEvent.change(within(dialog).getByLabelText(/Důvod blokace/), { target: { value: 'Školení' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    await waitFor(() => expect(appointmentsApi.createBlock).toHaveBeenCalledTimes(4));
    const calls = vi.mocked(appointmentsApi.createBlock).mock.calls.map(([id, start, end]) => [id, new Date(start as string).toISOString(), new Date(end as string).toISOString()]);
    expect(calls).toEqual([
      ['c1', '2026-12-13T23:00:00.000Z', '2026-12-15T23:00:00.000Z'],
      ['c2', '2026-12-13T23:00:00.000Z', '2026-12-15T23:00:00.000Z'],
      ['c1', '2026-12-20T23:00:00.000Z', '2026-12-21T23:00:00.000Z'],
      ['c2', '2026-12-20T23:00:00.000Z', '2026-12-21T23:00:00.000Z'],
    ]);
    expect(await screen.findByText('Zablokováno: 2 místa.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('day-tray')).toBeNull());
  });

  it("the server's refusal (a patient is booked) stays in the dialog, the marks stay, nothing is announced", async () => {
    vi.mocked(appointmentsApi.createBlock).mockRejectedValue(new Error('V tomto čase je objednaný pacient.'));
    await openMonth();
    dragDays('2026-12-14', '2026-12-15', { ctrlKey: true });
    fireEvent.click(screen.getByTestId('day-tray-block'));
    const dialog = await screen.findByRole('dialog', { name: 'Zablokovat celé dny' });
    fireEvent.change(within(dialog).getByLabelText(/Důvod blokace/), { target: { value: 'Školení' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zablokovat' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/^Zablokováno:/)).toBeNull();
    expect(screen.getByTestId('day-tray')).toBeInTheDocument();
  });

  it('a place in the past is marked as such and cannot be blocked; with a place of today on, only that one is', async () => {
    await openMonth();
    dragDays('2026-12-07', '2026-12-07', { ctrlKey: true });
    const chip = within(screen.getByTestId('day-tray')).getByTestId('day-tray-chip');
    expect(chip).toHaveAttribute('data-past', 'true');
    expect(chip).toHaveTextContent('v minulosti');
    expect(tile('2026-12-07')).toHaveAttribute('data-picked', 'past');
    expect(screen.getByTestId('day-tray-block')).toBeDisabled();
    dragDays('2026-12-21', '2026-12-21', { ctrlKey: true });
    expect(screen.getByTestId('day-tray-block')).toBeEnabled();
    fireEvent.click(screen.getByTestId('day-tray-block'));
    expect(await screen.findByTestId('days-block-list')).toHaveTextContent('Po 21. 12. · 1 den');
    expect(screen.getByTestId('days-block-list').querySelectorAll('li')).toHaveLength(1);
  });

  it('touch: "Vybrat víc dnů" turns every tap into a mark, "Vybrat od–do" taps the first and the last day', async () => {
    await openMonth();
    fireEvent.click(screen.getByTestId('month-tool-more'));
    fireEvent.click(tile('2026-12-14'));
    fireEvent.click(tile('2026-12-18'));
    expect(within(screen.getByTestId('day-tray')).getAllByTestId('day-tray-chip')).toHaveLength(2);
    expect(alternate()).toHaveTextContent('Prosinec 2026'); // no tap opened a day
    fireEvent.click(screen.getByTestId('month-tool-more')); // off
    fireEvent.click(screen.getByTestId('day-tray-clear'));
    fireEvent.click(screen.getByTestId('month-tool-range'));
    fireEvent.click(tile('2026-12-22'));
    expect(tile('2026-12-22')).toHaveAttribute('data-picked', 'true');
    fireEvent.click(tile('2026-12-24'));
    const menu = await screen.findByRole('menu', { name: 'Akce pro vybraný čas' });
    expect(within(menu.closest('[role="presentation"]') as HTMLElement).getByText('22. 12. – 24. 12.')).toBeInTheDocument();
  });

  it('touch: a press held 380 ms starts the drag across days, a quick tap does not', async () => {
    await openMonth();
    const touch = { button: 0, pointerType: 'touch', pointerId: 2, clientY: 10 };
    /* a quick touch: pointer up before the long press - nothing is marked, the click opens the day later */
    fireEvent.pointerDown(tile('2026-12-14'), { ...touch, clientX: over('2026-12-14') });
    fireEvent.pointerUp(tile('2026-12-14'), { ...touch, clientX: over('2026-12-14') });
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    expect(tile('2026-12-14')).not.toHaveAttribute('data-picked');
    /* held: the drag starts, the finger travels, the run is chosen */
    fireEvent.pointerDown(tile('2026-12-14'), { ...touch, clientX: over('2026-12-14') });
    await act(async () => { await new Promise((r) => setTimeout(r, 450)); });
    expect(screen.getByTestId('month-matrix')).toHaveAttribute('data-dragging', 'true');
    fireEvent.pointerMove(window, { ...touch, clientX: over('2026-12-17') });
    fireEvent.pointerUp(window, { ...touch, clientX: over('2026-12-17') });
    const menu = await screen.findByRole('menu', { name: 'Akce pro vybraný čas' });
    expect(within(menu.closest('[role="presentation"]') as HTMLElement).getByText('14. 12. – 17. 12.')).toBeInTheDocument();
  });

  it('a whole-day block of the desk is named on its tile; a part of a day and a club window are not', async () => {
    blocks = [
      { id: 'm1', startUtc: '2026-12-14T23:00:00Z', endUtc: '2026-12-15T23:00:00Z', reason: 'Dovolená', kind: 'manual' }, // the 15th, whole
      { id: 'm2', startUtc: '2026-12-16T08:00:00Z', endUtc: '2026-12-16T09:00:00Z', reason: 'Školení', kind: 'manual' },
      { id: 'k1', startUtc: '2026-12-17T07:00:00Z', endUtc: '2026-12-17T15:00:00Z', reason: '', kind: 'club', clubBlockId: 'cb1', clubName: 'FK Slaný' },
    ];
    await openMonth();
    await waitFor(() => expect(screen.getByTestId('tile-blocked-2026-12-15')).toHaveTextContent('Blokováno'));
    expect(screen.queryByTestId('tile-blocked-2026-12-16')).toBeNull();
    expect(screen.queryByTestId('tile-blocked-2026-12-17')).toBeNull();
  });

  it('offers nothing without the permission to book or block', async () => {
    window.localStorage.setItem('permissions', JSON.stringify([]));
    await openMonth();
    expect(screen.queryByTestId('month-tools')).toBeNull();
    expect(tile('2026-12-14')).not.toHaveAttribute('data-range-day');
    dragDays('2026-12-14', '2026-12-16');
    expect(screen.queryByRole('menu', { name: 'Akce pro vybraný čas' })).toBeNull();
  });

  it('while a club order is planned the month marks days FOR THE ORDER: the tray plans them, it does not block them', async () => {
    mount({ config: { mode: 'club' } });
    await screen.findByTestId('board-booking-b1');
    click('Měsíc');
    await screen.findByTestId('month-matrix');
    expect(screen.getByTestId('month-tools')).toHaveTextContent(/Klepnutím na den ho naplánujete celý/);
    click('Vybrat víc dnů');
    fireEvent.click(document.querySelector('.month-tile[data-day="2026-12-09"]')!);
    const tray = await screen.findByTestId('day-tray');
    expect(within(tray).getByTestId('day-tray-plan')).toHaveTextContent('Naplánovat vybrané dny');
    expect(within(tray).queryByTestId('day-tray-block')).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/* 3. the phone's list                                                        */
/* ------------------------------------------------------------------------ */

const agenda = () => screen.getByTestId('phone-agenda');
async function openAgenda(opts: { initialDate?: string } = {}) {
  mount({ layout: 'phone', ...opts });
  await screen.findByRole('button', { name: 'Den' });
  click('Den');
  await screen.findByTestId('phone-agenda');
}
const piece = (id: string, startUtc: string, endUtc: string): TimeBlock => ({ id, startUtc, endUtc, reason: '', kind: 'club', clubBlockId: 'cb1', clubId: 'club1', clubName: 'FK Slaný', colorHex: '#2E7D32' });

describe('the phone: Den is an agenda of the day under the week\'s strip', () => {
  beforeEach(() => {
    blocks = [
      piece('k1', '2026-12-09T07:00:00Z', '2026-12-09T11:00:00Z'), // Wednesday 08:00-12:00
      { id: 'm1', startUtc: '2026-12-09T12:00:00Z', endUtc: '2026-12-09T13:00:00Z', reason: 'Školení', kind: 'manual' }, // Wednesday 13:00-14:00
    ];
    clubOrders = [order({ id: 'o1', clubName: 'Dukla', status: 'Requested', requestedDates: ['2026-12-09', '2026-12-11'] })];
  });

  it('is a list, not the grid: bookings, club windows and blocks in the order they start, with what each is', async () => {
    await openAgenda();
    const list = await within(agenda()).findByTestId('phone-day-list');
    await waitFor(() => expect(within(list).getAllByRole('button')).toHaveLength(3));
    const rows = within(list).getAllByRole('button');
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual(['club', 'booking', 'block']);
    expect(rows[0]).toHaveTextContent('08:00–12:00');
    expect(rows[0]).toHaveTextContent('FK Slaný');
    expect(rows[1]).toHaveTextContent('10:00 – 10:30');
    expect(rows[1]).toHaveTextContent('Pacient b2');
    expect(rows[1]).toHaveTextContent('Fyzio');
    expect(rows[2]).toHaveTextContent('Školení');
    expect(rows[2]).toHaveTextContent('Ordinace 1');
    expect(agenda()).toHaveTextContent('St 9. 12. 2026 · Denní přehled');
    expect(document.getElementById('day-board')).toBeTruthy(); // the board is kept behind, hidden, not torn down
    expect(screen.getByTestId('alternate-view')).not.toHaveAttribute('hidden');
  });

  it('the strip counts each day of the week, dots the clubs and rings the inquiries', async () => {
    await openAgenda();
    await within(agenda()).findByTestId('phone-day-list');
    const strip = within(agenda()).getByRole('group', { name: 'Dny týdne' });
    expect(within(strip).getAllByRole('button')).toHaveLength(7);
    const tuesday = within(strip).getByTestId('phone-strip-2026-12-08');
    expect(tuesday).toHaveTextContent('Út');
    expect(tuesday).toHaveTextContent('1'); // b1
    const wednesday = within(strip).getByTestId('phone-strip-2026-12-09');
    expect(wednesday).toHaveAttribute('aria-pressed', 'true');
    expect(wednesday).toHaveAttribute('aria-current', 'date');
    expect(within(wednesday).getByTestId('club-dots')).toBeInTheDocument();
    expect(within(wednesday).getByTestId('inquiry-dot')).toBeInTheDocument();
    expect(within(strip).getByTestId('phone-strip-2026-12-11')).toContainElement(within(strip).getByTestId('phone-strip-2026-12-11').querySelector('[data-testid="inquiry-dot"]'));
    expect(within(tuesday).queryByTestId('inquiry-dot')).toBeNull();
  });

  it('reads the whole week for the strip, not only the day', async () => {
    await openAgenda();
    await waitFor(() => expect(vi.mocked(appointmentsApi.range).mock.calls.some(([from, to]) => from === '2026-12-07' && to === '2026-12-13')).toBe(true));
  });

  it('a tap on a day of the strip shows that day; a swipe moves a day on or back', async () => {
    await openAgenda();
    fireEvent.click(within(agenda()).getByTestId('phone-strip-2026-12-08'));
    expect(agenda()).toHaveTextContent('Út 8. 12. 2026 · Denní přehled');
    expect(within(agenda()).getByTestId('phone-day-list')).toHaveTextContent('Pacient b1');
    fireEvent.touchStart(agenda(), { touches: [{ clientX: 300, clientY: 200 }] });
    fireEvent.touchEnd(agenda(), { changedTouches: [{ clientX: 120, clientY: 210 }] });
    expect(agenda()).toHaveTextContent('St 9. 12. 2026 · Denní přehled');
    fireEvent.touchStart(agenda(), { touches: [{ clientX: 100, clientY: 200 }] });
    fireEvent.touchEnd(agenda(), { changedTouches: [{ clientX: 300, clientY: 205 }] });
    expect(agenda()).toHaveTextContent('Út 8. 12. 2026 · Denní přehled');
    /* a mostly vertical move is a scroll, not a swipe */
    fireEvent.touchStart(agenda(), { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(agenda(), { changedTouches: [{ clientX: 250, clientY: 300 }] });
    expect(agenda()).toHaveTextContent('Út 8. 12. 2026 · Denní přehled');
  });

  it('a booking opens its detail, a club window the club\'s popover, a block its detail', async () => {
    await openAgenda();
    fireEvent.click(await within(agenda()).findByTestId('phone-entry-b2'));
    expect((await screen.findByTestId('appointment-detail')).dataset.id).toBe('b2');
    cleanup();
    await openAgenda();
    await within(agenda()).findByTestId('phone-entry-b2');
    await waitFor(() => expect(within(agenda()).getAllByRole('button').some((b) => b.getAttribute('data-kind') === 'club')).toBe(true));
    fireEvent.click(within(agenda()).getAllByRole('button').find((b) => b.getAttribute('data-kind') === 'club')!);
    expect(JSON.parse((await screen.findByTestId('club-popover')).dataset.pick!)).toMatchObject({ clubBlockId: 'cb1', clubName: 'FK Slaný' });
    fireEvent.click(within(agenda()).getAllByRole('button').find((b) => b.getAttribute('data-kind') === 'block')!);
    expect(await screen.findByRole('dialog', { name: /Zablokovaný čas/ })).toHaveTextContent('Školení');
  });

  it('the day\'s inquiries are chips above the list; one opens the order', async () => {
    await openAgenda();
    const chips = await screen.findByTestId('day-inquiries');
    fireEvent.click(within(chips).getByTestId('inquiry-chip-o1'));
    expect(lastLocation()).toMatchObject({ path: '/clubs/objednavky', state: { openOrderId: 'o1' } });
  });

  it('an empty day says so and offers the booking', async () => {
    await openAgenda();
    fireEvent.click(within(agenda()).getByTestId('phone-strip-2026-12-12'));
    expect(within(agenda()).queryByTestId('phone-day-list')).toBeNull();
    expect(within(agenda()).getByTestId('phone-empty')).toHaveTextContent('Na vybraný den zatím nejsou vytvořené termíny.');
    fireEvent.click(within(agenda()).getByRole('button', { name: 'Nová objednávka' }));
    expect(await screen.findByTestId('new-appointment')).toBeInTheDocument();
  });

  it('a closed day is named in the strip', async () => {
    await openAgenda({ initialDate: '2026-11-26' });
    const day = within(agenda()).getByTestId('phone-strip-2026-11-26');
    expect(day).toHaveClass('is-closed');
    expect(day).toHaveAttribute('aria-label', expect.stringContaining('Zavřeno (ukázka)'));
  });
});

describe('the phone: Měsíc is a list of days', () => {
  beforeEach(() => {
    blocks = [piece('k1', '2026-12-09T07:00:00Z', '2026-12-09T15:00:00Z'), { id: 'm1', startUtc: '2026-12-14T23:00:00Z', endUtc: '2026-12-15T23:00:00Z', reason: 'Dovolená', kind: 'manual' }];
    clubOrders = [order({ id: 'o1', clubName: 'Dukla', status: 'Requested', requestedDates: ['2026-12-10'] })];
  });
  async function openPhoneMonth() {
    mount({ layout: 'phone' });
    await screen.findByRole('button', { name: 'Měsíc' });
    click('Měsíc');
    return screen.findByTestId('phone-month-list');
  }

  it('is one row per day of the month, no tiles and no marking tools', async () => {
    const list = await openPhoneMonth();
    expect(within(list).getAllByRole('listitem')).toHaveLength(31);
    expect(screen.queryByTestId('month-matrix')).toBeNull();
    expect(screen.queryByTestId('month-tools')).toBeNull();
    expect(alternate()).toHaveTextContent('Prosinec 2026 · Měsíční přehled');
    const wednesday = within(list).getByTestId('phone-month-day-2026-12-09');
    expect(wednesday).toHaveTextContent('St');
    expect(wednesday).toHaveAttribute('aria-current', 'date');
  });

  it('writes out what a day holds: bookings, the club\'s window, the inquiry, a day blocked whole', async () => {
    const list = await openPhoneMonth();
    await waitFor(() => expect(within(list).getByTestId('phone-month-club-2026-12-09')).toHaveTextContent('FK Slaný · 08:00–16:00'));
    /* the day by činnost (reviewer 2.2), not a count of terms: b2 is one Fyzio booking */
    expect(within(list).getByTestId('phone-month-activity-2026-12-09')).toHaveTextContent('Fyzio · 1 slot');
    expect(within(list).getByTestId('phone-month-inquiry-2026-12-10')).toHaveTextContent('Poptávka · Dukla');
    expect(within(list).getByTestId('phone-month-blocked-2026-12-15')).toHaveTextContent('Blokováno');
    expect(within(list).getByTestId('phone-month-day-2026-12-20')).toHaveTextContent('Žádné rezervace');
  });

  it('a tap on a row opens that day as the agenda', async () => {
    const list = await openPhoneMonth();
    fireEvent.click(within(list).getByTestId('phone-month-day-2026-12-08'));
    expect(await screen.findByTestId('phone-agenda')).toHaveTextContent('Út 8. 12. 2026 · Denní přehled');
    expect(within(agenda()).getByTestId('phone-day-list')).toHaveTextContent('Pacient b1');
  });
});

describe('the other layouts keep the file\'s own list and tiles', () => {
  it.each(['tablet', 'desktop'] as const)('%s: Den is the file\'s list, Měsíc the tiles', async (layout) => {
    mount({ layout });
    await screen.findByRole('button', { name: 'Den' });
    click('Den');
    expect(screen.queryByTestId('phone-agenda')).toBeNull();
    expect(alternate()).toHaveTextContent('Denní přehled');
    click('Měsíc');
    expect(screen.queryByTestId('phone-month-list')).toBeNull();
    expect(alternate().querySelectorAll('.month-tile')).toHaveLength(42);
  });
});

void act;
void actions;
