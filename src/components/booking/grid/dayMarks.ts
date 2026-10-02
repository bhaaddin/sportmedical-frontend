import { dayState, type DayPreviewLike } from '../../../pages/booking/dayState';
import type { DateOnly } from '../../../utils/time';
import { GRID_TEXT } from './gridText';

/*
 * What a day looks like before anything is booked into it: a red number, a
 * shaded column, a word saying why.
 *
 * Two sources, and they answer different questions:
 *
 *   - the holiday list (`/api/holidays/{year}`) says whether the day is a
 *     public holiday and whether the clinic has decided to work it anyway
 *     (`isStatutory: true, isHoliday: false`);
 *   - the preview (`…/preview`) says what each calendar actually does that
 *     day, after the period, the cycle, an exception and the holiday.
 *
 * The owner's rule: a holiday is shut - nobody books, the day is switched off
 * - unless the administrator has explicitly allowed work that day. A worked
 * holiday keeps its red number, because it is still a holiday, but it is open.
 */

export interface HolidayLike {
  date: string;
  name: string;
  isHoliday: boolean;
  isStatutory: boolean;
}

export interface DayMark {
  /** The day number is drawn red: a public holiday, worked or not, or a clinic day off. */
  redNumber: boolean;
  /** Nobody can book: shaded, and no drag menu. */
  closed: boolean;
  /** The word in the day's header, or `null` for an ordinary day. */
  label: string | null;
  /** The holiday's own name, when there is one. */
  detail: string | null;
}

const CLOSED_BECAUSE: Record<string, string> = {
  holiday: GRID_TEXT.publicHoliday,
  override: GRID_TEXT.closed,
  notAWorkingDay: GRID_TEXT.notAWorkingDay,
  noPeriod: GRID_TEXT.noPeriod,
};

export function dayMark(
  holiday: HolidayLike | undefined,
  rows: readonly DayPreviewLike[],
): DayMark {
  if (holiday?.isHoliday) {
    return {
      redNumber: true,
      closed: true,
      label: holiday.isStatutory ? GRID_TEXT.publicHoliday : GRID_TEXT.closed,
      detail: holiday.name || null,
    };
  }

  const worked = holiday !== undefined && holiday.isStatutory;
  const state = dayState(rows);

  if (state.kind === 'closed') {
    return {
      redNumber: worked || state.because === 'holiday',
      closed: true,
      label: (state.because && CLOSED_BECAUSE[state.because]) || GRID_TEXT.closed,
      detail: holiday?.name || null,
    };
  }

  return {
    redNumber: worked,
    closed: false,
    label:
      state.kind === 'nothing-to-book'
        ? GRID_TEXT.noActivities
        : worked
          ? GRID_TEXT.holidayWorked
          : null,
    detail: holiday?.name || null,
  };
}

/**
 * Whether one calendar can be dragged on for one day.
 *
 * A shut day never; a calendar whose preview says it is closed that day
 * never. With no preview row at all - it failed to load - the drag is offered
 * and the server decides, because "unknown" is not "shut".
 */
export function calendarDayOpen(
  mark: DayMark,
  row: { isOpen: boolean } | undefined,
): boolean {
  if (mark.closed) return false;
  return row === undefined || row.isOpen;
}

/** The dates to paint red, for the mini calendar. */
export function holidayDates(holidays: readonly HolidayLike[]): Set<DateOnly> {
  return new Set(holidays.filter((h) => h.isHoliday || h.isStatutory).map((h) => h.date));
}

/** The dates the clinic has off, for the mini calendar. */
export function closedHolidayDates(holidays: readonly HolidayLike[]): Set<DateOnly> {
  return new Set(holidays.filter((h) => h.isHoliday).map((h) => h.date));
}

/** Every year a date range touches, so a week over New Year asks for both. */
export function yearsBetween(from: DateOnly, to: DateOnly): number[] {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  const out: number[] = [];
  for (let year = first; year <= last; year += 1) out.push(year);
  return out;
}
