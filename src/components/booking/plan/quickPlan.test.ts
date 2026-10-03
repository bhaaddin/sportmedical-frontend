import { describe, expect, it, vi } from 'vitest';
import type { SchedulePeriod, WorkingHour } from '../../../api/bookingContracts';
import {
  activitiesCount,
  appointmentsOutsideDay,
  appointmentsOutsidePlan,
  chunkRange,
  dayActivityRows,
  dayException,
  describeConflict,
  findConflicts,
  planName,
  planOperations,
  planPreview,
  planProblems,
  runPlanOperations,
  scopeRange,
  shiftedOffset,
  weekdaysLabel,
  workingHourInputs,
  type PlanApi,
  type PlanDraft,
} from './quickPlan';

const october: PlanDraft = {
  range: { from: '2026-10-01', to: '2026-10-31' },
  weekdays: [1, 2, 3, 4, 5],
  start: '08:00',
  end: '18:00',
  breakStart: '12:00',
  breakEnd: '12:30',
  activityIds: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'],
};

const yearRound: SchedulePeriod = { id: 'p1', name: 'Celoroční provoz', validFrom: '2026-01-01', validTo: null };

const row = (over: Partial<WorkingHour>): WorkingHour => ({
  id: 'r1',
  schedulePeriodId: 'p1',
  dayOfWeek: 1,
  startTime: '08:00:00',
  endTime: '18:00:00',
  breakStart: '12:00:00',
  breakEnd: '12:30:00',
  repeatEveryNWeeks: 1,
  weekOffset: 0,
  workerUserId: null,
  workerDisplayName: null,
  isActive: true,
  ...over,
});

describe('scope -> dates', () => {
  const base = { scope: 'day' as const, date: '2026-10-07', month: '2026-10', from: '', to: '' };

  it('a day is that one date', () => {
    expect(scopeRange(base)).toEqual({ from: '2026-10-07', to: '2026-10-07' });
  });

  it('a week is Monday to Sunday around any date in it', () => {
    expect(scopeRange({ ...base, scope: 'week' })).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    // a Sunday still belongs to the week that began on the Monday before
    expect(scopeRange({ ...base, scope: 'week', date: '2026-10-11' })).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
    });
  });

  it('a month runs from the 1st to its last day, leap years included', () => {
    expect(scopeRange({ ...base, scope: 'month' })).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(scopeRange({ ...base, scope: 'month', month: '2028-02' })).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(scopeRange({ ...base, scope: 'month', month: '2026-12' })?.to).toBe('2026-12-31');
  });

  it('a custom range needs both dates in order', () => {
    expect(scopeRange({ ...base, scope: 'custom', from: '2026-10-10', to: '2026-10-20' })).toEqual({
      from: '2026-10-10',
      to: '2026-10-20',
    });
    expect(scopeRange({ ...base, scope: 'custom', from: '2026-10-20', to: '2026-10-10' })).toBeNull();
    expect(scopeRange({ ...base, scope: 'custom', from: '', to: '2026-10-10' })).toBeNull();
    expect(scopeRange({ ...base, scope: 'month', month: '' })).toBeNull();
  });
});

describe('wording', () => {
  it('names the plan after its dates', () => {
    expect(planName({ from: '2026-10-01', to: '2026-10-31' })).toBe('Plán 1.–31. 10. 2026');
    expect(planName({ from: '2026-10-05', to: '2026-10-05' })).toBe('Plán 5. 10. 2026');
    expect(planName({ from: '2026-09-28', to: '2026-10-04' })).toBe('Plán 28. 9. – 4. 10. 2026');
    expect(planName({ from: '2026-12-28', to: '2027-01-03' })).toBe('Plán 28. 12. 2026 – 3. 1. 2027');
  });

  it('folds weekdays into ranges', () => {
    expect(weekdaysLabel([1, 2, 3, 4, 5])).toBe('Po–Pá');
    expect(weekdaysLabel([5, 3, 1, 2, 4])).toBe('Po–Pá');
    expect(weekdaysLabel([1, 3, 5])).toBe('Po, St, Pá');
    expect(weekdaysLabel([1, 2])).toBe('Po, Út');
    expect(weekdaysLabel([1, 2, 3, 5])).toBe('Po–St, Pá');
    expect(weekdaysLabel([6, 0])).toBe('So, Ne');
    expect(weekdaysLabel([])).toBe('žádný den');
  });

  it('declines činnost', () => {
    expect(activitiesCount(1)).toBe('1 činnost');
    expect(activitiesCount(3)).toBe('3 činnosti');
    expect(activitiesCount(8)).toBe('8 činností');
    expect(activitiesCount(0)).toBe('žádná činnost');
  });

  it('writes the one-line preview', () => {
    expect(planPreview(october)).toBe(
      'Po–Pá 08:00–18:00, přestávka 12:00–12:30, 8 činností, 1. 10. – 31. 10. 2026',
    );
    expect(planPreview({ ...october, breakStart: null, breakEnd: null })).toBe(
      'Po–Pá 08:00–18:00, 8 činností, 1. 10. – 31. 10. 2026',
    );
  });
});

describe('payloads', () => {
  it('one every-week row per chosen weekday, with the break', () => {
    const rows = workingHourInputs({ ...october, weekdays: [5, 1] });
    expect(rows.map((r) => r.dayOfWeek)).toEqual([1, 5]);
    expect(rows[0]).toEqual({
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '18:00',
      breakStart: '12:00',
      breakEnd: '12:30',
      repeatEveryNWeeks: 1,
      weekOffset: 0,
      workerUserId: null,
      isActive: true,
    });
  });

  it('sends all seven days, činnosti only on the working ones', () => {
    const rows = dayActivityRows(october);
    expect(rows.map((r) => r.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(rows[0].activityIds).toHaveLength(8);
    expect(rows[5].activityIds).toEqual([]);
    expect(rows[6].activityIds).toEqual([]);
  });

  it('a single date is an exception: closed, or other hours', () => {
    const day = { date: '2026-10-09', works: true, start: '09:00', end: '13:00', reason: ' Školení ' };
    expect(dayException(day)).toMatchObject({
      date: '2026-10-09', isClosed: false, startTime: '09:00', endTime: '13:00', reason: 'Školení',
    });
    expect(dayException({ ...day, works: false })).toMatchObject({
      isClosed: true, startTime: null, endTime: null,
    });
  });

  it('refuses a plan nobody could book into', () => {
    expect(planProblems(october)).toEqual([]);
    expect(planProblems({ ...october, weekdays: [] })).toContain('Vyberte aspoň jeden pracovní den.');
    expect(planProblems({ ...october, activityIds: [] })[0]).toMatch(/aspoň jednu činnost/);
    expect(planProblems({ ...october, start: '18:00', end: '08:00' })[0]).toMatch(/Konec musí být později/);
    expect(planProblems({ ...october, breakStart: '12:00', breakEnd: null })[0]).toMatch(/Pauza/);
  });
});

describe('how the plan meets existing periods', () => {
  it('a plan inside an open-ended period splits it', () => {
    const [conflict] = findConflicts([yearRound], october.range);
    expect(conflict.kind).toBe('split');
    expect(conflict.head).toEqual({ from: '2026-01-01', to: '2026-09-30' });
    expect(conflict.tail).toEqual({ from: '2026-11-01', to: null });
    expect(describeConflict(conflict)).toContain('„Celoroční provoz“');
    expect(describeConflict(conflict)).toContain('rozdělí');
  });

  it('classifies a period that sticks out one side, or lies inside', () => {
    const early: SchedulePeriod = { id: 'e', name: 'Zima', validFrom: '2026-01-01', validTo: '2026-10-15' };
    const late: SchedulePeriod = { id: 'l', name: 'Podzim', validFrom: '2026-10-20', validTo: '2026-12-31' };
    const inside: SchedulePeriod = { id: 'i', name: 'Týden', validFrom: '2026-10-05', validTo: '2026-10-11' };
    const elsewhere: SchedulePeriod = { id: 'x', name: 'Loni', validFrom: '2025-01-01', validTo: '2025-12-31' };

    const found = findConflicts([late, inside, early, elsewhere], october.range);
    expect(found.map((c) => [c.period.id, c.kind])).toEqual([
      ['e', 'trimEnd'], ['i', 'replace'], ['l', 'trimStart'],
    ]);
  });

  it('no overlap, no conflict - the touching day does not count', () => {
    const before: SchedulePeriod = { id: 'b', name: 'Září', validFrom: '2026-09-01', validTo: '2026-09-30' };
    expect(findConflicts([before], october.range)).toEqual([]);
  });

  it('keeps week A and B where they were when a period starts later', () => {
    // one week later: A becomes B
    expect(shiftedOffset({ repeatEveryNWeeks: 2, weekOffset: 0 }, '2026-01-05', '2026-01-12')).toBe(1);
    expect(shiftedOffset({ repeatEveryNWeeks: 2, weekOffset: 1 }, '2026-01-05', '2026-01-12')).toBe(0);
    // two weeks later: unchanged
    expect(shiftedOffset({ repeatEveryNWeeks: 2, weekOffset: 1 }, '2026-01-05', '2026-01-19')).toBe(1);
    // every-week rows never move
    expect(shiftedOffset({ repeatEveryNWeeks: 1, weekOffset: 0 }, '2026-01-05', '2026-01-12')).toBe(0);
  });

  it('cuts first, adds the plan, restores the tail last', () => {
    const [conflict] = findConflicts([yearRound], october.range);
    const ops = planOperations(october, [
      {
        conflict,
        token: 'tok',
        rows: [row({ id: 'mon' }), row({ id: 'tue', dayOfWeek: 2, repeatEveryNWeeks: 2, weekOffset: 1 })],
        grid: [{ dayOfWeek: 1, activityIds: ['a1'] }],
      },
    ]);

    expect(ops.map((o) => o.kind)).toEqual([
      'updatePeriod',
      'createPeriod',
      ...Array(5).fill('createWorkingHour'),
      'saveDayActivities',
      'createPeriod',
      'createWorkingHour',
      'createWorkingHour',
      'saveDayActivities',
    ]);
    expect(ops[0]).toEqual({
      kind: 'updatePeriod',
      periodId: 'p1',
      input: { name: 'Celoroční provoz', validFrom: '2026-01-01', validTo: '2026-09-30' },
      token: 'tok',
    });
    expect(ops[1]).toEqual({
      kind: 'createPeriod',
      key: 'plan',
      input: { name: 'Plán 1.–31. 10. 2026', validFrom: '2026-10-01', validTo: '2026-10-31' },
    });
    const tail = ops[8];
    expect(tail).toEqual({
      kind: 'createPeriod',
      key: 'tail:p1',
      input: { name: 'Celoroční provoz', validFrom: '2026-11-01', validTo: null },
    });
    // the old Tuesday row was B of a period that started 5. 1.; 1. 11. is 43 weeks later -> odd shift flips it
    expect(ops[10]).toMatchObject({ kind: 'createWorkingHour', input: { dayOfWeek: 2, weekOffset: 0 } });
  });

  it('removes a period that lies inside the plan before creating the plan', () => {
    const inside: SchedulePeriod = { id: 'i', name: 'Týden', validFrom: '2026-10-05', validTo: '2026-10-11' };
    const [conflict] = findConflicts([inside], october.range);
    const ops = planOperations(october, [{ conflict, token: null, rows: [], grid: [] }]);
    expect(ops[0]).toEqual({ kind: 'deletePeriod', periodId: 'i' });
    expect(ops[1].kind).toBe('createPeriod');
  });

  it('runs the steps in order and wires the new period ids through', async () => {
    const calls: string[] = [];
    const api: PlanApi = {
      createPeriod: vi.fn(async (_c, input) => {
        calls.push(`create ${input.name}`);
        return { id: input.name.startsWith('Plán') ? 'new-plan' : 'new-tail' };
      }),
      updatePeriod: vi.fn(async (_c, id, _i, token) => void calls.push(`update ${id} ${token}`)),
      deletePeriod: vi.fn(),
      createWorkingHour: vi.fn(async (_c, periodId, input) => void calls.push(`row ${periodId} ${input.dayOfWeek}`)),
      deleteWorkingHour: vi.fn(),
      saveDayActivities: vi.fn(async (_c, periodId) => void calls.push(`grid ${periodId}`)),
    };
    const [conflict] = findConflicts([yearRound], october.range);
    const ops = planOperations(october, [
      { conflict, token: 'tok', rows: [row({})], grid: [{ dayOfWeek: 1, activityIds: ['a1'] }] },
    ]);

    const planId = await runPlanOperations(api, 'cal', ops);

    expect(planId).toBe('new-plan');
    expect(calls[0]).toBe('update p1 tok');
    expect(calls[1]).toBe('create Plán 1.–31. 10. 2026');
    expect(calls.filter((c) => c.startsWith('row new-plan'))).toHaveLength(5);
    expect(calls).toContain('grid new-plan');
    expect(calls.at(-2)).toBe('row new-tail 1');
    expect(calls.at(-1)).toBe('grid new-tail');
  });
});

describe('who ends up outside the plan', () => {
  // 2026-10-05 is a Monday; Prague is UTC+2 in October.
  const booked = (id: string, startUtc: string, endUtc: string, extra: object = {}) => ({
    id, startUtc, endUtc, status: 1, activityId: 'a1', ...extra,
  });
  const fits = booked('fits', '2026-10-05T07:00:00Z', '2026-10-05T07:30:00Z'); // 09:00-09:30
  const saturday = booked('sat', '2026-10-03T07:00:00Z', '2026-10-03T07:30:00Z');
  const late = booked('late', '2026-10-05T16:30:00Z', '2026-10-05T17:30:00Z'); // 18:30-19:30
  const lunch = booked('lunch', '2026-10-05T10:15:00Z', '2026-10-05T10:45:00Z'); // 12:15-12:45
  const cancelled = booked('x', '2026-10-03T07:00:00Z', '2026-10-03T07:30:00Z', { status: 4 });
  const otherActivity = booked('act', '2026-10-05T07:00:00Z', '2026-10-05T07:30:00Z', { activityId: 'zzz' });

  it('counts a closed weekday, hours, the break and a činnost that is gone', () => {
    const out = appointmentsOutsidePlan(
      [fits, saturday, late, lunch, cancelled, otherActivity],
      october,
    );
    expect(out.map((a) => a.id)).toEqual(['sat', 'late', 'lunch', 'act']);
  });

  it('ignores what is outside the plan dates', () => {
    const september = booked('s', '2026-09-28T07:00:00Z', '2026-09-28T07:30:00Z');
    expect(appointmentsOutsidePlan([september], { ...october, weekdays: [2] })).toEqual([]);
  });

  it('a closed day strands everyone booked on it; other hours only the ones they cut', () => {
    const day = { date: '2026-10-05', works: false, start: '08:00', end: '18:00', reason: '' };
    expect(appointmentsOutsideDay([fits, late], day).map((a) => a.id)).toEqual(['fits', 'late']);
    expect(appointmentsOutsideDay([fits, late], { ...day, works: true, end: '17:00' }).map((a) => a.id)).toEqual([
      'late',
    ]);
  });
});

describe('chunking', () => {
  it('splits a long range into windows the day endpoint accepts', () => {
    const chunks = chunkRange({ from: '2026-01-01', to: '2026-12-31' });
    expect(chunks[0]).toEqual({ from: '2026-01-01', to: '2026-03-03' });
    expect(chunks.at(-1)?.to).toBe('2026-12-31');
    expect(chunkRange({ from: '2026-10-05', to: '2026-10-05' })).toEqual([
      { from: '2026-10-05', to: '2026-10-05' },
    ]);
  });
});
