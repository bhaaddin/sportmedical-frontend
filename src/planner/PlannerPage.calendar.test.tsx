import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from '../api/bookingContracts';
import type { PickSession } from '../components/clubs/order/pickSession';
import { SidebarSlot, SidebarSlotProvider } from '../components/shell/SidebarSlot';
import { setViewport, VIEWPORTS } from '../test/viewport';
import { addDaysToDateOnly } from '../utils/time';
import { boardSettings } from './components/board/boardSettings';
import { DemoDataSource } from './data/DemoDataSource';

/*
 * The everyday calendar, on `/planovani`, through `PlannerPage` - what `CalendarGridPage` used to do, now that the
 * planner is the page: the board reads the clinic's real calendar (API mocked here), the router state other screens
 * hand over lands on the right thing, the settings stick. The board's own mechanics are tested in components/board;
 * this file proves the COMPOSITION a user meets at the route.
 */

vi.mock('../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../api/appointments', () => ({
  appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn() },
}));
vi.mock('../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../api/patients', () => ({ patientsApi: { getById: vi.fn() } }));
vi.mock('../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: actual.CALENDAR_DISPLAY_OFFLINE, loaded: true })) };
});
vi.mock('../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: Record<string, unknown>) => (
    <div role="dialog" aria-label="Nová objednávka" data-testid="new-appointment" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock('../components/booking/AppointmentDetail', () => ({
  AppointmentDetail: (props: { appointmentId: string; calendarId: string }) => (
    <div role="dialog" aria-label="Detail rezervace" data-testid="appointment-detail" data-id={props.appointmentId} data-calendar={props.calendarId} />
  ),
}));
vi.mock('../components/booking/calendar/AddToClubOrderDialog', () => ({ AddToClubOrderDialog: () => null }));
vi.mock('../components/clubs/order/ClubOrderEntry', () => ({
  ClubOrderEntry: (props: { open: boolean; onPhone: (clubId?: string) => void }) =>
    props.open ? (
      <div role="dialog" aria-label="Nová klubová objednávka" data-testid="club-entry">
        <button type="button" onClick={() => props.onPhone('club7')}>Vyplním sám</button>
      </div>
    ) : null,
}));
vi.mock('../components/booking/calendar/ClubBlockPopover', () => ({
  ClubBlockPopover: (props: { pick: unknown }) => (props.pick ? <div role="dialog" aria-label="Blok klubu" data-testid="club-popover" /> : null),
}));
vi.mock('../components/clubs/order/PickOrderSetup', () => ({
  PickOrderSetup: (props: { defaultClubId?: string; parent?: { orderId: string }; onStart: (s: PickSession) => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Nová klubová objednávka" data-testid="pick-setup" data-club={props.defaultClubId ?? ''} data-parent={props.parent?.orderId ?? ''}>
      <button type="button" onClick={() => props.onStart(SESSION)}>Začít plánovat</button>
    </div>
  ),
}));
const apiSource = vi.hoisted(() => ({ calls: [] as unknown[], source: null as unknown }));
vi.mock('./api/useApiDataSource', () => ({
  useApiDataSource: (options: unknown) => {
    apiSource.calls.push(options);
    return apiSource.source;
  },
}));

import { calendarsApi } from '../api/calendars';
import { clinicServicesApi } from '../api/clinicServices';
import { workingHoursApi } from '../api/workingHours';
import { appointmentsApi } from '../api/appointments';
import { activitiesApi } from '../api/activities';
import PlannerPage from './PlannerPage';

const TODAY = '2026-12-09'; // Wednesday
const ROW = 455 / 720;
const yOf = (minute: number) => (minute - 420) * ROW;
const BOARD_WIDTH = 700;
/* Two calendars on screen split every day into two columns (reviewer 2.4): `colX` is the FIRST calendar's column of a day, `col2X` the second's. */
const colX = (col: number) => col * (BOARD_WIDTH / 7) + 25;
const col2X = (col: number) => col * (BOARD_WIDTH / 7) + 75;

const SESSION: PickSession = {
  clubId: 'club1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Diagnostika', activities: [], paymentMethod: 'ClubInvoice', note: '',
};

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};
const second: Calendar = { ...calendar, id: 'c2', name: 'Ordinace 2', color: '#777777', sortOrder: 1, clinicServiceId: 's2' };

const appt = (id: string, startUtc: string, endUtc: string, extra: Partial<DayAppointment> = {}): DayAppointment => ({
  id, calendarId: 'c1', patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null, ...extra,
});
const b1 = appt('b1', '2026-12-08T08:00:00Z', '2026-12-08T08:30:00Z'); // Tuesday 09:00-09:30
let blocks: TimeBlock[] = [];
let appointments: DayAppointment[] = [b1];
let closedDays: string[] = [];

function stubLayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    if (el.id === 'day-board') return rect(0, 0, BOARD_WIDTH, 455);
    if (el.classList?.contains('board-selection')) return rect(111, 222, 90, 33);
    if (el.dataset?.bookingId) return rect(0, Number.parseFloat(el.style.top) || 0, 90, Number.parseFloat(el.style.height) || 0);
    return rect(0, 0, 0, 0);
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location" data-path={location.pathname} data-state={JSON.stringify(location.state)} />;
}

function mount(entry: { pathname?: string; state?: unknown } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[{ pathname: '/planovani', ...entry }]}>
        <SidebarSlotProvider available>
          <SidebarSlot />
          <LocationProbe />
          <Routes>
            <Route path="/planovani" element={<PlannerPage />} />
          </Routes>
        </SidebarSlotProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const board = () => document.getElementById('day-board') as HTMLElement;
const drag = (col: number, fromMinute: number, toMinute: number) => {
  fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(col), clientY: yOf(fromMinute), pointerId: 1 });
  fireEvent.pointerMove(board(), { pointerType: 'mouse', clientX: colX(col), clientY: yOf(toMinute), pointerId: 1 });
  fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: colX(col), clientY: yOf(toMinute), pointerId: 1 });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-09T08:15:00Z'));
  setViewport(VIEWPORTS.desktop);
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));
  boardSettings.reset();
  stubLayout();
  blocks = [];
  appointments = [b1];
  closedDays = [];
  apiSource.calls = [];
  apiSource.source = new DemoDataSource({ today: TODAY });
  vi.mocked(calendarsApi.list).mockResolvedValue([calendar, second]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([
    { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 2, calendars: 1, colorHex: '#1565C0' },
    { id: 's2', name: 'Lékařské prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: '#2E7D32' },
  ]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (_id, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      const closed = closedDays.includes(d);
      rows.push({
        date: d, isOpen: !closed, closedBecause: closed ? 'notAWorkingDay' : null,
        startTime: closed ? null : '08:00:00', endTime: closed ? null : '16:00:00', breakStart: closed ? null : '12:00:00', breakEnd: closed ? null : '12:30:00',
        workerUserId: 'u1', workerDisplayName: 'Anna Černá', isChangedByOverride: false, offeredActivityIds: closed ? [] : ['a1', 'a2'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockImplementation(async () => appointments);
  vi.mocked(appointmentsApi.blocks).mockImplementation(async (calendarId) => (calendarId === 'c1' ? blocks : []));
  vi.mocked(appointmentsApi.reschedule).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('/planovani draws the clinic\'s real calendar', () => {
  it('shows the bookings, a club\'s window as one block across lunch, a manual block, the lunch band and a closed day', async () => {
    // the day marks (holiday, hours, lunch) are the data source's: a closed Friday with its reason
    const marks = (apiSource.source as DemoDataSource).listDayMarks.bind(apiSource.source as DemoDataSource);
    (apiSource.source as DemoDataSource).listDayMarks = async (range) =>
      (await marks(range)).map((m) => (m.date === '2026-12-11' ? { ...m, closed: true, label: 'Státní svátek', hours: null, lunch: null } : m));
    const piece = (id: string, startUtc: string, endUtc: string): TimeBlock => ({ id, startUtc, endUtc, reason: '', kind: 'club', clubBlockId: 'cb1', clubId: 'club1', clubName: 'FK Slaný', colorHex: '#2E7D32' });
    blocks = [
      piece('k1', '2026-12-10T07:00:00Z', '2026-12-10T11:00:00Z'),
      piece('k2', '2026-12-10T11:30:00Z', '2026-12-10T15:00:00Z'),
      { id: 'm1', startUtc: '2026-12-08T11:00:00Z', endUtc: '2026-12-08T12:00:00Z', reason: 'Školení', kind: 'manual' },
    ];
    mount();
    expect(await screen.findByTestId('planner-page')).toHaveAttribute('data-mode', 'standard');
    const card = await screen.findByTestId('board-booking-b1');
    expect(card).toHaveTextContent('Pacient b1');
    expect(card).toHaveAttribute('data-col', '1');
    const club = await screen.findByTestId('board-window-k1-2026-12-10');
    expect(club).toHaveTextContent('FK Slaný');
    expect(within(club).getByTestId('club-window-time')).toHaveTextContent('08:00–16:00');
    expect(screen.queryByTestId('board-window-k2-2026-12-10')).toBeNull();
    expect(screen.getByTestId('board-window-m1-2026-12-08')).toHaveTextContent('Školení');
    expect(screen.getByTestId('lunch-2026-12-10')).toHaveTextContent('Oběd');
    expect(await screen.findByTestId('closed-2026-12-11')).toHaveTextContent('Státní svátek');
    expect(screen.queryByTestId('lunch-2026-12-11')).toBeNull(); // a closed day has no lunch band
  });

  it('a free slot: the marked time offers "Objednat pacienta", which opens the booking bubble on that calendar and time', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    drag(3, 13 * 60, 14 * 60); // Thursday 13:00 - 14:30
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props).toMatchObject({
      open: true, initialDate: '2026-12-10', initialCalendarId: 'c1', initialStart: '2026-12-10T13:00', initialEnd: '2026-12-10T14:30',
      anchor: { x: 111, y: 222, width: 90, height: 33 },
    });
  });

  it('the same marked time in the second calendar column opens the booking on THAT calendar (reviewer 2.4)', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: col2X(3), clientY: yOf(13 * 60), pointerId: 1 });
    fireEvent.pointerMove(board(), { pointerType: 'mouse', clientX: col2X(3), clientY: yOf(14 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: col2X(3), clientY: yOf(14 * 60), pointerId: 1 });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props).toMatchObject({ initialDate: '2026-12-10', initialCalendarId: 'c2', initialStart: '2026-12-10T13:00' });
  });

  it('moving a booking asks first; "Přesunout" sends it with notifyPatient as the checkbox says', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b1'); // Tuesday 09:00
    const top = Number.parseFloat(card.style.top);
    fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: colX(1), clientY: top + 2, pointerId: 7 });
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: colX(3), clientY: yOf(10 * 60 + 30) + 2, pointerId: 7 });
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: colX(3), clientY: yOf(10 * 60 + 30) + 2, pointerId: 7 });
    const ask = await screen.findByTestId('move-confirm');
    expect(ask).toHaveTextContent('Přesunutí rezervace');
    expect(appointmentsApi.reschedule).not.toHaveBeenCalled();
    const notify = within(ask).getByRole('checkbox', { name: 'Upozornit klienta na změnu' });
    expect(notify).toBeChecked();
    fireEvent.click(within(ask).getByRole('button', { name: 'Přesunout' }));
    await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(1));
    expect(appointmentsApi.reschedule).toHaveBeenCalledWith('c1', 'b1', '2026-12-10T09:30:00.000Z', undefined, { notifyPatient: true });
  });
});

describe('/planovani remembers what the desk set', () => {
  it('the resolution (the zoom) is kept under calendarZoomV2 and is still there after the page is opened again', async () => {
    const view = mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    fireEvent.click(await screen.findByRole('button', { name: '15 min' }));
    expect(window.localStorage.getItem('calendarZoomV2')).toBe('3.5');
    expect(board()).toHaveAttribute('data-step', '15');
    view.unmount();
    boardSettings.reset(); // "a reload": the store is built again from the same storage
    mount();
    await screen.findByTestId('board-booking-b1');
    expect(board()).toHaveAttribute('data-step', '15');
  });

  it('a služba switched off (the gear, row Služby) stays off across the week arrows and the Den / Měsíc / Týden switches', async () => {
    appointments = [b1, appt('b9', '2026-12-08T10:00:00Z', '2026-12-08T10:30:00Z', { calendarId: 'c2' })];
    mount();
    await screen.findByTestId('board-booking-b1');
    // the old sidebar legend is gone: no stray SLUŽBY block outside the stage
    expect(screen.queryByTestId('planner-service-legend')).toBeNull();
    act(() => boardSettings.toggleService('s1', ['s1', 's2']));
    expect(boardSettings.getState().serviceSet?.has('s1')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Další týden|Následující týden/i }));
    fireEvent.click(screen.getByRole('button', { name: /Předchozí týden/i }));
    expect(boardSettings.getState().serviceSet?.has('s1')).toBe(false);
    for (const view of ['Den', 'Měsíc', 'Týden']) fireEvent.click(screen.getByRole('button', { name: view }));
    expect(boardSettings.getState().serviceSet?.has('s1')).toBe(false);
    expect(boardSettings.getState().serviceSet?.has('s2')).toBe(true);
  });
});

describe('/planovani takes what other screens hand over by router state', () => {
  it('the shell\'s "Nová objednávka" (state.newAppointment) opens the booking on the next free slot, once', async () => {
    mount({ state: { newAppointment: 1 } });
    const props = JSON.parse((await screen.findByTestId('new-appointment', undefined, { timeout: 3000 })).dataset.props!);
    expect(props).toMatchObject({ open: true, initialCalendarId: 'c1', initialDate: TODAY, initialStart: '2026-12-09T09:30' });
    expect(props.initialPatientId).toBeUndefined();
  });

  it('a patient\'s "Objednat termín" (newAppointment + patientId) books for that patient', async () => {
    mount({ state: { newAppointment: 2, patientId: 'p9' } });
    const props = JSON.parse((await screen.findByTestId('new-appointment', undefined, { timeout: 3000 })).dataset.props!);
    expect(props).toMatchObject({ initialPatientId: 'p9', initialCalendarId: 'c1' });
  });

  it('"Zobrazit v kalendáři" from the club reservations (state.date) moves the board to that week', async () => {
    mount({ state: { date: '2026-12-22' } });
    await waitFor(() => expect(document.getElementById('week-range')).toHaveTextContent('21. – 27. prosince 2026'));
  });

  it('"Vybrat v kalendáři" of the new-order chooser (state.serviceId) shows only that služba', async () => {
    mount({ state: { serviceId: 's2' } });
    await waitFor(() => expect([...(boardSettings.getState().serviceSet ?? [])]).toEqual(['s2']));
  });

  it('the sidebar\'s and the toolbar\'s "Klubová objednávka" (state.openClubOrder) open the chooser; "Vyplním sám" asks for the setup, then club planning starts', async () => {
    mount({ state: { openClubOrder: true } });
    fireEvent.click(within(await screen.findByTestId('club-entry')).getByRole('button', { name: 'Vyplním sám' }));
    const setup = await screen.findByTestId('pick-setup');
    expect(setup).toHaveAttribute('data-club', 'club7');
    fireEvent.click(within(setup).getByRole('button', { name: 'Začít plánovat' }));
    await waitFor(() => expect(screen.getByTestId('planner-page')).toHaveAttribute('data-mode', 'club'));
    expect(screen.getByTestId('location').dataset.path).toBe('/planovani');
    expect(screen.getByTestId('club-header')).toHaveAttribute('data-mode', 'club');
  });

  it('a club\'s card ("Vyplním sám" with a club) opens the setup form for that club on the calendar', async () => {
    mount({ state: { pickOrder: { clubId: 'club7' } } });
    expect(await screen.findByTestId('pick-setup')).toHaveAttribute('data-club', 'club7');
  });

  it('"Přidat další službu / další hráče" (an addendum) opens the setup locked to the parent order', async () => {
    mount({ state: { pickOrder: { clubId: 'club1', parent: { orderId: 'o1', clubId: 'club1', clubName: 'FK Slaný', paymentMethod: 'ClubInvoice' } } } });
    const setup = await screen.findByTestId('pick-setup');
    expect(setup).toHaveAttribute('data-parent', 'o1');
    expect(setup).toHaveAttribute('data-club', 'club1');
  });

  it('"Upravit termíny" / "Přidat hráče / rozšířit" (an edit session) plans that order: the whole planner interface, the session handed to the data source', async () => {
    const edit: PickSession = { ...SESSION, editOrder: { orderId: 'o1', mode: 'edit', code: 'KO-1', ranges: [], athletes: 0 } as unknown as PickSession['editOrder'] };
    mount({ state: { pickOrder: { start: edit } } });
    expect(await screen.findByTestId('planner-page')).toHaveAttribute('data-mode', 'club');
    await screen.findByTestId('week-board-panel');
    expect(apiSource.calls.at(-1)).toMatchObject({ session: { editOrder: { orderId: 'o1', mode: 'edit' }, clubId: 'club1' } });
    expect(screen.getByTestId('club-header')).toHaveAttribute('data-mode', 'club');
    expect(screen.queryByTestId('pick-setup')).toBeNull();
  });
});
