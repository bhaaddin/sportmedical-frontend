/*
 * The warning that went silent exactly when it mattered.
 *
 * The rule it mirrors changed under it on 13. 9. 2026: a period with nothing
 * assigned used to offer the whole catalogue and now offers nothing. The
 * screen still carried the old shape -
 *
 *     const anyDayChosen = [...grid.values()].some((ids) => ids.size > 0);
 *     const bookableNothing = works && anyDayChosen && forDay.size === 0;
 *
 * - and `anyDayChosen` was not a mistake when it was written. It is one now:
 * it suppresses the warning for a grid with nothing ticked anywhere, which is
 * the state where the calendar offers nothing at all. Two of the three real
 * calendars are in it. The owner's question was "where do I even set this",
 * and the screen that sets it was the one screen saying nothing was wrong.
 */
import { describe, it, expect } from 'vitest';
import {
  hasAnyAssignment, offersNothingAtAll, offersNothingOn,
} from './dayActivityRule';
import type { ActivityGrid } from './dayActivityRule';

/** Mon–Fri worked, weekend not, unless a test says otherwise. */
const WEEKDAYS = new Set([1, 2, 3, 4, 5]);

const gridOf = (rows: Record<number, string[]>): ActivityGrid =>
  new Map(Object.entries(rows).map(([day, ids]) => [Number(day), new Set(ids)]));

const EMPTY = gridOf({ 1: [], 2: [], 3: [], 4: [], 5: [] });

describe('a day that will offer nothing', () => {
  /*
   * The case the old guard hid. Nothing is ticked anywhere, so under the
   * current server rule every working day offers nothing - and the screen
   * showed no warning on any of them.
   */
  it('warns on a working day when the whole grid is empty', () => {
    expect(offersNothingOn(1, EMPTY, WEEKDAYS)).toBe(true);
  });

  it('warns on a working day left empty while other days are filled', () => {
    const grid = gridOf({ 1: ['a1'], 2: [], 3: ['a1'] });
    expect(offersNothingOn(2, grid, WEEKDAYS)).toBe(true);
  });

  it('says nothing about a day that has something ticked', () => {
    expect(offersNothingOn(1, gridOf({ 1: ['a1'] }), WEEKDAYS)).toBe(false);
  });

  /*
   * A day nobody works offers nothing because it is shut, and the row already
   * says "nepracovní den". A second warning beside it teaches the reader to
   * ignore the first.
   */
  it('says nothing about a day nobody works', () => {
    expect(offersNothingOn(6, EMPTY, WEEKDAYS)).toBe(false);
    expect(offersNothingOn(0, EMPTY, WEEKDAYS)).toBe(false);
  });

  it('treats a day missing from the grid as a day with nothing ticked', () => {
    expect(offersNothingOn(4, gridOf({ 1: ['a1'] }), WEEKDAYS)).toBe(true);
  });
});

describe('a calendar that will offer nothing at all', () => {
  /* The sentence at the top, and the state two real calendars are in. */
  it('is true when nothing is ticked anywhere and somebody works', () => {
    expect(offersNothingAtAll(EMPTY, WEEKDAYS)).toBe(true);
  });

  it('is false the moment one single day has one single activity', () => {
    expect(offersNothingAtAll(gridOf({ 3: ['a1'] }), WEEKDAYS)).toBe(false);
  });

  /*
   * A period nobody works in offers nothing either, and telling the owner to
   * tick činnosti would be advice that changes nothing - the hours are what is
   * missing, and the rows above already say so.
   */
  it('is false when nobody works in this period at all', () => {
    expect(offersNothingAtAll(EMPTY, new Set())).toBe(false);
  });

  it('is false for a grid that has not loaded yet but has working days', () => {
    expect(offersNothingAtAll(gridOf({ 1: ['a1'] }), WEEKDAYS)).toBe(false);
  });
});

describe('whether anything is assigned', () => {
  it('is false for an empty grid and for one with only empty days', () => {
    expect(hasAnyAssignment(new Map())).toBe(false);
    expect(hasAnyAssignment(EMPTY)).toBe(false);
  });

  it('is true for a single tick on a single day', () => {
    expect(hasAnyAssignment(gridOf({ 5: ['a1'] }))).toBe(true);
  });
});
