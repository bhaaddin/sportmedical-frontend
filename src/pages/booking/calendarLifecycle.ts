/*
 * The three states a calendar can be in, kept apart.
 *
 * Contract v37, 4.1, changes 87 and 88. Until 13. 9. 2026 `DELETE` deactivated
 * and there was no separate deactivate at all, so one button meant both things
 * - which is what the owner objected to in his own words: "neaktívny je keď ho
 * zneaktívnim, a nie keď ho odstránim".
 *
 *     aktivní     new bookings yes
 *     neaktivní   new bookings NO; existing appointments stand, nobody cancelled
 *     smazaný     never carried anything; gone with its periods, hours, day
 *                 activities, exceptions, blocks and access
 *
 * Worth recording because it changes what this screen is for: `IsActive` was
 * measured to mean nothing at all before - no rule read it, so a "deleted"
 * calendar still took bookings. The state is real now.
 */

export interface CalendarLike {
  isActive: boolean;
}

/**
 * What the list shows.
 *
 * Inactive ones are hidden by default. The owner's complaint is a crowded
 * screen and hiding is the answer to that; deleting is not, because deleting
 * takes the appointments with it - and the server refuses precisely then,
 * which is the refusal somebody meets at the worst moment.
 */
export function visibleCalendars<T extends CalendarLike>(
  calendars: readonly T[],
  showInactive: boolean,
): T[] {
  return showInactive ? [...calendars] : calendars.filter((c) => c.isActive);
}

/** How many are hidden right now - the switch says so rather than just offering. */
export function hiddenCount(calendars: readonly CalendarLike[]): number {
  return calendars.filter((c) => !c.isActive).length;
}

/**
 * Whether a calendar that cannot be deleted can be deactivated instead.
 *
 * Offered only after the server has refused, and only when there is something
 * to offer: suggesting "zneaktivnit" for a calendar that already is would be a
 * button that does nothing to a person who has just been told no.
 */
export function offerDeactivateInstead(
  calendar: CalendarLike | null,
  deleteFailed: boolean,
): boolean {
  return deleteFailed && calendar !== null && calendar.isActive;
}

/**
 * The ones the grid leaves out, so it can name them instead of dropping them.
 *
 * The planning grid draws only active calendars - an inactive one's hours no
 * longer count - and until now that meant a calendar simply vanished from the
 * chip row with no explanation, while its appointments went on being drawn
 * among everyone else's. "Kam sa podela Ordinace" is the question that
 * follows, and the screen had no answer on it.
 *
 * Paired with `visibleCalendars` on purpose: between them every calendar is
 * either drawn or named, and `everyCalendarIsShownOrNamed` in the tests holds
 * that. A calendar in neither is one that disappeared.
 */
export function inactiveAmong<T extends CalendarLike>(calendars: readonly T[]): T[] {
  return calendars.filter((c) => !c.isActive);
}
