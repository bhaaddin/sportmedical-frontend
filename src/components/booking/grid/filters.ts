import { addDaysToDateOnly, dayOfWeekOf, type DateOnly } from '../../../utils/time';

/*
 * What the grid shows, after the checkboxes, the service filter and the
 * employee filter have had their say.
 *
 * Nothing here is a second copy of a server rule. Who works which day comes
 * from the preview rows (`workerUserId` of a calendar's day), and an
 * appointment belongs to the worker of its calendar's day - which is how the
 * server fills `workerUserId` on the appointment itself.
 */

export interface CalendarLike {
  id: string;
  clinicServiceId: string | null;
}

export interface WorkerRowLike {
  workerUserId: string | null;
  workerDisplayName: string | null;
}

/**
 * The calendars that get a sub-column: ticked (`null` means all), and running
 * the chosen service when one is chosen.
 */
export function visibleCalendars<T extends CalendarLike>(
  calendars: readonly T[],
  ticked: ReadonlySet<string> | null,
  serviceId: string | null,
): T[] {
  return calendars.filter(
    (c) =>
      (ticked === null || ticked.has(c.id)) &&
      (serviceId === null || c.clinicServiceId === serviceId),
  );
}

/** Ticking or unticking one calendar. The first click starts from "all". */
export function toggleCalendar(
  ticked: ReadonlySet<string> | null,
  all: readonly string[],
  id: string,
): Set<string> {
  const next = new Set(ticked ?? all);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export interface Employee {
  id: string;
  name: string;
}

/** Everybody the rota names in the rows given, once each, by name. */
export function employeesIn(rows: Iterable<WorkerRowLike>): Employee[] {
  const byId = new Map<string, string>();
  for (const row of rows) {
    if (!row.workerUserId) continue;
    const name = row.workerDisplayName?.trim() || byId.get(row.workerUserId) || '';
    byId.set(row.workerUserId, name);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name: name || id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

/**
 * Whether a calendar's day belongs to the chosen employee. With no employee
 * chosen, every day does; with one chosen, a day nobody is named on does not.
 */
export function dayBelongsTo(row: WorkerRowLike | undefined, employeeId: string | null): boolean {
  if (employeeId === null) return true;
  return row?.workerUserId === employeeId;
}

/**
 * Which part of the grid the selected date lights up.
 *
 *   - week view: the selected day's column;
 *   - month view: the selected day, and the week it sits in more faintly;
 *   - day view: nothing - the one column is the selection.
 */
export type Emphasis = 'day' | 'week' | null;

export function emphasis(dayKey: DateOnly, selected: DateOnly, view: 'day' | 'week' | 'month'): Emphasis {
  if (view === 'day') return null;
  if (dayKey === selected) return 'day';
  if (view === 'month' && mondayOf(dayKey) === mondayOf(selected)) return 'week';
  return null;
}

/** Monday of the week a date falls in. */
export function mondayOf(date: DateOnly): DateOnly {
  return addDaysToDateOnly(date, -((dayOfWeekOf(date) + 6) % 7));
}
