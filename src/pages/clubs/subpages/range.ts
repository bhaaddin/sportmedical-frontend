/*
 * The date-range choice the club sub-pages share: "Tento týden", "Tento měsíc", "Vše" or a custom from-to.
 * Pure, so the tests can pin the arithmetic. Dates are Prague calendar days (yyyy-MM-dd).
 */
import { mondayOf, monthOf } from '../../statistics/aggregate';
import { addDaysToDateOnly, type DateOnly } from '../../../utils/time';

export type RangeKey = 'week' | 'month' | 'all' | 'custom';

export interface DateRange {
  from: DateOnly | null;
  to: DateOnly | null;
}

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'week', label: 'Tento týden' },
  { key: 'month', label: 'Tento měsíc' },
  { key: 'all', label: 'Vše' },
  { key: 'custom', label: 'Vlastní' },
];

export function rangeFor(key: RangeKey, today: DateOnly, custom: DateRange = { from: null, to: null }): DateRange {
  switch (key) {
    case 'week': {
      const monday = mondayOf(today);
      return { from: monday, to: addDaysToDateOnly(monday, 6) };
    }
    case 'month': {
      const m = monthOf(today);
      return { from: m.from, to: m.to };
    }
    case 'custom': {
      const { from, to } = custom;
      return from !== null && to !== null && from > to ? { from: to, to: from } : { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

/** Does [from, to] touch the range? An open end of the range never excludes. */
export function overlaps(range: DateRange, from: DateOnly, to: DateOnly): boolean {
  if (range.from !== null && to < range.from) return false;
  if (range.to !== null && from > range.to) return false;
  return true;
}
