/**
 * The arithmetic behind the mini calendar, kept apart from the component so the
 * rules the owner asked for can be tested without a browser:
 *
 *   - the month is drawn Monday first (Po … Ne), six rows, so the panel never
 *     changes height when the month changes;
 *   - the selected DAY is the strongest mark, the selected WEEK the next one -
 *     in week view the whole week lights up ("click the 8th -> that week"),
 *     in day and month view it is a softer band so the week is still visible.
 *
 * Every date here is a local calendar day built from its parts
 * (`new Date(y, m, d)`), never from a string and never by adding 24 hours, so
 * the two clock-change weekends cannot shift a cell.
 */

export type CalendarView = 'day' | 'week' | 'month';

/** How strongly one cell is marked. `day` > `week` > `weekSoft` > `none`. */
export type Highlight = 'day' | 'week' | 'weekSoft' | 'none';

export const WEEKDAY_SHORT = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'] as const;

const WEEKDAY_LONG = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];

const MONTH_NOMINATIVE = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

const MONTH_GENITIVE = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
];

/** The month a panel shows: a year and a zero-based month index. */
export interface ShownMonth {
  year: number;
  month: number;
}

/** Local midnight of the same calendar day. */
export function dayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday of the week the date falls in (Czech weeks start on Monday). */
export function startOfWeek(date: Date): Date {
  const mondayOffset = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function sameWeek(a: Date, b: Date): boolean {
  return sameDay(startOfWeek(a), startOfWeek(b));
}

/** `yyyy-MM-dd` of a local calendar day - the key holidays and closed days use. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Six Monday-first weeks covering the month, adjacent days included. */
export function monthMatrix({ year, month }: ShownMonth): Date[][] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(new Date(year, month, 1 - lead + w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

/** The month before or after, across a year boundary. */
export function shiftMonth({ year, month }: ShownMonth, by: number): ShownMonth {
  const moved = new Date(year, month + by, 1);
  return { year: moved.getFullYear(), month: moved.getMonth() };
}

export function monthOf(date: Date): ShownMonth {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** `Září 2026`. */
export function monthTitle({ year, month }: ShownMonth): string {
  return `${MONTH_NOMINATIVE[month]} ${year}`;
}

/**
 * The mark one cell gets for the selected date in the given view.
 *
 * The selected day always wins. Its week is `week` in week view - the view in
 * which the week IS the selection - and `weekSoft` otherwise.
 */
export function highlightOf(cell: Date, value: Date, view: CalendarView): Highlight {
  if (sameDay(cell, value)) return 'day';
  if (sameWeek(cell, value)) return view === 'week' ? 'week' : 'weekSoft';
  return 'none';
}

export interface DayFlags {
  /** Belongs to the month before or after the one shown. */
  outside: boolean;
  today: boolean;
  holiday: boolean;
  closed: boolean;
}

export function dayFlags(
  cell: Date,
  shown: ShownMonth,
  today: Date,
  holidays: ReadonlySet<string> | undefined,
  closedDays: ReadonlySet<string> | undefined,
): DayFlags {
  const key = dayKey(cell);
  return {
    outside: cell.getMonth() !== shown.month || cell.getFullYear() !== shown.year,
    today: sameDay(cell, today),
    holiday: holidays?.has(key) ?? false,
    closed: closedDays?.has(key) ?? false,
  };
}

/** What a screen reader hears for one day: `čtvrtek 24. září 2026, svátek, dnes`. */
export function dayLabel(cell: Date, flags: DayFlags): string {
  const weekday = WEEKDAY_LONG[(cell.getDay() + 6) % 7];
  const parts = [
    `${weekday} ${cell.getDate()}. ${MONTH_GENITIVE[cell.getMonth()]} ${cell.getFullYear()}`,
  ];
  if (flags.holiday) parts.push('svátek');
  if (flags.closed) parts.push('zavřeno');
  if (flags.today) parts.push('dnes');
  return parts.join(', ');
}
