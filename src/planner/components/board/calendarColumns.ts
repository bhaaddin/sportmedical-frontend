/*
 * The two calendars of the clinic as two columns of every day (reviewer 2.4), the way the old grid drew the week: "In the week
 * the columns are the days, with a sub-column per calendar when several are on screen." Pure rules, no DOM.
 *
 *   one calendar on screen          one column per day, as ever
 *   two or three calendars          each day is split into one column per calendar, in the calendars' own order, each headed by
 *                                   a chip with the calendar's name and colour (both from the calendars' data - nothing is a literal)
 *   more than three                 the day stays one column (a card would be a sliver); the calendar selector says how many are
 *                                   on screen and lets the desk tick fewer
 *
 * Only the standard calendar splits. A club's planning board belongs to one order and is not touched.
 */
import type { Calendar } from '../../../api/bookingContracts';

/** More columns than this per day and a card is too narrow to read. */
export const MAX_CALENDAR_COLUMNS = 3;

const byOrder = (a: Calendar, b: Calendar): number => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs');

/** The calendars the days are split into (in column order), or null when the week stays one column per day. */
export function calendarColumns(calendars: readonly Calendar[], enabled: boolean, max = MAX_CALENDAR_COLUMNS): Calendar[] | null {
  if (!enabled) return null;
  const sorted = [...calendars].sort(byOrder);
  return sorted.length >= 2 && sorted.length <= max ? sorted : null;
}

/** The column of a calendar id in a split week (0 when it is not one of them). */
export const columnOf = (columns: readonly Calendar[] | null, calendarId: string | null | undefined): number =>
  columns === null || !calendarId ? 0 : Math.max(0, columns.findIndex((c) => c.id === calendarId));

/** The calendar a marked place belongs to: the column's own when the day is split, else the first calendar that works that day. */
export function calendarOfColumn(columns: readonly Calendar[] | null, sub: number): Calendar | null {
  return columns === null ? null : (columns[Math.min(Math.max(0, sub), columns.length - 1)] ?? null);
}

/** What the chip above a column reads: the calendar's name, in the calendar's colour. */
export interface ColumnChip {
  id: string;
  name: string;
  colour: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function columnChips(columns: readonly Pick<Calendar, 'id' | 'name' | 'color'>[], fallbackColour = '#6e91a5'): ColumnChip[] {
  return columns.map((c) => ({ id: c.id, name: c.name, colour: HEX.test(c.color) ? c.color : fallbackColour }));
}
