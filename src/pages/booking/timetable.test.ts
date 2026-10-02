/*
 * The timetable without periods.
 *
 * What cannot be seen by looking at the screen: which rows a day turns into,
 * that only the days somebody touched are sent, and that the order of the
 * requests does not trip the server's 409 for two rows that could apply at
 * once.
 */
import { describe, it, expect } from 'vitest';
import type { SchedulePeriod, WorkingHour } from '../../api/bookingContracts';
import {
  OFF_SHIFT,
  defaultPeriodStart,
  mondayOf,
  pickPeriod,
  planSave,
  rowsForDay,
  setAlternating,
  shiftProblem,
  timetableFrom,
  type Timetable,
} from './timetable';

const row = (over: Partial<WorkingHour> = {}): WorkingHour => ({
  id: 'r1',
  schedulePeriodId: 'p1',
  dayOfWeek: 1,
  startTime: '08:00:00',
  endTime: '16:00:00',
  breakStart: null,
  breakEnd: null,
  repeatEveryNWeeks: 1,
  weekOffset: 0,
  workerUserId: null,
  workerDisplayName: null,
  isActive: true,
  ...over,
});

const period = (over: Partial<SchedulePeriod> = {}): SchedulePeriod => ({
  id: 'p1',
  name: 'Pracovní doba',
  validFrom: '2026-01-05',
  validTo: null,
  ...over,
});

const monday = (t: Timetable) => t.days.find((d) => d.dayOfWeek === 1)!;

describe('reading saved rows', () => {
  it('shows Monday to Sunday, Monday first, with unsaved days off', () => {
    const t = timetableFrom([row()]);

    expect(t.days.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(t.alternating).toBe(false);
    expect(monday(t).a).toMatchObject({ working: true, start: '08:00', end: '16:00' });
    expect(t.days[1].a.working).toBe(false);
  });

  it('reads week A and week B from the two alternating rows', () => {
    const t = timetableFrom([
      row({ id: 'a', repeatEveryNWeeks: 2, weekOffset: 0, startTime: '07:00:00' }),
      row({ id: 'b', repeatEveryNWeeks: 2, weekOffset: 1, startTime: '12:00:00', endTime: '18:00:00' }),
    ]);

    expect(t.alternating).toBe(true);
    expect(monday(t).a.start).toBe('07:00');
    expect(monday(t).b).toMatchObject({ start: '12:00', end: '18:00' });
    expect(monday(t).unsupported).toBe(false);
  });

  it('a day that is the same in both weeks shows in both columns', () => {
    const t = timetableFrom([
      row({ id: 'every', dayOfWeek: 2 }),
      row({ id: 'a', repeatEveryNWeeks: 2, weekOffset: 0 }),
    ]);
    const tuesday = t.days.find((d) => d.dayOfWeek === 2)!;

    expect(tuesday.a).toEqual(tuesday.b);
    // Monday works week A only.
    expect(monday(t).b.working).toBe(false);
  });

  it('marks a day it cannot draw faithfully', () => {
    const t = timetableFrom([row({ repeatEveryNWeeks: 3, weekOffset: 1 })]);

    expect(monday(t).unsupported).toBe(true);
    expect(monday(t).a.working).toBe(true);
  });
});

describe('which rows a day becomes', () => {
  it('one every-week row when the timetable does not alternate', () => {
    const t = timetableFrom([row()]);

    expect(rowsForDay(monday(t), false)).toEqual([
      expect.objectContaining({ dayOfWeek: 1, repeatEveryNWeeks: 1, weekOffset: 0, startTime: '08:00' }),
    ]);
  });

  it('two rows, offset 0 and 1, when the weeks differ', () => {
    const day = { dayOfWeek: 1, a: { ...OFF_SHIFT, working: true }, b: { ...OFF_SHIFT, working: true, start: '10:00' }, unsupported: false };

    expect(rowsForDay(day, true).map((r) => [r.repeatEveryNWeeks, r.weekOffset])).toEqual([[2, 0], [2, 1]]);
  });

  it('a day the same in both weeks stays one row even when alternating', () => {
    const day = { dayOfWeek: 1, a: { ...OFF_SHIFT, working: true }, b: { ...OFF_SHIFT, working: true }, unsupported: false };

    expect(rowsForDay(day, true)).toHaveLength(1);
    expect(rowsForDay(day, true)[0].repeatEveryNWeeks).toBe(1);
  });

  it('only week B working is one row with offset 1', () => {
    const day = { dayOfWeek: 1, a: { ...OFF_SHIFT }, b: { ...OFF_SHIFT, working: true }, unsupported: false };

    expect(rowsForDay(day, true).map((r) => [r.repeatEveryNWeeks, r.weekOffset])).toEqual([[2, 1]]);
  });

  it('a day off has no rows', () => {
    expect(rowsForDay({ dayOfWeek: 1, a: OFF_SHIFT, b: OFF_SHIFT, unsupported: false }, false)).toEqual([]);
  });
});

describe('what is sent on save', () => {
  it('nothing when nothing changed', () => {
    const saved = [row()];
    const t = timetableFrom(saved);

    expect(planSave(saved, t, t)).toEqual([]);
  });

  it('turning alternation on without changing week B sends nothing', () => {
    const saved = [row()];
    const t = timetableFrom(saved);

    expect(planSave(saved, t, setAlternating(t, true))).toEqual([]);
  });

  it('a changed time is an update of the same row', () => {
    const saved = [row()];
    const t = timetableFrom(saved);
    const edited: Timetable = {
      ...t,
      days: t.days.map((d) => (d.dayOfWeek === 1 ? { ...d, a: { ...d.a, end: '15:00' } } : d)),
    };

    expect(planSave(saved, t, edited)).toEqual([
      { kind: 'update', id: 'r1', input: expect.objectContaining({ endTime: '15:00', repeatEveryNWeeks: 1 }) },
    ]);
  });

  it('switching a day off deletes its row', () => {
    const saved = [row()];
    const t = timetableFrom(saved);
    const edited: Timetable = {
      ...t,
      days: t.days.map((d) => (d.dayOfWeek === 1 ? { ...d, a: { ...d.a, working: false } } : d)),
    };

    expect(planSave(saved, t, edited)).toEqual([{ kind: 'delete', id: 'r1' }]);
  });

  it('a new working day is created', () => {
    const saved: WorkingHour[] = [];
    const t = timetableFrom(saved);
    const edited: Timetable = {
      ...t,
      days: t.days.map((d) => (d.dayOfWeek === 3 ? { ...d, a: { ...d.a, working: true } } : d)),
    };

    expect(planSave(saved, t, edited)).toEqual([
      { kind: 'create', input: expect.objectContaining({ dayOfWeek: 3, repeatEveryNWeeks: 1 }) },
    ]);
  });

  it('from alternating back to every week, the old week B row goes before anything else', () => {
    const saved = [
      row({ id: 'a', repeatEveryNWeeks: 2, weekOffset: 0 }),
      row({ id: 'b', repeatEveryNWeeks: 2, weekOffset: 1, startTime: '12:00:00' }),
    ];
    const t = timetableFrom(saved);
    const ops = planSave(saved, t, setAlternating(t, false));

    expect(ops[0]).toEqual({ kind: 'delete', id: 'a' });
    expect(ops[1]).toEqual({ kind: 'delete', id: 'b' });
    expect(ops[2]).toEqual({ kind: 'create', input: expect.objectContaining({ repeatEveryNWeeks: 1, weekOffset: 0 }) });
    expect(ops).toHaveLength(3);
  });

  it('splitting a day into weeks A and B keeps one row and adds the other', () => {
    const saved = [row()];
    const t = setAlternating(timetableFrom(saved), true);
    const edited: Timetable = {
      ...t,
      days: t.days.map((d) => (d.dayOfWeek === 1 ? { ...d, b: { ...d.b, start: '12:00' } } : d)),
    };
    const ops = planSave(saved, timetableFrom(saved), edited);

    expect(ops.map((op) => op.kind)).toEqual(['delete', 'create', 'create']);
    expect(ops.slice(1).map((op) => op.kind === 'create' && [op.input.repeatEveryNWeeks, op.input.weekOffset])).toEqual([[2, 0], [2, 1]]);
  });

  it('leaves a day it cannot draw alone until somebody edits it', () => {
    const saved = [row({ repeatEveryNWeeks: 3 }), row({ id: 'tue', dayOfWeek: 2 })];
    const t = timetableFrom(saved);
    const edited: Timetable = {
      ...t,
      days: t.days.map((d) => (d.dayOfWeek === 2 ? { ...d, a: { ...d.a, start: '09:00' } } : d)),
    };

    expect(planSave(saved, t, edited)).toEqual([
      { kind: 'update', id: 'tue', input: expect.objectContaining({ dayOfWeek: 2, startTime: '09:00' }) },
    ]);
  });
});

describe('what the screen refuses before the server does', () => {
  const working = { ...OFF_SHIFT, working: true };

  it('accepts a plain day and a day off', () => {
    expect(shiftProblem(working)).toBeNull();
    expect(shiftProblem({ ...OFF_SHIFT, start: '17:00' })).toBeNull();
  });

  it('refuses an end before the start', () => {
    expect(shiftProblem({ ...working, start: '16:00', end: '08:00' })).toMatch(/Konec/);
  });

  it('wants both ends of a break or neither', () => {
    expect(shiftProblem({ ...working, breakStart: '12:00' })).toMatch(/Pauza/);
    expect(shiftProblem({ ...working, breakStart: '12:00', breakEnd: '12:30' })).toBeNull();
  });

  it('keeps the break inside the day', () => {
    expect(shiftProblem({ ...working, breakStart: '07:00', breakEnd: '07:30' })).toMatch(/uvnitř/);
    expect(shiftProblem({ ...working, breakStart: '12:30', breakEnd: '12:00' })).toMatch(/skončit/);
  });
});

describe('the period nobody sees', () => {
  it('takes the one in force today', () => {
    const now = period({ id: 'now', validFrom: '2026-01-05', validTo: null });
    const old = period({ id: 'old', validFrom: '2025-01-06', validTo: '2025-12-31' });

    expect(pickPeriod([now, old], '2026-09-23')).toEqual({ main: now, others: [old] });
  });

  it('otherwise the next one to start', () => {
    const next = period({ id: 'next', validFrom: '2026-10-01' });

    expect(pickPeriod([next], '2026-09-23').main).toBe(next);
  });

  it('none when every period has ended', () => {
    const old = period({ validFrom: '2025-01-06', validTo: '2025-12-31' });

    expect(pickPeriod([old], '2026-09-23')).toEqual({ main: null, others: [old] });
  });

  it('a new one starts this Monday, so week A is this week', () => {
    expect(mondayOf('2026-09-23')).toBe('2026-09-21');
    expect(mondayOf('2026-09-27')).toBe('2026-09-21');
    expect(mondayOf('2026-09-21')).toBe('2026-09-21');
    expect(defaultPeriodStart([], '2026-09-23')).toBe('2026-09-21');
  });

  it('but never overlapping an old period that ran into this week', () => {
    const old = period({ validFrom: '2026-01-05', validTo: '2026-09-22' });

    expect(defaultPeriodStart([old], '2026-09-23')).toBe('2026-09-23');
  });
});
