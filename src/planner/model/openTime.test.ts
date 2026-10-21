/*
 * The lunch break is never consumed (owner, 21. 10. 2026: a club block of "9 slotů 08:30-13:00" drawn across the break).
 * Slots are counted only in the clinic's open pieces; a block that crosses the break is two terms.
 */
import { describe, expect, it } from 'vitest';
import {
  addPlannedInterval,
  createFromDialog,
  layoutSlots,
  makeContext,
  openPieces,
  openTimeBlock,
  plannedOf,
  slotsBefore,
  slotsFrom,
  startBefore,
  smartEditInitialDraft,
  smartEditValidation,
  validateTermExpansion,
  validateTermMove,
  validatePlacement,
  type DayMark,
  type PlannerCategory,
  type PlannerContext,
  type PlannerSession,
} from './index';

const TODAY = '2026-10-21';
const DAY = '2026-10-22';
const WINDOW = { startMinutes: 7 * 60, endMinutes: 19 * 60 };
const mark = (extra: Partial<DayMark> = {}): DayMark => ({ date: DAY, closed: false, hours: { from: '08:00', to: '17:00' }, lunch: { from: '12:00', to: '13:00' }, ...extra });
const cat: PlannerCategory = { id: 'z', name: 'Základní sportovní prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, parallelCapacity: 1 };
const ctxOf = (sessions: PlannerSession[] = [], marks: Record<string, DayMark> = { [DAY]: mark() }, requested = 20): PlannerContext =>
  makeContext({ categories: [cat], demands: [{ categoryId: 'z', requested, baselinePlanned: 0 }], sessions, today: TODAY, dayMarks: marks });
const ids = () => { let n = 0; return () => `n${++n}`; };

describe('openPieces', () => {
  it('hours minus the lunch break', () => {
    expect(openPieces(WINDOW, mark())).toEqual([{ start: 480, end: 720 }, { start: 780, end: 1020 }]);
  });
  it('no mark = the whole planning window; no lunch = one piece; closed = nothing', () => {
    expect(openPieces(WINDOW, undefined)).toEqual([{ start: 420, end: 1140 }]);
    expect(openPieces(WINDOW, mark({ lunch: null }))).toEqual([{ start: 480, end: 1020 }]);
    expect(openPieces(WINDOW, mark({ closed: true }))).toEqual([]);
  });
  it('a break outside the hours does not split anything', () => {
    expect(openPieces(WINDOW, mark({ lunch: { from: '17:30', to: '18:00' } }))).toEqual([{ start: 480, end: 1020 }]);
  });
});

describe('layoutSlots · slots only outside the break', () => {
  const pieces = openPieces(WINDOW, mark());
  it('9 slots of 30 min from 08:30 are 7 before the break and 2 after it - never 08:30-13:00', () => {
    const { parts, placed } = layoutSlots(pieces, 8 * 60 + 30, 9, 30);
    expect(placed).toBe(9);
    expect(parts).toEqual([{ start: 510, end: 720, slots: 7 }, { start: 780, end: 840, slots: 2 }]);
  });
  it('a slot that would straddle the break moves behind it', () => {
    const { parts } = layoutSlots(pieces, 11 * 60 + 40, 2, 30); // 11:40-12:10 would cross 12:00
    expect(parts).toEqual([{ start: 780, end: 840, slots: 2 }]);
  });
  it('starting inside the break starts after it; running out of the day places fewer', () => {
    expect(layoutSlots(pieces, 12 * 60 + 15, 1, 30).parts).toEqual([{ start: 780, end: 810, slots: 1 }]);
    const r = layoutSlots(pieces, 16 * 60, 5, 30);
    expect(r.placed).toBe(2);
  });
  it('capacity counters agree with the layout', () => {
    expect(slotsFrom(pieces, 480, 30)).toBe(8 + 8);
    expect(slotsBefore(pieces, 17 * 60, 30)).toBe(16);
    expect(slotsBefore(pieces, 13 * 60 + 15, 30)).toBe(8);
  });
  it('startBefore lays backwards and skips the break', () => {
    expect(startBefore(pieces, 14 * 60, 4, 30)).toEqual({ start: 11 * 60, placed: 4 }); // 13:00-14:00 (2 slots) + 11:00-12:00 (2 slots)
  });
});

describe('openTimeBlock', () => {
  const ctx = ctxOf();
  it('inside a piece: fine; across the break: names the break; outside the hours: names the hours', () => {
    expect(openTimeBlock(ctx, DAY, 9 * 60, 11 * 60)).toBeNull();
    expect(openTimeBlock(ctx, DAY, 11 * 60, 13 * 60 + 30)).toMatch(/polední pauzy 12:00–13:00/);
    expect(openTimeBlock(ctx, DAY, 16 * 60, 18 * 60)).toMatch(/ordinační dobu 08:00–17:00/);
  });
  it('a closed day and an unknown day', () => {
    expect(openTimeBlock(ctxOf([], { [DAY]: mark({ closed: true, label: 'Státní svátek' }) }), DAY, 600, 660)).toMatch(/zavřeno \(Státní svátek\)/);
    expect(openTimeBlock(ctx, '2026-10-30', 12 * 60, 13 * 60)).toBeNull();
  });
});

describe('a drop across the break is two terms', () => {
  it('addPlannedInterval: 9 slots from 08:30 -> 7 + 2 slots, the pause stays free, 9 are planned', () => {
    const ctx = ctxOf();
    const r = addPlannedInterval(ctx, { date: DAY, categoryId: 'z', start: '08:30', quantity: 9 }, ids());
    expect(r.ok).toBe(true);
    const terms = r.sessions.slice().sort((a, b) => a.start.localeCompare(b.start));
    expect(terms.map((t) => [t.start, t.end, t.capacity])).toEqual([['08:30', '12:00', 7], ['13:00', '14:00', 2]]);
    expect(plannedOf({ ...ctx, sessions: r.sessions }, 'z')).toBe(9);
    // no term touches 12:00-13:00
    expect(terms.some((t) => t.start < '13:00' && t.end > '12:00')).toBe(false);
  });
  it('slots that do not fit into the rest of the day are refused, nothing is changed', () => {
    const ctx = ctxOf();
    const r = addPlannedInterval(ctx, { date: DAY, categoryId: 'z', start: '16:00', quantity: 5 }, ids());
    expect(r.ok).toBe(false);
    expect(r.sessions).toEqual([]);
  });
  it('a following drop right after the break merges with the second part only', () => {
    const ctx = ctxOf([{ id: 'p2', date: DAY, start: '13:00', end: '14:00', categoryId: 'z', capacity: 2, booked: 0, showInList: true, createdByPlanner: true, origin: 'club' }]);
    const r = addPlannedInterval(ctx, { date: DAY, categoryId: 'z', start: '14:00', quantity: 2 }, ids());
    expect(r.ok).toBe(true);
    expect(r.sessions.map((t) => [t.start, t.end, t.capacity])).toEqual([['13:00', '15:00', 4]]);
  });
  it('without day marks the behaviour is the old one: one block', () => {
    const ctx = makeContext({ categories: [cat], demands: [{ categoryId: 'z', requested: 20, baselinePlanned: 0 }], sessions: [], today: TODAY });
    const r = addPlannedInterval(ctx, { date: DAY, categoryId: 'z', start: '08:30', quantity: 9 }, ids());
    expect(r.sessions.map((t) => [t.start, t.end, t.capacity])).toEqual([['08:30', '13:00', 9]]);
  });
});

describe('validation names the break', () => {
  const ctx = ctxOf();
  it('validatePlacement refuses a term that touches the break or the hours', () => {
    expect(validatePlacement(ctx, { date: DAY, categoryId: 'z', start: '11:30', end: '12:30', quantity: 2 })).toMatchObject({ ok: false });
    expect(validatePlacement(ctx, { date: DAY, categoryId: 'z', start: '11:30', end: '12:30', quantity: 2 }).reason).toMatch(/pauzy/);
    expect(validatePlacement(ctx, { date: DAY, categoryId: 'z', start: '16:30', end: '17:30', quantity: 2 }).reason).toMatch(/ordinační dobu/);
    expect(validatePlacement(ctx, { date: DAY, categoryId: 'z', start: '09:00', end: '10:00', quantity: 2 }).ok).toBe(true);
  });
  it('the "Vytvořit termín" dialog cannot carve the break out either', () => {
    const r = createFromDialog(ctx, { date: DAY, categoryId: 'z', start: '11:00', end: '13:30' }, ids());
    expect(r.ok).toBe(false);
  });
});

describe('moving, pulling and editing a club term keeps the break free and stays out of the past', () => {
  const part = (id: string, start: string, end: string, capacity: number, date = DAY): PlannerSession => ({ id, date, start, end, categoryId: 'z', capacity, booked: 0, showInList: true, createdByPlanner: true, origin: 'club' });

  it('moving a term onto the break or into the past is refused with the reason', () => {
    const t = part('a', '09:00', '10:00', 2);
    const ctx = ctxOf([t]);
    expect(validateTermMove(ctx, t, DAY, '11:30', '12:30', true).reason).toMatch(/pauzy/);
    expect(validateTermMove(ctx, t, '2026-10-20', '09:00', '10:00', true).reason).toMatch(/minulosti/);
    expect(validateTermMove(ctx, t, DAY, '13:00', '14:00', true).ok).toBe(true);
  });

  it('pulling the bottom edge over the break is refused; pulling inside the morning is fine', () => {
    const t = part('a', '10:00', '11:30', 3);
    const ctx = ctxOf([t]);
    expect(validateTermExpansion(ctx, t, 'bottom', 2, '10:00', '12:30').reason).toMatch(/pauzy/);
    expect(validateTermExpansion(ctx, t, 'bottom', 1, '10:00', '12:00').ok).toBe(true);
  });

  it('the smart editor cannot stretch a term over the break', () => {
    const t = part('a', '10:00', '11:30', 3);
    const ctx = ctxOf([t]);
    const draft = { ...smartEditInitialDraft(t), dirty: true, end: '13:00', capacity: 6 };
    const v = smartEditValidation(ctx, t, draft);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/pauzy/);
    expect(smartEditValidation(ctx, t, { ...draft, end: '12:00', capacity: 4 }).ok).toBe(true);
  });
});
