/*
 * Three states, and the one that was invisible.
 *
 * Booking added `closedBecause: "noActivities"` on 13. 9. 2026 for a day that
 * is open and staffed but has no činnosti assigned - and it leaves `isOpen`
 * TRUE, because the day really is open. The grid's only question until then
 * was `find((p) => !p.isOpen)`, so that day matched nothing: no word, no
 * shading, nothing. It drew as an ordinary day that silently offers nothing,
 * which is the precise hole the flag exists to close.
 *
 * The other half is the wording. "Zavřeno" on a day a colleague is sitting in
 * the ordinace sends the reader to check the hours, and the hours are fine.
 */
import { describe, it, expect } from 'vitest';
import {
  dayState, dayStateLabelKey, isShaded, rangeOffersNothing, NO_ACTIVITIES,
} from './dayState';
import cs from '../../i18n/locales/cs.json';
import type { DayPreviewLike } from './dayState';

/*
 * A shut day never carries offers. Measured in `SchedulePlanService`:
 * `period is null || !day.IsOpen ? [] : OfferedOn(...)`. The first version of
 * this helper gave a closed day an activity anyway, and four tests were then
 * passing on a row the server cannot produce.
 */
const day = (over: Partial<DayPreviewLike> = {}): DayPreviewLike => {
  const row = { isOpen: true, closedBecause: null, offeredActivityIds: ['a1'], ...over };
  return row.isOpen ? row : { ...row, offeredActivityIds: [] };
};

describe('what a day is', () => {
  it('is open when it is open and offers something', () => {
    expect(dayState([day()])).toEqual({ kind: 'open' });
  });

  it('is closed when the day is shut, and carries the reason', () => {
    expect(dayState([day({ isOpen: false, closedBecause: 'holiday' })])).toEqual({
      kind: 'closed',
      because: 'holiday',
    });
  });

  /*
   * The case that was invisible. `isOpen` is true, so the old test found
   * nothing at all.
   */
  it('finds a day that is open and has nothing to book', () => {
    expect(
      dayState([day({ isOpen: true, closedBecause: NO_ACTIVITIES, offeredActivityIds: [] })]),
    ).toEqual({ kind: 'nothing-to-book' });
  });

  it('does not call that day closed', () => {
    const state = dayState([day({ closedBecause: NO_ACTIVITIES, offeredActivityIds: [] })]);
    expect(state.kind).not.toBe('closed');
  });

  /* Grey is the mark of a shut day. Shading an open one says "closed" in
     colour, having just avoided saying it in words. */
  it('shades a closed day and leaves an open one alone', () => {
    expect(isShaded(dayState([day({ isOpen: false, closedBecause: 'holiday' })]))).toBe(true);
    expect(isShaded(dayState([day({ closedBecause: NO_ACTIVITIES, offeredActivityIds: [] })])))
      .toBe(false);
    expect(isShaded(dayState([day()]))).toBe(false);
  });

  /*
   * One calendar, shut. Telling somebody to assign činnosti to a public
   * holiday is advice that changes nothing, so a shut day stays shut.
   */
  it('reports a shut calendar as closed, not as lacking činnosti', () => {
    expect(dayState([day({ isOpen: false, closedBecause: 'holiday' })]))
      .toMatchObject({ kind: 'closed', because: 'holiday' });
  });
});

/*
 * The rows are one per calendar and the answer is about the day. This was got
 * wrong and was on screen on 13. 9. 2026, with two calendars drawn together:
 *
 *   Úterý  labelled "bez činností"   while Sportovni offered two that day
 *   Pondělí greyed "nepracovní den"  while Laboratoř was open
 *
 * `find` answers "is any of them"; the question is "are all of them". A fact
 * about one calendar written across the whole day is the same shape as a
 * per-appointment rule written across a patient - and both read as true.
 */
describe('a day with several calendars drawn on it', () => {
  const offering = () => day();
  const openButEmpty = () => day({ closedBecause: NO_ACTIVITIES, offeredActivityIds: [] });
  const shut = (why: string) => day({ isOpen: false, closedBecause: why });

  it('is an ordinary day when any calendar offers something', () => {
    expect(dayState([offering(), openButEmpty()])).toEqual({ kind: 'open' });
    expect(dayState([openButEmpty(), offering()])).toEqual({ kind: 'open' });
  });

  it('is an ordinary day when one is shut and another is offering', () => {
    expect(dayState([shut('notAWorkingDay'), offering()])).toEqual({ kind: 'open' });
  });

  /* Nobody is shut, so "nepracovní den" would be wrong; nothing is offered,
     so the day really does have nothing to book. */
  it('has nothing to book only when no calendar offers anything', () => {
    expect(dayState([openButEmpty(), openButEmpty()])).toEqual({ kind: 'nothing-to-book' });
  });

  /* One open, one shut, neither offering: the practice is open, so this is
     not a holiday - it is a day with nothing assigned. */
  it('prefers "nothing to book" over "closed" while any calendar is open', () => {
    expect(dayState([shut('holiday'), openButEmpty()])).toEqual({ kind: 'nothing-to-book' });
  });

  it('is closed only when every calendar is shut', () => {
    expect(dayState([shut('holiday'), shut('notAWorkingDay')]))
      .toMatchObject({ kind: 'closed' });
    expect(isShaded(dayState([shut('holiday'), openButEmpty()]))).toBe(false);
  });

  it('is open when the preview is empty', () => {
    expect(dayState([])).toEqual({ kind: 'open' });
  });

  /* A closed day with no reason given still has to draw as closed rather than
     fall through to "open". */
  it('handles a closed day with no reason', () => {
    expect(dayState([day({ isOpen: false, closedBecause: null })])).toEqual({
      kind: 'closed',
      because: null,
    });
  });
});

describe('why a whole range came back empty', () => {
  /*
   * Monday offers things, Tuesday has nothing assigned. The range as a whole
   * is bookable, so the reader must not be told the calendar does nothing.
   * Written without the `noActivities` day first, where it passed with or
   * without the rule it was meant to guard.
   */
  it('is not this when one day still offers something', () => {
    expect(
      rangeOffersNothing([
        day(),
        day({ closedBecause: NO_ACTIVITIES, offeredActivityIds: [] }),
      ]),
    ).toBe(false);
  });

  it('is this when nothing is offered and a day says so', () => {
    expect(
      rangeOffersNothing([
        day({ closedBecause: NO_ACTIVITIES, offeredActivityIds: [] }),
        day({ isOpen: false, closedBecause: 'notAWorkingDay', offeredActivityIds: [] }),
      ]),
    ).toBe(true);
  });

  /*
   * A week of holidays offers nothing either, and sending the owner to the
   * assignment screen for it would be the same misdirection in new words.
   */
  it('is not this when the range is empty only because it is all shut', () => {
    expect(
      rangeOffersNothing([
        day({ isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] }),
        day({ isOpen: false, closedBecause: 'holiday', offeredActivityIds: [] }),
      ]),
    ).toBe(false);
  });

  /* Nothing is known yet, so nothing is claimed. */
  it('claims nothing when the preview has not arrived', () => {
    expect(rangeOffersNothing([])).toBe(false);
  });

  it('survives a server that omits the offered ids entirely', () => {
    expect(
      rangeOffersNothing([{ isOpen: true, closedBecause: NO_ACTIVITIES }]),
    ).toBe(true);
  });
});

/*
 * The quiet way this could have gone wrong.
 *
 * `t()` on a key that does not exist does not throw and does not warn on
 * screen - it prints the `defaultValue`, which here is "zavřeno". So routing
 * `noActivities` through `booking.grid.closed.*`, or shipping the component
 * without adding the Czech wording, would have put the single word this change
 * exists to prevent onto a day that is open. Both are checked here rather than
 * hoped about.
 */
describe('the word in the corner of a day', () => {
  const key = (s: Parameters<typeof dayStateLabelKey>[0]) => dayStateLabelKey(s);
  const czech = (path: string): unknown =>
    path.split('.').reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      cs as unknown,
    );

  it('says nothing on an open day', () => {
    expect(key({ kind: 'open' })).toBeNull();
  });

  /* Not under `closed.*`, where the absent key would quietly become "zavřeno". */
  it('does not send a day with nothing to book through the closed wording', () => {
    expect(key({ kind: 'nothing-to-book' })).not.toMatch(/^booking\.grid\.closed\./);
  });

  it('has real Czech for every state, "zavřeno" only for a shut day', () => {
    expect(czech(key({ kind: 'nothing-to-book' }) as string)).toBe('bez činností');

    for (const because of ['notAWorkingDay', 'noPeriod', 'override', 'holiday']) {
      const text = czech(key({ kind: 'closed', because }) as string);
      expect(typeof text).toBe('string');
      expect(text).not.toBe('');
    }
  });

  it('falls back to a shut day with no stated reason', () => {
    expect(czech(key({ kind: 'closed', because: null }) as string)).toBe('zavřeno');
  });

  /* The sentence and the way out both have to exist, or the explanation the
     booking lane asked for is an empty string. */
  it('has the sentence explaining it, and the label on the way out', () => {
    expect(czech('booking.grid.noActivitiesWhy')).toMatch(/činnosti/);
    expect(czech('booking.grid.noActivitiesWhere')).toBeTruthy();
  });
});
