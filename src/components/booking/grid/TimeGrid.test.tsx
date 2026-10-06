import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Calendar, PreviewDay } from '../../../api/bookingContracts';
import { TimeGrid, type TimeGridProps } from './TimeGrid';
import { dayMark } from './dayMarks';

/*
 * The grid driven the way a receptionist drives it: press on a slot, drag,
 * let go, pick from the menu. The logic behind it is tested on its own in the
 * neighbouring files; this holds the wiring - permissions, shut days, the
 * live label and what reaches the booking dialog.
 */

const DAY = '2026-09-23';
const PX_PER_MINUTE = 52 / 60;
/* The grid below draws from 07:00, so a pointer this far down is at `minute`. */
const yAt = (minute: number) => (minute - 7 * 60) * PX_PER_MINUTE + 1;

const calendar: Calendar = {
  id: 'c1',
  name: 'Sportovní diagnostika',
  color: '#1565C0',
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
    offeredActivityIds: ['a1'],
    ...overrides,
  };
}

function renderGrid(overrides: Partial<TimeGridProps> = {}, preview: PreviewDay = row(DAY)) {
  const props: TimeGridProps = {
    days: [DAY],
    view: 'day',
    selectedDay: DAY,
    calendars: [calendar],
    appointmentsByDay: new Map(),
    previewByCalendar: new Map([[calendar.id, new Map([[preview.date, preview]])]]),
    blocksByCalendar: new Map(),
    marks: new Map([[DAY, dayMark(undefined, [preview])]]),
    openSpan: { start: 7, end: 19 },
    /* Another day, so no now-line gets in the way. */
    now: new Date('2026-09-20T10:00:00Z'),
    employeeId: null,
    nowLineColor: '#D32F2F',
    holidayColor: '#9333EA',
    mayBook: true,
    mayBlock: true,
    onOpen: vi.fn(),
    onBook: vi.fn(),
    onPickDay: vi.fn(),
    ...overrides,
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TimeGrid {...props} />
    </QueryClientProvider>,
  );
  return props;
}

function drag(from: number, to: number) {
  const column = screen.getByTestId(`sub-column-${calendar.id}-${DAY}`);
  fireEvent.pointerDown(column, { button: 0, clientY: yAt(from), clientX: 100, pointerId: 1 });
  fireEvent.pointerMove(column, { clientY: yAt(to), clientX: 100, pointerId: 1 });
  return column;
}

function release(column: HTMLElement, minute: number) {
  fireEvent.pointerUp(column, { clientY: yAt(minute), clientX: 100, pointerId: 1 });
}

describe('dragging on the grid', () => {
  it('shows the time pill live while dragging', () => {
    renderGrid();
    drag(8 * 60, 9 * 60 + 40);
    expect(screen.getByTestId('drag-selection')).toHaveTextContent('08:00 – 10:00 · 120 min');
  });

  it('opens the popover on release and books with the chosen time', () => {
    const props = renderGrid();
    const column = drag(8 * 60, 9 * 60 + 10);
    release(column, 9 * 60 + 10);

    /* The board's popover: the range, the day with the free minutes, the actions. */
    expect(screen.getByText('08:00 – 09:30')).toBeInTheDocument();
    expect(screen.getByText('Středa 23. září · 90 minut volno')).toBeInTheDocument();
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /Zablokovat čas/ })).toBeInTheDocument();
    expect(screen.getByText('Zrušit výběr')).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: /Objednat pacienta/ }));
    expect(props.onBook).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'c1',
        dayKey: DAY,
        start: '2026-09-23T08:00',
        end: '2026-09-23T09:30',
      }),
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('never offers a club reservation: marked time books a patient or blocks time', () => {
    renderGrid();
    const column = drag(10 * 60, 10 * 60);
    release(column, 10 * 60);
    expect(screen.queryByRole('menuitem', { name: /Rezervovat pro klub/ })).not.toBeInTheDocument();
  });

  it('"Zrušit výběr" and Esc drop the selection', () => {
    renderGrid();
    const column = drag(10 * 60, 10 * 60);
    release(column, 10 * 60);
    fireEvent.click(screen.getByText('Zrušit výběr'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();

    release(drag(11 * 60, 11 * 60), 11 * 60);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('asks for a reason before blocking', () => {
    renderGrid();
    const column = drag(10 * 60, 10 * 60);
    release(column, 10 * 60);
    fireEvent.click(screen.getByRole('menuitem', { name: /Zablokovat čas/ }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/od 10:00 – do 10:30/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zablokovat' })).toBeDisabled();
  });

  it('offers only what the employee may do', () => {
    renderGrid({ mayBlock: false });
    const column = drag(8 * 60, 8 * 60);
    release(column, 8 * 60);
    expect(screen.getByRole('menuitem', { name: /Objednat pacienta/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Zablokovat čas/ })).not.toBeInTheDocument();
  });

  it('snaps to the finer grid when the resolution is below the calendar step', () => {
    const props = renderGrid({ resolutionStep: 10 });
    const column = drag(8 * 60 + 5, 8 * 60 + 25);
    release(column, 8 * 60 + 25);
    fireEvent.click(screen.getByRole('menuitem', { name: /Objednat pacienta/ }));
    expect(props.onBook).toHaveBeenCalledWith(
      expect.objectContaining({ start: '2026-09-23T08:00', end: '2026-09-23T08:30' }),
    );
  });

  it('does not react at all without bookings.create and bookings.edit', () => {
    renderGrid({ mayBook: false, mayBlock: false });
    const column = drag(8 * 60, 9 * 60);
    fireEvent.pointerUp(column, { clientY: yAt(9 * 60), clientX: 100, pointerId: 1 });
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('names each calendar with its bookings in the day header', () => {
    renderGrid({
      appointmentsByDay: new Map([
        [
          DAY,
          [
            {
              id: 'ap1',
              calendarId: 'c1',
              patientId: 'p1',
              activityId: 'a1',
              activityName: 'Spiroergometrie',
              startUtc: '2026-09-23T06:00:00Z',
              endUtc: '2026-09-23T07:00:00Z',
              status: 0,
              isRunningLate: false,
              checkedInUtc: null,
              paperwork: null,
              partnerName: null,
              clubDiscountPercent: null,
              paymentState: "none",
              invoiceId: null,
            },
          ],
        ],
      ]),
    });
    expect(screen.getByRole('heading', { name: 'Sportovní diagnostika' })).toBeInTheDocument();
    expect(screen.getByText('1 rezervace')).toBeInTheDocument();
  });

  it('does not react on a shut day', () => {
    renderGrid({}, row(DAY, { isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] }));
    drag(8 * 60, 9 * 60);
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
  });

  it("does not react on another worker's day while one worker is filtered for", () => {
    renderGrid({ employeeId: 'u2' });
    drag(8 * 60, 9 * 60);
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
  });

  it('opens the appointment rather than starting a drag when one is pressed', () => {
    const props = renderGrid({
      appointmentsByDay: new Map([
        [
          DAY,
          [
            {
              id: 'ap1',
              calendarId: 'c1',
              patientId: 'p1',
              activityId: 'a1',
              activityName: 'Spiroergometrie',
              startUtc: '2026-09-23T06:00:00Z',
              endUtc: '2026-09-23T07:00:00Z',
              status: 0,
              isRunningLate: false,
              checkedInUtc: null,
              paperwork: null,
              partnerName: null,
              clubDiscountPercent: null,
              paymentState: "none",
              invoiceId: null,
            },
          ],
        ],
      ]),
    });
    const button = screen.getByRole('button', { name: /Spiroergometrie/ });
    fireEvent.pointerDown(button, { button: 0, clientY: yAt(8 * 60 + 10), pointerId: 1 });
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(props.onOpen).toHaveBeenCalledWith('ap1');
  });
});

describe('the now-line on the grid', () => {
  const NOW = new Date('2026-09-23T08:15:00Z'); // 10:15 in Prague

  it('in the week: a horizontal line, the time pill, both edges of today and the DNES pill', () => {
    renderGrid({ view: 'week', now: NOW });
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('10:15');
    expect(screen.getByTestId('now-edge-left')).toBeInTheDocument();
    expect(screen.getByTestId('now-edge-right')).toBeInTheDocument();
    expect(screen.getByText('DNES')).toBeInTheDocument();
  });

  it('in the day: the horizontal line alone', () => {
    renderGrid({ view: 'day', now: NOW });
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
    expect(screen.queryByTestId('now-edge-left')).not.toBeInTheDocument();
  });

  it('not on a shut today', () => {
    renderGrid({ view: 'week', now: NOW }, row(DAY, { isOpen: false, closedBecause: 'override', offeredActivityIds: [] }));
    expect(screen.queryByTestId('now-line')).not.toBeInTheDocument();
  });
});

describe('a holiday on the grid', () => {
  it('has a red number and says why', () => {
    const preview = row(DAY, { isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] });
    renderGrid({
      marks: new Map([
        [DAY, dayMark({ date: DAY, name: 'Den české státnosti', isHoliday: true, isStatutory: true }, [preview])],
      ]),
    }, preview);
    /* A SVÁTEK chip in the header, and one hatched block down the column that
       says "Státní svátek — zavřeno" with the holiday's own name. */
    expect(screen.getByText('SVÁTEK')).toBeInTheDocument();
    const block = screen.getByTestId(`closed-block-${DAY}`);
    expect(block).toHaveTextContent('Státní svátek — zavřeno');
    expect(block).toHaveTextContent('Den české státnosti');
    expect(screen.getByTestId(`day-number-${DAY}`)).toHaveStyle({ color: 'rgb(211, 47, 47)' });
  });

  it('a calendar off on its own says so down its column', () => {
    const absent = row(DAY, { isOpen: false, closedBecause: 'workerAbsent', offeredActivityIds: [] });
    renderGrid(
      {
        calendars: [calendar, { ...calendar, id: 'c2', name: 'Druhá ordinace' }],
        /* The other calendar works, so the day itself is open. */
        marks: new Map([[DAY, dayMark(undefined, [absent, row(DAY)])]]),
      },
      absent,
    );
    expect(screen.getByTestId(`calendar-closed-c1-${DAY}`)).toHaveTextContent('Dovolená — Anna Černá');
    expect(screen.queryByTestId(`closed-block-${DAY}`)).not.toBeInTheDocument();
  });
});

describe('a booking on a shut day', () => {
  const saturday: TimeGridProps['appointmentsByDay'] = new Map([
    [
      DAY,
      [
        {
          id: 'ap-sat',
          calendarId: 'c1',
          patientId: 'p1',
          activityId: 'a1',
          activityName: 'Spiroergometrie',
          startUtc: '2026-09-23T08:00:00Z',
          endUtc: '2026-09-23T09:00:00Z',
          status: 0,
          isRunningLate: false,
          checkedInUtc: null,
          paperwork: null,
          partnerName: null,
          clubDiscountPercent: null,
          paymentState: 'none' as const,
          invoiceId: null,
        },
      ],
    ],
  ]);

  it('is drawn as a full card above the hatched block, and opens', () => {
    const preview = row(DAY, { isOpen: false, closedBecause: 'notAWorkingDay', offeredActivityIds: [] });
    const props = renderGrid({ appointmentsByDay: saturday }, preview);

    const block = screen.getByTestId(`closed-block-${DAY}`);
    expect(block).toHaveTextContent('Nepracovní den');
    const button = screen.getByRole('button', { name: /Spiroergometrie/ });
    const cell = screen.getByTestId('appointment-cell-ap-sat');
    expect(Number(getComputedStyle(cell).zIndex)).toBeGreaterThan(Number(getComputedStyle(block).zIndex));
    fireEvent.click(button);
    expect(props.onOpen).toHaveBeenCalledWith('ap-sat');
  });

  it('sits above a holiday hatch too', () => {
    const preview = row(DAY, { isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] });
    renderGrid(
      {
        appointmentsByDay: saturday,
        marks: new Map([[DAY, dayMark({ date: DAY, name: 'Den české státnosti', isHoliday: true, isStatutory: true }, [preview])]]),
      },
      preview,
    );
    const block = screen.getByTestId(`closed-block-${DAY}`);
    const cell = screen.getByTestId('appointment-cell-ap-sat');
    expect(Number(getComputedStyle(cell).zIndex)).toBeGreaterThan(Number(getComputedStyle(block).zIndex));
  });
});

describe('a club booking on the grid', () => {
  it('says "Klub · FK Slaný · −10 %" on the cell, and leaves the percent out when there is none', () => {
    const base = {
      calendarId: 'c1',
      patientId: '',
      activityId: 'a1',
      activityName: 'Prohlídka',
      status: 0,
      isRunningLate: false,
      checkedInUtc: null,
      paperwork: null,
      paymentState: 'none' as const,
      invoiceId: null,
    };
    renderGrid({
      appointmentsByDay: new Map([
        [
          DAY,
          [
            { ...base, id: 'k1', startUtc: '2026-09-23T06:00:00Z', endUtc: '2026-09-23T07:00:00Z', patientName: 'Jan Novák', partnerName: 'FK Slaný', clubDiscountPercent: 10 },
            { ...base, id: 'k2', startUtc: '2026-09-23T07:00:00Z', endUtc: '2026-09-23T08:00:00Z', patientName: 'Petr Malý', partnerName: 'TJ Sokol', clubDiscountPercent: null },
          ],
        ],
      ]),
    });
    expect(screen.getByText('Klub · FK Slaný · −10 %')).toBeInTheDocument();
    expect(screen.getByText('Klub · TJ Sokol')).toBeInTheDocument();
  });
});
