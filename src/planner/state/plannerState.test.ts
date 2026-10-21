import { describe, expect, it, vi } from 'vitest';
import { initialMiniState } from '../model';
import {
  createInitialState, plannerActions as a, plannerReducer, type PlannerAction, type PlannerState,
} from './plannerState';
import { createPlannerStore } from './PlannerStoreProvider';
import {
  selectActivePreview, selectCurrentToast, selectHasModal, selectIsGesturing, selectIsPlanning, selectMonthCells,
  selectVisibleRange, selectWeekDays,
} from './selectors';

const start = (): PlannerState => createInitialState({ today: '2026-11-10', selectedDate: '2026-11-20' });
const run = (s: PlannerState, ...actions: PlannerAction[]) => actions.reduce(plannerReducer, s);

const drag = { id: 'm1', pointerId: 1, x: 0, y: 0, started: false, oldDate: '2026-11-18', oldStart: '08:00', oldEnd: '10:00', grabOffset: 0 };
const okPreview = {
  kind: 'place' as const, date: '2026-11-25', categoryId: 'medical', start: '09:00', end: '10:00', quantity: 3,
  validation: { ok: true, reason: '' }, col: 2, startMinutes: 540, endMinutes: 600, isLimit: false,
  stoppedAtLimit: false, blockedByEndOfDay: false, remaining: 24,
};

describe('initial state', () => {
  it('opens on the chosen day with the week and month around it', () => {
    const s = start();
    expect(s).toMatchObject({
      view: 'week', filter: 'all', selectedDate: '2026-11-20', weekStart: '2026-11-16', calendarMonth: '2026-11-01',
      dialog: null, drawer: null, toasts: [], carousel: { index: 0 }, mini: initialMiniState, formGenerated: false,
    });
    expect(s.planning.selectedCategoryId).toBeNull();
    expect(s.summary).toEqual({ open: false, sheet: 'overview' });
  });
  it('defaults to today', () => {
    expect(createInitialState({ today: '2026-11-10' })).toMatchObject({ selectedDate: '2026-11-10', weekStart: '2026-11-09' });
  });
});

describe('navigation', () => {
  it('selectDay moves week and month with it', () => {
    expect(run(start(), a.selectDay('2026-12-02'))).toMatchObject({ selectedDate: '2026-12-02', weekStart: '2026-11-30', calendarMonth: '2026-12-01' });
  });
  it('previous / next week select the new Monday', () => {
    const s = run(start(), a.nextWeek());
    expect(s).toMatchObject({ weekStart: '2026-11-23', selectedDate: '2026-11-23', calendarMonth: '2026-11-01' });
    expect(run(s, a.nextWeek(), a.nextWeek())).toMatchObject({ weekStart: '2026-12-07', calendarMonth: '2026-12-01' });
    expect(run(start(), a.previousWeek())).toMatchObject({ weekStart: '2026-11-09', selectedDate: '2026-11-09' });
  });
  it('changeMonth keeps the day but hides the flyout', () => {
    const s = run(start(), a.mini({ type: 'openFlyout', date: '2026-11-18', pinned: true }), a.nextMonth());
    expect(s.calendarMonth).toBe('2026-12-01');
    expect(s.selectedDate).toBe('2026-11-20');
    expect(s.mini).toEqual(initialMiniState);
    expect(run(start(), a.previousMonth(), a.previousMonth()).calendarMonth).toBe('2026-09-01');
  });
  it('today jumps to the injected day', () => {
    expect(run(start(), a.nextWeek(), a.today('2026-11-10'))).toMatchObject({ selectedDate: '2026-11-10', weekStart: '2026-11-09' });
  });
  it('filter, view, focus and locate', () => {
    expect(run(start(), a.setFilter('physio'), a.setView('month'))).toMatchObject({ filter: 'physio', view: 'month' });
    expect(run(start(), a.focusDate('2026-12-02'))).toMatchObject({ selectedDate: '2026-12-02', calendarMonth: '2026-12-01', weekStart: '2026-11-16' });
    expect(run(start(), a.focusDate('2026-12-02', true)).weekStart).toBe('2026-11-30');
    const located = run(start(), a.setView('month'), a.setFilter('physio'), a.locateTerm('2026-11-04'));
    expect(located).toMatchObject({ view: 'week', filter: 'all', weekStart: '2026-11-02', selectedDate: '2026-11-04' });
  });
});

describe('agenda', () => {
  it('changes mode, činnost and scope independently', () => {
    const s = run(start(), a.setAgendaMode('all'), a.setAgendaCategory('physio'), a.setAgendaScope('week'));
    expect(s.agenda).toEqual({ mode: 'all', categoryId: 'physio', scope: 'week' });
  });
});

describe('planning mode', () => {
  it('arms a činnost, toasts, and disarms on the second click', () => {
    const armed = run(start(), a.selectPlanningCategory('medical', 'Aktivní: Sportovní prohlídky. Táhněte myší v kalendáři.'));
    expect(armed.planning.selectedCategoryId).toBe('medical');
    expect(selectIsPlanning(armed)).toBe(true);
    expect(selectCurrentToast(armed)?.message).toBe('Aktivní: Sportovní prohlídky. Táhněte myší v kalendáři.');
    const off = run(armed, a.selectPlanningCategory('medical'));
    expect(off.planning.selectedCategoryId).toBeNull();
    expect(selectCurrentToast(off)?.message).toBe('Výběr činnosti zrušen');
    expect(run(armed, a.selectPlanningCategory('physio')).planning.selectedCategoryId).toBe('physio');
  });
  it('tracks a placement drag and projects only a valid preview', () => {
    let s = run(start(), a.selectPlanningCategory('medical'), a.beginPlacement({ day: 2, startMinutes: 540 }), a.updatePlacement(okPreview));
    expect(selectIsGesturing(s)).toBe(true);
    expect(selectActivePreview(s)).toBe(okPreview);
    s = run(s, a.updatePlacement({ ...okPreview, validation: { ok: false, reason: 'x' } }));
    expect(selectActivePreview(s)).toBeNull();
    s = run(s, a.endPlacement());
    expect(s.planning.drag).toBeNull();
    expect(s.planning.preview).toBeNull();
    expect(selectIsGesturing(s)).toBe(false);
    expect(s.planning.selectedCategoryId).toBe('medical');
  });
  it('hides the flyout the first time a move or an edge pull actually starts', () => {
    const open = run(start(), a.mini({ type: 'openFlyout', date: '2026-11-18', pinned: false }), a.beginMove(drag));
    expect(open.mini.openDate).toBe('2026-11-18');
    const started = run(open, a.updateMove(true, null));
    expect(started.mini).toEqual(initialMiniState);
    expect(started.planning.move?.started).toBe(true);
    expect(run(started, a.endMove()).planning.move).toBeNull();
    const rz = run(start(), a.mini({ type: 'pin', date: '2026-11-18' }), a.beginResize({ id: 'm1', pointerId: 1, edge: 'top', originY: 0, started: false, original: {} as never }), a.updateResize(true, null));
    expect(rz.mini).toEqual(initialMiniState);
    expect(run(rz, a.endResize()).planning.resize).toBeNull();
    expect(run(start(), a.updateMove(true, null))).toEqual(start());
  });
  it('completion card replaces the selection', () => {
    const s = run(start(), a.selectPlanningCategory('medical'), a.showCompletion('medical'));
    expect(s.planning.selectedCategoryId).toBeNull();
    expect(s.planning.completion).toEqual({ categoryId: 'medical', alreadyCompleted: false });
    expect(run(s, a.hideCompletion()).planning.completion).toBeNull();
    // arming another činnost clears the card
    expect(run(s, a.selectPlanningCategory('physio')).planning.completion).toBeNull();
  });
  it('stores the undo token and the completed flag', () => {
    const s = run(start(), a.setUndoToken('undo-1'), a.setPlanCompleted(true));
    expect(s.planning).toMatchObject({ undoToken: 'undo-1', completed: true });
  });
});

describe('carousel', () => {
  it('does nothing under three cards, clamps, and leaves planning mode on a real page change', () => {
    expect(run(start(), a.carouselTo(1, 2)).carousel.index).toBe(0);
    const armed = run(start(), a.selectPlanningCategory('medical'));
    const same = run(armed, a.carouselTo(0, 6));
    expect(same.planning.selectedCategoryId).toBe('medical');
    const moved = run(armed, a.carouselMove(1, 6));
    expect(moved.carousel.index).toBe(1);
    expect(moved.planning.selectedCategoryId).toBeNull();
    expect(run(start(), a.carouselTo(99, 6)).carousel.index).toBe(4);
    expect(run(start(), a.carouselMove(-1, 6)).carousel.index).toBe(0);
  });

  it('a move the strip makes by itself (keep) turns the page and keeps the armed činnost', () => {
    const armed = run(start(), a.selectPlanningCategory('medical'));
    const kept = run(armed, a.carouselTo(2, 6, 2, true));
    expect(kept.carousel.index).toBe(2);
    expect(kept.planning.selectedCategoryId).toBe('medical');
    expect(run(armed, a.carouselTo(2, 6, 2)).planning.selectedCategoryId).toBeNull();
  });
});

describe('layers', () => {
  it('keeps at most three toasts and drops one by id', () => {
    let s = start();
    for (const m of ['a', 'b', 'c', 'd']) s = run(s, a.toast(m));
    expect(s.toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
    expect(s.toasts.map((t) => t.id)).toEqual([2, 3, 4]);
    expect(selectCurrentToast(s)?.message).toBe('d');
    expect(run(s, a.dismissToast(3)).toasts.map((t) => t.message)).toEqual(['b', 'd']);
    expect(run(start(), a.toast('x', { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 })).toasts[0]).toMatchObject({ actionKey: 'undo', durationMs: 5200 });
    expect(run(start(), a.toast('x')).toasts[0]!.durationMs).toBe(2800);
  });
  it('one dialog at a time', () => {
    const s = run(start(), a.openDialog({ kind: 'settings' }), a.openDialog({ kind: 'finish' }));
    expect(s.dialog).toEqual({ kind: 'finish' });
    expect(selectHasModal(s)).toBe(true);
    expect(run(s, a.closeDialog()).dialog).toBeNull();
  });
  it('drawer opens on the overview tab and hides the flyout', () => {
    const s = run(start(), a.mini({ type: 'pin', date: '2026-11-18' }), a.openReservationDrawer('2026-11-18'));
    expect(s.drawer).toEqual({ date: '2026-11-18', tab: 'overview' });
    expect(s.mini).toEqual(initialMiniState);
    expect(run(s, a.setDrawerTab('club')).drawer?.tab).toBe('club');
    expect(run(start(), a.setDrawerTab('club')).drawer).toBeNull();
    expect(run(s, a.closeReservationDrawer()).drawer).toBeNull();
  });
  it('summary opens on the overview sheet', () => {
    const s = run(start(), a.openSummary(), a.setSummarySheet('terms'));
    expect(s.summary).toEqual({ open: true, sheet: 'terms' });
    expect(run(s, a.closeSummary()).summary).toEqual({ open: false, sheet: 'overview' });
    expect(run(start(), a.setFormGenerated(true)).formGenerated).toBe(true);
  });
});

describe('Esc', () => {
  it('peels one layer per press, in the prototype order', () => {
    let s = run(
      start(),
      a.selectPlanningCategory('medical'),
      a.beginPlacement({ day: 1, startMinutes: 540 }),
      a.openDialog({ kind: 'settings' }),
      a.mini({ type: 'openFlyout', date: '2026-11-18', pinned: false }),
      a.openSummary(),
    );
    s = run(s, a.openReservationDrawer('2026-11-18'));
    // openReservationDrawer also hid the flyout; open it again to test the order
    s = run(s, a.mini({ type: 'openFlyout', date: '2026-11-18', pinned: false }));
    s = run(s, a.escape());
    expect(s.summary.open).toBe(false);
    expect(s.drawer).not.toBeNull();
    s = run(s, a.escape());
    expect(s.drawer).toBeNull();
    expect(s.mini.openDate).toBe('2026-11-18');
    s = run(s, a.escape());
    expect(s.mini).toEqual(initialMiniState);
    expect(s.dialog).not.toBeNull();
    s = run(s, a.escape());
    expect(s.dialog).toBeNull();
    expect(s.planning.drag).not.toBeNull();
    s = run(s, a.escape());
    expect(s.planning.drag).toBeNull();
    expect(s.planning.selectedCategoryId).toBeNull();
    expect(selectCurrentToast(s)?.message).toBe('Výběr činnosti zrušen');
    expect(run(s, a.escape())).toEqual(s); // nothing left to close
  });
  it('cancels a running move or an edge pull first, with a toast', () => {
    const moving = run(start(), a.beginMove(drag), a.openDialog({ kind: 'settings' }), a.escape());
    expect(moving.planning.move).toBeNull();
    expect(moving.dialog).not.toBeNull();
    expect(selectCurrentToast(moving)?.message).toBe('Přesun zrušen. Původní termín zůstal beze změny.');
    const pulling = run(start(), a.beginResize({ id: 'm1', pointerId: 1, edge: 'top', originY: 0, started: false, original: {} as never }), a.escape());
    expect(pulling.planning.resize).toBeNull();
    expect(selectCurrentToast(pulling)?.message).toBe('Rozšíření zrušeno. Termín zůstal beze změny.');
  });
  it('closes a pinned empty day without a flyout', () => {
    expect(run(start(), a.mini({ type: 'pinEmpty', date: '2026-11-25' }), a.escape()).mini).toEqual(initialMiniState);
  });
});

describe('right click', () => {
  it('on the board cancels the gesture, else disarms with its own message', () => {
    expect(selectCurrentToast(run(start(), a.beginMove(drag), a.rightClick(true)))?.message).toBe('Přesun zrušen. Původní termín zůstal beze změny.');
    const armed = run(start(), a.selectPlanningCategory('medical'), a.beginPlacement({ day: 1, startMinutes: 540 }));
    const s = run(armed, a.rightClick(true));
    expect(s.planning).toMatchObject({ selectedCategoryId: null, drag: null });
    expect(selectCurrentToast(s)?.message).toBe('Aktivní činnost byla zrušena');
    expect(run(start(), a.rightClick(true))).toEqual(start());
  });
  it('elsewhere only reacts while a činnost is armed', () => {
    expect(run(start(), a.rightClick(false))).toEqual(start());
    const s = run(start(), a.selectPlanningCategory('medical'), a.rightClick(false));
    expect(s.planning.selectedCategoryId).toBeNull();
    expect(selectCurrentToast(s)?.message).toBe('Výběr činnosti zrušen');
  });
});

describe('selectors', () => {
  it('derives the cells, the week and the range to load', () => {
    const s = start();
    expect(selectMonthCells(s)).toHaveLength(42);
    expect(selectWeekDays(s)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
    expect(selectVisibleRange(s)).toEqual({ from: '2026-10-26', to: '2026-12-06' });
    // week paged out of the shown month: the range grows to cover both
    const far = { ...s, weekStart: '2027-01-11', calendarMonth: '2026-11-01' };
    expect(selectVisibleRange(far)).toEqual({ from: '2026-10-26', to: '2027-01-17' });
  });
});

describe('createPlannerStore', () => {
  it('notifies only when the state changed', () => {
    const store = createPlannerStore({ today: '2026-11-10' });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.dispatch(a.setFilter('physio'));
    expect(listener).toHaveBeenCalledTimes(1);
    store.dispatch(a.updateMove(true, null)); // no move running -> same state
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.dispatch(a.setFilter('all'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().filter).toBe('all');
  });
});
