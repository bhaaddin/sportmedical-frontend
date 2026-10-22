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
import { BoardConfigProvider, type BoardConfig } from './boardConfig';
import { boardSettings } from './boardSettings';

/*
 * Reviewer 2.4: the clinic's two calendars - Lékařské prohlídky and Sportovní diagnostika - are two COLUMNS of every day again,
 * each headed by a chip with the calendar's own name and colour, and a calendar selector brings the choice back to the screen.
 * A mark, a booking and a drag belong to the calendar of the column they were made in. One calendar = one column; the club
 * planner is not touched.
 */

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
const yOf = (minute: number) => (minute - 420) * ROW;
const BOARD_WIDTH = 700;
const DAY_W = BOARD_WIDTH / 7;
/** x inside column `sub` of `subs` of day `col`. */
const subX = (col: number, sub: number, subs = 2) => col * DAY_W + (sub + 0.5) * (DAY_W / subs);

const cal = (id: string, name: string, sortOrder: number, color: string): Calendar => ({
  id, name, color, location: '', displayStepMinutes: 30, isActive: true, sortOrder, clinicServiceId: null,
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null,
});
const LEK = cal('c1', 'Lékařské prohlídky', 1, '#0EA5E9');
const DIA = cal('c2', 'Sportovní diagnostika', 2, '#7C3AED');
const INB = cal('c3', 'InBody', 3, '#D97706');
const BAL = cal('c4', 'Balíčky', 4, '#16A34A');

const appt = (id: string, calendarId: string, startUtc: string, endUtc: string): DayAppointment => ({
  id, calendarId, patientId: '', patientName: `Pacient ${id}`, activityId: 'a1', activityName: 'Prohlídka',
  startUtc, endUtc, status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, partnerName: null,
  clubDiscountPercent: null, paymentState: 'none', invoiceId: null,
});
/* December is CET: 09:00 Prague = 08:00Z */
const lek = appt('l1', 'c1', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z'); // Wednesday 09:00, Lékařské
const dia = appt('d1', 'c2', '2026-12-09T08:00:00Z', '2026-12-09T08:30:00Z'); // Wednesday 09:00, Diagnostika
const dia2 = appt('d2', 'c2', '2026-12-10T08:00:00Z', '2026-12-10T08:30:00Z'); // Thursday 09:00, Diagnostika

let appointments: DayAppointment[] = [lek, dia, dia2];
let blocks: Record<string, TimeBlock[]> = {};
let closedCalendarDay: { calendarId: string; date: string } | null = null;

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
const board = () => document.getElementById('day-board') as HTMLElement;
const chip = (id: string) => screen.getByTestId(`calendar-chip-${id}`);

function setCalendars(list: Calendar[]) {
  vi.mocked(calendarsApi.list).mockResolvedValue(list);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-12-09T08:15:00Z'));
  window.localStorage.clear();
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'bookings.edit']));
  boardSettings.reset();
  appointments = [lek, dia, dia2];
  blocks = {};
  closedCalendarDay = null;
  stubLayout();
  setCalendars([LEK, DIA]);
  vi.mocked(clinicServicesApi.list).mockResolvedValue([]);
  vi.mocked(activitiesApi.list).mockResolvedValue({ activities: [], warnings: [] });
  vi.mocked(workingHoursApi.preview).mockImplementation(async (calendarId, from, to) => {
    const rows: PreviewDay[] = [];
    for (let d = from; d <= to; d = addDaysToDateOnly(d, 1)) {
      const closed = closedCalendarDay !== null && closedCalendarDay.calendarId === calendarId && closedCalendarDay.date === d;
      rows.push({
        date: d, isOpen: !closed, closedBecause: closed ? 'holiday' : null, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00',
        workerUserId: 'u1', workerDisplayName: 'Anna', isChangedByOverride: false, offeredActivityIds: ['a1'],
      });
    }
    return rows;
  });
  vi.mocked(appointmentsApi.range).mockImplementation(async () => appointments);
  vi.mocked(appointmentsApi.blocks).mockImplementation(async (calendarId) => blocks[calendarId as string] ?? []);
  vi.mocked(appointmentsApi.reschedule).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the clinic has two calendars: every day is two columns', () => {
  it('heads each column with a chip carrying the calendar\'s own name and colour - nothing is a literal', async () => {
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(board()).toHaveAttribute('data-subs', '2');
    const wednesday = screen.getByTestId('day-calendars-2026-12-09');
    const chips = within(wednesday).getAllByText(/./).filter((e) => e.closest('.day-calendar') === e.parentElement || e.classList.contains('day-calendar'));
    expect(within(wednesday).getByText('Lékařské prohlídky')).toBeInTheDocument();
    expect(within(wednesday).getByText('Sportovní diagnostika')).toBeInTheDocument();
    void chips;
    const dots = [...wednesday.querySelectorAll<HTMLElement>('.day-calendar')];
    expect(dots.map((d) => d.style.getPropertyValue('--cal'))).toEqual(['#0EA5E9', '#7C3AED']);
    /* seven days, every one headed */
    expect(document.querySelectorAll('.day-calendars')).toHaveLength(7);
  });

  it('draws a booking in the column of its own calendar, and two simultaneous bookings of two calendars do not share lanes', async () => {
    mount();
    const l1 = await screen.findByTestId('board-booking-l1');
    const d1 = screen.getByTestId('board-booking-d1');
    expect(l1).toHaveAttribute('data-lanes', '1');
    expect(d1).toHaveAttribute('data-lanes', '1');
    /* the column index is day * columns + calendar (jsdom folds 2 * 2 into 4): Wednesday is day 2 */
    expect(l1.style.left).toContain('(4 + 0)');
    expect(d1.style.left).toContain('(4 + 1)');
    /* Thursday: only the Diagnostika booking, in the second column */
    expect(screen.getByTestId('board-booking-d2').style.left).toContain('(6 + 1)');
  });

  it('a click in the second column marks THAT calendar, in the first column the other one', async () => {
    mount();
    await screen.findByTestId('board-booking-l1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(4, 1), clientY: yOf(10 * 60 + 5), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(4, 1), clientY: yOf(10 * 60 + 5), pointerId: 1 });
    const selection = screen.getByTestId('board-selection');
    expect(selection.style.getPropertyValue('--sub')).toBe('1');
    expect(selection.style.getPropertyValue('--subs')).toBe('2');
    expect(selection.style.getPropertyValue('--col')).toBe('4');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    expect(JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!)).toMatchObject({ initialCalendarId: 'c2', initialDate: '2026-12-11' });
    cleanup();

    mount();
    await screen.findByTestId('board-booking-l1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(4, 0), clientY: yOf(11 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(4, 0), clientY: yOf(11 * 60), pointerId: 1 });
    expect(screen.getByTestId('board-selection').style.getPropertyValue('--sub')).toBe('0');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    expect(JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!).initialCalendarId).toBe('c1');
  });

  it('a drag stays in the column it began in, and "Zablokovat čas" blocks that calendar only', async () => {
    vi.mocked(appointmentsApi.createBlock).mockResolvedValue({ id: 'new', startUtc: '', endUtc: '', reason: 'Školení' } as TimeBlock);
    mount();
    await screen.findByTestId('board-booking-l1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(4, 1), clientY: yOf(13 * 60), pointerId: 1 });
    /* the pointer wanders into the first column of the day: the mark is still the second calendar's */
    fireEvent.pointerMove(board(), { pointerType: 'mouse', clientX: subX(4, 0), clientY: yOf(14 * 60), pointerId: 1 });
    expect(screen.getByTestId('board-selection').style.getPropertyValue('--sub')).toBe('1');
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(4, 0), clientY: yOf(14 * 60), pointerId: 1 });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Zablokovat čas/ }));
    fireEvent.change(await screen.findByLabelText(/Důvod blokace/), { target: { value: 'Školení' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zablokovat' }));
    await waitFor(() => expect(appointmentsApi.createBlock).toHaveBeenCalledTimes(1));
    expect(vi.mocked(appointmentsApi.createBlock).mock.calls[0]![0]).toBe('c2');
  });

  it('a calendar that is closed on a day the other works is hatched in its own column and cannot be marked there', async () => {
    closedCalendarDay = { calendarId: 'c2', date: '2026-12-11' };
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(await screen.findByTestId('calendar-closed-c2-2026-12-11')).toBeInTheDocument();
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(4, 1), clientY: yOf(10 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(4, 1), clientY: yOf(10 * 60), pointerId: 1 });
    expect(screen.queryByTestId('board-selection')).toBeNull();
    /* the other calendar of the same day is still markable */
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: subX(4, 0), clientY: yOf(10 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: subX(4, 0), clientY: yOf(10 * 60), pointerId: 1 });
    expect(screen.getByTestId('board-selection').style.getPropertyValue('--sub')).toBe('0');
  });

  it('a booking dragged over the other calendar\'s column is refused: it stays in its own calendar', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-l1');
    fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: subX(2, 0), clientY: Number.parseFloat(card.style.top) + 2, pointerId: 7 });
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: subX(3, 1), clientY: yOf(10 * 60) + 2, pointerId: 7 });
    const ghost = await screen.findByTestId('move-ghost');
    expect(ghost).toHaveAttribute('data-refused', 'calendar');
    expect(ghost.style.getPropertyValue('--sub')).toBe('1');
    /* over its own column it is fine */
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: subX(3, 0), clientY: yOf(10 * 60) + 2, pointerId: 7 });
    expect(await screen.findByTestId('move-ghost')).not.toHaveAttribute('data-refused');
  });

  it('a club window of both calendars is drawn in each column', async () => {
    const club = (id: string): TimeBlock => ({ id, startUtc: '2026-12-10T07:00:00Z', endUtc: '2026-12-10T09:00:00Z', reason: '', kind: 'club', clubId: 'k1', clubName: 'FK Slaný', clubBlockId: 'kb1', colorHex: '#2E7D6B' }) as unknown as TimeBlock;
    blocks = { c1: [club('x1')], c2: [club('x2')] };
    mount();
    await screen.findByTestId('board-booking-l1');
    await waitFor(() => expect(document.querySelectorAll('.board-window')).toHaveLength(2));
    const lefts = [...document.querySelectorAll<HTMLElement>('.board-window')].map((w) => w.style.left);
    expect(lefts[0]).toContain('(6 + 0)');
    expect(lefts[1]).toContain('(6 + 1)');
  });
});

describe('the calendar selector', () => {
  it('is a chip per calendar of the clinic, all on, named and coloured from the calendars', async () => {
    mount();
    await screen.findByTestId('calendar-strip');
    expect(chip('c1')).toHaveTextContent('Lékařské prohlídky');
    expect(chip('c2')).toHaveTextContent('Sportovní diagnostika');
    expect(chip('c1')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('c2')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('c1').style.getPropertyValue('--cal')).toBe('#0EA5E9');
    /* R20: "Všechny" is always there, selected while nothing is narrowed */
    expect(screen.getByTestId('calendar-chip-all')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('calendar-strip')).toHaveAttribute('data-split', 'true');
  });

  it('one calendar on screen is one column again; "Všechny" brings the split back', async () => {
    mount();
    await screen.findByTestId('board-booking-l1');
    /* R2: from "Všechny" ONE click shows only that služba */
    fireEvent.click(chip('c1'));
    await waitFor(() => expect(board()).not.toHaveAttribute('data-subs'));
    expect(document.querySelectorAll('.day-calendars')).toHaveLength(0);
    expect(chip('c2')).toHaveAttribute('aria-pressed', 'false');
    expect(chip('c1')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('board-booking-d1')).toBeNull(); /* the hidden calendar's bookings are not drawn */
    /* the remaining calendar's booking is back to the file's one-column strings */
    expect(screen.getByTestId('board-booking-l1').style.left).toBe('calc(28.5714% + 3px)'); /* 2 * 100% / 7 + 3px, as in the file */
    expect(screen.getByTestId('calendar-strip')).toHaveAttribute('data-split', 'false');
    fireEvent.click(screen.getByTestId('calendar-chip-all'));
    await waitFor(() => expect(board()).toHaveAttribute('data-subs', '2'));
    expect(screen.getByTestId('board-booking-d1')).toBeInTheDocument();
  });

  it('a selection made with one calendar books that calendar, with no column to choose', async () => {
    mount();
    await screen.findByTestId('board-booking-l1');
    fireEvent.click(chip('c2'));
    await waitFor(() => expect(board()).not.toHaveAttribute('data-subs'));
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: 4 * DAY_W + 30, clientY: yOf(10 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: 4 * DAY_W + 30, clientY: yOf(10 * 60), pointerId: 1 });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    expect(JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!).initialCalendarId).toBe('c2');
  });

  it('three calendars still split; four do not (a card would be a sliver) and the selector says so', async () => {
    setCalendars([LEK, DIA, INB]);
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(board()).toHaveAttribute('data-subs', '3');
    cleanup();
    boardSettings.reset();
    setCalendars([LEK, DIA, INB, BAL]);
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(board()).not.toHaveAttribute('data-subs');
    expect(screen.getByTestId('calendar-strip-hint')).toHaveTextContent('nejvýše 3');
    /* one click shows one služba, the next two add their columns: three is the most a day holds */
    fireEvent.click(chip('c1'));
    fireEvent.click(chip('c2'));
    fireEvent.click(chip('c3'));
    await waitFor(() => expect(board()).toHaveAttribute('data-subs', '3'));
    expect(screen.queryByTestId('calendar-strip-hint')).toBeNull();
  });

  it('a clinic with one calendar has no selector and no split', async () => {
    setCalendars([LEK]);
    appointments = [lek];
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(screen.queryByTestId('calendar-strip')).toBeNull();
    expect(board()).not.toHaveAttribute('data-subs');
  });

  it('the club planner is not touched: no selector, no split, whatever the calendars', async () => {
    mount({ mode: 'club' });
    await screen.findByTestId('week-board-panel');
    expect(screen.queryByTestId('calendar-strip')).toBeNull();
    expect(board()).not.toHaveAttribute('data-subs');
  });
});

describe('the month and the day list of a split week', () => {
  it('a month tile counts the bookings under each calendar\'s chip', async () => {
    mount();
    await screen.findByTestId('board-booking-l1');
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    const counts = await screen.findByTestId('tile-calendars-2026-12-09');
    expect([...counts.querySelectorAll('.tile-calendar')].map((c) => [c.getAttribute('data-calendar-id'), c.textContent])).toEqual([['c1', '1'], ['c2', '1']]);
    expect(counts).toHaveAttribute('aria-label', 'Lékařské prohlídky: 1, Sportovní diagnostika: 1');
    const thursday = screen.getByTestId('tile-calendars-2026-12-10');
    expect([...thursday.querySelectorAll('.tile-calendar')].map((c) => c.textContent)).toEqual(['0', '1']);
    expect(screen.queryByTestId('tile-calendars-2026-12-08')).not.toBeNull();
  });

  it('with one calendar the tile has no calendar counts', async () => {
    mount();
    await screen.findByTestId('board-booking-l1');
    fireEvent.click(chip('c2'));
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    await screen.findByTestId('month-matrix');
    expect(document.querySelectorAll('.tile-calendars')).toHaveLength(0);
  });
});

describe('R2: the selector is by služba, činnosti are inside, per-činnost calendars are not columns', () => {
  const svc = (id: string, name: string, colorHex: string | null, sortOrder: number) => ({ id, name, description: '', sortOrder, isActive: true, activities: 1, calendars: 1, colorHex });
  const withServices = (a: Calendar, b: Calendar) => {
    setCalendars([a, b]);
    vi.mocked(clinicServicesApi.list).mockResolvedValue([svc('s1', 'Sportovní lékařské prohlídky', '#11AA11', 0), svc('s2', 'Sportovní diagnostika', null, 1)]);
    vi.mocked(activitiesApi.list).mockResolvedValue({
      activities: [
        { id: 'a1', name: 'Základní prohlídka', clinicServiceId: 's1', isActive: true, sortOrder: 0, durationMinutes: 30, colorHex: '#11AA11', effectiveColorHex: '#11AA11', parallelCapacity: 1 },
        { id: 'a2', name: 'VO2max', clinicServiceId: 's2', isActive: true, sortOrder: 0, durationMinutes: 30, colorHex: '#7C3AED', effectiveColorHex: '#7C3AED', parallelCapacity: 1 },
      ],
      warnings: [],
    } as never);
  };
  const A = { ...LEK, clinicServiceId: 's1' };
  const B = { ...DIA, clinicServiceId: 's2' };

  it('the chips carry the SLUŽBA name and colour, not the calendar\'s ("Lékařské prohlídky" is a calendar)', async () => {
    withServices(A, B);
    mount();
    await screen.findByTestId('calendar-strip');
    expect(chip('s1')).toHaveTextContent('Lékařské prohlídky');
    expect(chip('s2')).toHaveTextContent('Sportovní diagnostika');
    expect(chip('s1').title).toContain('Sportovní lékařské prohlídky');
    expect(chip('s1').querySelector('svg use')).not.toBeNull();
    expect(chip('s1').style.getPropertyValue('--cal')).toBe('#11AA11');
    expect(screen.getByTestId('calendar-strip')).toHaveTextContent('Kalendáře');
    expect(screen.getByTestId('calendar-strip')).not.toHaveTextContent('Služby');
    /* the column heads say the same */
    const heads = within(screen.getByTestId('day-calendars-2026-12-09'));
    expect(heads.getByText('Sportovní lékařské prohlídky')).toBeInTheDocument();
    expect(heads.getByText('Sportovní diagnostika')).toBeInTheDocument();
  });

  it('one click shows ONE služba, a second click adds its column, the činnosti appear inside as pills (not as calendars)', async () => {
    withServices(A, B);
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(board()).toHaveAttribute('data-subs', '2');
    expect(screen.queryByTestId('calendar-strip-pills')).toBeNull(); // with every služba on screen they would be the whole price list
    fireEvent.click(chip('s2'));
    await waitFor(() => expect(board()).not.toHaveAttribute('data-subs'));
    expect(screen.queryByTestId('board-booking-l1')).toBeNull();
    expect(screen.getByTestId('board-booking-d1')).toBeInTheDocument();
    const pills = screen.getByTestId('calendar-strip-pills');
    expect([...pills.querySelectorAll('.calendar-pill')].map((p) => p.textContent)).toEqual(['VO2max']);
    expect(document.querySelectorAll('.calendar-chip:not(.is-all)')).toHaveLength(2); /* činnosti are never chips of their own */
    fireEvent.click(chip('s1'));
    await waitFor(() => expect(board()).toHaveAttribute('data-subs', '2'));
    expect(screen.getByTestId('board-booking-l1')).toBeInTheDocument();
    /* both služby shown = "Všechny" again (the clinic has two), so the pills fold away with the narrowing */
    expect(screen.queryByTestId('calendar-strip-pills')).toBeNull();
    expect(screen.getByTestId('calendar-chip-all')).toHaveAttribute('aria-pressed', 'true');
  });

  it('a služba with a second (per-činnost) calendar is still ONE chip and ONE column; its bookings ride in that column and nothing is dropped', async () => {
    const extra = { ...cal('c5', 'Jen spiro', 5, '#999999'), clinicServiceId: 's2' };
    withServices(A, B);
    setCalendars([A, B, extra]);
    appointments = [lek, dia, appt('x1', 'c5', '2026-12-09T09:00:00Z', '2026-12-09T09:30:00Z')];
    mount();
    await screen.findByTestId('board-booking-l1');
    expect(document.querySelectorAll('.calendar-chip:not(.is-all)')).toHaveLength(2);
    expect(board()).toHaveAttribute('data-subs', '2'); // two služby, not three calendars
    /* the extra calendar's booking is drawn in the služba's column (the second), beside the primary's */
    expect(screen.getByTestId('board-booking-x1').style.left).toContain('(4 + 1)');
    expect(screen.getByTestId('board-booking-d1').style.left).toContain('(4 + 1)');
    expect(screen.getByTestId('board-booking-l1').style.left).toContain('(4 + 0)');
  });
});
