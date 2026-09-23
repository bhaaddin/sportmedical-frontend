import type { ComponentType } from 'react';

/**
 * The mini calendar's props, as agreed between the grid and the team that
 * builds `src/components/booking/MiniCalendar.tsx`.
 */
export interface MiniCalendarProps {
  value: Date;
  view: 'day' | 'week' | 'month';
  onSelect: (date: Date) => void;
  /** `YYYY-MM-DD` of public holidays - drawn with a red number. */
  holidays?: ReadonlySet<string>;
  /** `YYYY-MM-DD` of days the clinic has off. */
  closedDays?: ReadonlySet<string>;
}

type MiniCalendarModule = {
  MiniCalendar?: ComponentType<MiniCalendarProps>;
  default?: ComponentType<MiniCalendarProps>;
};

/*
 * The mini calendar is written on another branch tonight, in parallel with
 * this grid. A plain `import` would not compile here until that branch is
 * merged, and a placeholder file of the same name would collide with it on
 * merge. An eager glob resolves to the real component once the file exists
 * and to nothing before, so both branches build on their own and merge
 * cleanly; the grid falls back to a date field in the meantime. Once both are
 * in, this can become an ordinary import.
 */
const found = import.meta.glob<MiniCalendarModule>('../MiniCalendar.tsx', { eager: true });

export function resolveMiniCalendar(): ComponentType<MiniCalendarProps> | null {
  const mod = Object.values(found)[0];
  return mod?.MiniCalendar ?? mod?.default ?? null;
}
