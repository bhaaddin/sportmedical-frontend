/*
 * R16a / R20: the bands of a mini-calendar day's liquid - one per činnost in its own colour, height = its share of the day's slots,
 * at most three bands and one merged grey "další" on top, kept in the catalogue's order like the ring's arcs.
 */
import { describe, expect, it } from 'vitest';
import { LIQUID_MAX_LAYERS, LIQUID_OTHER_COLOR, LIQUID_OTHER_ID, liquidLayers, miniCellModel } from './dayPlan';
import type { PlannerCategory, PlannerContext, PlannerSession } from './types';

const COLORS = ['#00f1dc', '#ffb124', '#7c3aed', '#ff3d6e', '#2e7d6b', '#0ea5e9'];
const categories: PlannerCategory[] = COLORS.map((color, i) => ({ id: `c${i + 1}`, name: `Činnost ${i + 1}`, iconKey: 'heart', color, slotMinutes: 30, priceCzk: null }));

/** One window per činnost on one day; činnost k has `slots[k]` slots (a window: its capacity). */
const day = (slots: number[]): PlannerSession[] =>
  slots.map((capacity, k) => ({ id: `s${k}`, date: '2026-11-18', start: `${String(8 + k).padStart(2, '0')}:00`, end: `${String(9 + k).padStart(2, '0')}:00`, categoryId: `c${k + 1}`, capacity, booked: 0 }));

const ctxOf = (sessions: PlannerSession[]): PlannerContext => ({ categories, sessions, dayBudgetMinutes: 480, today: '2026-11-10' }) as unknown as PlannerContext;

describe('liquidLayers', () => {
  it('a day without a term has no bands', () => {
    expect(liquidLayers(ctxOf([]), [])).toEqual([]);
  });

  it('one činnost: one band, the whole liquid, in the činnost colour', () => {
    const layers = liquidLayers(ctxOf(day([4])), day([4]));
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatchObject({ categoryId: 'c1', color: '#00f1dc', share: 1, slots: 4, merged: false });
  });

  it("two činnosti: two bands in their own colours, heights = their share of the slots (the owner's 2 + 2 example)", () => {
    const layers = liquidLayers(ctxOf(day([2, 2])), day([2, 2]));
    expect(layers.map((l) => l.color)).toEqual(['#00f1dc', '#ffb124']);
    expect(layers.map((l) => l.share)).toEqual([0.5, 0.5]);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])('%i činnosti: shares sum to 1, at most three own bands, the rest merged', (n) => {
    const slots = Array.from({ length: n }, (_, k) => 6 - k); // 6,5,4,...
    const sessions = day(slots);
    const layers = liquidLayers(ctxOf(sessions), sessions);
    if (n === 0) {
      expect(layers).toEqual([]);
      return;
    }
    expect(layers.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1, 10);
    const own = layers.filter((l) => !l.merged);
    expect(own.length).toBe(Math.min(n, LIQUID_MAX_LAYERS));
    expect(layers.filter((l) => l.merged)).toHaveLength(n > LIQUID_MAX_LAYERS ? 1 : 0);
    expect(layers.length).toBeLessThanOrEqual(LIQUID_MAX_LAYERS + 1);
    if (n > LIQUID_MAX_LAYERS) {
      const merged = layers[layers.length - 1]!;
      expect(merged).toMatchObject({ categoryId: LIQUID_OTHER_ID, color: LIQUID_OTHER_COLOR, merged: true });
      expect(merged.slots).toBe(slots.slice(3).reduce((a, b) => a + b, 0));
    }
    /* every own band is a činnost's activityColor, never a made-up one */
    for (const l of own) expect(COLORS).toContain(l.color);
  });

  it('keeps the LARGEST činnosti when there are more than three, drawn in the catalogue order (like the ring)', () => {
    const sessions = day([1, 9, 1, 8, 7, 1]); // c2 9, c4 8, c5 7 win
    const layers = liquidLayers(ctxOf(sessions), sessions);
    expect(layers.map((l) => l.categoryId)).toEqual(['c2', 'c4', 'c5', LIQUID_OTHER_ID]);
    expect(layers[3]!.share).toBeCloseTo(3 / 27, 10);
  });

  it('a booking counts the people booked, not the free parallel seats of its term', () => {
    const booking = { id: 'b', date: '2026-11-18', start: '08:00', end: '09:00', categoryId: 'c1', capacity: 2, booked: 1, appointments: [{ id: 'a1', patientName: 'X' }] } as unknown as PlannerSession;
    const other: PlannerSession = { id: 'w', date: '2026-11-18', start: '10:00', end: '11:00', categoryId: 'c2', capacity: 1, booked: 0 };
    const layers = liquidLayers(ctxOf([booking, other]), [booking, other]);
    expect(layers.map((l) => l.share)).toEqual([0.5, 0.5]); /* 1 person vs 1 slot, not 2 vs 1 */
  });

  it('weighs by minutes when no window has slots, and ignores an entry with no činnost', () => {
    const sessions: PlannerSession[] = [
      { id: 'a', date: '2026-11-18', start: '08:00', end: '09:00', categoryId: 'c1', capacity: 0, booked: 0 },
      { id: 'b', date: '2026-11-18', start: '09:00', end: '12:00', categoryId: 'c2', capacity: 0, booked: 0 },
      { id: 'n', date: '2026-11-18', start: '13:00', end: '14:00', categoryId: '', capacity: 0, booked: 0 },
    ];
    const layers = liquidLayers(ctxOf(sessions), sessions);
    expect(layers.map((l) => l.categoryId)).toEqual(['c1', 'c2']);
    expect(layers[0]!.share).toBeCloseTo(0.25, 10);
  });

  it('is part of the mini-calendar cell model: ring.layers, with the liquid level untouched', () => {
    const sessions = day([4, 4]);
    const model = miniCellModel(ctxOf(sessions), '2026-11-18');
    expect(model.ring!.layers.map((l) => l.categoryId)).toEqual(['c1', 'c2']);
    expect(model.ring!.liquidPercent).toBeCloseTo((120 / 480) * 100, 6);
    expect(model.ring!.arcs).toHaveLength(2);
  });
});
