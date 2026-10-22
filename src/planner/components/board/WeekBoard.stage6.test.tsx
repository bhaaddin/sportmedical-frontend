import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import { addDaysToDateOnly } from '../../../utils/time';
import { DemoDataSource } from '../../data/DemoDataSource';
import type { PlannerCatalogue } from '../../data/PlannerDataSource';
import { usePlannerActions } from '../../state/PlannerStoreProvider';
import { DialogLayer } from '../DialogLayer';
import { Toast } from '../Toast';
import { PlannerGate } from '../PlannerGate';
import { PlannerProviders } from '../PlannerProviders';
import { PlannerStage } from '../PlannerStage';
import { WeekBoardPanel } from '../WeekBoardPanel';
import { BoardConfigProvider, type BoardConfig } from './boardConfig';
import { boardSettings } from './boardSettings';

/*
 * The week board, function by function: on the demo data source (the file) and - with the clinic's
 * calendar API mocked - on the real calendar (book, block, move, summary, filters).
 */

vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: vi.fn() } }));
vi.mock('../../../api/clinicServices', () => ({ clinicServicesApi: { list: vi.fn() } }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { preview: vi.fn() } }));
vi.mock('../../../api/appointments', () => ({
  appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn(), create: vi.fn(), createUnregistered: vi.fn() },
}));
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: vi.fn() } }));
vi.mock('../../../api/patients', () => ({ patientsApi: { getById: vi.fn() } }));
vi.mock('../../../api/client', () => ({ default: { get: vi.fn().mockRejectedValue(new Error('offline')) }, client: {} }));
vi.mock('../../../api/displaySettings', async (importActual) => {
  const actual = await importActual<typeof import('../../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: vi.fn(() => ({ settings: { ...actual.CALENDAR_DISPLAY_OFFLINE, nowLineColor: '#6A1B9A' }, loaded: true })) };
});
/* The booking dialog, the detail and the club dialogs are screens of their own with their own tests: here only what the board hands them matters. */
vi.mock('../../../components/booking/NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: Record<string, unknown>) => (
    <div role="dialog" aria-label="Nová objednávka" data-testid="new-appointment" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock('../../../components/booking/AppointmentDetail', () => ({
  AppointmentDetail: (props: { onClose: () => void; onCancelled?: (a: unknown) => void }) => (
    <div role="dialog" aria-label="Detail rezervace" data-testid="appointment-detail">
      <button type="button" data-testid="fake-cancel" onClick={() => { props.onCancelled?.(cancelledFacts); props.onClose(); }}>Zrušit</button>
    </div>
  ),
}));
let cancelledFacts: Record<string, unknown> = {};
vi.mock('../../../components/booking/calendar/AddToClubOrderDialog', () => ({
  AddToClubOrderDialog: (props: { marked: unknown }) => <div role="dialog" aria-label="Přidat do objednávky klubu" data-testid="add-to-club" data-marked={JSON.stringify(props.marked)} />,
}));
vi.mock('../../../components/clubs/order/ClubOrderEntry', () => ({
  ClubOrderEntry: (props: { open: boolean; onPhone: (clubId?: string) => void }) =>
    props.open ? (
      <div role="dialog" aria-label="Nová klubová objednávka" data-testid="club-entry">
        <button type="button" onClick={() => props.onPhone('club7')}>Vyplním sám</button>
      </div>
    ) : null,
}));
vi.mock('../../../components/booking/calendar/ClubBlockPopover', () => ({
  ClubBlockPopover: (props: { pick: unknown }) => (props.pick ? <div role="dialog" aria-label="Blok klubu" data-testid="club-popover" data-pick={JSON.stringify(props.pick)} /> : null),
}));

import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { workingHoursApi } from '../../../api/workingHours';
import { appointmentsApi } from '../../../api/appointments';
import { activitiesApi } from '../../../api/activities';

const TODAY = '2026-12-09'; // Wednesday
const ROW = 455 / 720; // design px per minute at the file's zoom
const yOf = (minute: number) => (minute - 420) * ROW;
const BOARD_WIDTH = 700;
const colX = (col: number) => col * (BOARD_WIDTH / 7) + 50;

const calendar: Calendar = {
  id: 'c1', name: 'Ordinace 1', color: '#999999', location: '', displayStepMinutes: 30, isActive: true, sortOrder: 0,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
};

const appt = (id: string, startUtc: string, endUtc: string, extra: Partial<DayAppointment> = {}): DayAppointment => ({
  id, calendarId: 'c1', patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null, ...extra,
});
/* December is CET: 09:00 Prague = 08:00Z. */
const b1 = appt('b1', '2026-12-08T08:00:00Z', '2026-12-08T08:30:00Z'); // Tuesday 09:00-09:30
const b2 = appt('b2', '2026-12-09T09:00:00Z', '2026-12-09T09:30:00Z', { activityId: 'a2', activityName: 'Fyzio' }); // Wednesday 10:00-10:30

let blocks: TimeBlock[] = [];
let appointments: DayAppointment[] = [b1, b2];

/** jsdom lays nothing out: the board is 700 x 455 design px at the origin, cards sit where their style says. */
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

let actions: ReturnType<typeof usePlannerActions> | null = null;
function Grab() {
  actions = usePlannerActions();
  return null;
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location" data-path={location.pathname} data-state={JSON.stringify(location.state)} />;
}

function mount(opts: { real?: boolean; source?: DemoDataSource; initialDate?: string; config?: Partial<BoardConfig>; entry?: { pathname: string; state?: unknown } } = {}) {
  const { real = true, source = new DemoDataSource({ today: TODAY }), initialDate = TODAY, config = {}, entry = { pathname: '/' } } = opts;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <BoardConfigProvider value={{ realCalendar: real, mode: 'standard', excludeClubId: null, nowMinute: 10 * 60, ...config }}>
        <PlannerProviders source={source} today={TODAY} initialDate={initialDate}>
          <PlannerStage scale={1}>
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

const board = () => document.getElementById('day-board') as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-09T08:15:00Z'));
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit', 'settings.clinic.manage']));
  boardSettings.reset();
  blocks = [];
  appointments = [b1, b2];
  stubLayout();
  vi.mocked(calendarsApi.list).mockResolvedValue([calendar]);
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
  vi.mocked(appointmentsApi.reschedule).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------------ */
/* R15c (e): the keyboard shortcuts of the main calendar                      */
/* ------------------------------------------------------------------------ */

const key = (k: string, init: KeyboardEventInit = {}, target: Element | Window = window) => fireEvent.keyDown(target, { key: k, ...init });
const headingText = () => document.getElementById('week-range')?.textContent ?? '';

describe('R15c (e) shortcuts', () => {
  it('N opens a new booking on the next free slot, T goes to today, the arrows move the period', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    await screen.findByTestId('board-shortcuts-on');
    const first = headingText();
    key('ArrowRight');
    await waitFor(() => expect(headingText()).not.toBe(first));
    key('ArrowLeft');
    await waitFor(() => expect(headingText()).toBe(first));
    key('ArrowRight');
    key('ArrowRight');
    await waitFor(() => expect(headingText()).not.toBe(first));
    key('t');
    await waitFor(() => expect(headingText()).toBe(first));
    key('n');
    expect(await screen.findByTestId('new-appointment')).toBeInTheDocument();
  });

  it('D / W / M switch the view, and the arrows follow the view (a day, a week, a month)', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    await screen.findByTestId('board-shortcuts-on');
    key('m');
    await waitFor(() => expect(document.querySelector('.view-segment [data-view="month"]')).toHaveClass('active'));
    key('d');
    await waitFor(() => expect(document.querySelector('.view-segment [data-view="day"]')).toHaveClass('active'));
    key('w');
    await waitFor(() => expect(document.querySelector('.view-segment [data-view="week"]')).toHaveClass('active'));
    key('d');
    await waitFor(() => expect(document.querySelector('.view-segment [data-view="day"]')).toHaveClass('active'));
    const before = document.querySelector('#alternate-view')?.textContent ?? '';
    key('ArrowRight');
    await waitFor(() => expect(document.querySelector('#alternate-view')?.textContent ?? '').not.toBe(before));
  });

  it('? lists the shortcuts in a pop-out, Esc closes it', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    await screen.findByTestId('board-shortcuts-on');
    key('?', { shiftKey: true });
    const help = await screen.findByTestId('board-shortcuts');
    expect(help).toHaveTextContent('Nová rezervace');
    expect(help).toHaveTextContent('Ctrl+K');
    key('Escape');
    await waitFor(() => expect(screen.queryByTestId('board-shortcuts')).toBeNull());
  });

  it('does nothing while typing in a field, with Ctrl/Alt, or while a dialog holds the focus', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    await screen.findByTestId('board-shortcuts-on');
    const headingBefore = headingText();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    key('n', {}, input);
    key('?', {}, input);
    key('ArrowRight', {}, input);
    key('n', { ctrlKey: true });
    key('t', { altKey: true });
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    const inner = document.createElement('button');
    dlg.appendChild(inner);
    document.body.appendChild(dlg);
    key('n', {}, inner);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('new-appointment')).toBeNull();
    expect(screen.queryByTestId('board-shortcuts')).toBeNull();
    expect(headingText()).toBe(headingBefore);
    input.remove();
    dlg.remove();
  });

  it('are off on the demo planner and on a club\'s own board (the older planner-wide N is untouched there)', async () => {
    mount({ real: false });
    await screen.findByTestId('week-board-panel');
    key('?', { shiftKey: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('board-shortcuts')).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/* R15c (d): undo of a move and of a cancel                                   */
/* ------------------------------------------------------------------------ */

const topOf2 = (el: HTMLElement) => Number.parseFloat(el.style.top);
async function moveB1() {
  const card = await screen.findByTestId('board-booking-b1'); // Tuesday 09:00
  fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: colX(1), clientY: topOf2(card) + 2, pointerId: 7 });
  fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: colX(3), clientY: yOf(10 * 60 + 30) + 2, pointerId: 7 });
  await screen.findByTestId('move-ghost');
  fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: colX(3), clientY: yOf(10 * 60 + 30) + 2, pointerId: 7 });
  fireEvent.click(within(await screen.findByTestId('move-confirm')).getByRole('button', { name: 'Přesunout' }));
  await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(1));
}

describe('R15c (d) undo', () => {
  it('a move offers "Vrátit zpět" for 30 s; pressing it moves the booking back to where it was (same notify choice)', async () => {
    mount();
    await moveB1();
    const bar = await screen.findByTestId('board-undo');
    expect(bar).toHaveAttribute('data-kind', 'move');
    expect(screen.getByTestId('board-undo-left')).toHaveTextContent('30 s');
    fireEvent.click(screen.getByTestId('board-undo-run'));
    await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(2));
    expect(vi.mocked(appointmentsApi.reschedule).mock.calls[1]).toEqual(['c1', 'b1', '2026-12-08T08:00:00Z', undefined, { notifyPatient: true }]);
    await waitFor(() => expect(screen.queryByTestId('board-undo')).toBeNull());
    expect(screen.getByTestId('board-notice')).toHaveTextContent('Vráceno zpět: termín je zase na původním místě.');
  });

  it('the window ends after 30 seconds and the button goes with it', async () => {
    mount();
    await moveB1();
    await screen.findByTestId('board-undo');
    vi.setSystemTime(new Date('2026-12-09T08:15:31Z'));
    await waitFor(() => expect(screen.queryByTestId('board-undo')).toBeNull(), { timeout: 4000 });
    expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(1);
  });

  it('a refused undo is said, and the booking stays where it is', async () => {
    mount();
    await moveB1();
    vi.mocked(appointmentsApi.reschedule).mockRejectedValueOnce(new Error('boom'));
    fireEvent.click(await screen.findByTestId('board-undo-run'));
    await waitFor(() => expect(screen.getByTestId('board-notice')).toHaveAttribute('data-tone', 'error'));
    expect(screen.getByTestId('board-notice')).toHaveTextContent('Vrátit zpět se nepodařilo');
    expect(screen.queryByTestId('board-undo')).toBeNull();
  });

  it('the dismiss button closes it without calling the API', async () => {
    mount();
    await moveB1();
    fireEvent.click(await screen.findByRole('button', { name: 'Zavřít' }));
    expect(screen.queryByTestId('board-undo')).toBeNull();
    expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(1);
  });

  async function openAndCancel(facts: Record<string, unknown>) {
    cancelledFacts = facts;
    mount();
    const card = await screen.findByTestId('board-booking-b2');
    fireEvent.click(card);
    fireEvent.click(card);
    fireEvent.click(await screen.findByTestId('fake-cancel'));
  }
  const cancelledPatient = { id: 'b2', calendarId: 'c1', patientId: 'p1', activityId: 'a2', startUtc: '2026-12-09T09:00:00Z', note: 'poznámka', agreedPriceCzk: 1200, unregisteredName: null, unregisteredPhone: null };

  it('a cancelled registered booking can be created again - same patient, činnost, time, note and agreed price - and says it is a new reservation', async () => {
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as never);
    await openAndCancel(cancelledPatient);
    expect(await screen.findByTestId('board-undo')).toHaveAttribute('data-kind', 'cancel');
    fireEvent.click(screen.getByTestId('board-undo-run'));
    await waitFor(() => expect(appointmentsApi.create).toHaveBeenCalledTimes(1));
    expect(appointmentsApi.create).toHaveBeenCalledWith({ patientId: 'p1', calendarId: 'c1', activityId: 'a2', startUtc: '2026-12-09T09:00:00Z', source: 0, note: 'poznámka', agreedPriceCzk: 1200 });
    await waitFor(() => expect(screen.getByTestId('board-notice')).toHaveTextContent('rezervace byla vytvořena znovu (nová rezervace'));
  });

  it('a walk-in with a name is created again through the unregistered call', async () => {
    vi.mocked(appointmentsApi.createUnregistered).mockResolvedValue({} as never);
    await openAndCancel({ ...cancelledPatient, patientId: '', unregisteredName: 'Jan Host', unregisteredPhone: '+420777111222', note: null, agreedPriceCzk: null });
    fireEvent.click(await screen.findByTestId('board-undo-run'));
    await waitFor(() => expect(appointmentsApi.createUnregistered).toHaveBeenCalledWith({ calendarId: 'c1', activityId: 'a2', startUtc: '2026-12-09T09:00:00Z', name: 'Jan Host', phone: '+420777111222', note: null, agreedPriceCzk: null }));
  });

  it('what cannot be re-created (a club term, a booking with nobody) hides Undo and says so', async () => {
    await openAndCancel({ ...cancelledPatient, patientId: 'p1', partnerName: 'FK Slaný' });
    expect(await screen.findByTestId('board-notice')).toHaveTextContent('nejde vrátit zpět');
    expect(screen.queryByTestId('board-undo')).toBeNull();
  });

  it('the newest change replaces the older one: only the last can be undone', async () => {
    vi.mocked(appointmentsApi.create).mockResolvedValue({} as never);
    mount();
    await moveB1();
    await screen.findByTestId('board-undo');
    cancelledFacts = cancelledPatient;
    const card = await screen.findByTestId('board-booking-b2');
    fireEvent.click(card);
    fireEvent.click(card);
    fireEvent.click(await screen.findByTestId('fake-cancel'));
    await waitFor(() => expect(screen.getByTestId('board-undo')).toHaveAttribute('data-kind', 'cancel'));
  });
});
