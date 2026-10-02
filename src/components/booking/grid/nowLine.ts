import { pragueDateKey, type DateOnly } from '../../../utils/time';
import { parseTimeOfDay, pragueMinuteOfDay, type MinuteRange } from './timeRange';

/*
 * The now-line, as the owner described it.
 *
 *   - its colour is the setting `calendar.nowLineColor`;
 *   - a horizontal line at the current time, moving with the clock;
 *   - in the week, two vertical lines on the edges of today's column as well;
 *     in the day view, no vertical lines;
 *   - only on a working day, and only within that day's working hours - never
 *     on a shut day and never across the whole 24 hours;
 *   - today's working column carries a translucent highlighted border.
 *
 * Everything that decides whether and where it is drawn is here, so the rules
 * are tested as rules rather than by looking at a screen at the right minute.
 */

/** Only what these rules read from a preview row. */
export interface WorkingRowLike {
  isOpen: boolean;
  startTime: string | null;
  endTime: string | null;
}

/**
 * The working hours of a day across the calendars on screen: from the
 * earliest opening to the latest closing among those that are open. `null`
 * when none of them works that day.
 */
export function workingSpan(rows: readonly WorkingRowLike[]): MinuteRange | null {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (!row.isOpen) continue;
    const from = parseTimeOfDay(row.startTime);
    const to = parseTimeOfDay(row.endTime);
    if (from === null || to === null || to <= from) continue;
    start = Math.min(start, from);
    end = Math.max(end, to);
  }
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null;
}

export interface NowLineInput {
  now: Date;
  dayKey: DateOnly;
  view: 'day' | 'week';
  /** The preview rows of this day for the calendars on screen. */
  rows: readonly WorkingRowLike[];
  /** A day the clinic has off (a holiday not explicitly worked). */
  closed: boolean;
}

export interface NowLinePlacement {
  /** Wall-clock minute of the horizontal line. */
  minute: number;
  /** The working hours the vertical lines run along. */
  span: MinuteRange;
  /** Week view only: the two edges of today's column. */
  verticalLines: boolean;
}

/** Whether this column is today and a working day - the one that is highlighted. */
export function isWorkingToday(input: Omit<NowLineInput, 'view'>): boolean {
  if (input.closed) return false;
  if (pragueDateKey(input.now) !== input.dayKey) return false;
  return workingSpan(input.rows) !== null;
}

/** Where the now-line goes on this column, or `null` when it is not drawn. */
export function nowLinePlacement(input: NowLineInput): NowLinePlacement | null {
  if (!isWorkingToday(input)) return null;
  const span = workingSpan(input.rows);
  if (span === null) return null;
  const minute = pragueMinuteOfDay(input.now);
  if (minute < span.start || minute >= span.end) return null;
  return { minute, span, verticalLines: input.view === 'week' };
}

/**
 * The colour to draw with. Only hex, `rgb()` and `hsl()` values are taken:
 * the translucent border is made from this colour, and a colour name cannot be
 * made translucent. Anything else - unset, blank, mistyped - is the fallback.
 */
export function resolveNowLineColor(raw: string | null | undefined, fallback: string): string {
  const value = (raw ?? '').trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) return value;
  if (/^(?:rgb|rgba|hsl|hsla)\(\s*[\d.,%\s/]+\)$/i.test(value)) return value;
  return fallback;
}

/** The settings key the colour lives under. */
export const NOW_LINE_COLOR_KEY = 'calendar.nowLineColor';
