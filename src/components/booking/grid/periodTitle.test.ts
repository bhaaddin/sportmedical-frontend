import { describe, expect, it } from 'vitest';
import {
  longDate,
  minutesFree,
  periodTitle,
  reservationsCount,
  shortDate,
  weekdayShort,
} from './periodTitle';

describe('the period title in the top bar', () => {
  it('names the day in full', () => {
    expect(periodTitle('day', ['2026-10-26'], '2026-10-26')).toBe('Pondělí 26. října 2026');
    expect(longDate('2026-10-26', false)).toBe('Pondělí 26. října');
  });

  it('spans a week across a month end, inside a month, and across a year end', () => {
    const week = (from: string, to: string) => periodTitle('week', [from, to], from);
    expect(week('2026-10-26', '2026-11-01')).toBe('26. října — 1. listopadu 2026');
    expect(week('2026-10-05', '2026-10-11')).toBe('5. — 11. října 2026');
    expect(week('2026-12-28', '2027-01-03')).toBe('28. prosince 2026 — 3. ledna 2027');
  });

  it('names the month', () => {
    expect(periodTitle('month', [], '2026-10-14')).toBe('Říjen 2026');
  });
});

describe('the small words', () => {
  it('abbreviates the weekday and the date for the week header', () => {
    expect(weekdayShort('2026-10-26')).toBe('Po');
    expect(weekdayShort('2026-11-01')).toBe('Ne');
    expect(shortDate('2026-10-26')).toBe('26. 10.');
  });

  it('declines rezervace and minuty', () => {
    expect(reservationsCount(0)).toBe('0 rezervací');
    expect(reservationsCount(1)).toBe('1 rezervace');
    expect(reservationsCount(3)).toBe('3 rezervace');
    expect(reservationsCount(7)).toBe('7 rezervací');
    expect(minutesFree(60)).toBe('60 minut volno');
    expect(minutesFree(1)).toBe('1 minuta volno');
    expect(minutesFree(3)).toBe('3 minuty volno');
  });
});
