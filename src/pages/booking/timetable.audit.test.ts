/*
 * Settings audit (20. 10. 2026) - Otevírací doba: the rules between the screen
 * and the rows the server keeps (dev API, POST /api/calendars/{id}/periods/{pid}/working-hours):
 *   times go out as "HH:mm" and come back as "HH:mm:ss"
 *   end before start            -> 422 scheduling.working_hours.end_before_start
 *   a break outside the day     -> 422 scheduling.working_hours.break_outside
 *   a break with one end only   -> 422 scheduling.working_hours.break_end_before_start
 *   two rows that can apply on the same day (also every-week + week A) -> 409
 *   isActive is not sent back by the server - a row existing makes the day work.
 */
import { describe, expect, it } from 'vitest';
import type { SchedulePeriod, WorkingHour } from '../../api/bookingContracts';
import {
  OFF_SHIFT, defaultPeriodStart, mondayOf, pickPeriod, planSave, rowsForDay, setAlternating, shiftProblem, timetableFrom,
  type DayPlan, type Shift, type Timetable,
} from './timetable';

const row = (over: Partial<WorkingHour> = {}): WorkingHour => ({
  id: 'r1', schedulePeriodId: 'p1', dayOfWeek: 1, startTime: '08:00:00', endTime: '16:00:00', breakStart: null, breakEnd: null,
  repeatEveryNWeeks: 1, weekOffset: 0, workerUserId: null, workerDisplayName: null, isActive: true, ...over,
});
const shift = (over: Partial<Shift> = {}): Shift => ({ ...OFF_SHIFT, working: true, ...over });
const day = (t: Timetable, d: number): DayPlan => t.days.find((x) => x.dayOfWeek === d) as DayPlan;

describe('shiftProblem', () => {
  it.each([
    ['a day that is off', { ...OFF_SHIFT, start: '', end: '' }, null],
    ['an ordinary day', shift(), null],
    ['a start missing', shift({ start: '' }), 'Vyplňte začátek i konec.'],
    ['an end missing', shift({ end: '' }), 'Vyplňte začátek i konec.'],
    ['end equal to start', shift({ start: '09:00', end: '09:00' }), 'Konec musí být později než začátek.'],
    ['end before start', shift({ start: '16:00', end: '08:00' }), 'Konec musí být později než začátek.'],
    ['a break start alone', shift({ breakStart: '12:00' }), 'Pauza potřebuje začátek i konec, nebo ani jedno.'],
    ['a break end alone', shift({ breakEnd: '12:30' }), 'Pauza potřebuje začátek i konec, nebo ani jedno.'],
    ['a break that ends where it starts', shift({ breakStart: '12:00', breakEnd: '12:00' }), 'Pauza musí skončit později, než začne.'],
    ['a break that ends before it starts', shift({ breakStart: '13:00', breakEnd: '12:00' }), 'Pauza musí skončit později, než začne.'],
    ['a break starting before the day', shift({ breakStart: '07:00', breakEnd: '07:30' }), 'Pauza musí ležet uvnitř pracovní doby.'],
    ['a break ending after the day', shift({ breakStart: '15:30', breakEnd: '16:30' }), 'Pauza musí ležet uvnitř pracovní doby.'],
    ['a break filling the day exactly', shift({ breakStart: '08:00', breakEnd: '16:00' }), null],
    ['a lunch in the middle', shift({ breakStart: '12:00', breakEnd: '12:30' }), null],
  ])('%s', (_label, input, expected) => {
    expect(shiftProblem(input as Shift)).toBe(expected);
  });
});

describe('reading what the server keeps', () => {
  it('cuts the seconds off a time', () => {
    const t = timetableFrom([row({ startTime: '07:30:00', endTime: '15:45:00', breakStart: '12:00:00', breakEnd: '12:30:00' })]);
    expect(day(t, 1).a).toMatchObject({ working: true, start: '07:30', end: '15:45', breakStart: '12:00', breakEnd: '12:30' });
  });

  it('shows Sunday last and off when nothing is stored', () => {
    const t = timetableFrom([]);
    expect(t.days.at(-1)?.dayOfWeek).toBe(0);
    expect(t.days.every((d) => !d.a.working && !d.unsupported)).toBe(true);
  });

  it('carries the worker of the row', () => {
    expect(day(timetableFrom([row({ workerUserId: 'u7' })]), 1).a.workerUserId).toBe('u7');
  });

  it('calls a timetable alternating as soon as any row repeats every second week', () => {
    expect(timetableFrom([row({ repeatEveryNWeeks: 2, weekOffset: 1 })]).alternating).toBe(true);
    expect(timetableFrom([row()]).alternating).toBe(false);
  });

  it('flags a day with two rows for the same week kind as unsupported, and leaves it alone until edited', () => {
    const saved = [row({ id: 'a' }), row({ id: 'b', startTime: '17:00:00', endTime: '19:00:00' })];
    const t = timetableFrom(saved);
    expect(day(t, 1).unsupported).toBe(true);
    expect(planSave(saved, t, t)).toEqual([]);
  });

  it('flags every-third-week rows as unsupported', () => {
    expect(day(timetableFrom([row({ repeatEveryNWeeks: 3 })]), 1).unsupported).toBe(true);
  });

  it('flags an every-week row mixed with a week-A row as unsupported', () => {
    expect(day(timetableFrom([row({ id: 'a' }), row({ id: 'b', repeatEveryNWeeks: 2, weekOffset: 0 })]), 1).unsupported).toBe(true);
  });
});

describe('what a day is stored as', () => {
  const alternating = (a: Shift, b: Shift): DayPlan => ({ dayOfWeek: 2, a, b, unsupported: false });

  it('a day off stores nothing', () => {
    expect(rowsForDay({ dayOfWeek: 1, a: OFF_SHIFT, b: OFF_SHIFT, unsupported: false }, false)).toEqual([]);
  });

  it('every week: one row with HH:mm times, the cycle 1/0 and isActive true', () => {
    expect(rowsForDay({ dayOfWeek: 1, a: shift({ breakStart: '12:00', breakEnd: '12:30', workerUserId: 'u1' }), b: OFF_SHIFT, unsupported: false }, false)).toEqual([
      { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', breakStart: '12:00', breakEnd: '12:30', workerUserId: 'u1', isActive: true, repeatEveryNWeeks: 1, weekOffset: 0 },
    ]);
  });

  it('alternating weeks that differ: A is 2/0 and B is 2/1', () => {
    const rows = rowsForDay(alternating(shift(), shift({ start: '10:00', end: '18:00' })), true);
    expect(rows.map((r) => [r.repeatEveryNWeeks, r.weekOffset, r.startTime])).toEqual([[2, 0, '08:00'], [2, 1, '10:00']]);
  });

  it('alternating weeks that are the same collapse into one every-week row (the server refuses overlapping rows)', () => {
    const rows = rowsForDay(alternating(shift(), shift()), true);
    expect(rows.map((r) => [r.repeatEveryNWeeks, r.weekOffset])).toEqual([[1, 0]]);
  });

  it('alternating with only week B working stores one 2/1 row', () => {
    const rows = rowsForDay(alternating(OFF_SHIFT, shift()), true);
    expect(rows.map((r) => [r.repeatEveryNWeeks, r.weekOffset])).toEqual([[2, 1]]);
  });

  it('turning alternation on copies week A into week B, off keeps week A', () => {
    const t = timetableFrom([row({ startTime: '09:00:00' })]);
    const on = setAlternating(t, true);
    expect(day(on, 1).b).toEqual(day(on, 1).a);
    const off = setAlternating({ ...on, days: on.days.map((d) => (d.dayOfWeek === 1 ? { ...d, b: shift({ start: '11:00', end: '19:00' }) } : d)) }, false);
    expect(day(off, 1).b).toEqual(day(off, 1).a);
    expect(day(off, 1).a.start).toBe('09:00');
  });
});

describe('what a save sends (planSave)', () => {
  const edit = (saved: WorkingHour[], change: (t: Timetable) => Timetable) => {
    const initial = timetableFrom(saved);
    return planSave(saved, initial, change(initial));
  };
  const setDay = (t: Timetable, d: number, apply: (p: DayPlan) => DayPlan): Timetable => ({ ...t, days: t.days.map((p) => (p.dayOfWeek === d ? apply(p) : p)) });

  it('sends nothing when nothing changed', () => {
    expect(edit([row()], (t) => t)).toEqual([]);
  });

  it('turning a day on creates one row', () => {
    const ops = edit([], (t) => setDay(t, 3, (p) => ({ ...p, a: shift(), b: shift() })));
    expect(ops).toEqual([{ kind: 'create', input: expect.objectContaining({ dayOfWeek: 3, startTime: '08:00', endTime: '16:00' }) }]);
  });

  it('turning a day off deletes its row', () => {
    expect(edit([row({ id: 'mon' })], (t) => setDay(t, 1, (p) => ({ ...p, a: OFF_SHIFT, b: OFF_SHIFT })))).toEqual([{ kind: 'delete', id: 'mon' }]);
  });

  it('changing the hours updates the same row instead of replacing it', () => {
    const ops = edit([row({ id: 'mon' })], (t) => setDay(t, 1, (p) => ({ ...p, a: { ...p.a, end: '17:00' }, b: { ...p.b, end: '17:00' } })));
    expect(ops).toEqual([{ kind: 'update', id: 'mon', input: expect.objectContaining({ endTime: '17:00' }) }]);
  });

  it('removing the break sends nulls, not omitted fields', () => {
    const ops = edit([row({ id: 'mon', breakStart: '12:00:00', breakEnd: '12:30:00' })], (t) => setDay(t, 1, (p) => ({ ...p, a: { ...p.a, breakStart: null, breakEnd: null } })));
    expect(ops).toEqual([{ kind: 'update', id: 'mon', input: expect.objectContaining({ breakStart: null, breakEnd: null }) }]);
  });

  it('changing the worker is an update', () => {
    const ops = edit([row({ id: 'mon' })], (t) => setDay(t, 1, (p) => ({ ...p, a: { ...p.a, workerUserId: 'u2' } })));
    expect(ops).toEqual([{ kind: 'update', id: 'mon', input: expect.objectContaining({ workerUserId: 'u2' }) }]);
  });

  it('only the days that were touched are sent', () => {
    const saved = [row({ id: 'mon' }), row({ id: 'tue', dayOfWeek: 2 })];
    const ops = edit(saved, (t) => setDay(t, 2, (p) => ({ ...p, a: { ...p.a, start: '09:00' } })));
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'update', id: 'tue' });
  });

  it('puts deletes before updates before creates (going back to every week would otherwise hit the overlap 409)', () => {
    const saved = [row({ id: 'a', repeatEveryNWeeks: 2, weekOffset: 0 }), row({ id: 'b', repeatEveryNWeeks: 2, weekOffset: 1, startTime: '10:00:00', endTime: '18:00:00' })];
    const initial = timetableFrom(saved);
    const ops = planSave(saved, initial, setAlternating(initial, false));
    expect(ops.map((o) => o.kind)).toEqual(['delete', 'delete', 'create'].slice(0, ops.length));
    expect(ops.findIndex((o) => o.kind === 'create')).toBeGreaterThan(ops.findLastIndex((o) => o.kind === 'delete'));
  });
});

describe('the period kept behind the scenes', () => {
  const period = (over: Partial<SchedulePeriod> = {}): SchedulePeriod => ({ id: 'p1', name: 'Pracovní doba', validFrom: '2026-01-05', validTo: null, ...over });

  it('the timetable is the period in force today, else the next one to start', () => {
    expect(pickPeriod([period({ id: 'old', validTo: '2026-06-30' }), period({ id: 'now', validFrom: '2026-07-01' })], '2026-10-20').main?.id).toBe('now');
    expect(pickPeriod([period({ id: 'later', validFrom: '2027-01-01' })], '2026-10-20').main?.id).toBe('later');
    expect(pickPeriod([period({ validTo: '2026-02-01' })], '2026-10-20').main).toBeNull();
  });

  it('the others are listed, not hidden', () => {
    const { others } = pickPeriod([period({ id: 'a' }), period({ id: 'b', validFrom: '2027-03-01' })], '2026-10-20');
    expect(others.map((p) => p.id)).toEqual(['b']);
  });

  it.each([
    ['2026-10-20', '2026-10-19'],
    ['2026-10-19', '2026-10-19'],
    ['2026-10-25', '2026-10-19'],
    ['2026-10-26', '2026-10-26'],
    ['2027-01-01', '2026-12-28'],
  ])('mondayOf(%s) is %s', (date, expected) => {
    expect(mondayOf(date)).toBe(expected);
  });

  it('a new period starts this Monday, or the day after an old one that still runs past it', () => {
    expect(defaultPeriodStart([], '2026-10-21')).toBe('2026-10-19');
    expect(defaultPeriodStart([period({ validTo: '2026-11-02' })], '2026-10-21')).toBe('2026-11-03');
    expect(defaultPeriodStart([period({ validTo: '2026-09-01' })], '2026-10-21')).toBe('2026-10-19');
  });
});
