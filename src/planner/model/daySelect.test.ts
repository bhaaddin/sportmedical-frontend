import { describe, expect, it } from 'vitest';
import {
  addPlace,
  blockableRange,
  blockableRanges,
  daysIn,
  daySelectReducer,
  highlightOf,
  INITIAL_DAY_SELECT,
  placeStateOf,
  type DaySelectAction,
  type DaySelectState,
} from './daySelect';

const run = (actions: DaySelectAction[], from: DaySelectState = INITIAL_DAY_SELECT) => actions.reduce(daySelectReducer, from);
const TODAY = '2026-12-09';

describe('a plain drag across days', () => {
  it('finishing on another day chooses the whole run, whichever end was pressed first', () => {
    const forward = run([{ type: 'begin', day: '2026-12-14', additive: false }, { type: 'enter', day: '2026-12-16' }, { type: 'finish', x: 5, y: 6 }]);
    expect(forward.chosen).toEqual({ from: '2026-12-14', to: '2026-12-16', x: 5, y: 6 });
    expect(forward.dragging).toBe(false);
    const backward = run([{ type: 'begin', day: '2026-12-16', additive: false }, { type: 'enter', day: '2026-12-14' }, { type: 'finish', x: 0, y: 0 }]);
    expect(backward.chosen).toMatchObject({ from: '2026-12-14', to: '2026-12-16' });
  });

  it('lights up the run while it is dragged, and keeps it while the popover is open', () => {
    const dragging = run([{ type: 'begin', day: '2026-12-14', additive: false }, { type: 'enter', day: '2026-12-15' }]);
    expect(highlightOf(dragging)).toEqual({ from: '2026-12-14', to: '2026-12-15' });
    const chosen = daySelectReducer(dragging, { type: 'finish', x: 1, y: 1 });
    expect(highlightOf(chosen)).toEqual({ from: '2026-12-14', to: '2026-12-15' });
    expect(highlightOf(daySelectReducer(chosen, { type: 'dismissChosen' }))).toBeNull();
  });

  it('a press and release on one day is a click, not a choice', () => {
    const state = run([{ type: 'begin', day: '2026-12-14', additive: false }, { type: 'finish', x: 0, y: 0 }]);
    expect(state.chosen).toBeNull();
    expect(state.places).toEqual([]);
    expect(state.dragging).toBe(false);
  });

  it('a plain press starts over: the marked places are dropped', () => {
    const marked = run([{ type: 'begin', day: '2026-12-14', additive: true }, { type: 'finish', x: 0, y: 0 }]);
    expect(marked.places).toHaveLength(1);
    expect(daySelectReducer(marked, { type: 'begin', day: '2026-12-20', additive: false }).places).toEqual([]);
  });

  it('ignores moves and a release when no drag is under way', () => {
    expect(daySelectReducer(INITIAL_DAY_SELECT, { type: 'enter', day: '2026-12-14' })).toBe(INITIAL_DAY_SELECT);
    expect(daySelectReducer(INITIAL_DAY_SELECT, { type: 'finish', x: 0, y: 0 })).toBe(INITIAL_DAY_SELECT);
  });
});

describe('several places with Ctrl, Cmd or Shift', () => {
  const additive = (from: string, to: string): DaySelectAction[] => [
    { type: 'begin', day: from, additive: true },
    { type: 'enter', day: to },
    { type: 'finish', x: 0, y: 0 },
  ];

  it('every additive drag adds a place and keeps the earlier ones; a single day is a place too', () => {
    const state = run([...additive('2026-12-14', '2026-12-16'), ...additive('2026-12-21', '2026-12-21'), ...additive('2026-12-30', '2026-12-28')]);
    expect(state.places.map((p) => [p.from, p.to])).toEqual([['2026-12-14', '2026-12-16'], ['2026-12-21', '2026-12-21'], ['2026-12-28', '2026-12-30']]);
    expect(state.chosen).toBeNull();
    expect(new Set(state.places.map((p) => p.id)).size).toBe(3);
  });

  it('the same place twice is one place', () => {
    expect(run([...additive('2026-12-14', '2026-12-16'), ...additive('2026-12-14', '2026-12-16')]).places).toHaveLength(1);
  });

  it('a place is removed on its own, and "clear" drops them all', () => {
    const state = run([...additive('2026-12-14', '2026-12-16'), ...additive('2026-12-21', '2026-12-21')]);
    const removed = daySelectReducer(state, { type: 'remove', id: state.places[0]!.id });
    expect(removed.places.map((p) => p.from)).toEqual(['2026-12-21']);
    expect(daySelectReducer(removed, { type: 'clear' }).places).toEqual([]);
  });

  it('ids are not reused after a place was removed', () => {
    const one = run(additive('2026-12-14', '2026-12-14'));
    const gone = daySelectReducer(one, { type: 'remove', id: one.places[0]!.id });
    expect(addPlace(gone, { from: '2026-12-15', to: '2026-12-15' }).places[0]!.id).not.toBe(one.places[0]!.id);
  });
});

describe('touch: "Vybrat od-do" and "Vybrat víc dnů"', () => {
  it('without the toggles a tap is not used (the day opens)', () => {
    expect(daySelectReducer(INITIAL_DAY_SELECT, { type: 'tap', day: '2026-12-14', x: 0, y: 0 })).toBe(INITIAL_DAY_SELECT);
  });

  it('tap the first day, tap the last: the run is chosen; tapping the first again cancels it', () => {
    const waiting = run([{ type: 'setTapMode', on: true }, { type: 'tap', day: '2026-12-14', x: 0, y: 0 }]);
    expect(highlightOf(waiting)).toEqual({ from: '2026-12-14', to: '2026-12-14' });
    expect(daySelectReducer(waiting, { type: 'tap', day: '2026-12-14', x: 0, y: 0 }).anchor).toBeNull();
    const chosen = daySelectReducer(waiting, { type: 'tap', day: '2026-12-17', x: 7, y: 8 });
    expect(chosen.chosen).toEqual({ from: '2026-12-14', to: '2026-12-17', x: 7, y: 8 });
    /* a tap after a choice starts a new one */
    expect(daySelectReducer(chosen, { type: 'tap', day: '2026-12-22', x: 0, y: 0 })).toMatchObject({ chosen: null, anchor: '2026-12-22' });
  });

  it('with "víc dnů" on, a tap marks one day; with "od-do" too, the run becomes a place', () => {
    const single = run([{ type: 'setAdditiveMode', on: true }, { type: 'tap', day: '2026-12-14', x: 0, y: 0 }, { type: 'tap', day: '2026-12-15', x: 0, y: 0 }]);
    expect(single.places.map((p) => [p.from, p.to])).toEqual([['2026-12-14', '2026-12-14'], ['2026-12-15', '2026-12-15']]);
    const ranged = run([
      { type: 'setAdditiveMode', on: true },
      { type: 'setTapMode', on: true },
      { type: 'tap', day: '2026-12-14', x: 0, y: 0 },
      { type: 'tap', day: '2026-12-18', x: 0, y: 0 },
    ]);
    expect(ranged.places.map((p) => [p.from, p.to])).toEqual([['2026-12-14', '2026-12-18']]);
    expect(ranged.chosen).toBeNull();
  });

  it('"clear" keeps the toggles the desk switched on', () => {
    const state = run([{ type: 'setTapMode', on: true }, { type: 'setAdditiveMode', on: true }, { type: 'clear' }]);
    expect(state).toMatchObject({ tapMode: true, additiveMode: true, places: [], chosen: null });
  });
});

describe('what a place says about a day and what can be blocked', () => {
  const places = [
    { id: 'a', kind: 'days' as const, from: '2026-12-07', to: '2026-12-08' }, // past
    { id: 'b', kind: 'days' as const, from: '2026-12-14', to: '2026-12-16' },
  ];

  it('active for a place that starts today or later, past (muted) for one that began before', () => {
    expect(placeStateOf('2026-12-15', places, TODAY)).toBe('active');
    expect(placeStateOf('2026-12-08', places, TODAY)).toBe('past');
    expect(placeStateOf('2026-12-10', places, TODAY)).toBeNull();
  });

  it('a block starts today at the earliest and a place wholly in the past blocks nothing', () => {
    expect(blockableRange({ from: '2026-12-07', to: '2026-12-08' }, TODAY)).toBeNull();
    expect(blockableRange({ from: '2026-12-07', to: '2026-12-11' }, TODAY)).toEqual({ from: '2026-12-09', to: '2026-12-11' });
    expect(blockableRange({ from: '2026-12-09', to: '2026-12-09' }, TODAY)).toEqual({ from: '2026-12-09', to: '2026-12-09' });
  });

  it('joins overlapping and touching places and counts the days', () => {
    const ranges = blockableRanges(
      [{ from: '2026-12-16', to: '2026-12-18' }, { from: '2026-12-14', to: '2026-12-15' }, { from: '2026-12-07', to: '2026-12-08' }, { from: '2026-12-30', to: '2026-12-31' }],
      TODAY,
    );
    expect(ranges).toEqual([{ from: '2026-12-14', to: '2026-12-18' }, { from: '2026-12-30', to: '2026-12-31' }]);
    expect(daysIn(ranges)).toBe(7);
  });
});
