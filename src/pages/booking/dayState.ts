/*
 * What a day in the grid actually is, once the server has had its say.
 *
 * There used to be one question here - `find((p) => !p.isOpen)` - and one
 * answer: shade it grey and print a word. That worked while every empty day
 * was a shut day.
 *
 * It stopped working on 13. 9. 2026. Booking made a calendar with no činnosti
 * assigned offer nothing instead of offering the whole catalogue (which had
 * let a sports examination be booked into a blood-draw room). That created a
 * day nobody had had to describe before: open, staffed, hours set, and with
 * nothing to book.
 *
 * The server marks it `closedBecause: "noActivities"` and - this is the part
 * that matters here - leaves `isOpen` TRUE. So the old `!p.isOpen` test never
 * finds it. The day would have drawn as a perfectly ordinary day that silently
 * offers nothing, which is the exact hole the flag was added to close.
 *
 * These are three different states with three different next steps, so they
 * are three different answers:
 *
 *     closed          nobody works - look at the hours, the exception, the holiday
 *     nothing-to-book somebody works - the calendar has not been told what it does
 *     open            neither
 *
 * "Closed" and "has nothing to offer" are not the same sentence and must not
 * share a word. A receptionist reading "zavřeno" on a day her colleague is
 * sitting in the ordinace will go and check the wrong thing.
 */

/** Only the fields these decisions need - the preview row carries far more. */
export interface DayPreviewLike {
  isOpen: boolean;
  closedBecause: string | null;
  offeredActivityIds?: readonly string[];
}

export type DayState =
  | { kind: 'open' }
  | { kind: 'closed'; because: string | null }
  | { kind: 'nothing-to-book' };

/** The server's word for a day that is open but has no činnosti assigned. */
export const NO_ACTIVITIES = 'noActivities';

export function dayState(preview: readonly DayPreviewLike[]): DayState {
  const shut = preview.find((p) => !p.isOpen);
  if (shut !== undefined) return { kind: 'closed', because: shut.closedBecause };

  /*
   * Deliberately after the closed check. A shut day is shut whatever else is
   * true of it, and telling somebody to assign činnosti to a holiday would be
   * advice that changes nothing.
   */
  const empty = preview.find((p) => p.closedBecause === NO_ACTIVITIES);
  if (empty !== undefined) return { kind: 'nothing-to-book' };

  return { kind: 'open' };
}

/** Grey belongs to a shut day only. An open day that offers nothing is open. */
export function isShaded(state: DayState): boolean {
  return state.kind === 'closed';
}

/**
 * Whether a whole range has nothing to book because nothing is assigned.
 *
 * This is what stands behind the wording on an empty list of times. The old
 * message said "there is no free time in this range - try another date or
 * another činnost", and for this case every word of that advice is wrong: no
 * date and no činnost will help, because the calendar has not been told what
 * it does.
 *
 * Both halves are required. A range that offers something is not empty for
 * this reason, and a range that is empty only because it is all holidays is a
 * shut range, not an unassigned one - sending somebody to the assignment
 * screen for a week of Christmas would be the same misdirection wearing new
 * words.
 */
export function rangeOffersNothing(days: readonly DayPreviewLike[]): boolean {
  if (days.some((d) => (d.offeredActivityIds ?? []).length > 0)) return false;
  /* An empty range falls out of this on its own and answers `false`: before
     the preview arrives nothing is known, so nothing is claimed. */
  return days.some((d) => d.closedBecause === NO_ACTIVITIES);
}

/**
 * The translation key for the word in the corner of a day.
 *
 * Pulled out of the component so the one thing that can go quietly wrong is
 * testable: `noActivities` must not reach `booking.grid.closed.*`. It has no
 * entry there, so the `defaultValue` would catch it and print "zavřeno" - the
 * single word this whole change exists to stop appearing on a day that is
 * open. A missing key does not fail; it lies politely.
 */
export function dayStateLabelKey(state: DayState): string | null {
  if (state.kind === 'open') return null;
  if (state.kind === 'nothing-to-book') return 'booking.grid.noActivities';
  if (state.because === null) return 'booking.grid.closed.other';
  return `booking.grid.closed.${state.because}`;
}
