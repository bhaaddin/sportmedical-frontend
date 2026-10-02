import { dayOfWeekOf, type DateOnly } from '../../../utils/time';

/*
 * The Czech words the calendar's chrome is written in - the period title in
 * the top bar ("Pondělí 26. října 2026", "26. října — 1. listopadu 2026",
 * "Říjen 2026"), the day headers of the week ("Po", "26. 10."), and the
 * small counts ("3 rezervace", "60 minut volno"). Pure string arithmetic on
 * `yyyy-MM-dd` keys, so it is tested without a browser and never touches a
 * time zone.
 */

/** Index = `Date.getDay()`, Sunday first as the wire spells it. */
export const WEEKDAY_NOMINATIVE = [
  'Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota',
] as const;

export const WEEKDAY_ABBREVIATION = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'] as const;

export const MONTH_NOMINATIVE = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
] as const;

export const MONTH_GENITIVE = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
] as const;

function parts(day: DateOnly): { year: number; month: number; date: number } {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, date };
}

/** `Po` for a `yyyy-MM-dd`. */
export function weekdayShort(day: DateOnly): string {
  return WEEKDAY_ABBREVIATION[dayOfWeekOf(day)];
}

/** `Pondělí` for a `yyyy-MM-dd`. */
export function weekdayLong(day: DateOnly): string {
  return WEEKDAY_NOMINATIVE[dayOfWeekOf(day)];
}

/** `26. 10.` - the number under the weekday in the week header. */
export function shortDate(day: DateOnly): string {
  const { month, date } = parts(day);
  return `${date}. ${month}.`;
}

/** `Pondělí 26. října 2026`, or without the year for the selection popover. */
export function longDate(day: DateOnly, withYear = true): string {
  const { year, month, date } = parts(day);
  const base = `${weekdayLong(day)} ${date}. ${MONTH_GENITIVE[month - 1]}`;
  return withYear ? `${base} ${year}` : base;
}

/** `Říjen 2026` for any day of that month. */
export function monthTitle(day: DateOnly): string {
  const { year, month } = parts(day);
  return `${MONTH_NOMINATIVE[month - 1]} ${year}`;
}

/**
 * The title in the top bar for the period on screen.
 *
 *   day    Pondělí 26. října 2026
 *   week   26. října — 1. listopadu 2026   (5. — 11. října 2026 inside one month,
 *          28. prosince 2026 — 3. ledna 2027 across a year end)
 *   month  Říjen 2026
 */
export function periodTitle(
  view: 'day' | 'week' | 'month',
  days: readonly DateOnly[],
  anchor: DateOnly,
): string {
  if (view === 'month') return monthTitle(anchor);
  if (view === 'day' || days.length === 0) return longDate(anchor);
  const first = parts(days[0]);
  const last = parts(days[days.length - 1]);
  if (first.year !== last.year) {
    return `${first.date}. ${MONTH_GENITIVE[first.month - 1]} ${first.year} — ${last.date}. ${MONTH_GENITIVE[last.month - 1]} ${last.year}`;
  }
  if (first.month !== last.month) {
    return `${first.date}. ${MONTH_GENITIVE[first.month - 1]} — ${last.date}. ${MONTH_GENITIVE[last.month - 1]} ${last.year}`;
  }
  return `${first.date}. — ${last.date}. ${MONTH_GENITIVE[last.month - 1]} ${last.year}`;
}

/** Czech plural: `1 rezervace`, `3 rezervace`, `5 rezervací`, `0 rezervací`. */
export function reservationsCount(count: number): string {
  if (count === 1) return '1 rezervace';
  if (count >= 2 && count <= 4) return `${count} rezervace`;
  return `${count} rezervací`;
}

/** Czech plural: `1 minuta`, `3 minuty`, `60 minut`. */
export function minutesWord(minutes: number): string {
  if (minutes === 1) return '1 minuta';
  if (minutes >= 2 && minutes <= 4) return `${minutes} minuty`;
  return `${minutes} minut`;
}

/** The popover's second line: `60 minut volno`. */
export function minutesFree(minutes: number): string {
  return `${minutesWord(minutes)} volno`;
}
