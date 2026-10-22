/*
 * Picking whole days in the month for a club order (owner, 21. 10. 2026: "když jsem chtěl kliknout na celý den,
 * v kalendáři sekce měsíc mi to nedovolilo"). The plan of a pick: which days, which činnosti, how many whole slots -
 * never into the lunch break, never outside the hours, never on a holiday or in the past, and never more than the
 * club needs. Every day that can not be taken says why.
 */
import { describe, expect, it } from 'vitest';
import { makeContext, type DayMark, type PlannerCategory, type PlannerContext, type PlannerSession } from '../../model';
import { orderFigures } from './orderFigures';
import { describeDayPick, expandRanges, planDays } from './dayPick';

const TODAY = '2026-10-21';
const open = (date: string, extra: Partial<DayMark> = {}): DayMark => ({ date, closed: false, hours: { from: '08:00', to: '17:00' }, lunch: { from: '12:00', to: '13:00' }, ...extra });
const cats: PlannerCategory[] = [
  { id: 'z', name: 'Základní', iconKey: 'heart', color: '#00f1dc', slotMinutes: 40, parallelCapacity: 1 },
  { id: 'k', name: 'Komplexní', iconKey: 'heart', color: '#0f94ff', slotMinutes: 60, parallelCapacity: 1 },
];
const ctxOf = (needZ: number, needK: number, sessions: PlannerSession[] = []): PlannerContext =>
  makeContext({
    categories: cats,
    demands: [{ categoryId: 'z', requested: needZ, baselinePlanned: 0 }, { categoryId: 'k', requested: needK, baselinePlanned: 0 }].filter((d) => d.requested > 0),
    sessions,
    today: TODAY,
  });
const marksOf = (...dates: string[]) => Object.fromEntries(dates.map((d) => [d, open(d)]));
const D1 = '2026-10-22'; // Thursday
const D2 = '2026-10-23';
const D3 = '2026-10-26';

const plan = (ctx: PlannerContext, dates: string[], armed: string | null, marks: Record<string, DayMark>) =>
  planDays({ dates, figures: orderFigures(ctx), armed, marks, sessions: ctx.sessions, today: TODAY });

describe('expandRanges', () => {
  it('turns ranges into sorted unique days', () => {
    expect(expandRanges([{ from: '2026-10-22', to: '2026-10-24' }, { from: '2026-10-23', to: '2026-10-23' }])).toEqual(['2026-10-22', '2026-10-23', '2026-10-24']);
  });
});

describe('planDays · one whole day', () => {
  it('takes the whole open day for the armed činnost, in two runs around the lunch break, never more than the need', () => {
    // 40 min slots: 08:00-12:00 holds 6, 13:00-17:00 holds 6 -> a day is 12 slots
    const p = plan(ctxOf(30, 0), [D1], 'z', marksOf(D1));
    expect(p.parts.map((x) => [x.start, x.end, x.slots])).toEqual([[480, 720, 6], [780, 1020, 6]]);
    expect(p.skipped).toEqual([]);
    expect(p.limited).toBe(false);
  });

  it('only the part that the need holds when the day is longer than the need - and says so', () => {
    const p = plan(ctxOf(8, 0), [D1], 'z', marksOf(D1));
    expect(p.parts.map((x) => [x.start, x.end, x.slots])).toEqual([[480, 720, 6], [780, 860, 2]]);
    expect(p.limited).toBe(true);
    expect(describeDayPick(p).text).toMatch(/jen část/);
  });

  it('with no činnost armed every open činnost is laid out one after another (the order of the order)', () => {
    const p = plan(ctxOf(3, 2), [D1], null, marksOf(D1));
    expect(p.parts.map((x) => [x.categoryId, x.start, x.end, x.slots])).toEqual([['z', 480, 600, 3], ['k', 600, 720, 2]]);
  });

  it('a činnost that already has its players is left out; all done = a clear refusal, nothing planned', () => {
    const full = ctxOf(2, 0, [{ id: 'a', date: D2, start: '08:00', end: '09:20', categoryId: 'z', capacity: 2, booked: 0, showInList: true, createdByPlanner: true, origin: 'club' }]);
    const p = plan(full, [D1], null, marksOf(D1, D2));
    expect(p.parts).toEqual([]);
    expect(p.fulfilled).toBe(true);
    expect(describeDayPick(p).text).toMatch(/už mají termín.*nepotřebuje/);
    expect(describeDayPick(p).text).toMatch(/Přidat termín navíc/); // and says what to do instead
  });

  it('a refused pick ends with what to do instead (closed day, past day, no free slot)', () => {
    const closed = plan(ctxOf(3, 2), [D1], null, { [D1]: open(D1, { closed: true, label: 'Svátek' }) });
    expect(describeDayPick(closed).text).toMatch(/zavřeno.*Zvolte jiný den\.$/);
    const past = plan(ctxOf(3, 2), ['2026-10-19'], null, marksOf('2026-10-19'));
    expect(describeDayPick(past).text).toMatch(/v minulosti.*Zvolte dnešní nebo pozdější den\.$/);
    const noHours = plan(ctxOf(3, 2), [D1], null, { [D1]: { date: D1, closed: false, hours: null, lunch: null } as DayMark });
    expect(describeDayPick(noHours).text).toMatch(/Zvolte jiný den\.$/);
  });

  it('free time only: another term of the day is never overlapped', () => {
    const busy: PlannerSession = { id: 'b', date: D1, start: '08:00', end: '10:00', categoryId: 'k', capacity: 2, booked: 0, showInList: true, createdByPlanner: true, origin: 'club' };
    const p = plan(ctxOf(6, 2, [busy]), [D1], 'z', marksOf(D1));
    expect(p.parts[0]).toMatchObject({ start: 600 });
    for (const part of p.parts) expect(part.start >= 600 || part.end <= 480).toBe(true);
  });
});

describe('planDays · several days at once', () => {
  it('fills the days in order and stops the moment the need is met; later days are not taken, with the reason', () => {
    const p = plan(ctxOf(14, 0), [D1, D2, D3], 'z', marksOf(D1, D2, D3));
    expect(p.daysUsed).toEqual([D1, D2]);
    expect(p.slotsBy.get('z')).toBe(14);
    expect(p.skipped).toEqual([{ date: D3, reason: expect.stringMatching(/naplněn|splněn/i) }]);
  });

  it('holidays, past days and days without hours are refused with their own reason; the rest is taken', () => {
    const marks = { ...marksOf(D2), [D1]: open(D1, { closed: true, hours: null, lunch: null, label: 'Státní svátek' }) };
    const p = plan(ctxOf(30, 0), ['2026-10-20', D1, D2, '2026-10-24'], 'z', marks);
    expect(p.daysUsed).toEqual([D2]);
    const byDate = Object.fromEntries(p.skipped.map((s) => [s.date, s.reason]));
    expect(byDate['2026-10-20']).toMatch(/minulosti/);
    expect(byDate[D1]).toMatch(/zavřeno.*Státní svátek/);
    expect(byDate['2026-10-24']).toMatch(/ordinační/);
  });

  it('property: for many needs the picked slots never exceed the need and no run touches the break', () => {
    for (const need of [1, 2, 3, 5, 6, 7, 11, 12, 13, 17, 25, 40, 100]) {
      const p = plan(ctxOf(need, 0), [D1, D2, D3], 'z', marksOf(D1, D2, D3));
      const slots = p.parts.reduce((n, x) => n + x.slots, 0);
      expect(slots, `need ${need}`).toBeLessThanOrEqual(need);
      expect(slots, `need ${need}`).toBe(Math.min(need, 36));
      for (const part of p.parts) expect(part.end <= 720 || part.start >= 780, `need ${need}`).toBe(true);
    }
  });

  it('the inputs are what createInterval takes: date, činnost, start and whole slots', () => {
    const p = plan(ctxOf(8, 0), [D1], 'z', marksOf(D1));
    expect(p.inputs).toEqual([
      { date: D1, categoryId: 'z', start: '08:00', quantity: 6 },
      { date: D1, categoryId: 'z', start: '13:00', quantity: 2 },
    ]);
  });
});
