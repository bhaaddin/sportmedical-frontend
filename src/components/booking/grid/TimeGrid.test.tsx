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
const PX_PER_MINUTE = 46 / 30;
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

describe('dragging on the grid', () => {
  it('shows "od – do" live while dragging', () => {
    renderGrid();
    drag(8 * 60, 9 * 60 + 40);
    expect(screen.getByTestId('drag-selection')).toHaveTextContent('od 08:00 – do 10:00');
  });

  it('offers booking and blocking on release, and books with the chosen time', () => {
    const props = renderGrid();
    const column = drag(8 * 60, 9 * 60 + 10);
    fireEvent.pointerUp(column, { clientY: yAt(9 * 60 + 10), clientX: 100, pointerId: 1 });

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Sportovní diagnostika · od 08:00 – do 09:30')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Zablokovat' })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Objednat' }));
    expect(props.onBook).toHaveBeenCalledWith({
      calendarId: 'c1',
      dayKey: DAY,
      start: '2026-09-23T08:00',
      end: '2026-09-23T09:30',
    });
  });

  it('asks for a reason before blocking', () => {
    renderGrid();
    const column = drag(10 * 60, 10 * 60);
    fireEvent.pointerUp(column, { clientY: yAt(10 * 60), clientX: 100, pointerId: 1 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Zablokovat' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/od 10:00 – do 10:30/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Zablokovat' })).toBeDisabled();
  });

  it('offers only what the employee may do', () => {
    renderGrid({ mayBlock: false });
    const column = drag(8 * 60, 8 * 60);
    fireEvent.pointerUp(column, { clientY: yAt(8 * 60), clientX: 100, pointerId: 1 });
    expect(screen.getByRole('menuitem', { name: 'Objednat' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Zablokovat' })).not.toBeInTheDocument();
  });

  it('does not react at all without bookings.create and bookings.edit', () => {
    renderGrid({ mayBook: false, mayBlock: false });
    const column = drag(8 * 60, 9 * 60);
    fireEvent.pointerUp(column, { clientY: yAt(9 * 60), clientX: 100, pointerId: 1 });
    expect(screen.queryByTestId('drag-selection')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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

  it('in the week: a horizontal line and both edges of today', () => {
    renderGrid({ view: 'week', now: NOW });
    expect(screen.getByTestId('now-line')).toBeInTheDocument();
    expect(screen.getByTestId('now-edge-left')).toBeInTheDocument();
    expect(screen.getByTestId('now-edge-right')).toBeInTheDocument();
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
    expect(screen.getByText('Státní svátek')).toBeInTheDocument();
    expect(screen.getByTestId(`day-number-${DAY}`)).toHaveStyle({ color: 'rgb(211, 47, 47)' });
  });
});
