/*
 * One definition of "planned": a club term that was never saved and lies before today can not be written (the order's
 * ranges drop past days), so it counts for nothing - not in the cards, not in the summary, not in the finish dialog.
 * The owner's bug (21. 10. 2026): 12 / 12 with green ticks next to "Nejsou naplánované žádné budoucí termíny".
 */
import { describe, expect, it } from 'vitest';
import {
  addPlannedInterval,
  countsForOrder,
  isUnsavedPast,
  makeContext,
  plannedOf,
  totals,
  validatePlacement,
  type PlannerCategory,
  type PlannerContext,
  type PlannerSession,
} from './index';

const TODAY = '2026-10-21';
const cat = (id: string, slotMinutes: number): PlannerCategory => ({ id, name: id, iconKey: 'heart', color: '#00f1dc', slotMinutes, parallelCapacity: 1 });
const term = (id: string, date: string, start: string, end: string, categoryId: string, capacity: number, extra: Partial<PlannerSession> = {}): PlannerSession => ({
  id, date, start, end, categoryId, capacity, booked: 0, showInList: true, createdByPlanner: true, origin: 'club', ...extra,
});
const ctxOf = (sessions: PlannerSession[]): PlannerContext =>
  makeContext({
    categories: [cat('z', 40), cat('k', 60)],
    demands: [{ categoryId: 'z', requested: 7, baselinePlanned: 0 }, { categoryId: 'k', requested: 5, baselinePlanned: 0 }],
    sessions,
    today: TODAY,
  });

describe('isUnsavedPast / countsForOrder', () => {
  const ctx = ctxOf([]);
  it('a new term before today is unsaved past; today and later are not', () => {
    expect(isUnsavedPast(ctx, term('a', '2026-10-20', '08:00', '09:00', 'z', 1))).toBe(true);
    expect(isUnsavedPast(ctx, term('a', '2026-10-21', '08:00', '09:00', 'z', 1))).toBe(false);
    expect(isUnsavedPast(ctx, term('a', '2026-10-22', '08:00', '09:00', 'z', 1))).toBe(false);
  });
  it('a term the server already holds (a club block behind it) is history, not unsaved', () => {
    expect(isUnsavedPast(ctx, term('a', '2026-10-01', '08:00', '09:00', 'z', 1, { clubBlockId: 'blk' }))).toBe(false);
    expect(countsForOrder(ctx, term('a', '2026-10-01', '08:00', '09:00', 'z', 1, { clubBlockId: 'blk' }))).toBe(true);
  });
  it('a term of the baseline (a saved one the model was handed) is not unsaved either', () => {
    const withBaseline = { ...ctx, baselineSessions: [{ id: 'old', categoryId: 'z', capacity: 1 }] };
    expect(isUnsavedPast(withBaseline, term('old', '2026-10-01', '08:00', '09:00', 'z', 1))).toBe(false);
  });
  it('public terms never count for the order', () => {
    expect(countsForOrder(ctx, term('p', '2026-10-25', '08:00', '09:00', 'z', 1, { origin: 'public' }))).toBe(false);
  });
});

describe('the planned figure ignores what can not be saved', () => {
  it('7 + 5 planted in the past plan nothing; the same on a future day plans everything', () => {
    const past = ctxOf([term('p1', '2026-10-19', '08:00', '12:40', 'z', 7), term('p2', '2026-10-20', '08:00', '13:00', 'k', 5)]);
    expect(plannedOf(past, 'z')).toBe(0);
    expect(plannedOf(past, 'k')).toBe(0);
    expect(totals(past)).toMatchObject({ requested: 12, planned: 0, pending: 12, percent: 0 });
    const future = ctxOf([term('p1', '2026-10-22', '08:00', '12:40', 'z', 7), term('p2', '2026-10-23', '08:00', '13:00', 'k', 5)]);
    expect(totals(future)).toMatchObject({ requested: 12, planned: 12, pending: 0, percent: 100 });
  });
  it('a saved past window still counts (it was delivered): 7 saved in the past + 0 new = 7', () => {
    const ctx = ctxOf([term('h', '2026-10-05', '08:00', '12:40', 'z', 7, { clubBlockId: 'blk' })]);
    expect(plannedOf(ctx, 'z')).toBe(7);
  });
});

describe('a past day is refused where the term is placed', () => {
  it('validatePlacement: yesterday is refused with a Czech reason, today is fine', () => {
    const ctx = ctxOf([]);
    const y = validatePlacement(ctx, { date: '2026-10-20', categoryId: 'z', start: '08:00', end: '08:40', quantity: 1 });
    expect(y.ok).toBe(false);
    expect(y.reason).toMatch(/minulosti/);
    expect(validatePlacement(ctx, { date: '2026-10-21', categoryId: 'z', start: '08:00', end: '08:40', quantity: 1 }).ok).toBe(true);
  });
  it('addPlannedInterval refuses a drop on a past day and changes nothing', () => {
    const ctx = ctxOf([]);
    const r = addPlannedInterval(ctx, { date: '2026-10-19', categoryId: 'z', start: '08:00', quantity: 3 }, () => 'n1');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/minulosti/);
    expect(r.sessions).toEqual([]);
  });
});
