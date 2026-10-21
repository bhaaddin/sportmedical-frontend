/*
 * The drag preview counts slots only outside the lunch break, exactly the way the drop will lay them out
 * (owner, 21. 10. 2026: "9 slotů 08:30-13:00" drawn over the lunch).
 */
import { describe, expect, it } from 'vitest';
import { addPlannedInterval, makeContext, type DayMark, type PlannerCategory, type PlannerContext, type PlannerSession } from '../../model';
import { orderFigures } from './orderFigures';
import { planSelection, planStart } from './placementPlan';

const DAY = '2026-10-22'; // Thursday
const WEEK = '2026-10-19';
const mark: DayMark = { date: DAY, closed: false, hours: { from: '08:00', to: '17:00' }, lunch: { from: '12:00', to: '13:00' } };
const cat: PlannerCategory = { id: 'z', name: 'Základní sportovní prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, parallelCapacity: 1 };
const ctxOf = (sessions: PlannerSession[] = [], requested = 40): PlannerContext =>
  makeContext({ categories: [cat], demands: [{ categoryId: 'z', requested, baselinePlanned: 0 }], sessions, today: '2026-10-21', dayMarks: { [DAY]: mark } });
const at = (minute: number) => ({ x: (3 + 0.5) / 7, y: (minute - 420) / 720 });

describe('planSelection with a lunch break', () => {
  const ctx = ctxOf();
  const figures = orderFigures(ctx);
  const marks = { [DAY]: mark };
  const drag = (m: number) => {
    const s = planStart(ctx, figures, 'z', at(m));
    if (s.kind !== 'start') throw new Error('expected a drag');
    return s.drag;
  };

  it('dragging from 08:30 to 13:30 is 7 + 1 slots, not the 10 that 5 raw hours would suggest', () => {
    const p = planSelection(ctx, figures, drag(8 * 60 + 30), 'z', WEEK, at(13 * 60 + 30), marks)!;
    expect(p.quantity).toBe(8);
    expect(p.parts).toEqual([{ start: 510, end: 720, slots: 7 }, { start: 780, end: 810, slots: 1 }]);
    expect(p).toMatchObject({ start: '08:30', end: '13:30', validation: { ok: true } });
  });

  it('a drag that stays before the break is one part, as ever', () => {
    const p = planSelection(ctx, figures, drag(9 * 60), 'z', WEEK, at(10 * 60 + 40), marks)!;
    expect(p.quantity).toBe(4);
    expect(p.parts).toEqual([{ start: 540, end: 660, slots: 4 }]);
  });

  it('dragging upwards from after the break skips the break as well', () => {
    const p = planSelection(ctx, figures, drag(14 * 60), 'z', WEEK, at(11 * 60), marks)!;
    // 13:00-14:00 = 2 slots, 11:00-12:00 = 2 slots; the block is laid down again from its start
    expect(p.quantity).toBe(4);
    expect(p.parts).toEqual([{ start: 660, end: 720, slots: 2 }, { start: 780, end: 840, slots: 2 }]);
  });

  it('is capped by the end of the open time and says so', () => {
    const p = planSelection(ctx, figures, drag(16 * 60), 'z', WEEK, at(18 * 60), marks)!;
    expect(p.quantity).toBe(2); // 16:00-17:00, the clinic closes at 17:00
    expect(p.blockedByEndOfDay).toBe(true);
  });

  it('never exceeds what is still needed, break or not', () => {
    const small = ctxOf([], 5);
    const f = orderFigures(small);
    const s = planStart(small, f, 'z', at(10 * 60));
    if (s.kind !== 'start') throw new Error('expected a drag');
    const p = planSelection(small, f, s.drag, 'z', WEEK, at(15 * 60), marks)!;
    expect(p.quantity).toBe(5);
    expect(p.parts).toEqual([{ start: 600, end: 720, slots: 4 }, { start: 780, end: 810, slots: 1 }]);
    expect(p.isLimit).toBe(true);
  });

  it('what the preview shows is what the drop writes: same parts, same figures', () => {
    const p = planSelection(ctx, figures, drag(8 * 60 + 30), 'z', WEEK, at(13 * 60 + 30), marks)!;
    const r = addPlannedInterval(ctx, { date: p.date, categoryId: 'z', start: p.start, quantity: p.quantity }, () => 'n');
    const written = r.sessions.slice().sort((a, b) => a.start.localeCompare(b.start)).map((t) => [timeOf(t.start), timeOf(t.end), t.capacity]);
    expect(written).toEqual(p.parts!.map((x) => [x.start, x.end, x.slots]));
    const after = orderFigures({ ...ctx, sessions: r.sessions });
    expect(after.byId.get('z')!.planned).toBe(p.quantity);
  });
});

const timeOf = (t: string): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
