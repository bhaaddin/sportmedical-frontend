import { describe, expect, it } from 'vitest';
import {
  dayFlags,
  dayKey,
  dayLabel,
  highlightOf,
  monthMatrix,
  monthTitle,
  shiftMonth,
  startOfWeek,
} from './MiniCalendar.logic';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('the month grid', () => {
  it('starts on the Monday before the 1st and runs six whole weeks', () => {
    // 1. 9. 2026 is a Tuesday.
    const weeks = monthMatrix({ year: 2026, month: 8 });
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(dayKey(weeks[0][0])).toBe('2026-08-31');
    expect(dayKey(weeks[0][1])).toBe('2026-09-01');
    expect(dayKey(weeks[5][6])).toBe('2026-10-11');
  });

  it('starts on the 1st itself when the month begins on a Monday', () => {
    // 1. 6. 2026 is a Monday.
    expect(dayKey(monthMatrix({ year: 2026, month: 5 })[0][0])).toBe('2026-06-01');
  });

  it('never repeats or skips a day across the October clock change', () => {
    const keys = monthMatrix({ year: 2026, month: 9 }).flat().map(dayKey);
    expect(new Set(keys).size).toBe(42);
    expect(keys).toContain('2026-10-25');
    expect(keys).toContain('2026-10-26');
  });

  it('is titled in Czech and moves across a year boundary', () => {
    expect(monthTitle({ year: 2026, month: 8 })).toBe('Září 2026');
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('the week a day belongs to', () => {
  it('begins on Monday, and a Sunday belongs to the week before it', () => {
    expect(dayKey(startOfWeek(d(2026, 9, 8)))).toBe('2026-09-07');
    expect(dayKey(startOfWeek(d(2026, 9, 13)))).toBe('2026-09-07');
    expect(dayKey(startOfWeek(d(2026, 9, 14)))).toBe('2026-09-14');
  });
});

describe('highlighting the selection', () => {
  const eighth = d(2026, 9, 8);

  it('lights the whole week in week view, the clicked day strongest', () => {
    expect(highlightOf(d(2026, 9, 8), eighth, 'week')).toBe('day');
    for (const day of [7, 9, 10, 11, 12, 13]) {
      expect(highlightOf(d(2026, 9, day), eighth, 'week')).toBe('week');
    }
    expect(highlightOf(d(2026, 9, 6), eighth, 'week')).toBe('none');
    expect(highlightOf(d(2026, 9, 14), eighth, 'week')).toBe('none');
  });

  it('keeps the week visible but softer in day and month view', () => {
    expect(highlightOf(d(2026, 9, 10), eighth, 'day')).toBe('weekSoft');
    expect(highlightOf(d(2026, 9, 10), eighth, 'month')).toBe('weekSoft');
    expect(highlightOf(d(2026, 9, 8), eighth, 'day')).toBe('day');
  });

  it('compares calendar days, not instants', () => {
    const lateInTheDay = new Date(2026, 8, 8, 23, 59);
    expect(highlightOf(d(2026, 9, 8), lateInTheDay, 'week')).toBe('day');
  });
});

describe('what a day is', () => {
  const shown = { year: 2026, month: 8 };
  const holidays = new Set(['2026-09-28']);
  const closed = new Set(['2026-09-29']);

  it('knows holidays, closed days, today and the neighbouring month', () => {
    expect(dayFlags(d(2026, 9, 28), shown, d(2026, 9, 23), holidays, closed)).toEqual({
      outside: false,
      today: false,
      holiday: true,
      closed: false,
    });
    expect(dayFlags(d(2026, 9, 29), shown, d(2026, 9, 23), holidays, closed).closed).toBe(true);
    expect(dayFlags(d(2026, 9, 23), shown, d(2026, 9, 23), holidays, closed).today).toBe(true);
    expect(dayFlags(d(2026, 8, 31), shown, d(2026, 9, 23), holidays, closed).outside).toBe(true);
  });

  it('works with no sets at all', () => {
    const flags = dayFlags(d(2026, 9, 28), shown, d(2026, 9, 23), undefined, undefined);
    expect(flags.holiday).toBe(false);
    expect(flags.closed).toBe(false);
  });

  it('is read out in Czech, with what makes it special', () => {
    const flags = { outside: false, today: true, holiday: true, closed: false };
    expect(dayLabel(d(2026, 9, 28), flags)).toBe('pondělí 28. září 2026, svátek, dnes');
  });
});
