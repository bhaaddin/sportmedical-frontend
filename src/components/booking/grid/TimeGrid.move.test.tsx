import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingApiError } from '../../../api/apiError';
import type { Calendar, DayAppointment, PreviewDay } from '../../../api/bookingContracts';
import { TimeGrid, type TimeGridProps } from './TimeGrid';
import { dayMark } from './dayMarks';

/*
 * The owner's card semantics (Etapa 12): one click selects and shows the
 * summary, a double click opens, a press that travels drags - the ghost snaps
 * to the step - and the drop is committed in place: straight away in "direct"
 * mode, after the small popover beside the card in "confirm" mode. Esc snaps
 * back; a refusal glides back and says why.
 */

const DAY = '2026-10-26';
const PX = 52 / 60;
/* jsdom draws every rect at 0: a pointer at `at(minute)` is that minute of the column. */
const at = (minute: number) => (minute - 7 * 60) * PX;
const topOf = (cell: HTMLElement) => Number.parseFloat(getComputedStyle(cell).top);

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

const row: PreviewDay = {
  date: DAY,
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
};

const appt = (id: string, startUtc: string, endUtc: string, status = 0): DayAppointment => ({
  id,
  calendarId: 'c1',
  patientId: '',
  patientName: `Pacient ${id}`,
  activityId: 'a1',
  activityName: 'Prohlídka',
  startUtc,
  endUtc,
  status,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  partnerName: null,
  clubDiscountPercent: null,
  paymentState: 'none',
  invoiceId: null,
});

const card = appt('m1', '2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z'); // 08:00–08:30 in Prague

function renderGrid(overrides: Partial<TimeGridProps> = {}) {
  const props: TimeGridProps = {
    days: [DAY],
    view: 'day',
    selectedDay: DAY,
    calendars: [calendar],
    appointmentsByDay: new Map([[DAY, [card]]]),
    previewByCalendar: new Map([[calendar.id, new Map([[DAY, row]])]]),
    blocksByCalendar: new Map(),
    marks: new Map([[DAY, dayMark(undefined, [row])]]),
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
    ...overrides,
  };
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TimeGrid {...props} />
    </QueryClientProvider>,
  );
  return { props, ...view };
}

const cell = () => screen.getByTestId('appointment-cell-m1');
const button = () => screen.getByRole('button', { name: /Pacient m1/ });
const grab = (pointerType = 'mouse', pointerId = 1) =>
  fireEvent.pointerDown(cell(), { button: 0, pointerType, clientX: 50, clientY: 0, pointerId });
const moveTo = (minute: number, pointerType = 'mouse', pointerId = 1) =>
  fireEvent.pointerMove(window, { pointerType, clientX: 50, clientY: at(minute), pointerId });
const dropAt = (minute: number, pointerType = 'mouse', pointerId = 1) =>
  fireEvent.pointerUp(window, { pointerType, clientX: 50, clientY: at(minute), pointerId });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  window.sessionStorage.clear();
});

describe('clicking a card', () => {
  it('one click selects it and shows the summary - not the detail', async () => {
    const { props } = renderGrid({ onMove: vi.fn() });
    grab();
    dropAt(8 * 60);
    fireEvent.click(button(), { detail: 1 });
    expect(props.onOpen).not.toHaveBeenCalled();
    expect(cell()).toHaveAttribute('data-selected', 'true');
    const summary = await screen.findByTestId('appointment-summary');
    expect(summary).toHaveTextContent('08:00–08:30');
    expect(summary).toHaveTextContent('Pacient m1');
    expect(summary).toHaveTextContent('Prohlídka');
    expect(screen.queryByRole('dialog', { name: 'Přesunutí rezervace' })).not.toBeInTheDocument();
    /* "Otevřít detail" in the summary is the tablet's way in. */
    fireEvent.click(within(summary).getByRole('button', { name: 'Otevřít detail' }));
    expect(props.onOpen).toHaveBeenCalledWith('m1');
    expect(screen.queryByTestId('appointment-summary')).not.toBeInTheDocument();
  });

  it('a double click opens the detail', () => {
    const { props } = renderGrid({ onMove: vi.fn() });
    fireEvent.click(button(), { detail: 1 });
    fireEvent.click(button(), { detail: 2 });
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    expect(props.onOpen).toHaveBeenCalledWith('m1');
  });

  it('two taps in quick succession open it too (touch has no dblclick to lean on)', () => {
    const { props } = renderGrid({ onMove: vi.fn() });
    fireEvent.click(button(), { detail: 1 });
    fireEvent.click(button(), { detail: 1 });
    expect(props.onOpen).toHaveBeenCalledWith('m1');
  });

  it('Enter on the focused card opens it (a click with detail 0)', () => {
    const { props } = renderGrid({ onMove: vi.fn() });
    fireEvent.click(button(), { detail: 0 });
    expect(props.onOpen).toHaveBeenCalledWith('m1');
    expect(screen.queryByTestId('appointment-summary')).not.toBeInTheDocument();
  });

  it('a press that wanders less than the threshold is still a click', () => {
    const onMoveCommit = vi.fn().mockResolvedValue(undefined);
    renderGrid({ onMoveCommit, moveCommit: 'direct' });
    grab();
    fireEvent.pointerMove(window, { pointerType: 'mouse', clientX: 53, clientY: 3, pointerId: 1 });
    expect(screen.queryByTestId('move-preview')).not.toBeInTheDocument();
    fireEvent.pointerUp(window, { pointerType: 'mouse', clientX: 53, clientY: 3, pointerId: 1 });
    expect(onMoveCommit).not.toHaveBeenCalled();
    fireEvent.click(button(), { detail: 1 });
    expect(cell()).toHaveAttribute('data-selected', 'true');
  });
});

describe('dragging a card', () => {
  it.each([
    [30, '10:30–11:00', '2026-10-26T10:30'],
    [15, '10:15–10:45', '2026-10-26T10:15'],
    [10, '10:20–10:50', '2026-10-26T10:20'],
  ])('at the %i-minute level a pointer at 10:20 snaps to %s', async (resolutionStep, label, start) => {
    const onMoveCommit = vi.fn().mockResolvedValue(undefined);
    renderGrid({ onMoveCommit, moveCommit: 'direct', resolutionStep });
    grab();
    moveTo(10 * 60 + 20);
    expect(screen.getByTestId('move-preview-time')).toHaveTextContent(label);
    /* The original stays, faded, until the drop. */
    expect(cell()).toHaveStyle({ opacity: '0.35' });
    dropAt(10 * 60 + 20);
    expect(onMoveCommit).toHaveBeenCalledWith(expect.objectContaining({ start, notifyPatient: true, appointment: expect.objectContaining({ id: 'm1' }) }));
    await flush();
  });

  it('Esc during a drag cancels it: no ghost, nothing committed, the card where it was', () => {
    const onMoveCommit = vi.fn().mockResolvedValue(undefined);
    renderGrid({ onMoveCommit, moveCommit: 'direct' });
    const before = topOf(cell());
    grab();
    moveTo(10 * 60);
    expect(screen.getByTestId('move-preview')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('move-preview')).not.toBeInTheDocument();
    dropAt(10 * 60);
    expect(onMoveCommit).not.toHaveBeenCalled();
    expect(topOf(cell())).toBe(before);
  });

  it('a slot that is taken shows a red ghost and refuses the drop with a toast', () => {
    const onMoveCommit = vi.fn().mockResolvedValue(undefined);
    renderGrid({
      onMoveCommit,
      moveCommit: 'direct',
      appointmentsByDay: new Map([[DAY, [card, appt('m2', '2026-10-26T09:00:00Z', '2026-10-26T09:30:00Z')]]]),
    });
    grab();
    moveTo(10 * 60 + 10);
    const ghost = screen.getByTestId('move-preview');
    expect(ghost).toHaveAttribute('data-refused', 'busy');
    expect(ghost).toHaveTextContent('Obsazeno');
    dropAt(10 * 60 + 10);
    expect(onMoveCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId('grid-notice')).toHaveAttribute('data-tone', 'error');
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('Sem termín přesunout nelze · Obsazeno');
  });

  it('outside the working hours the ghost says so', () => {
    renderGrid({ onMoveCommit: vi.fn(), moveCommit: 'direct' });
    grab();
    moveTo(7 * 60 + 30);
    expect(screen.getByTestId('move-preview-time')).toHaveTextContent('07:30–08:00');
    expect(screen.getByTestId('move-preview')).toHaveAttribute('data-refused', 'hours');
    expect(screen.getByTestId('move-preview')).toHaveTextContent('Mimo ordinační hodiny');
    dropAt(7 * 60 + 30);
  });

  describe('on touch', () => {
    it('a long press starts the drag, and the drop lands on the step', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const onMoveCommit = vi.fn().mockResolvedValue(undefined);
        renderGrid({ onMoveCommit, moveCommit: 'direct' });
        grab('touch', 7);
        expect(screen.queryByTestId('move-preview')).not.toBeInTheDocument();
        act(() => {
          vi.advanceTimersByTime(260);
        });
        expect(screen.getByTestId('move-preview')).toBeInTheDocument();
        moveTo(11 * 60 + 10, 'touch', 7);
        expect(screen.getByTestId('move-preview-time')).toHaveTextContent('11:00–11:30');
        dropAt(11 * 60 + 10, 'touch', 7);
        expect(onMoveCommit).toHaveBeenCalledWith(expect.objectContaining({ start: '2026-10-26T11:00' }));
      } finally {
        vi.useRealTimers();
      }
    });

    it('a finger that moves before the long press is scrolling, not dragging', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      try {
        const onMoveCommit = vi.fn().mockResolvedValue(undefined);
        renderGrid({ onMoveCommit, moveCommit: 'direct' });
        grab('touch', 7);
        fireEvent.pointerMove(window, { pointerType: 'touch', clientX: 50, clientY: 30, pointerId: 7 });
        act(() => {
          vi.advanceTimersByTime(400);
        });
        expect(screen.queryByTestId('move-preview')).not.toBeInTheDocument();
        dropAt(11 * 60, 'touch', 7);
        expect(onMoveCommit).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('committing the move', () => {
  it('by default (onMove only) the drop is handed to the page and the card stays where the server has it', () => {
    const onMove = vi.fn();
    renderGrid({ onMove });
    const before = topOf(cell());
    grab();
    moveTo(10 * 60);
    dropAt(10 * 60);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(topOf(cell())).toBe(before);
    expect(screen.queryByRole('dialog', { name: 'Přesunutí rezervace' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-notice')).not.toBeInTheDocument();
  });

  it('"direct": the card is drawn at the new slot at once, the commit resolves, the toast says so', async () => {
    let resolve: () => void = () => undefined;
    const onMoveCommit = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    renderGrid({ onMoveCommit, moveCommit: 'direct' });
    const before = topOf(cell());
    grab();
    moveTo(10 * 60);
    dropAt(10 * 60);
    expect(onMoveCommit).toHaveBeenCalledTimes(1);
    /* Optimistic: two hours further down, before the server has answered. */
    expect(topOf(cell())).toBeCloseTo(before + 120 * PX, 3);
    expect(cell()).toHaveStyle({ opacity: '1' });
    await act(async () => {
      resolve();
      await flush();
    });
    expect(topOf(cell())).toBeCloseTo(before + 120 * PX, 3);
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('Termín přesunut · pacientovi odesíláme oznámení');
    expect(screen.getByTestId('grid-notice')).toHaveAttribute('data-tone', 'info');
  });

  it('"direct": a rejected commit puts the card back and shows the server\'s sentence', async () => {
    const onMoveCommit = vi.fn().mockRejectedValue(new BookingApiError('conflict', 409, 'Čas už mezitím někdo obsadil.'));
    renderGrid({ onMoveCommit, moveCommit: 'direct' });
    const before = topOf(cell());
    grab();
    moveTo(10 * 60);
    dropAt(10 * 60);
    expect(topOf(cell())).not.toBe(before);
    await act(async () => {
      await flush();
    });
    expect(topOf(cell())).toBe(before);
    const toast = screen.getByTestId('grid-notice');
    expect(toast).toHaveAttribute('data-tone', 'error');
    expect(toast).toHaveTextContent('Čas už mezitím někdo obsadil.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the override goes once the server\'s data shows the card at its new time', async () => {
    const onMoveCommit = vi.fn().mockResolvedValue(undefined);
    const { props, rerender } = renderGrid({ onMoveCommit, moveCommit: 'direct' });
    grab();
    moveTo(10 * 60);
    dropAt(10 * 60);
    await act(async () => {
      await flush();
    });
    const movedTop = topOf(cell());
    const fresh = { ...card, startUtc: '2026-10-26T09:00:00Z', endUtc: '2026-10-26T09:30:00Z' };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TimeGrid {...props} appointmentsByDay={new Map([[DAY, [fresh]]])} />
      </QueryClientProvider>,
    );
    expect(topOf(cell())).toBe(movedTop);
    expect(screen.getByRole('button', { name: /Pacient m1/ })).toHaveTextContent(/^10:00/);
  });

  describe('"confirm" (the default with onMoveCommit)', () => {
    it('asks beside the moved card: title, question, old → new, the notify checkbox on, two buttons', async () => {
      const onMoveCommit = vi.fn().mockResolvedValue(undefined);
      renderGrid({ onMoveCommit });
      const before = topOf(cell());
      grab();
      moveTo(10 * 60);
      dropAt(10 * 60);
      expect(onMoveCommit).not.toHaveBeenCalled();
      /* The card already sits in the new slot, marked as not yet settled. */
      expect(topOf(cell())).toBeCloseTo(before + 120 * PX, 3);
      expect(cell()).toHaveAttribute('data-proposed', 'true');
      const dialog = await screen.findByRole('dialog', { name: 'Přesunutí rezervace' });
      expect(dialog).toHaveAttribute('aria-labelledby', 'move-title');
      expect(within(dialog).getByText('Opravdu chcete změnit čas této rezervace?')).toBeInTheDocument();
      expect(within(dialog).getByTestId('move-confirm-times')).toHaveTextContent('Pacient m1 · 08:00 → 10:00–10:30');
      expect(within(dialog).getByRole('checkbox', { name: 'Upozornit klienta na změnu' })).toBeChecked();
      expect(within(dialog).getByRole('button', { name: 'Přesunout' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toBeInTheDocument();
      /* Anchored to the card (the caret), not a centred modal. */
      expect(screen.getByTestId('move-confirm-caret')).toBeInTheDocument();
      expect(screen.getByTestId('move-confirm')).not.toHaveClass('MuiDialog-root');
    });

    it('"Zrušit" returns the card to its slot and commits nothing', async () => {
      const onMoveCommit = vi.fn().mockResolvedValue(undefined);
      renderGrid({ onMoveCommit });
      const before = topOf(cell());
      grab();
      moveTo(10 * 60);
      dropAt(10 * 60);
      const dialog = await screen.findByRole('dialog', { name: 'Přesunutí rezervace' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušit' }));
      expect(screen.queryByRole('dialog', { name: 'Přesunutí rezervace' })).not.toBeInTheDocument();
      expect(topOf(cell())).toBe(before);
      expect(cell()).not.toHaveAttribute('data-proposed');
      expect(onMoveCommit).not.toHaveBeenCalled();
    });

    it('Esc cancels it the same way', async () => {
      const onMoveCommit = vi.fn().mockResolvedValue(undefined);
      renderGrid({ onMoveCommit });
      const before = topOf(cell());
      grab();
      moveTo(10 * 60);
      dropAt(10 * 60);
      const dialog = await screen.findByRole('dialog', { name: 'Přesunutí rezervace' });
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await act(async () => {
        await flush();
      });
      expect(screen.queryByRole('dialog', { name: 'Přesunutí rezervace' })).not.toBeInTheDocument();
      expect(topOf(cell())).toBe(before);
      expect(onMoveCommit).not.toHaveBeenCalled();
    });

    it('"Přesunout" commits with notifyPatient from the checkbox, remembers it, and the toast follows', async () => {
      const onMoveCommit = vi.fn().mockResolvedValue(undefined);
      renderGrid({ onMoveCommit });
      const before = topOf(cell());
      grab();
      moveTo(10 * 60);
      dropAt(10 * 60);
      const dialog = await screen.findByRole('dialog', { name: 'Přesunutí rezervace' });
      fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Upozornit klienta na změnu' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));
      await act(async () => {
        await flush();
      });
      expect(onMoveCommit).toHaveBeenCalledWith(
        expect.objectContaining({ start: '2026-10-26T10:00', end: '2026-10-26T10:30', notifyPatient: false }),
      );
      expect(screen.queryByRole('dialog', { name: 'Přesunutí rezervace' })).not.toBeInTheDocument();
      expect(topOf(cell())).toBeCloseTo(before + 120 * PX, 3);
      expect(screen.getByTestId('grid-notice')).toHaveTextContent('Termín přesunut · bez oznámení');
      expect(window.sessionStorage.getItem('sm.move.notifyPatient')).toBe('0');
    });

    it('a server refusal after "Přesunout" glides the card back with the message', async () => {
      const onMoveCommit = vi.fn().mockRejectedValue(new BookingApiError('conflict', 409, 'Rezervace byla mezitím změněna.'));
      renderGrid({ onMoveCommit });
      const before = topOf(cell());
      grab();
      moveTo(10 * 60);
      dropAt(10 * 60);
      const dialog = await screen.findByRole('dialog', { name: 'Přesunutí rezervace' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Přesunout' }));
      await act(async () => {
        await flush();
      });
      expect(topOf(cell())).toBe(before);
      expect(screen.getByTestId('grid-notice')).toHaveTextContent('Rezervace byla mezitím změněna.');
    });
  });
});
