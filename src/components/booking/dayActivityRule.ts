/*
 * What this period will actually offer, read off the grid somebody is editing.
 *
 * This is not availability, and 6.1 is not being broken. The server owns which
 * times are free; nobody can ask it about a grid that has not been saved yet.
 * What is answered here is narrower and entirely the screen's own business:
 * "if you save this, will anything be bookable" - a question about the form in
 * front of the user, asked before the save, which is the only moment the
 * answer is worth anything.
 *
 * It mirrors the server's `DayActivityRule.OfferedOn`, and that mirror is the
 * risk, so it is written once here and tested rather than spread through the
 * component:
 *
 *     assignments.Count == 0  ->  []          nothing anywhere, nothing offered
 *     otherwise               ->  that day's ticks
 *
 * The first line changed on 13. 9. 2026. It used to return the whole catalogue,
 * and this screen still had the warning built around the old shape:
 *
 *     const anyDayChosen = [...grid.values()].some((ids) => ids.size > 0);
 *     const bookableNothing = works && anyDayChosen && forDay.size === 0;
 *
 * `anyDayChosen` was there on purpose - under the old rule an empty grid
 * offered everything, so warning would have been wrong. Under the new rule it
 * silences the warning in exactly the state that most needs it: a calendar
 * with nothing ticked anywhere, which offers nothing on every working day. Two
 * of the three real calendars are in that state right now, and the screen
 * where you fix it said nothing at all.
 */

/** One period's ticks: day of week -> the activity ids chosen for it. */
export type ActivityGrid = ReadonlyMap<number, ReadonlySet<string>>;

/** Whether the period has any tick at all. Nothing anywhere means nothing offered. */
export function hasAnyAssignment(grid: ActivityGrid): boolean {
  for (const ids of grid.values()) if (ids.size > 0) return true;
  return false;
}

/**
 * A working day that will offer nothing once this grid is saved.
 *
 * A day nobody works is not this: it offers nothing because it is shut, which
 * the screen already says in its own words, and stacking a second warning on
 * it would train the reader to ignore both.
 */
export function offersNothingOn(
  dayOfWeek: number,
  grid: ActivityGrid,
  workingDays: ReadonlySet<number>,
): boolean {
  if (!workingDays.has(dayOfWeek)) return false;
  return (grid.get(dayOfWeek)?.size ?? 0) === 0;
}

/**
 * The whole calendar offers nothing, on any day.
 *
 * Worth saying once at the top rather than only seven times down the rows: it
 * is a different fact with a different fix. One empty day is an oversight in a
 * week; an empty grid means this calendar cannot be booked at all, and nobody
 * looking at the booking screen would ever learn why.
 */
export function offersNothingAtAll(
  grid: ActivityGrid,
  workingDays: ReadonlySet<number>,
): boolean {
  return workingDays.size > 0 && !hasAnyAssignment(grid);
}
