/*
 * Three states where there used to be one and a half.
 *
 * Until 13. 9. 2026 `DELETE /api/calendars/{id}` deactivated, `IsActive` was
 * read by no rule anywhere, and a "deleted" calendar went on taking bookings.
 * One button did two jobs and neither of them properly.
 *
 * What is tested here is the screen's half of the split: what the list shows,
 * and when the other door is offered. The deleting itself is the server's.
 */
import { describe, it, expect } from 'vitest';
import {
  hiddenCount, inactiveAmong, offerDeactivateInstead, visibleCalendars,
} from './calendarLifecycle';

const cal = (name: string, isActive: boolean) => ({ name, isActive });

const ALL = [cal('Sportovni', true), cal('Ordinace', false), cal('Laborator', true)];

describe('what the list shows', () => {
  /* The default, and the owner's actual complaint: a crowded screen. */
  it('hides inactive calendars by default', () => {
    expect(visibleCalendars(ALL, false).map((c) => c.name))
      .toEqual(['Sportovni', 'Laborator']);
  });

  it('shows everything once asked', () => {
    expect(visibleCalendars(ALL, true)).toHaveLength(3);
  });

  /* Order is the caller's - the page sorts by `sortOrder` before this runs and
     filtering must not quietly reshuffle it. */
  it('keeps the order it was given', () => {
    expect(visibleCalendars(ALL, true).map((c) => c.name))
      .toEqual(['Sportovni', 'Ordinace', 'Laborator']);
  });

  it('does not hand back the caller its own array to mutate', () => {
    expect(visibleCalendars(ALL, true)).not.toBe(ALL);
  });

  it('copes with nothing at all', () => {
    expect(visibleCalendars([], false)).toEqual([]);
    expect(visibleCalendars([], true)).toEqual([]);
  });
});

describe('how many are hidden', () => {
  /* The switch says the number. "Zobrazit neaktivní" alone makes somebody
     click to find out whether there is anything behind it. */
  it('counts the inactive ones', () => {
    expect(hiddenCount(ALL)).toBe(1);
    expect(hiddenCount([])).toBe(0);
    expect(hiddenCount([cal('a', true), cal('b', true)])).toBe(0);
  });
});

describe('the other door, after a refusal', () => {
  /*
   * The server answers 409 with a count - "obsahuje 12 termínů" - and that is
   * exactly when deactivating is the thing to do instead. Offered then and
   * not before: a second button up front would ask somebody to weigh two
   * choices before anything has gone wrong.
   */
  it('is offered once deleting has been refused', () => {
    expect(offerDeactivateInstead(cal('Ordinace', true), true)).toBe(true);
  });

  it('is not offered before anything has failed', () => {
    expect(offerDeactivateInstead(cal('Ordinace', true), false)).toBe(false);
  });

  /* A button that would do nothing, shown to somebody who has just been told
     no, is worse than no button. */
  it('is not offered for a calendar that is already inactive', () => {
    expect(offerDeactivateInstead(cal('Ordinace', false), true)).toBe(false);
  });

  it('is not offered when the dialog is closed', () => {
    expect(offerDeactivateInstead(null, true)).toBe(false);
  });
});

/*
 * Nothing disappears without being named.
 *
 * Booking asked for the two silences to be told apart: a calendar that offers
 * nothing because it was deactivated, and one that offers nothing because no
 * činnosti are assigned. The fixes are opposite - explaining the second as the
 * first sends somebody to activate a calendar that is already active, and it
 * does not help - and the live data has one of each.
 *
 * On the planning grid the deactivated one did not even offer an empty
 * calendar: it vanished from the chip row entirely while its appointments
 * stayed on screen.
 */
describe('every calendar is either shown or named', () => {
  const cases = [
    [] as { name: string; isActive: boolean }[],
    [cal('a', true)],
    [cal('a', false)],
    [cal('a', true), cal('b', false), cal('c', true)],
  ];

  it.each(cases.map((c, i) => [i, c]))('holds for case %i', (_i, list) => {
    const drawn = visibleCalendars(list as never[], false);
    const named = inactiveAmong(list as never[]);
    expect(drawn.length + named.length).toBe((list as never[]).length);
    /* And never both, which would draw a calendar and announce it missing. */
    for (const c of named) expect(drawn).not.toContain(c);
  });

  it('names exactly the inactive ones', () => {
    expect(inactiveAmong(ALL).map((c) => c.name)).toEqual(['Ordinace']);
  });

  it('says nothing when every calendar is active', () => {
    expect(inactiveAmong([cal('a', true), cal('b', true)])).toEqual([]);
  });
});
