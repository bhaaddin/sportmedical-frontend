import { describe, expect, it } from 'vitest';
import {
  dayBelongsTo,
  emphasis,
  employeesIn,
  mondayOf,
  toggleCalendar,
  visibleCalendars,
} from './filters';

const diagnostika = { id: 'c1', name: 'Sportovní diagnostika', clinicServiceId: 's1' };
const prohlidka = { id: 'c2', name: 'Sportovní prohlídka', clinicServiceId: 's2' };
const bezSluzby = { id: 'c3', name: 'Ordinace', clinicServiceId: null };
const all = [diagnostika, prohlidka, bezSluzby];

describe('which calendars are drawn', () => {
  it('shows every calendar until somebody narrows it down', () => {
    expect(visibleCalendars(all, null, null)).toEqual(all);
  });

  it('shows the ticked ones side by side', () => {
    expect(visibleCalendars(all, new Set(['c1', 'c2']), null).map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('narrows to the chosen service', () => {
    expect(visibleCalendars(all, null, 's2').map((c) => c.id)).toEqual(['c2']);
    expect(visibleCalendars(all, new Set(['c1']), 's2')).toEqual([]);
  });

  it('starts unticking from "all"', () => {
    expect([...toggleCalendar(null, ['c1', 'c2', 'c3'], 'c2')]).toEqual(['c1', 'c3']);
    expect([...toggleCalendar(new Set(['c1']), ['c1', 'c2'], 'c2')].sort()).toEqual(['c1', 'c2']);
  });
});

describe('employees', () => {
  it('lists everybody the rota names once, by name', () => {
    expect(
      employeesIn([
        { workerUserId: 'u2', workerDisplayName: 'Tomáš Veselý' },
        { workerUserId: 'u1', workerDisplayName: 'Anna Černá' },
        { workerUserId: 'u2', workerDisplayName: 'Tomáš Veselý' },
        { workerUserId: null, workerDisplayName: null },
      ]),
    ).toEqual([
      { id: 'u1', name: 'Anna Černá' },
      { id: 'u2', name: 'Tomáš Veselý' },
    ]);
  });

  it('filters a calendar day to the worker it belongs to', () => {
    expect(dayBelongsTo({ workerUserId: 'u1', workerDisplayName: 'A' }, null)).toBe(true);
    expect(dayBelongsTo(undefined, null)).toBe(true);
    expect(dayBelongsTo({ workerUserId: 'u1', workerDisplayName: 'A' }, 'u1')).toBe(true);
    expect(dayBelongsTo({ workerUserId: 'u2', workerDisplayName: 'B' }, 'u1')).toBe(false);
    expect(dayBelongsTo({ workerUserId: null, workerDisplayName: null }, 'u1')).toBe(false);
  });
});

describe('the selected day lights up', () => {
  it('in the week, the chosen day and nothing else', () => {
    expect(emphasis('2026-10-08', '2026-10-08', 'week')).toBe('day');
    expect(emphasis('2026-10-07', '2026-10-08', 'week')).toBeNull();
  });

  it('in the month, the chosen day and its week more faintly', () => {
    expect(emphasis('2026-10-08', '2026-10-08', 'month')).toBe('day');
    expect(emphasis('2026-10-05', '2026-10-08', 'month')).toBe('week');
    expect(emphasis('2026-10-11', '2026-10-08', 'month')).toBe('week');
    expect(emphasis('2026-10-12', '2026-10-08', 'month')).toBeNull();
  });

  it('not in the day view, where the one column is the selection', () => {
    expect(emphasis('2026-10-08', '2026-10-08', 'day')).toBeNull();
  });

  it('counts weeks from Monday', () => {
    expect(mondayOf('2026-10-08')).toBe('2026-10-05');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(mondayOf('2026-10-05')).toBe('2026-10-05');
  });
});
