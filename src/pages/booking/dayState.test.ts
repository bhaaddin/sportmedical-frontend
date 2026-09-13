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

const day = (over: Partial<DayPreviewLike> = {}): DayPreviewLike => ({
  isOpen: true,
  closedBecause: null,
  offeredActivityIds: ['a1'],
  ...over,
});

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
   * A shut day is shut whatever else is true of it. Telling somebody to assign
   * činnosti to a public holiday is advice that changes nothing.
   */
  it('reports a closed day as closed even when it also has no činnosti', () => {
    expect(
      dayState([
        day({ isOpen: false, closedBecause: 'holiday' }),
        day({ closedBecause: NO_ACTIVITIES, offeredActivityIds: [] }),
      ]),
    ).toMatchObject({ kind: 'closed', because: 'holiday' });
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
