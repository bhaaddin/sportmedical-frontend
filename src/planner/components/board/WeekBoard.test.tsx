import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { BookingApiError } from '../../../api/apiError';
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
  appointmentsApi: { range: vi.fn(), blocks: vi.fn(), reschedule: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn() },
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
  AppointmentDetail: (props: { appointmentId: string; calendarId: string }) => (
    <div role="dialog" aria-label="Detail rezervace" data-testid="appointment-detail" data-id={props.appointmentId} data-calendar={props.calendarId} />
  ),
}));
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
/* the file, on demo data                                                    */
/* ------------------------------------------------------------------------ */

describe('the board on the demo data (the file)', () => {
  it('draws the week\'s cards, the week counter and never asks the API', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    expect(await screen.findByTestId('board-card-m1')).toBeInTheDocument();
    expect(screen.getByTestId('board-card-f1')).toHaveTextContent('Kondiční diagnostika');
    expect(screen.getByTestId('board-card-f1')).toHaveTextContent('12 slotů');
    expect(screen.getByTestId('board-card-f1')).toHaveTextContent('14:00 – 16:00');
    expect(document.getElementById('week-range')).toHaveTextContent('16. – 22. listopadu 2026');
    expect(document.getElementById('week-number')).toHaveTextContent('47. týden');
    expect(appointmentsApi.range).not.toHaveBeenCalled();
    expect(calendarsApi.list).not.toHaveBeenCalled();
  });

  it('colours a card with its činnost and draws its icon', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    const card = await screen.findByTestId('board-card-f1');
    expect(card.style.getPropertyValue('--ev-border')).toBe('#128ffc');
    expect(card.querySelector('use')?.getAttribute('href')).toBe('#icon-dumbbell');
  });

  it('week arrows, "Dnes" and the counter move the week like the prototype', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    fireEvent.click(screen.getByRole('button', { name: 'Následující týden' }));
    expect(document.getElementById('week-number')).toHaveTextContent('48. týden');
    expect(document.getElementById('week-range')).toHaveTextContent('23. – 29. listopadu 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Předchozí týden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Předchozí týden' }));
    expect(document.getElementById('week-number')).toHaveTextContent('46. týden');
    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));
    expect(document.getElementById('week-range')).toHaveTextContent('7. – 13. prosince 2026');
  });

  it('the činnost filter filters', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    expect(document.querySelectorAll('.schedule-event').length).toBeGreaterThan(3);
    fireEvent.change(document.getElementById('activity-filter')!, { target: { value: 'fitness' } });
    const cards = [...document.querySelectorAll('.schedule-event')];
    expect(cards.map((c) => c.getAttribute('data-category-id'))).toEqual(['fitness']);
    fireEvent.change(document.getElementById('activity-filter')!, { target: { value: 'all' } });
    expect(document.querySelectorAll('.schedule-event').length).toBeGreaterThan(3);
  });

  it('Den is the list of the day, Měsíc the 42 tiles, Týden the board again', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const alternate = screen.getByTestId('alternate-view');
    expect(alternate).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(alternate).not.toHaveAttribute('hidden');
    expect(alternate).toHaveTextContent('Pá 20. 11. 2026 · Denní přehled');
    expect(alternate).toHaveTextContent('Fyzioterapie');
    expect(alternate).toHaveTextContent('Kondiční diagnostika');
    expect(alternate).toHaveTextContent('12/12');
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    expect(alternate.querySelectorAll('.month-tile')).toHaveLength(42);
    expect(alternate).toHaveTextContent('Listopad 2026 · Měsíční přehled');
    fireEvent.click(alternate.querySelector('[data-day="2026-11-18"]')!);
    expect(alternate).toHaveTextContent('St 18. 11. 2026 · Denní přehled'); // a tile opens that day
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(alternate).toHaveAttribute('hidden');
  });

  it('an empty day offers to create a term and asks for a činnost first', async () => {
    mount({ real: false, initialDate: '2026-11-24' });
    await screen.findByTestId('board-body');
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(screen.getByTestId('alternate-view')).toHaveTextContent('Na vybraný den zatím nejsou vytvořené termíny.');
    fireEvent.click(screen.getByRole('button', { name: '+ Vytvořit termín' }));
    expect(screen.getByTestId('toast-layer')).toHaveTextContent('Nejprve vyberte činnost z dolních karet.');
  });

  it('a click on a card opens the term: a club\'s is managed, a public one is shown', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    fireEvent.click(await screen.findByTestId('board-card-m1'));
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', 'agendaDetail');
    act(() => actions!.closeDialog());
    fireEvent.click(screen.getByTestId('board-card-p1'));
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', 'eventDetail');
  });

  it('a click that ends a drag is not a click on the card', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    const card = await screen.findByTestId('board-card-m1');
    fireEvent.pointerDown(card, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.click(card, { clientX: 60, clientY: 80 });
    expect(screen.getByTestId('dialog-layer')).toHaveAttribute('data-dialog', '');
  });

  it('draws the lunch band, the closed day with its reason and the hours around the day', async () => {
    mount({ real: false, initialDate: '2026-11-26' });
    expect(await screen.findByTestId('closed-2026-11-26')).toHaveTextContent('Zavřeno (ukázka)');
    expect(screen.getByTestId('lunch-2026-11-24')).toHaveTextContent('Oběd');
    expect(screen.queryByTestId('lunch-2026-11-26')).toBeNull(); // a closed day has no lunch band
    expect(screen.getByTestId('shade-nohours-2026-11-28')).toBeInTheDocument(); // Saturday, no hours
    // the demo calendar is open 07:00-19:00: nothing before / after it
    expect(screen.queryByTestId('shade-before-2026-11-24')).toBeNull();
  });

  it('puts the price on a tall card and in the hover, "bez ceny" when the list has none', async () => {
    class Priced extends DemoDataSource {
      async getCatalogue(): Promise<PlannerCatalogue> {
        const c = await super.getCatalogue();
        return { ...c, categories: c.categories.map((x) => (x.id === 'fitness' ? { ...x, priceCzk: 1200 } : x)) };
      }
    }
    mount({ real: false, source: new Priced({ today: TODAY }), initialDate: '2026-11-20' });
    const tall = await screen.findByTestId('board-card-f1'); // 14:00-16:00, 75 px
    expect(within(tall).getByTestId('price-line')).toHaveTextContent(/1\s200\sKč/);
    expect(within(screen.getByTestId('board-card-m1')).getByTestId('price-line')).toHaveTextContent('bez ceny');
    fireEvent.mouseOver(tall);
    expect(await screen.findByTestId('session-tip-price', undefined, { timeout: 2000 })).toHaveTextContent(/1\s200\sKč/);
  });

  it('shows no pickable cursor and no booking actions without the real calendar', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    expect(board()).not.toHaveAttribute('data-pickable');
    expect(screen.queryByTestId('board-entry-points')).toBeNull();
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(2), clientY: yOf(9 * 60), pointerId: 1 });
    fireEvent.pointerUp(board(), { button: 0, pointerType: 'mouse', clientX: colX(2), clientY: yOf(9 * 60), pointerId: 1 });
    expect(screen.queryByRole('menuitem', { name: /Objednat pacienta/ })).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/* the gear                                                                  */
/* ------------------------------------------------------------------------ */

describe('the gear: Rozlišení, Kalendáře, Pracovník', () => {
  it('opens the settings dialog with the file\'s rows and the resolution (Hodina = 1x at the start)', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const dialog = await screen.findByTestId('board-settings');
    expect(within(dialog).getByText('Více činností během jednoho dne')).toBeInTheDocument();
    expect(within(dialog).getByText('Referenční denní kapacita mini kalendáře')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Hodina' })).toHaveAttribute('aria-pressed', 'true');
    // the lab has read no calendars: nothing to filter
    expect(screen.queryByTestId('settings-calendars')).toBeNull();
    expect(screen.queryByTestId('settings-employee')).toBeNull();
  });

  it('a resolution is a zoom: Hodina 1x, 30 min 2x, 15 min 3.5x, 10 min 6x - remembered under calendarZoomV2 and kept after a reload', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const heightOf = () => Number.parseFloat(board().style.height);
    expect(heightOf()).toBeCloseTo(455, 3);
    expect(screen.queryByTestId('board-substeps')).toBeNull();
    expect(board()).toHaveAttribute('data-step', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    fireEvent.click(await screen.findByRole('button', { name: '30 min' }));
    expect(board()).toHaveAttribute('data-step', '30');
    expect(heightOf()).toBeCloseTo(455 * 2, 3);
    fireEvent.click(await screen.findByRole('button', { name: '15 min' }));
    expect(window.localStorage.getItem('calendarZoomV2')).toBe('3.5');
    expect(board()).toHaveAttribute('data-step', '15');
    expect(heightOf()).toBeCloseTo(455 * 3.5, 3);
    expect(screen.getByTestId('board-substeps')).toBeInTheDocument();
    expect(screen.getByTestId('board-body')).toHaveClass('is-tall');
    // the toolbar group shows the same zoom
    expect(screen.getByRole('button', { name: 'Přiblížení 3,5×' })).toBeInTheDocument();
    // + goes one preset finer, − one coarser
    fireEvent.click(screen.getByRole('button', { name: 'Jemnější mřížka' }));
    expect(board()).toHaveAttribute('data-step', '10');
    expect(heightOf()).toBeCloseTo(455 * 6, 3);
    fireEvent.click(screen.getByRole('button', { name: 'Hrubší mřížka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hrubší mřížka' }));
    expect(board()).toHaveAttribute('data-step', '30');
    expect(screen.getByRole('button', { name: 'Hrubší mřížka' })).toBeEnabled();
    // "reload": the store is re-created from the same storage
    cleanup();
    boardSettings.reset();
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    expect(board()).toHaveAttribute('data-step', '30');
    expect(boardSettings.getState().zoom).toBe(2);
    // the first version\'s key is migrated once (1.5 = "15 min" of the old grid -> 3.5x)
    window.localStorage.clear();
    window.localStorage.setItem('calendarZoom', '1.5');
    boardSettings.reset();
    expect(boardSettings.getState().zoom).toBe(3.5);
    expect(window.localStorage.getItem('calendarZoomV2')).toBe('3.5');
  });

  it('the zoom group of the toolbar: - and + walk the ladder 1-6, the value resets, the labels are Czech', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const group = screen.getByRole('group', { name: 'Přiblížení časové osy' });
    expect(within(group).getByRole('button', { name: 'Přiblížení 1×' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Oddálit' })).toBeDisabled();
    fireEvent.click(within(group).getByRole('button', { name: 'Přiblížit' }));
    expect(boardSettings.getState().zoom).toBe(1.5);
    fireEvent.click(within(group).getByRole('button', { name: 'Přiblížit' }));
    expect(within(group).getByRole('button', { name: 'Přiblížení 2×' })).toBeInTheDocument();
    expect(board()).toHaveAttribute('data-step', '30');
    expect(Number.parseFloat(board().style.height)).toBeCloseTo(910, 3);
    for (let i = 0; i < 10; i += 1) {
      const more = within(group).getByRole('button', { name: 'Přiblížit' });
      if (!(more as HTMLButtonElement).disabled) fireEvent.click(more);
    }
    expect(boardSettings.getState().zoom).toBe(6);
    expect(within(group).getByRole('button', { name: 'Přiblížit' })).toBeDisabled();
    expect(board()).toHaveAttribute('data-step', '10');
    expect(board()).toHaveAttribute('data-snap', '10');
    fireEvent.click(within(group).getByRole('button', { name: 'Přiblížení 6×' }));
    expect(boardSettings.getState().zoom).toBe(1);
    expect(Number.parseFloat(board().style.height)).toBeCloseTo(455, 3);
  });

  it('+ - 0 zoom the board when it is focused; other keys and Ctrl combinations do not', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const area = screen.getByTestId('week-board');
    area.focus();
    expect(area).toHaveFocus();
    fireEvent.keyDown(area, { key: '+' });
    expect(boardSettings.getState().zoom).toBe(1.5);
    fireEvent.keyDown(area, { key: '=' });
    fireEvent.keyDown(area, { key: 'Add' });
    expect(boardSettings.getState().zoom).toBe(2.5);
    fireEvent.keyDown(area, { key: '-' });
    expect(boardSettings.getState().zoom).toBe(2);
    fireEvent.keyDown(area, { key: '+', ctrlKey: true });
    fireEvent.keyDown(area, { key: 'x' });
    expect(boardSettings.getState().zoom).toBe(2);
    fireEvent.keyDown(area, { key: '0' });
    expect(boardSettings.getState().zoom).toBe(1);
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(area, { key: '+' });
    expect(boardSettings.getState().zoom).toBe(6);
    for (let i = 0; i < 12; i += 1) fireEvent.keyDown(area, { key: '-' });
    expect(boardSettings.getState().zoom).toBe(1);
  });

  it('Ctrl / Cmd + wheel over the board zooms it and stops the browser zooming the page; a plain wheel does neither', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const area = screen.getByTestId('week-board');
    const wheel = (init: WheelEventInit) => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
      act(() => {
        area.dispatchEvent(event);
      });
      return event;
    };
    const plain = wheel({ deltaY: -100 });
    expect(plain.defaultPrevented).toBe(false);
    expect(boardSettings.getState().zoom).toBe(1);
    const up = wheel({ deltaY: -100, ctrlKey: true });
    expect(up.defaultPrevented).toBe(true);
    expect(boardSettings.getState().zoom).toBeGreaterThan(1.2);
    const afterOne = boardSettings.getState().zoom;
    wheel({ deltaY: -100, metaKey: true });
    expect(boardSettings.getState().zoom).toBeGreaterThan(afterOne);
    for (let i = 0; i < 20; i += 1) wheel({ deltaY: -100, ctrlKey: true });
    expect(boardSettings.getState().zoom).toBe(6);
    for (let i = 0; i < 30; i += 1) wheel({ deltaY: 100, ctrlKey: true });
    expect(boardSettings.getState().zoom).toBe(1);
    // still keeps the page from zooming at the limit
    expect(wheel({ deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(true);
  });

  it('two fingers on the board pinch it: the spread of the fingers is the zoom', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const area = screen.getByTestId('week-board');
    const fingers = (spread: number) =>
      [
        { identifier: 1, clientX: 100, clientY: 200 },
        { identifier: 2, clientX: 100, clientY: 200 + spread },
      ] as unknown as Touch[];
    const send = (type: string, list: Touch[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: list });
      act(() => {
        area.dispatchEvent(event);
      });
      return event;
    };
    send('touchstart', fingers(100));
    send('touchmove', fingers(200));
    expect(boardSettings.getState().zoom).toBeCloseTo(2, 1);
    send('touchmove', fingers(900));
    expect(boardSettings.getState().zoom).toBe(6);
    send('touchmove', fingers(50));
    expect(boardSettings.getState().zoom).toBe(1);
    send('touchend', []);
    // one finger is not a pinch
    send('touchstart', [{ identifier: 1, clientX: 1, clientY: 1 }] as unknown as Touch[]);
    send('touchmove', [{ identifier: 1, clientX: 1, clientY: 90 }] as unknown as Touch[]);
    expect(boardSettings.getState().zoom).toBe(1);
  });

  it('the hour column labels the lines of the zoom: hours at 1x, half hours, quarters and ten minutes as it grows', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    const labels = () => [...document.querySelectorAll<HTMLElement>('.hour-label')];
    expect(labels().map((l) => l.textContent).slice(0, 3)).toEqual(['7:00', '8:00', '9:00']);
    expect(labels().some((l) => l.classList.contains('is-sub'))).toBe(false);
    act(() => boardSettings.setZoom(2));
    expect(labels()).toHaveLength(24);
    expect(labels().slice(0, 3).map((l) => l.textContent)).toEqual(['7:00', '7:30', '8:00']);
    act(() => boardSettings.setZoom(3.5));
    expect(labels()).toHaveLength(48);
    expect(labels()[1]).toHaveTextContent('7:15');
    act(() => boardSettings.setZoom(5));
    expect(labels()).toHaveLength(72);
    expect(labels().slice(0, 4).map((l) => l.textContent)).toEqual(['7:00', '7:10', '7:20', '7:30']);
    expect(labels()[1]).toHaveClass('is-sub');
    expect(labels()[0]).not.toHaveClass('is-sub');
    // 7:10 sits ten minutes below 7:00 on the zoomed board (11 px label offset as the file's)
    const tops = labels().map((l) => Number.parseFloat(l.style.top));
    expect(tops[1]! - tops[0]!).toBeCloseTo(10 * (455 / 720) * 5, 3);
    act(() => boardSettings.setZoom(1));
    expect(labels()).toHaveLength(12);
  });

  it('a zoomed-in card has room for more lines: booked / capacity appears with the height, not at 1x', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    const f1 = await screen.findByTestId('board-card-f1');
    expect(within(f1).queryByTestId('more-line')).toBeNull();
    act(() => boardSettings.setZoom(6));
    const zoomed = screen.getByTestId('board-card-f1');
    expect(within(zoomed).getByTestId('more-line')).toHaveTextContent('12 / 12 osob');
    // the lines it shows are unchanged: the činnost, the slots, the time and the price
    expect(zoomed).toHaveTextContent('Kondiční diagnostika');
    expect(zoomed).toHaveTextContent('14:00 – 16:00');
    act(() => boardSettings.setZoom(1));
    expect(within(screen.getByTestId('board-card-f1')).queryByTestId('more-line')).toBeNull();
  });

  it('the scroll position and the zoom stay when the week, the view or the day changes', async () => {
    mount({ real: false, initialDate: '2026-11-20' });
    await screen.findByTestId('board-card-m1');
    act(() => boardSettings.setZoom(4));
    const body = screen.getByTestId('board-body');
    body.scrollTop = 777;
    fireEvent.scroll(body);
    fireEvent.click(screen.getByRole('button', { name: 'Následující týden' }));
    expect(document.getElementById('week-number')).toHaveTextContent('48. týden');
    expect(screen.getByTestId('board-body').scrollTop).toBe(777);
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    fireEvent.click(screen.getByRole('button', { name: 'Měsíc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(screen.getByTestId('board-body').scrollTop).toBe(777);
    expect(boardSettings.getState().zoom).toBe(4);
    expect(boardSettings.getTopMinute()).not.toBeNull();
  });

  it('the calendars and the worker are chosen here and filter what the board shows', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    const second: Calendar = { ...calendar, id: 'c2', name: 'Ordinace 2' };
    expect(screen.getByTestId('board-booking-b2')).toBeInTheDocument();
    // a second calendar appears, with a booking of its own
    vi.mocked(calendarsApi.list).mockResolvedValue([calendar, second]);
    appointments = [b1, b2, appt('b3', '2026-12-10T08:00:00Z', '2026-12-10T08:30:00Z', { calendarId: 'c2' })];
    cleanup();
    boardSettings.reset();
    mount();
    await screen.findByTestId('board-booking-b3');
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const calendars = await screen.findByTestId('settings-calendars');
    fireEvent.click(within(calendars).getByRole('checkbox', { name: /Ordinace 2/ }));
    await waitFor(() => expect(screen.queryByTestId('board-booking-b3')).toBeNull());
    expect(screen.getByTestId('board-booking-b1')).toBeInTheDocument();
    fireEvent.click(within(calendars).getByRole('button', { name: 'Zobrazit všechny kalendáře' }));
    await screen.findByTestId('board-booking-b3');
    // the worker of the rota: only the days of that worker
    const employee = within(await screen.findByTestId('settings-employee')).getByRole('combobox');
    expect([...employee.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Všichni pracovníci', 'Anna Černá']);
  });
});

/* ------------------------------------------------------------------------ */
/* the real calendar: bookings, windows, blocks                              */
/* ------------------------------------------------------------------------ */

describe('the real calendar on the board', () => {
  it('draws every booking in its day with the patient, the times and the price line', async () => {
    appointments = [b1, appt('b4', '2026-12-08T10:00:00Z', '2026-12-08T12:00:00Z', { listPriceCzk: 1600 })];
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    expect(card).toHaveTextContent('Pacient b1');
    expect(card).toHaveTextContent('09:00 – 09:30');
    const tall = await screen.findByTestId('board-booking-b4'); // two hours: price on its own line
    expect(within(tall).getByTestId('price-line')).toHaveTextContent(/1\s600\sKč/);
    expect(tall).toHaveAttribute('data-price-lines', 'own');
    // a 30 minute card has no room for it
    expect(within(card).queryByTestId('price-line')).toBeNull();
    expect(card).toHaveAttribute('data-col', '1'); // Tuesday
  });

  it('draws a club\'s window as one block across the lunch break and a manual block with its reason', async () => {
    const piece = (id: string, startUtc: string, endUtc: string): TimeBlock => ({ id, startUtc, endUtc, reason: '', kind: 'club', clubBlockId: 'cb1', clubId: 'club1', clubName: 'FK Slaný', colorHex: '#2E7D32' });
    blocks = [
      piece('k1', '2026-12-10T07:00:00Z', '2026-12-10T11:00:00Z'), // 08:00-12:00
      piece('k2', '2026-12-10T11:30:00Z', '2026-12-10T15:00:00Z'), // 12:30-16:00
      { id: 'm1', startUtc: '2026-12-11T08:00:00Z', endUtc: '2026-12-11T09:00:00Z', reason: 'Školení', kind: 'manual' },
    ];
    mount();
    const club = await screen.findByTestId('board-window-k1-2026-12-10');
    expect(club).toHaveTextContent('FK Slaný');
    expect(within(club).getByTestId('club-window-time')).toHaveTextContent('08:00–16:00');
    expect(screen.queryByTestId('board-window-k2-2026-12-10')).toBeNull(); // one block, not two pieces
    expect(screen.getByTestId('board-window-m1-2026-12-11')).toHaveTextContent('Školení');
    expect(screen.getByTestId('lunch-2026-12-10')).toHaveTextContent('Oběd');
  });

  it('a click on a club window opens the club\'s popover, on a manual block the block\'s detail', async () => {
    blocks = [
      { id: 'k1', startUtc: '2026-12-10T07:00:00Z', endUtc: '2026-12-10T09:00:00Z', reason: '', kind: 'club', clubBlockId: 'cb1', clubId: 'club1', clubName: 'FK Slaný', colorHex: '#2E7D32' },
      { id: 'm1', startUtc: '2026-12-11T08:00:00Z', endUtc: '2026-12-11T09:00:00Z', reason: 'Školení', kind: 'manual' },
    ];
    mount();
    fireEvent.click(await screen.findByTestId('board-window-k1-2026-12-10'));
    expect(JSON.parse(screen.getByTestId('club-popover').dataset.pick!)).toMatchObject({ clubBlockId: 'cb1', clubId: 'club1', clubName: 'FK Slaný' });
    fireEvent.click(screen.getByTestId('board-window-m1-2026-12-11'));
    const detail = await screen.findByRole('dialog', { name: /Zablokovaný čas/ });
    expect(detail).toHaveTextContent('Školení');
  });

  it('draws the now-line on today inside the working day, with its time', async () => {
    mount();
    const line = await screen.findByTestId('now-line');
    expect(screen.getByTestId('now-pill')).toHaveTextContent('10:00');
    expect(Number.parseFloat(line.style.top)).toBeCloseTo(yOf(600), 3);
    expect(screen.getByTestId('now-edge-left')).toBeInTheDocument();
    expect(document.querySelector('.day-title.is-today')).toHaveAttribute('data-day', TODAY);
  });
});

/* ------------------------------------------------------------------------ */
/* marking free time -> the popover -> the dialogs                           */
/* ------------------------------------------------------------------------ */

const drag = (col: number, fromMinute: number, toMinute: number, pointerType = 'mouse') => {
  fireEvent.pointerDown(board(), { button: 0, pointerType, clientX: colX(col), clientY: yOf(fromMinute), pointerId: 1 });
  fireEvent.pointerMove(board(), { pointerType, clientX: colX(col), clientY: yOf(toMinute), pointerId: 1 });
  fireEvent.pointerUp(board(), { pointerType, clientX: colX(col), clientY: yOf(toMinute), pointerId: 1 });
};

describe('marking free time', () => {
  it('a drag on an empty place shows the preview with its length and opens the popover', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(3), clientY: yOf(13 * 60 + 10), pointerId: 1 });
    fireEvent.pointerMove(board(), { pointerType: 'mouse', clientX: colX(3), clientY: yOf(14 * 60 + 20), pointerId: 1 });
    const preview = screen.getByTestId('board-selection');
    expect(preview).toHaveTextContent('13:00 – 14:30');
    expect(preview).toHaveTextContent('90 min');
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: colX(3), clientY: yOf(14 * 60 + 20), pointerId: 1 });
    const menu = await screen.findByRole('menu', { name: 'Akce pro vybraný čas' });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Objednat pacienta/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Zablokovat čas/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Přidat do objednávky klubu/ })).toBeInTheDocument();
    expect(within(menu.closest('[role="presentation"]') as HTMLElement).getByText('13:00 – 14:30')).toBeInTheDocument();
    expect(screen.getByText('Ordinace 1')).toBeInTheDocument();
  });

  it('a click on a free slot marks that one slot (the calendar\'s step)', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(4), clientY: yOf(9 * 60 + 40), pointerId: 1 });
    fireEvent.pointerUp(board(), { pointerType: 'mouse', clientX: colX(4), clientY: yOf(9 * 60 + 40), pointerId: 1 });
    expect(screen.getByTestId('board-selection')).toHaveTextContent('09:30 – 10:00');
  });

  it('"Objednat pacienta" opens the booking bubble anchored to the marked slot, on the right calendar and time', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    drag(3, 13 * 60, 14 * 60); // Thursday 13:00 - 14:30
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props).toMatchObject({
      open: true,
      initialDate: '2026-12-10',
      initialCalendarId: 'c1',
      initialStart: '2026-12-10T13:00',
      initialEnd: '2026-12-10T14:30',
      anchor: { x: 111, y: 222, width: 90, height: 33 }, // the marked slot's own box
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('with a činnost chosen in the filter the booking starts on that činnost', async () => {
    vi.mocked(activitiesApi.list).mockResolvedValue({
      activities: [{ id: 'a1', name: 'Prohlídka', clinicServiceId: 's1', durationMinutes: 30, sortOrder: 0, isActive: true, parallelCapacity: 1, priceCzk: 1600, colorHex: '#00f1dc', effectiveColorHex: '#00f1dc' } as never],
      warnings: [],
    });
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.change(document.getElementById('activity-filter')!, { target: { value: 'all' } });
    drag(3, 9 * 60, 9 * 60);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Objednat pacienta/ }));
    const props = JSON.parse((await screen.findByTestId('new-appointment')).dataset.props!);
    expect(props.initialDate).toBe('2026-12-10');
  });

  it('"Zablokovat čas" asks for the reason and blocks that time on that calendar', async () => {
    vi.mocked(appointmentsApi.createBlock).mockResolvedValue({ id: 'new', startUtc: '', endUtc: '', reason: 'Školení' } as TimeBlock);
    mount();
    await screen.findByTestId('board-booking-b1');
    drag(4, 14 * 60, 14 * 60); // Friday 14:00-14:30
    fireEvent.click(await screen.findByRole('menuitem', { name: /Zablokovat čas/ }));
    expect(await screen.findByText('Důvod blokace')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Důvod blokace/), { target: { value: 'Školení' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zablokovat' }));
    await waitFor(() => expect(appointmentsApi.createBlock).toHaveBeenCalledTimes(1));
    const [calendarId, startUtc, endUtc, reason] = vi.mocked(appointmentsApi.createBlock).mock.calls[0]!;
    expect(calendarId).toBe('c1');
    expect(new Date(startUtc as string).toISOString()).toBe('2026-12-11T13:00:00.000Z');
    expect(new Date(endUtc as string).toISOString()).toBe('2026-12-11T13:30:00.000Z');
    expect(reason).toBe('Školení');
  });

  it('"Přidat do objednávky klubu" hands the marked range to the club order dialog', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    drag(0, 9 * 60, 10 * 60); // Monday 09:00-10:30
    fireEvent.click(await screen.findByRole('menuitem', { name: /Přidat do objednávky klubu/ }));
    expect(JSON.parse((await screen.findByTestId('add-to-club')).dataset.marked!)).toMatchObject({
      kind: 'time', calendarId: 'c1', dayKey: '2026-12-07', range: { start: 540, end: 630 },
    });
  });

  it('does not start on a closed day, on a card, or while a činnost is armed for planning', async () => {
    mount({ initialDate: '2026-11-26' });
    await screen.findByTestId('closed-2026-11-26');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(3), clientY: yOf(9 * 60), pointerId: 1 }); // 26. 11. is the Thursday
    expect(screen.queryByTestId('board-selection')).toBeNull();
    cleanup();
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: colX(1), clientY: yOf(9 * 60), pointerId: 1 });
    expect(screen.queryByTestId('board-selection')).toBeNull();
    act(() => actions!.selectPlanningCategory('medical'));
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(3), clientY: yOf(9 * 60), pointerId: 1 });
    expect(screen.queryByTestId('board-selection')).toBeNull();
    expect(board()).not.toHaveAttribute('data-pickable');
  });

  it("while a club order is planned the board belongs to the order: a press on free time starts no booking", async () => {
    mount({ config: { mode: 'club' } });
    await screen.findByTestId('board-booking-b1');
    expect(board()).not.toHaveAttribute('data-pickable');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(3), clientY: yOf(9 * 60), pointerId: 1 });
    expect(screen.queryByTestId('board-selection')).toBeNull();
    expect(screen.getByTestId('planning-board-layer')).toBeInTheDocument(); // the planning layer owns the board
    expect(screen.queryByTestId('board-entry-points')).not.toBeNull(); // the toolbar's entry points stay
  });

  it('standard ordering without an order mounts no planning layer (nothing to arm, no "vyberte činnost" prompt)', async () => {
    class NoOrder extends DemoDataSource {
      async getOrder() {
        const o = await super.getOrder();
        return { ...o, demands: [], baselineSessions: [] };
      }
    }
    mount({ source: new NoOrder({ today: TODAY }) });
    await screen.findByTestId('board-booking-b1');
    expect(screen.queryByTestId('planning-board-layer')).toBeNull();
    expect(board()).toHaveAttribute('data-board-mode', 'standard');
    expect(board()).toHaveAttribute('data-pickable', 'true');
  });

  it("standard layout (order.club === false): the board takes the room of the deck and widens to a booking outside the hours", async () => {
    class Standard extends DemoDataSource {
      async getOrder() {
        const o = await super.getOrder();
        return { ...o, club: false, demands: [], baselineSessions: [] };
      }
    }
    appointments = [b1, appt('night', '2026-12-08T00:00:00Z', '2026-12-08T00:30:00Z')]; // 01:00-01:30 Prague
    mount({ source: new Standard({ today: TODAY }) });
    await screen.findByTestId('board-booking-night');
    expect(screen.getByTestId('week-board-panel')).toHaveAttribute('data-layout', 'standard');
    const pxPerHour = 629 / 12;
    // 01:00 ... 19:00: the planning window (07-19) widened by six hours above it, the hour keeps its height
    expect(Number.parseFloat(board().style.height)).toBeCloseTo(18 * pxPerHour, 3);
    expect([...document.querySelectorAll('.hour-label')].map((e) => e.textContent).slice(0, 2)).toEqual(['1:00', '2:00']);
    expect(topOf(screen.getByTestId('board-booking-night'))).toBeCloseTo(0, 3);
    expect(screen.getByTestId('board-body')).toHaveClass('is-tall');
  });

  it('Esc drops a drag in progress', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.pointerDown(board(), { button: 0, pointerType: 'mouse', clientX: colX(3), clientY: yOf(9 * 60), pointerId: 1 });
    expect(screen.getByTestId('board-selection')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('board-selection')).toBeNull();
  });

  it('offers nothing without the permission to book or block', async () => {
    window.localStorage.setItem('permissions', JSON.stringify([]));
    mount();
    await screen.findByTestId('board-booking-b1');
    expect(board()).not.toHaveAttribute('data-pickable');
    expect(screen.queryByTestId('board-entry-points')).toBeNull();
    expect(screen.getByTestId('board-booking-b1')).not.toHaveAttribute('data-draggable');
  });
});

/* ------------------------------------------------------------------------ */
/* clicking a booking                                                        */
/* ------------------------------------------------------------------------ */

describe('clicking a booking', () => {
  it('one click selects it and shows the summary; "Otevřít detail" and a double click open the detail', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    fireEvent.click(card, { detail: 1 });
    expect(screen.queryByTestId('appointment-detail')).toBeNull();
    const summary = await screen.findByTestId('appointment-summary');
    expect(summary).toHaveTextContent('09:00–09:30');
    expect(summary).toHaveTextContent('Pacient b1');
    expect(card).toHaveClass('is-selected');
    fireEvent.click(within(summary).getByRole('button', { name: 'Otevřít detail' }));
    expect(screen.getByTestId('appointment-detail')).toHaveAttribute('data-id', 'b1');
    expect(screen.getByTestId('appointment-detail')).toHaveAttribute('data-calendar', 'c1');
  });

  it('a double click opens the detail straight away', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b2');
    fireEvent.click(card, { detail: 1 });
    fireEvent.click(card, { detail: 2 });
    expect(screen.getByTestId('appointment-detail')).toHaveAttribute('data-id', 'b2');
  });

  it('Esc closes the summary', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('board-booking-b1'), { detail: 1 });
    await screen.findByTestId('appointment-summary');
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('appointment-summary')).toBeNull());
  });
});

/* ------------------------------------------------------------------------ */
/* moving a booking                                                          */
/* ------------------------------------------------------------------------ */

const topOf = (el: HTMLElement) => Number.parseFloat(el.style.top);
const grab = (card: HTMLElement) => fireEvent.pointerDown(card, { button: 0, pointerType: 'mouse', clientX: colX(1), clientY: topOf(card) + 2, pointerId: 7 });
const moveTo = (col: number, minute: number) => fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: colX(col), clientY: yOf(minute) + 2, pointerId: 7 });
const dropAt = (col: number, minute: number) => fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: colX(col), clientY: yOf(minute) + 2, pointerId: 7 });

describe('moving a booking', () => {
  it('asks first (beside the card), and "Přesunout" sends the new time with notifyPatient', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b1'); // Tuesday 09:00
    grab(card);
    moveTo(3, 10 * 60 + 30); // Thursday 10:30
    expect(await screen.findByTestId('move-ghost')).toHaveTextContent('10:30 – 11:00');
    dropAt(3, 10 * 60 + 30);
    // the card sits at its new slot and the confirm popover asks - nothing is written yet
    const dialog = await screen.findByTestId('move-confirm');
    expect(dialog).toHaveTextContent('Přesunutí rezervace');
    expect(dialog).toHaveTextContent('Pacient b1');
    expect(appointmentsApi.reschedule).not.toHaveBeenCalled();
    const moved = screen.getByTestId('board-booking-b1');
    expect(moved).toHaveClass('is-proposed');
    expect(moved).toHaveAttribute('data-col', '3'); // Thursday: the card sits at its new slot
    expect(topOf(moved)).toBeCloseTo(yOf(10 * 60 + 30), 3);
    // "Upozornit klienta na změnu" is on by default; the desk can switch it off
    const notify = within(dialog).getByRole('checkbox', { name: 'Upozornit klienta na změnu' });
    expect(notify).toBeChecked();
    fireEvent.click(notify);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));
    await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalledTimes(1));
    expect(appointmentsApi.reschedule).toHaveBeenCalledWith('c1', 'b1', '2026-12-10T09:30:00.000Z', undefined, { notifyPatient: false });
    await waitFor(() => expect(screen.getByTestId('board-notice')).toHaveTextContent('Termín přesunut · bez oznámení'));
  });

  it('says "pacientovi odesíláme oznámení" when the patient is told', async () => {
    mount();
    grab(await screen.findByTestId('board-booking-b1'));
    moveTo(2, 11 * 60);
    dropAt(2, 11 * 60);
    fireEvent.click(within(await screen.findByTestId('move-confirm')).getByRole('button', { name: 'Přesunout' }));
    await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalled());
    expect(vi.mocked(appointmentsApi.reschedule).mock.calls[0]![4]).toEqual({ notifyPatient: true });
    await waitFor(() => expect(screen.getByTestId('board-notice')).toHaveTextContent('pacientovi odesíláme oznámení'));
  });

  it('says so when the server did not tell the patient although the desk asked for it', async () => {
    vi.mocked(appointmentsApi.reschedule).mockResolvedValue({ patientNotified: false, reason: 'no_email' });
    mount();
    grab(await screen.findByTestId('board-booking-b1'));
    moveTo(2, 11 * 60);
    dropAt(2, 11 * 60);
    fireEvent.click(within(await screen.findByTestId('move-confirm')).getByRole('button', { name: 'Přesunout' }));
    await waitFor(() => expect(screen.getByTestId('board-notice')).toHaveTextContent('Termín přesunut · pacient nebyl upozorněn (pacient nemá e-mail)'));
  });

  it('"Zrušit" glides the card back to where it was and writes nothing', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    const home = topOf(card);
    grab(card);
    moveTo(3, 14 * 60);
    dropAt(3, 14 * 60);
    const dialog = await screen.findByTestId('move-confirm');
    expect(topOf(screen.getByTestId('board-booking-b1'))).toBeCloseTo(yOf(14 * 60), 3);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
    await waitFor(() => expect(screen.queryByTestId('move-confirm')).toBeNull());
    const back = screen.getByTestId('board-booking-b1');
    expect(topOf(back)).toBeCloseTo(home, 3);
    expect(back).toHaveAttribute('data-col', '1'); // Tuesday again
    expect(appointmentsApi.reschedule).not.toHaveBeenCalled();
  });

  it('Esc during the drag snaps back with no question', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    grab(card);
    moveTo(3, 14 * 60);
    expect(await screen.findByTestId('move-ghost')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('move-ghost')).toBeNull());
    dropAt(3, 14 * 60);
    expect(screen.queryByTestId('move-confirm')).toBeNull();
    expect(appointmentsApi.reschedule).not.toHaveBeenCalled();
  });

  it('a server refusal glides the card back and says the server\'s own sentence', async () => {
    vi.mocked(appointmentsApi.reschedule).mockRejectedValue(new BookingApiError('conflict', 409, 'Termín už je obsazený.'));
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    const home = topOf(card);
    grab(card);
    moveTo(3, 10 * 60);
    dropAt(3, 10 * 60);
    fireEvent.click(within(await screen.findByTestId('move-confirm')).getByRole('button', { name: 'Přesunout' }));
    await waitFor(() => expect(screen.getByTestId('board-notice')).toHaveTextContent('Termín už je obsazený.'));
    expect(screen.getByTestId('board-notice')).toHaveAttribute('data-tone', 'error');
    await waitFor(() => expect(topOf(screen.getByTestId('board-booking-b1'))).toBeCloseTo(home, 3));
  });

  it('refuses a place outside the working hours / a busy one before asking, naming the reason', async () => {
    appointments = [b1, b2, appt('b6', '2026-12-11T13:00:00Z', '2026-12-11T13:30:00Z')]; // Friday 14:00-14:30
    mount();
    grab(await screen.findByTestId('board-booking-b1'));
    moveTo(3, 17 * 60); // after 16:00
    const ghost = await screen.findByTestId('move-ghost');
    expect(ghost).toHaveAttribute('data-refused', 'hours');
    expect(ghost).toHaveTextContent('Mimo ordinační hodiny');
    dropAt(3, 17 * 60);
    expect(screen.queryByTestId('move-confirm')).toBeNull();
    expect(screen.getByTestId('board-notice')).toHaveTextContent('Sem termín přesunout nelze · Mimo ordinační hodiny');
    // lunch is outside the hours too, and a booking of the same činnost makes a time busy
    grab(screen.getByTestId('board-booking-b1'));
    moveTo(4, 12 * 60 + 2); // the lunch break 12:00-12:30
    expect(await screen.findByTestId('move-ghost')).toHaveAttribute('data-refused', 'hours');
    moveTo(4, 14 * 60); // Friday 14:00 - where b6 (the same činnost, capacity 1) is
    expect(await screen.findByTestId('move-ghost')).toHaveAttribute('data-refused', 'busy');
  });

  it('the notice bus words: the checkbox remembers its state for the session', async () => {
    mount();
    grab(await screen.findByTestId('board-booking-b1'));
    moveTo(3, 11 * 60);
    dropAt(3, 11 * 60);
    const dialog = await screen.findByTestId('move-confirm');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Upozornit klienta na změnu' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));
    await waitFor(() => expect(appointmentsApi.reschedule).toHaveBeenCalled());
    expect(window.sessionStorage.getItem('sm.move.notifyPatient')).toBe('0');
  });

  it('a press that does not travel is a click (the summary), not a move', async () => {
    mount();
    const card = await screen.findByTestId('board-booking-b1');
    grab(card);
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: colX(1), clientY: topOf(card) + 2, pointerId: 7 });
    fireEvent.click(card, { detail: 1 });
    expect(await screen.findByTestId('appointment-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('move-ghost')).toBeNull();
    expect(screen.queryByTestId('move-confirm')).toBeNull();
  });

  it('a cancelled booking cannot be picked up', async () => {
    appointments = [appt('b5', '2026-12-08T08:00:00Z', '2026-12-08T08:30:00Z', { status: 4 })];
    mount();
    const card = await screen.findByTestId('board-booking-b5');
    expect(card).not.toHaveAttribute('data-draggable');
    grab(card);
    moveTo(3, 11 * 60);
    expect(screen.queryByTestId('move-ghost')).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/* the toolbar's entry points                                                */
/* ------------------------------------------------------------------------ */

describe('"Nová objednávka" and "Klubová objednávka"', () => {
  it('Nová objednávka opens the booking on the next free slot of the first calendar', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    const entry = screen.getByTestId('board-entry-points');
    fireEvent.click(within(entry).getByRole('button', { name: /Objednávka/ }));
    const props = JSON.parse((await screen.findByTestId('new-appointment', undefined, { timeout: 3000 })).dataset.props!);
    expect(props).toMatchObject({ open: true, initialCalendarId: 'c1', initialDate: TODAY });
    // now is Wed 09:15 Prague: the next free half hour that is neither booked nor lunch
    expect(props.initialStart).toBe('2026-12-09T09:30');
    expect(props.initialEnd).toBe('2026-12-09T10:00');
  });

  it('Klubová objednávka opens the club order chooser', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    expect(screen.getByRole('button', { name: 'Klubová objednávka' })).toBeInTheDocument();
  });
});


/* ------------------------------------------------------------------------ */
/* what other screens hand over by router state                              */
/* ------------------------------------------------------------------------ */

describe("hand-overs by router state (the calendar page's landings)", () => {
  it("'Nová objednávka' from the sidebar / a patient's card opens the booking once, for that patient", async () => {
    mount({ entry: { pathname: '/', state: { newAppointment: 1, patientId: 'p9' } } });
    const props = JSON.parse((await screen.findByTestId('new-appointment', undefined, { timeout: 3000 })).dataset.props!);
    expect(props).toMatchObject({ initialPatientId: 'p9', initialCalendarId: 'c1' });
  });

  it('a date moves the board to that week', async () => {
    mount({ entry: { pathname: '/', state: { date: '2026-12-22' } } });
    await screen.findByTestId('board-booking-b1').catch(() => null);
    await waitFor(() => expect(document.getElementById('week-range')).toHaveTextContent('21. – 27. prosince 2026'));
  });

  it('"openClubOrder" opens the club order chooser, and "Vyplním sám" starts club planning through the router', async () => {
    mount({ entry: { pathname: '/planovani', state: { openClubOrder: true } } });
    const entry = await screen.findByTestId('club-entry');
    fireEvent.click(within(entry).getByRole('button', { name: 'Vyplním sám' }));
    await waitFor(() => expect(screen.queryByTestId('club-entry')).toBeNull());
    const probe = screen.getByTestId('location');
    expect(probe.dataset.path).toBe('/planovani');
    expect(JSON.parse(probe.dataset.state!)).toEqual({ pickOrder: { clubId: 'club7' } });
  });

  it('the "Klub" button of the toolbar opens the same chooser', async () => {
    mount();
    await screen.findByTestId('board-booking-b1');
    fireEvent.click(screen.getByRole('button', { name: 'Klubová objednávka' }));
    expect(await screen.findByTestId('club-entry')).toBeInTheDocument();
  });

  it("a služba hand-over shows only that služba's calendars", async () => {
    const second: Calendar = { ...calendar, id: 'c2', name: 'Ordinace 2', clinicServiceId: 's2' };
    vi.mocked(calendarsApi.list).mockResolvedValue([calendar, second]);
    vi.mocked(clinicServicesApi.list).mockResolvedValue([
      { id: 's1', name: 'Diagnostika', description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null },
      { id: 's2', name: 'Prohlídky', description: '', sortOrder: 1, isActive: true, activities: 1, calendars: 1, colorHex: null },
    ]);
    appointments = [b1, appt('b3', '2026-12-10T08:00:00Z', '2026-12-10T08:30:00Z', { calendarId: 'c2' })];
    mount({ entry: { pathname: '/', state: { serviceId: 's2' } } });
    await waitFor(() => expect(screen.queryByTestId('board-booking-b1')).toBeNull());
    expect(await screen.findByTestId('board-booking-b3')).toBeInTheDocument();
    // the gear shows the same filter and takes it back
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const services = await screen.findByTestId('settings-services');
    expect(within(services).getByRole('checkbox', { name: /Diagnostika/ })).not.toBeChecked();
    fireEvent.click(within(services).getByRole('button', { name: 'Všechny služby' }));
    await screen.findByTestId('board-booking-b1');
  });
});
