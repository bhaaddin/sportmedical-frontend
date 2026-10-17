import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { DemoDataSource } from '../../data/DemoDataSource';
import type { MovePreview, PlacementPreview } from '../../model';
import { plannerActions } from '../../state/plannerState';
import { MiniCalendarPanel } from '../MiniCalendarPanel';
import { MiniDayTooltip } from '../MiniDayTooltip';
import { ReservationDrawer } from '../ReservationDrawer';
import { mountPanels } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async (options = {}) => {
  const m = mountPanels(
    <>
      <MiniCalendarPanel />
      <MiniDayTooltip />
      <ReservationDrawer />
    </>,
    options,
  );
  await screen.findByTestId('mini-calendar');
  return m;
};
const day = (date: string) => document.querySelector<HTMLButtonElement>(`#mini-days [data-date="${date}"]`)!;
const tip = () => document.getElementById('mini-day-tooltip')!;
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('mini-calendar rings', () => {
  it('draws 42 days of the shown month, Monday first, with the month title', async () => {
    await mount();
    expect(document.getElementById('month-title')).toHaveTextContent('Listopad 2026');
    const cells = document.querySelectorAll('#mini-days .day-cell');
    expect(cells).toHaveLength(42);
    expect(cells[0]).toHaveAttribute('data-date', '2026-10-26');
    expect(cells[41]).toHaveAttribute('data-date', '2026-12-06');
    expect(day('2026-10-26')).toHaveClass('other-month');
    expect(day('2026-11-02')).not.toHaveClass('other-month');
  });

  it('computes the ring arcs and the liquid level of a day from its real sessions', async () => {
    await mount();
    // 18. 11.: medical 08:00-10:00 (120 min) + VO2 10:30-12:00 (90 min) against the 720 min day budget.
    const cell = day('2026-11-18');
    expect(cell).toHaveClass('has-terms');
    const arcs = cell.querySelectorAll('circle.spectrum-arc');
    expect(arcs).toHaveLength(2);
    expect(arcs[0]).toHaveAttribute('stroke', '#00f1dc');
    expect(arcs[0]).toHaveAttribute('stroke-dasharray', '20.39 131.95');
    expect(arcs[0]).toHaveAttribute('stroke-dashoffset', '0.00');
    expect(arcs[1]).toHaveAttribute('stroke', '#0f94ff');
    expect(arcs[1]).toHaveAttribute('stroke-dasharray', '14.89 131.95');
    expect(arcs[1]).toHaveAttribute('stroke-dashoffset', '-21.99');
    expect(cell.querySelector('.liquid-water')).toHaveAttribute('data-fill', '29.167');
    expect(cell).toHaveAccessibleName('18. 11. 2026 · 2 termínů · 20 slotů · 29% plánovací kapacity');
    // a day without terms is only its number
    const empty = day('2026-11-25');
    expect(empty).not.toHaveClass('has-terms');
    expect(empty.querySelector('svg.spectrum-ring')).toBeNull();
    expect(empty.querySelector('.day-number')).toHaveTextContent('25');
  });

  it('marks today, a closed day in the holiday colour, and a legend entry for it', async () => {
    await mount();
    expect(day('2026-11-10')).toHaveClass('is-today');
    expect(day('2026-11-11')).not.toHaveClass('is-today');
    const closed = day('2026-11-26');
    expect(closed).toHaveClass('is-closed');
    expect(closed).toHaveAccessibleName(expect.stringContaining('Zavřeno: Zavřeno (ukázka)'));
    const number = closed.querySelector<HTMLElement>('.day-number')!;
    expect(number.style.color).not.toBe('');
    expect(day('2026-11-25').querySelector<HTMLElement>('.day-number')!.style.color).toBe('');
    expect(screen.getByTestId('mini-legend-closed')).toHaveTextContent('ZAVŘENO');
  });

  it('shows the live ring of a placement drag on an empty day and removes it afterwards', async () => {
    const { store } = await mount();
    const preview: PlacementPreview = {
      kind: 'place', date: '2026-11-25', categoryId: 'physio', start: '09:00', end: '10:00', quantity: 2,
      validation: { ok: true, reason: '' }, col: 2, startMinutes: 540, endMinutes: 600,
      isLimit: false, stoppedAtLimit: false, blockedByEndOfDay: false, remaining: 0,
    };
    act(() => store.dispatch(plannerActions.updatePlacement(preview)));
    const cell = day('2026-11-25');
    expect(cell).toHaveClass('has-terms', 'preview-liquid');
    expect(cell.querySelectorAll('circle.spectrum-arc')).toHaveLength(1);
    expect(cell.querySelector('circle.spectrum-arc')).toHaveAttribute('stroke', '#ffb124');
    expect(cell.querySelector('.liquid-water')).toHaveAttribute('data-fill', '8.333');
    // an invalid preview is not projected
    act(() => store.dispatch(plannerActions.updatePlacement({ ...preview, validation: { ok: false, reason: 'Kolize' } })));
    expect(cell).not.toHaveClass('has-terms');
    act(() => store.dispatch(plannerActions.updatePlacement(preview)));
    act(() => store.dispatch(plannerActions.endPlacement()));
    expect(cell).not.toHaveClass('preview-liquid');
    expect(cell.querySelector('svg.spectrum-ring')).toBeNull();
  });

  it('moves a term from its old day to the new one while it is dragged', async () => {
    const { store } = await mount();
    const drag = { id: 'm1', pointerId: 1, x: 0, y: 0, started: false, oldDate: '2026-11-18', oldStart: '08:00', oldEnd: '10:00', grabOffset: 0 };
    const move: MovePreview = {
      kind: 'move', eventId: 'm1', date: '2026-11-25', categoryId: 'medical', start: '10:00', end: '12:00',
      startMinutes: 600, endMinutes: 720, col: 2, quantity: 12, validation: { ok: true, reason: '' },
      oldDate: '2026-11-18', oldStart: '08:00', oldEnd: '10:00',
    };
    act(() => store.dispatch(plannerActions.beginMove(drag)));
    act(() => store.dispatch(plannerActions.updateMove(true, move)));
    expect(day('2026-11-18').querySelectorAll('circle.spectrum-arc')).toHaveLength(1);
    expect(day('2026-11-18').querySelector('circle.spectrum-arc')).toHaveAttribute('stroke', '#0f94ff');
    expect(day('2026-11-25')).toHaveClass('has-terms', 'preview-liquid');
    act(() => store.dispatch(plannerActions.endMove()));
    expect(day('2026-11-18').querySelectorAll('circle.spectrum-arc')).toHaveLength(2);
    expect(day('2026-11-25')).not.toHaveClass('has-terms');
  });

  it('turns the month with the arrows', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Následující měsíc' }));
    expect(document.getElementById('month-title')).toHaveTextContent('Prosinec 2026');
    expect(document.querySelectorAll('#mini-days .day-cell')).toHaveLength(42);
    fireEvent.click(screen.getByRole('button', { name: 'Předchozí měsíc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Předchozí měsíc' }));
    expect(document.getElementById('month-title')).toHaveTextContent('Říjen 2026');
  });
});

describe('mini-calendar flyout', () => {
  it('opens after the hover delay with the day overview, and closes after the leave delay', async () => {
    await mount();
    vi.useFakeTimers();
    const cell = day('2026-11-18');
    fireEvent.mouseEnter(cell);
    // hover zoom is immediate, the flyout waits 120 ms
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'hover');
    expect(cell).toHaveClass('zoom-focus-target');
    advance(119);
    expect(tip()).toHaveAttribute('hidden');
    advance(1);
    expect(tip()).not.toHaveAttribute('hidden');
    const t = within(tip());
    expect(t.getByRole('heading', { name: 'Středa 18. 11.' })).toBeInTheDocument();
    expect(tip().querySelector('.tday-pct')).toHaveTextContent('29%');
    expect(tip().querySelectorAll('.tday-bar i')).toHaveLength(2);
    expect(tip().querySelectorAll('.tday-event')).toHaveLength(2);
    expect(tip()).toHaveTextContent('Sportovní prohlídky');
    expect(tip()).toHaveTextContent('08:00–10:00 · Klub');
    expect(tip()).toHaveTextContent('10:30–12:00 · Veřejné');
    expect(tip()).toHaveTextContent('Naplánováno 3 h 30 min');
    expect(tip().querySelector('.tday-stats')).toHaveTextContent('2Termíny20Sloty3 h 30 minPlánovaný čas');
    expect(cell).toHaveClass('is-hover-anchor');

    fireEvent.mouseLeave(cell);
    advance(219);
    expect(tip()).not.toHaveAttribute('hidden');
    advance(1);
    expect(tip()).toHaveAttribute('hidden');
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'neutral');
  });

  it('shows nothing for a day without terms but still zooms it', async () => {
    await mount();
    vi.useFakeTimers();
    fireEvent.mouseEnter(day('2026-11-25'));
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'hover');
    advance(500);
    expect(tip()).toHaveAttribute('hidden');
  });

  it('stays open while the pointer is over the flyout', async () => {
    await mount();
    vi.useFakeTimers();
    const cell = day('2026-11-18');
    fireEvent.mouseEnter(cell);
    advance(120);
    fireEvent.mouseLeave(cell);
    fireEvent.mouseEnter(tip());
    advance(1000);
    expect(tip()).not.toHaveAttribute('hidden');
    fireEvent.mouseLeave(tip());
    advance(220);
    expect(tip()).toHaveAttribute('hidden');
  });

  it('keeps the flyout while the pointer travels the safe corridor, then closes when it leaves it', async () => {
    await mount();
    vi.useFakeTimers();
    const cell = day('2026-11-18');
    fireEvent.mouseEnter(cell);
    advance(120);
    fireEvent.mouseLeave(cell);
    // (0, 0) lies inside the corridor between the (zero-size) cell and flyout of jsdom
    act(() => { document.body.dispatchEvent(new MouseEvent('pointermove', { clientX: 0, clientY: 0, bubbles: true })); });
    advance(1000);
    expect(tip()).not.toHaveAttribute('hidden');
    act(() => { document.body.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 900, bubbles: true })); });
    advance(220);
    expect(tip()).toHaveAttribute('hidden');
  });

  it('switches to another day after the switch delay and closes for an empty day', async () => {
    await mount();
    vi.useFakeTimers();
    fireEvent.mouseEnter(day('2026-11-18'));
    advance(120);
    fireEvent.mouseEnter(day('2026-11-19'));
    advance(244);
    expect(tip().querySelector('h3')).toHaveTextContent('Středa 18. 11.');
    advance(1);
    expect(tip()).not.toHaveAttribute('hidden');
    expect(tip().querySelector('h3')).toHaveTextContent('Čtvrtek 19. 11.');
    fireEvent.mouseEnter(day('2026-11-25'));
    advance(245);
    expect(tip()).toHaveAttribute('hidden');
    // the hover zoom stays on the empty day until the pointer leaves
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'hover');
  });

  it('pins on click (with the flyout), unpins with the pin button and resets on a second click', async () => {
    const { store } = await mount();
    vi.useFakeTimers();
    const cell = day('2026-11-18');
    fireEvent.click(cell, { detail: 1 });
    expect(tip()).not.toHaveAttribute('hidden');
    expect(tip()).toHaveClass('is-pinned');
    expect(tip()).toHaveTextContent('PŘIPNUTO');
    expect(cell).toHaveAttribute('aria-pressed', 'true');
    expect(cell).toHaveClass('is-pinned');
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'pinned');
    expect(store.getState().mini.pinnedDate).toBe('2026-11-18');
    // a pinned day ignores all hover
    fireEvent.mouseEnter(day('2026-11-19'));
    advance(500);
    expect(tip().querySelector('h3')).toHaveTextContent('Středa 18. 11.');
    // the pin button de-pins back to the soft hover context
    fireEvent.click(within(tip()).getByRole('button', { name: 'Odepnout detail' }));
    expect(tip()).not.toHaveClass('is-pinned');
    expect(store.getState().mini.pinnedDate).toBeNull();
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'hover');
    // pin again, then a click on the pinned day is a deliberate reset
    fireEvent.click(within(tip()).getByRole('button', { name: 'Připnout detail' }));
    expect(store.getState().mini.pinnedDate).toBe('2026-11-18');
    fireEvent.click(cell, { detail: 1 });
    expect(tip()).toHaveAttribute('hidden');
    expect(screen.getByTestId('mini-days')).toHaveAttribute('data-zoom-state', 'neutral');
  });

  it('closes with the close button, a press elsewhere, a right click and Esc', async () => {
    const { store } = await mount();
    vi.useFakeTimers();
    const open = () => { fireEvent.click(day('2026-11-18'), { detail: 1 }); expect(tip()).not.toHaveAttribute('hidden'); };
    open();
    fireEvent.click(within(tip()).getByRole('button', { name: 'Zavřít detail' }));
    expect(tip()).toHaveAttribute('hidden');
    open();
    act(() => { document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); });
    expect(tip()).toHaveAttribute('hidden');
    open();
    const notPrevented = fireEvent.contextMenu(day('2026-11-18'));
    expect(notPrevented).toBe(false); // the browser menu is suppressed on a day
    expect(tip()).toHaveAttribute('hidden');
    open();
    act(() => store.dispatch(plannerActions.escape()));
    expect(tip()).toHaveAttribute('hidden');
  });

  it('"Přejít na den" moves the board to the day, "Obsazenost" opens the reservation drawer', async () => {
    const { store } = await mount();
    vi.useFakeTimers();
    fireEvent.click(day('2026-11-19'), { detail: 1 });
    fireEvent.click(within(tip()).getByRole('button', { name: 'Přejít na den' }));
    expect(store.getState().selectedDate).toBe('2026-11-19');
    expect(store.getState().weekStart).toBe('2026-11-16');
    expect(tip()).toHaveAttribute('hidden');
    fireEvent.click(day('2026-11-18'), { detail: 1 });
    fireEvent.click(within(tip()).getByRole('button', { name: /Obsazenost/ }));
    expect(store.getState().drawer).toEqual({ date: '2026-11-18', tab: 'overview' });
    expect(tip()).toHaveAttribute('hidden');
    expect(screen.getByTestId('reservation-drawer-panel')).toBeInTheDocument();
  });

  it('a click on an empty day pins the zoom and brings the board there (no flyout)', async () => {
    const { store } = await mount();
    vi.useFakeTimers();
    fireEvent.click(day('2026-12-02'), { detail: 1 });
    expect(store.getState().mini.pinnedDate).toBe('2026-12-02');
    expect(store.getState().selectedDate).toBe('2026-12-02');
    expect(store.getState().weekStart).toBe('2026-11-30');
    expect(tip()).toHaveAttribute('hidden');
  });
});

describe('mini-calendar keyboard', () => {
  it('has one tab stop and moves over the days with the arrow keys', async () => {
    await mount();
    const stops = [...document.querySelectorAll<HTMLElement>('#mini-days .day-cell')].filter((c) => c.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAttribute('data-date', '2026-11-20'); // the selected day
    const start = day('2026-11-20');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(day('2026-11-21'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(day('2026-11-28'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(day('2026-11-27'));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(day('2026-11-20'));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(day('2026-11-16'));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(day('2026-11-22'));
  });

  it('turns the page when an arrow leaves the grid and focuses the day it was heading for', async () => {
    await mount();
    const last = day('2026-12-06');
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    await waitFor(() => expect(document.getElementById('month-title')).toHaveTextContent('Prosinec 2026'));
    await waitFor(() => expect(document.activeElement).toBe(day('2026-12-07')));
    fireEvent.keyDown(document.activeElement!, { key: 'PageUp' });
    await waitFor(() => expect(document.getElementById('month-title')).toHaveTextContent('Listopad 2026'));
  });

  it('opens the flyout on focus and pins it with Enter, which keeps the focus', async () => {
    const { store } = await mount();
    vi.useFakeTimers();
    const cell = day('2026-11-18');
    act(() => cell.focus());
    advance(120);
    expect(tip()).not.toHaveAttribute('hidden');
    fireEvent.click(cell, { detail: 0 });
    expect(store.getState().mini.pinnedDate).toBe('2026-11-18');
    expect(document.activeElement).toBe(cell);
  });
});

describe('mini-calendar on a failing source', () => {
  it('uses the data source of the test only (smoke: custom sessions change the ring)', async () => {
    const source = new DemoDataSource({
      today: '2026-11-10',
      sessions: [{ id: 'only', date: '2026-11-03', start: '08:00', end: '14:00', categoryId: 'medical', capacity: 6, booked: 0, origin: 'public' }],
    });
    await mount({ source });
    const cell = day('2026-11-03');
    expect(cell.querySelector('circle.spectrum-arc')).toHaveAttribute('stroke-dasharray', '64.37 131.95');
    expect(cell.querySelector('.liquid-water')).toHaveAttribute('data-fill', '50.000');
    expect(day('2026-11-18')).not.toHaveClass('has-terms');
  });
});
