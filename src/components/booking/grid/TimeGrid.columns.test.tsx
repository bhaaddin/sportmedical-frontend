import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import { TimeGrid, type TimeGridProps } from './TimeGrid';
import { dayMark } from './dayMarks';
import { addDaysToDateOnly } from '../../../utils/time';
import { useDayRange } from '../calendar/useDayRange';
import { activityInfoOf, type Catalogue, type ColumnSpec } from '../calendar/model';
import type { Activity } from '../../../api/bookingContracts';

/*
 * The grid of činnosti: columns coloured by the činnost, simultaneous bookings
 * in lanes, a club's block as its own thing, and the two ways of marking days.
 */

const DAY = '2026-10-26';
const PX_PER_MINUTE = 52 / 60;
const yAt = (minute: number) => (minute - 7 * 60) * PX_PER_MINUTE + 1;

const calendar: Calendar = {
  id: 'c1',
  name: 'Ordinace 1',
  color: '#999999',
  location: '',
  displayStepMinutes: 30,
  isActive: true,
  sortOrder: 0,
  clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null,
  publicHorizonDays: null,
  publicHoldMinutes: null,
  publicCancellationHours: null,
};

const activity = (id: string, name: string, hex: string, sortOrder: number): Activity =>
  ({
    id,
    name,
    slug: id,
    durationMinutes: 30,
    color: '#000000',
    publicNote: '',
    isPubliclyBookable: true,
    requiresReportByEmail: false,
    requiresClubSharing: false,
    questionnaireRequirement: 'NotAsked',
    sortOrder,
    isActive: true,
    serviceItemId: null,
    priceCzk: null,
    clinicServiceId: 's1',
    questionnaireDefinitionId: null,
    effectiveColorHex: hex,
  }) as Activity;

const catalogue: Catalogue = {
  activities: new Map(
    [activity('a1', 'Základní prohlídka', '#1565C0', 1), activity('a2', 'Spiroergometrie', '#2E7D32', 2)].map((a) => [
      a.id,
      activityInfoOf(a),
    ]),
  ),
  services: new Map([['s1', { id: 's1', name: 'Prohlídky', colorHex: '#1565C0', sortOrder: 1, isActive: true }]]),
};

const columns: ColumnSpec[] = [
  { key: 'c1:a1', calendarId: 'c1', activityId: 'a1', title: 'Základní prohlídka', colorHex: '#1565C0', serviceId: 's1', capacity: 1 },
  { key: 'c1:a2', calendarId: 'c1', activityId: 'a2', title: 'Spiroergometrie', colorHex: '#2E7D32', serviceId: 's1', capacity: 1 },
];

function row(date: string, overrides: Partial<PreviewDay> = {}): PreviewDay {
  return {
    date,
    isOpen: true,
    closedBecause: null,
    startTime: '08:00:00',
    endTime: '16:00:00',
    breakStart: null,
    breakEnd: null,
    workerUserId: 'u1',
    workerDisplayName: 'Anna Černá',
    isChangedByOverride: false,
    offeredActivityIds: ['a1', 'a2'],
    ...overrides,
  };
}

const appt = (id: string, activityId: string, startUtc: string, endUtc: string): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: '',
  patientName: `Pacient ${id}`,
  activityId,
  activityName: activityId === 'a1' ? 'Základní prohlídka' : 'Spiroergometrie',
  startUtc,
  endUtc,
  status: 0,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  partnerName: null,
  clubDiscountPercent: null,
  paymentState: 'none',
  invoiceId: null,
});

function Harness({ props }: { props: Partial<TimeGridProps> }) {
  const rangeSelect = useDayRange();
  const full: TimeGridProps = {
    days: [DAY],
    view: 'day',
    selectedDay: DAY,
    calendars: [calendar],
    appointmentsByDay: new Map(),
    previewByCalendar: new Map([[calendar.id, new Map([[DAY, row(DAY)]])]]),
    blocksByCalendar: new Map(),
    marks: new Map([[DAY, dayMark(undefined, [row(DAY)])]]),
    openSpan: { start: 7, end: 19 },
    now: new Date('2026-10-20T10:00:00Z'),
    employeeId: null,
    nowLineColor: '#C0392B',
    holidayColor: '#E7CBA9',
    mayBook: true,
    mayBlock: true,
    onOpen: vi.fn(),
    onBook: vi.fn(),
    onPickDay: vi.fn(),
    columns,
    catalogue,
    rangeSelect,
    ...props,
  };
  return (
    <>
      <TimeGrid {...full} />
      <output data-testid="chosen">{rangeSelect.chosen ? `${rangeSelect.chosen.from}|${rangeSelect.chosen.to}` : ''}</output>
    </>
  );
}

function renderGrid(props: Partial<TimeGridProps> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Harness props={props} />
    </QueryClientProvider>,
  );
}

describe('the columns are činnosti, coloured by their service', () => {
  it('heads each with a dot in its colour, its name and its reservations', () => {
    renderGrid({
      appointmentsByDay: new Map([
        [
          DAY,
          [
            appt('1', 'a1', '2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z'),
            appt('2', 'a1', '2026-10-26T08:00:00Z', '2026-10-26T08:30:00Z'),
            appt('3', 'a2', '2026-10-26T09:00:00Z', '2026-10-26T10:00:00Z'),
          ],
        ],
      ]),
    });
    const first = screen.getByTestId('column-header-c1:a1');
    expect(within(first).getByRole('heading', { name: 'Základní prohlídka' })).toBeInTheDocument();
    expect(within(first).getByText(/^2 rezervace/)).toBeInTheDocument();
    expect(screen.getByTestId('column-dot-c1:a1')).toHaveStyle({ backgroundColor: 'rgb(21, 101, 192)' });
    expect(screen.getByTestId('column-dot-c1:a2')).toHaveStyle({ backgroundColor: 'rgb(46, 125, 50)' });
    /* The second činnost's only booking ends before noon on a day that works to 16:00. */
    expect(within(screen.getByTestId('column-header-c1:a2')).getByText('1 rezervace · odpoledne volno')).toBeInTheDocument();
  });

  it('draws a booking with its činnost’s colour on the edge, in its own column', () => {
    renderGrid({
      appointmentsByDay: new Map([[DAY, [appt('9', 'a2', '2026-10-26T09:00:00Z', '2026-10-26T10:00:00Z')]]]),
    });
    const cell = within(screen.getByTestId('sub-column-c1:a2-2026-10-26')).getByTestId('appointment-cell-9');
    expect(within(cell).getByRole('button')).toHaveStyle({ borderLeft: '3px solid #2E7D32' });
    expect(within(screen.getByTestId('sub-column-c1:a1-2026-10-26')).queryByTestId('appointment-cell-9')).not.toBeInTheDocument();
  });

  it('names the calendar over its group of columns when there are several', () => {
    const other: Calendar = { ...calendar, id: 'c2', name: 'Ordinace 2' };
    renderGrid({
      calendars: [calendar, other],
      previewByCalendar: new Map([
        ['c1', new Map([[DAY, row(DAY)]])],
        ['c2', new Map([[DAY, row(DAY)]])],
      ]),
      columns: [...columns, { key: 'c2:a1', calendarId: 'c2', activityId: 'a1', title: 'Základní prohlídka', colorHex: '#1565C0', serviceId: 's1', capacity: 1 }],
    });
    expect(screen.getByText('Ordinace 1')).toBeInTheDocument();
    expect(screen.getByText('Ordinace 2')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Základní prohlídka' })).toHaveLength(2);
  });

  it('a drag in a činnost column hands the calendar and the činnost on', () => {
    const onBook = vi.fn();
    renderGrid({ onBook });
    const column = screen.getByTestId('sub-column-c1:a2-2026-10-26');
    fireEvent.pointerDown(column, { button: 0, clientY: yAt(9 * 60), clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(column, { clientY: yAt(9 * 60), clientX: 100, pointerId: 1 });
    fireEvent.click(screen.getByRole('menuitem', { name: /Objednat pacienta/ }));
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ calendarId: 'c1', activityId: 'a2', start: '2026-10-26T09:00' }));
  });
});

describe('simultaneous bookings', () => {
  it('sit side by side in lanes inside one column', () => {
    renderGrid({
      appointmentsByDay: new Map([
        [
          DAY,
          [
            appt('1', 'a1', '2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z'),
            appt('2', 'a1', '2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z'),
            appt('3', 'a1', '2026-10-26T12:00:00Z', '2026-10-26T13:00:00Z'),
          ],
        ],
      ]),
    });
    const one = screen.getByTestId('appointment-cell-1');
    const two = screen.getByTestId('appointment-cell-2');
    expect(one).toHaveAttribute('data-lanes', '2');
    expect(two).toHaveAttribute('data-lanes', '2');
    expect(new Set([one.dataset.lane, two.dataset.lane])).toEqual(new Set(['0', '1']));
    /* The lone one at noon keeps the full width. */
    expect(screen.getByTestId('appointment-cell-3')).toHaveAttribute('data-lanes', '1');
  });

  it('fold into a count when more than fits, and the count opens the rest', () => {
    const onOpen = vi.fn();
    const five = ['1', '2', '3', '4', '5'].map((id) => appt(id, 'a1', '2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z'));
    renderGrid({ appointmentsByDay: new Map([[DAY, five]]), onOpen });
    const chip = screen.getByRole('button', { name: /Dalších 3 rezervací/ });
    expect(chip).toHaveTextContent('+3');
    fireEvent.click(chip);
    const popover = screen.getByRole('presentation');
    const rest = within(popover).getAllByRole('button');
    expect(rest).toHaveLength(3);
    fireEvent.click(rest[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('a club’s block', () => {
  const clubBlock: TimeBlock = {
    id: 'b1',
    startUtc: '2026-10-26T07:00:00Z',
    endUtc: '2026-10-26T10:00:00Z',
    reason: '',
    kind: 'club',
    clubBlockId: 'cb1',
    clubId: 'club1',
    clubName: 'FK Slaný',
    colorHex: '#7B1FA2',
  };
  const manual: TimeBlock = { id: 'b2', startUtc: '2026-10-26T11:00:00Z', endUtc: '2026-10-26T12:00:00Z', reason: 'Porada', kind: 'manual' };

  it('wears the club’s colour and name, apart from a manual block', () => {
    renderGrid({ blocksByCalendar: new Map([[calendar.id, [clubBlock, manual]]]) });
    const club = screen.getAllByRole('button', { name: 'FK Slaný' })[0];
    expect(club).toHaveAttribute('data-kind', 'club');
    expect(club).toHaveStyle({ borderLeft: '3px solid #7B1FA2' });
    const plain = screen.getAllByRole('button', { name: 'Porada' })[0];
    expect(plain).toHaveAttribute('data-kind', 'manual');
  });

  it('is not bookable: a press on it does not start a drag', () => {
    renderGrid({ blocksByCalendar: new Map([[calendar.id, [clubBlock]]]) });
    const club = screen.getAllByRole('button', { name: 'FK Slaný' })[0];
    fireEvent.pointerDown(club, { button: 0, clientY: yAt(9 * 60), pointerId: 1 });
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
  });

  /*
   * Etapa 12 (owner): "when a team books, it gets the whole day WITHOUT the time step
   * dividing the order". A window held all day is ONE block from the start of the day
   * to its end at every resolution: one button, one time line, an opaque base under
   * the hatch so the grid lines beneath cannot chop it into slots.
   */
  describe.each([
    ['Hodina', 60, 0.6, 46],
    ['30 min', 30, 1, 52],
    ['15 min', 15, 1.5, 65],
    ['10 min', 10, 2, 78],
  ])('a whole-day window at %s', (_label, step, zoom, hourPx) => {
    const wholeDay: TimeBlock = { ...clubBlock, startUtc: '2026-10-26T07:00:00Z', endUtc: '2026-10-26T15:00:00Z' };

    it('is one uninterrupted block over the lines', () => {
      renderGrid({ blocksByCalendar: new Map([[calendar.id, [wholeDay]]]), resolutionStep: step, zoom });
      const column = screen.getByTestId(`sub-column-${calendar.id}:a1-${DAY}`);
      const blocks = within(column).getAllByRole('button', { name: 'FK Slaný' });
      expect(blocks).toHaveLength(1);
      const block = blocks[0];
      /* 08:00–16:00 local is eight hours of the column, in one piece. */
      expect(block).toHaveStyle({ height: `${8 * hourPx}px` });
      expect(within(block).getAllByTestId('club-block-time')).toHaveLength(1);
      expect(within(block).getByTestId('club-block-time')).toHaveTextContent('08:00–16:00');
      /* Opaque under the hatch: the step lines drawn beneath (zIndex 1) do not show through. */
      expect(block).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' });
      expect(getComputedStyle(block).backgroundImage).toContain('repeating-linear-gradient(135deg');
      expect(within(column).getByTestId('grid-lines')).toHaveAttribute('data-step', String(step));
      expect(Number(getComputedStyle(block).zIndex)).toBeGreaterThan(Number(getComputedStyle(within(column).getByTestId('grid-lines')).zIndex));
    });
  });

  /*
   * Owner, 10. 10. 2026: "it is still divided into three segments". The server keeps an
   * order's day as the window before lunch and the one after; the grid draws them as the
   * ONE block the desk ordered, over the lunch band, with one time line 08:00–16:00.
   */
  it('an order held across lunch is one block, not a morning, a gap and an afternoon', () => {
    const morning: TimeBlock = { ...clubBlock, id: 'm1', startUtc: '2026-10-26T07:00:00Z', endUtc: '2026-10-26T11:00:00Z' };
    const afternoon: TimeBlock = { ...clubBlock, id: 'm2', startUtc: '2026-10-26T11:30:00Z', endUtc: '2026-10-26T15:00:00Z' };
    const lunchDay = row(DAY, { breakStart: '12:00:00', breakEnd: '12:30:00' });
    renderGrid({
      blocksByCalendar: new Map([[calendar.id, [morning, afternoon, manual]]]),
      previewByCalendar: new Map([[calendar.id, new Map([[DAY, lunchDay]])]]),
      marks: new Map([[DAY, dayMark(undefined, [lunchDay])]]),
    });
    const column = screen.getByTestId(`sub-column-${calendar.id}:a1-${DAY}`);
    const blocks = within(column).getAllByRole('button', { name: 'FK Slaný' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toHaveStyle({ height: `${8 * 52}px` });
    expect(within(blocks[0]).getByTestId('club-block-time')).toHaveTextContent('08:00–16:00');
    /* The lunch band is still drawn beneath (the block's opaque base covers it); a manual block keeps the same base. */
    expect(within(column).getByLabelText('Oběd')).toBeInTheDocument();
    expect(within(column).getByRole('button', { name: 'Porada' })).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' });
  });

  it('two windows of one order with free time between them stay two blocks', () => {
    const early: TimeBlock = { ...clubBlock, id: 'e1', startUtc: '2026-10-26T07:00:00Z', endUtc: '2026-10-26T09:00:00Z' };
    const late: TimeBlock = { ...clubBlock, id: 'e2', startUtc: '2026-10-26T13:00:00Z', endUtc: '2026-10-26T15:00:00Z' };
    const lunchDay = row(DAY, { breakStart: '12:00:00', breakEnd: '12:30:00' });
    renderGrid({
      blocksByCalendar: new Map([[calendar.id, [early, late]]]),
      previewByCalendar: new Map([[calendar.id, new Map([[DAY, lunchDay]])]]),
      marks: new Map([[DAY, dayMark(undefined, [lunchDay])]]),
    });
    const column = screen.getByTestId(`sub-column-${calendar.id}:a1-${DAY}`);
    expect(within(column).getAllByRole('button', { name: 'FK Slaný' })).toHaveLength(2);
  });

  it('tells the page which block it is when clicked, with the days it covers', () => {
    const onOpenClubBlock = vi.fn();
    const second: TimeBlock = { ...clubBlock, id: 'b3', startUtc: '2026-11-08T07:00:00Z', endUtc: '2026-11-08T10:00:00Z' };
    renderGrid({ blocksByCalendar: new Map([[calendar.id, [clubBlock, second]]]), onOpenClubBlock });
    fireEvent.click(screen.getAllByRole('button', { name: 'FK Slaný' })[0], { clientX: 40, clientY: 50 });
    expect(onOpenClubBlock).toHaveBeenCalledWith({
      clubBlockId: 'cb1',
      clubId: 'club1',
      clubName: 'FK Slaný',
      colorHex: '#7B1FA2',
      range: { from: '2026-10-26', to: '2026-11-08' },
      x: 40,
      y: 50,
    });
  });
});

describe('marking days in the week', () => {
  const week = Array.from({ length: 7 }, (_, i) => addDaysToDateOnly('2026-10-26', i));
  const preview = new Map([[calendar.id, new Map(week.map((d) => [d, row(d)]))]]);
  const props: Partial<TimeGridProps> = {
    days: week,
    view: 'week',
    previewByCalendar: preview,
    marks: new Map(week.map((d) => [d, dayMark(undefined, [row(d)])])),
    columns: undefined,
  };

  it('a drag across the day headers picks the days, pills the range and keeps the click for a single day', () => {
    const onPickDay = vi.fn();
    renderGrid({ ...props, onPickDay });
    fireEvent.pointerDown(screen.getByTestId('day-header-2026-10-26'), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(screen.getByTestId('day-header-2026-10-28'), { pointerId: 1 });
    expect(screen.getByTestId('range-pill')).toHaveTextContent('26. 10. – 28. 10. · 3 dny');
    expect(screen.getByTestId('range-overlay-2026-10-27')).toBeInTheDocument();
    expect(screen.queryByTestId('range-overlay-2026-10-29')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 300, clientY: 80 }));
    });
    expect(screen.getByTestId('chosen')).toHaveTextContent('2026-10-26|2026-10-28');
    expect(onPickDay).not.toHaveBeenCalled();
  });

  it('a plain click on a header still opens that day', () => {
    const onPickDay = vi.fn();
    renderGrid({ ...props, onPickDay });
    const header = screen.getByTestId('day-header-2026-10-27');
    fireEvent.pointerDown(header, { button: 0, pointerId: 1 });
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
    fireEvent.click(header);
    expect(onPickDay).toHaveBeenCalledWith('2026-10-27');
    expect(screen.getByTestId('chosen')).toHaveTextContent('');
  });

  it('does not offer a range to somebody who can neither book nor block', () => {
    renderGrid({ ...props, mayBook: false, mayBlock: false });
    fireEvent.pointerDown(screen.getByTestId('day-header-2026-10-26'), { button: 0, pointerId: 1 });
    fireEvent.pointerEnter(screen.getByTestId('day-header-2026-10-28'), { pointerId: 1 });
    expect(screen.queryByTestId('range-pill')).not.toBeInTheDocument();
  });
});

describe('touch', () => {
  it('a tap on a free slot picks that one slot and opens the popover', () => {
    renderGrid({ device: 'tablet' });
    const column = screen.getByTestId('sub-column-c1:a1-2026-10-26');
    fireEvent.pointerDown(column, { button: 0, pointerType: 'touch', clientY: yAt(10 * 60), clientX: 100, pointerId: 3 });
    fireEvent.pointerUp(column, { pointerType: 'touch', clientY: yAt(10 * 60), clientX: 100, pointerId: 3 });
    expect(screen.getByText('10:00 – 10:30')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Zablokovat čas/ })).toBeInTheDocument();
  });

  it('a press and hold starts a drag; moving first is a scroll and picks nothing', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderGrid({ device: 'tablet' });
      const column = screen.getByTestId('sub-column-c1:a1-2026-10-26');
      fireEvent.pointerDown(column, { button: 0, pointerType: 'touch', clientY: yAt(9 * 60), clientX: 100, pointerId: 3 });
      act(() => {
        vi.advanceTimersByTime(450);
      });
      fireEvent.pointerMove(column, { pointerType: 'touch', clientY: yAt(10 * 60 + 20), clientX: 100, pointerId: 3 });
      expect(screen.getByTestId('drag-selection')).toHaveTextContent('09:00 – 10:30 · 90 min');
      fireEvent.pointerUp(column, { pointerType: 'touch', clientY: yAt(10 * 60 + 20), clientX: 100, pointerId: 3 });
      expect(screen.getByText('09:00 – 10:30')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('moving before the long press is a scroll', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      renderGrid({ device: 'tablet' });
      const column = screen.getByTestId('sub-column-c1:a1-2026-10-26');
      fireEvent.pointerDown(column, { button: 0, pointerType: 'touch', clientY: 200, clientX: 100, pointerId: 3 });
      fireEvent.pointerMove(column, { pointerType: 'touch', clientY: 260, clientX: 100, pointerId: 3 });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
      fireEvent.pointerUp(column, { pointerType: 'touch', clientY: 260, clientX: 100, pointerId: 3 });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('moving a booking by dragging it (pointer events, Etapa 12)', () => {
  const card = appt('m1', 'a1', '2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z'); // 08:00–08:30 in Prague
  const at = (minute: number) => (minute - 7 * 60) * PX_PER_MINUTE;
  /* jsdom draws every rect at 0, so a press at clientY 0 holds the card by its top edge and a pointer at
     `at(minute)` is that minute of the column. */
  const grab = (cell: Element) => fireEvent.pointerDown(cell, { button: 0, pointerType: 'mouse', clientX: 50, clientY: 0, pointerId: 1 });
  const moveTo = (minute: number) => fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 50, clientY: at(minute), pointerId: 1 });
  const dropAt = (minute: number) => fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 50, clientY: at(minute), pointerId: 1 });

  it('shows the ghost with the snapped time while dragging, and hands the drop on (the page confirms)', () => {
    const onMove = vi.fn();
    renderGrid({ appointmentsByDay: new Map([[DAY, [card]]]), onMove });
    const cell = screen.getByTestId('appointment-cell-m1');
    expect(cell).toHaveAttribute('data-draggable', 'true');
    grab(cell);
    moveTo(10 * 60 + 5);
    expect(screen.getByTestId('move-preview')).toHaveTextContent('10:00–10:30');
    expect(screen.getByTestId('move-preview')).toHaveTextContent('Pacient m1');
    expect(screen.getByTestId('move-preview')).not.toHaveAttribute('data-refused');
    dropAt(10 * 60 + 5);
    expect(onMove).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'c1',
        dayKey: DAY,
        start: '2026-10-26T10:00',
        end: '2026-10-26T10:30',
        startUtc: '2026-10-26T09:00:00.000Z',
        endUtc: '2026-10-26T09:30:00.000Z',
        notifyPatient: true,
        appointment: expect.objectContaining({ id: 'm1' }),
      }),
    );
    expect(screen.queryByTestId('move-preview')).not.toBeInTheDocument();
    /* Without a mover of its own the grid leaves the card where the server has it. */
    expect(screen.queryByRole('dialog', { name: 'Přesunutí rezervace' })).not.toBeInTheDocument();
  });

  it('a drop where it already is changes nothing', () => {
    const onMove = vi.fn();
    renderGrid({ appointmentsByDay: new Map([[DAY, [card]]]), onMove });
    grab(screen.getByTestId('appointment-cell-m1'));
    moveTo(8 * 60 + 40);
    moveTo(8 * 60 + 2);
    dropAt(8 * 60 + 2);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not take a booking to another činnost’s column: the ghost goes red and the drop is refused', () => {
    const onMove = vi.fn();
    renderGrid({ appointmentsByDay: new Map([[DAY, [card]]]), onMove });
    const other = screen.getByTestId('sub-column-c1:a2-2026-10-26');
    const original = document.elementFromPoint;
    document.elementFromPoint = () => other;
    try {
      grab(screen.getByTestId('appointment-cell-m1'));
      moveTo(10 * 60);
      const ghost = screen.getByTestId('move-preview');
      expect(ghost).toHaveAttribute('data-refused', 'calendar');
      expect(ghost).toHaveTextContent('Jiný kalendář');
      expect(other.contains(ghost)).toBe(true);
      dropAt(10 * 60);
    } finally {
      document.elementFromPoint = original;
    }
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('Sem termín přesunout nelze · Jiný kalendář');
  });

  it('a booking that is over (cancelled, completed) is not draggable, nor is any without a mover', () => {
    renderGrid({
      appointmentsByDay: new Map([[DAY, [{ ...card, status: 4 }, appt('m2', 'a1', '2026-10-26T09:00:00Z', '2026-10-26T09:30:00Z')]]]),
      onMove: vi.fn(),
    });
    expect(screen.getByTestId('appointment-cell-m1')).not.toHaveAttribute('data-draggable');
    expect(screen.getByTestId('appointment-cell-m2')).toHaveAttribute('data-draggable', 'true');
  });

  it('without bookings.create, or without any mover, nothing can be moved', () => {
    const { unmount } = renderGrid({ appointmentsByDay: new Map([[DAY, [card]]]), onMove: vi.fn(), mayBook: false });
    expect(screen.getByTestId('appointment-cell-m1')).not.toHaveAttribute('data-draggable');
    unmount();
    renderGrid({ appointmentsByDay: new Map([[DAY, [card]]]) });
    expect(screen.getByTestId('appointment-cell-m1')).not.toHaveAttribute('data-draggable');
  });
});
