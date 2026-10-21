import { describe, expect, it } from 'vitest';
import {
  makeContext,
  orderCommandModel,
  planCardModel,
  previewedCardFigures,
  selectionFromPointer,
  type PlannerCategory,
  type PlannerContext,
  type PlannerSession,
} from '../../model';
import { demoBaseline, demoCategories, demoDemands, demoSessions } from '../../data/demoFixtures';
import { orderFigures, previewFigures, previewWindow, windowOfSession } from './orderFigures';
import { planSelection, planStart, planValidation, seatsOf } from './placementPlan';

/** The owner's case (Dukla Jižní Město): 20 Komplexní (60 min) + 50 Spiro (90 min). */
const komplexni: PlannerCategory = { id: 'k', name: 'Komplexní sportovní prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 60, parallelCapacity: 1, priceCzk: 1600 };
const spiro: PlannerCategory = { id: 's', name: 'Spiroergometrické vyšetření', iconKey: 'run', color: '#0f94ff', slotMinutes: 90, parallelCapacity: 1, priceCzk: 900 };

const term = (id: string, date: string, start: string, end: string, categoryId: string, capacity: number, extra: Partial<PlannerSession> = {}): PlannerSession => ({
  id, date, start, end, categoryId, capacity, booked: 0, showInList: true, createdByPlanner: true, ...extra,
});

const ownerCtx = (sessions: PlannerSession[], extra: Partial<PlannerContext> = {}): PlannerContext =>
  makeContext({
    categories: [komplexni, spiro],
    demands: [
      { categoryId: 'k', requested: 20, baselinePlanned: 0 },
      { categoryId: 's', requested: 50, baselinePlanned: 0 },
    ],
    sessions,
    /* the file's terms are mid-November: "today" is before them (a term before today can not be saved, see the end) */
    today: '2026-11-01',
    ...extra,
  });

describe('orderFigures · the owner\'s case, counted per činnost and window by window', () => {
  const sessions = [
    term('w1', '2026-11-13', '08:00', '14:00', 's', 4), // 360 min = 4 spiro slots
    term('w2', '2026-11-13', '14:30', '15:30', 'k', 1), // a 90-min window holds ONE komplexní slot; the planner builds whole slots
  ];

  it('4 spiro slots and 1 komplexní slot cover 4 + 1 players - never a pool of minutes', () => {
    const f = orderFigures(ownerCtx(sessions));
    const k = f.byId.get('k')!;
    const s = f.byId.get('s')!;
    expect(k).toMatchObject({ requested: 20, planned: 1, remaining: 19, remainingSlots: 19, percent: 5, slotMinutes: 60 });
    expect(s).toMatchObject({ requested: 50, planned: 4, remaining: 46, remainingSlots: 46, percent: 8, slotMinutes: 90 });
    expect(f).toMatchObject({ requested: 70, planned: 5, remaining: 65, percent: 7 });
    // 19 × 60 + 46 × 90 minutes of slots still missing: 1140 + 4140 = 5280 min = 88 h
    expect(f.remainingMinutes).toBe(19 * 60 + 46 * 90);
    expect(f.coverage.perActivity.map((a) => [a.activityId, a.coveredSlots, a.coveredSeats])).toEqual([['k', 1, 1], ['s', 4, 4]]);
  });

  it('a window counts only the whole slots of ITS činnost: komplexní minutes never leak into spiro', () => {
    const f = orderFigures(ownerCtx([term('only-k', '2026-11-13', '08:00', '14:00', 'k', 6)]));
    expect(f.byId.get('k')!.planned).toBe(6);
    expect(f.byId.get('s')!.planned).toBe(0);
  });

  it('places beyond the players are reported as spare, with the money they would earn', () => {
    const f = orderFigures(ownerCtx([term('big', '2026-11-13', '08:00', '20:00', 'k', 12), term('big2', '2026-11-14', '08:00', '16:00', 'k', 8)]));
    // 20 players need 20 slots; 12 + 8 = 20 -> exactly covered, nothing spare
    expect(f.byId.get('k')).toMatchObject({ planned: 20, remaining: 0, done: true, spareSeats: 0 });
    const over = orderFigures(ownerCtx([term('a', '2026-11-13', '08:00', '20:00', 'k', 12), term('b', '2026-11-14', '08:00', '17:00', 'k', 9)]));
    expect(over.byId.get('k')).toMatchObject({ planned: 20, remaining: 0, spareSeats: 1, spareMinutes: 60 });
    expect(over.spareSeats).toBe(1);
    expect(over.lostCzk).toBe(1600);
  });

  it('a parallel capacity of 2 halves the slots: 20 players need 10 slots, a 10-slot term covers all 20', () => {
    const two = { ...komplexni, parallelCapacity: 2 };
    const ctx = ownerCtx([term('p', '2026-11-13', '08:00', '18:00', 'k', 20)], { categories: [two, spiro] });
    const f = orderFigures(ctx);
    expect(f.byId.get('k')).toMatchObject({ planned: 20, remaining: 0, done: true, lanes: 2 });
    expect(windowOfSession(sessions[1]!, 60, 2)).toMatchObject({ range: { start: 14 * 60 + 30, end: 14 * 60 + 30 + 60 } });
    const none = orderFigures(ownerCtx([], { categories: [two, spiro] }));
    expect(none.byId.get('k')).toMatchObject({ remainingSlots: 10, remainingMinutes: 600 });
  });

  it('only terms of THIS order count when the terms carry an order id', () => {
    const mine = { ...sessions[0]!, orderId: 'o1' };
    const foreign = { ...sessions[1]!, orderId: 'other' };
    const f = orderFigures(ownerCtx([mine, foreign]), { orderId: 'o1' });
    expect(f.byId.get('s')!.planned).toBe(4);
    expect(f.byId.get('k')!.planned).toBe(0);
  });

  it('the live preview counts the dragged window in: +3 komplexní', () => {
    const ctx = ownerCtx(sessions);
    const before = orderFigures(ctx);
    const p = previewFigures(ctx, before, previewWindow('preview', '2026-11-16', 'k', 8 * 60, 3, 60));
    expect(p.added).toBe(3);
    expect(p.after.byId.get('k')).toMatchObject({ planned: 4, remaining: 16 });
    expect(p.after.planned).toBe(before.planned + 3);
    expect(p.willComplete).toBe(false);
    const rest = previewFigures(ctx, before, previewWindow('preview', '2026-11-16', 'k', 8 * 60, 19, 60));
    expect(rest.willComplete).toBe(true);
    expect(rest.added).toBe(19);
  });
});

describe('orderFigures · agrees with the prototype model on the sample order (lanes = 1)', () => {
  const demo = makeContext({
    categories: demoCategories,
    demands: demoDemands,
    baselineSessions: demoBaseline,
    sessions: demoSessions,
    today: '2026-11-10',
  });

  it('252 / 378, the same per card, the same command numbers', () => {
    const f = orderFigures(demo);
    const c = orderCommandModel(demo);
    expect([f.planned, f.requested, f.percent, f.remaining]).toEqual([c.planned, c.requested, c.percent, 126]);
    for (const d of demoDemands) {
      const card = planCardModel(demo, d.categoryId, '2026-11-16', null);
      const mine = f.byId.get(d.categoryId)!;
      expect([mine.planned, mine.requested, mine.remaining, mine.percent]).toEqual([card.planned, card.requested, card.remaining, card.percent]);
      expect(mine.slotMinutes).toBe(card.slotMinutes);
    }
  });

  it('the preview of +2 equals previewedCardFigures', () => {
    const before = orderFigures(demo);
    const p = previewFigures(demo, before, previewWindow('preview', '2026-11-25', 'physio', 9 * 60, 2, 30));
    const model = previewedCardFigures(demo, 'physio', 2);
    const mine = p.after.byId.get('physio')!;
    expect(p.added).toBe(2);
    expect([mine.planned, mine.percent, p.willComplete]).toEqual([model.after, model.percent, model.willComplete]);
  });
});

describe('planSelection · the drag, whole slots of the armed činnost', () => {
  const ctx = ownerCtx([term('w1', '2026-11-13', '08:00', '14:00', 's', 4)], { today: '2026-11-08' });
  const figures = orderFigures(ctx);
  const weekStart = '2026-11-09';
  const at = (minute: number) => ({ x: 0.5, y: (minute - 420) / 720 });

  it('nothing armed, or a complete činnost, does not start a drag', () => {
    expect(planStart(ctx, figures, null, at(600))).toEqual({ kind: 'noSelection' });
    const full = orderFigures(ownerCtx([term('all', '2026-11-13', '07:00', '19:00', 'k', 12), term('all2', '2026-11-14', '07:00', '15:00', 'k', 8)]));
    expect(planStart(ctx, full, 'k', at(600))).toEqual({ kind: 'complete', categoryId: 'k' });
    expect(planStart(ctx, figures, 'k', at(600))).toEqual({ kind: 'start', drag: { day: 3, startMinutes: 600 } });
  });

  it('dragging down 3 slots of komplexní gives 3 slots = 180 min; dragging up works too', () => {
    const start = planStart(ctx, figures, 'k', at(600));
    if (start.kind !== 'start') throw new Error('expected a drag');
    const down = planSelection(ctx, figures, start.drag, 'k', weekStart, at(600 + 170))!;
    expect(down).toMatchObject({ date: '2026-11-12', start: '10:00', end: '13:00', quantity: 3, validation: { ok: true } });
    const up = planSelection(ctx, figures, start.drag, 'k', weekStart, at(600 - 100))!;
    expect(up).toMatchObject({ start: '08:00', end: '10:00', quantity: 2 });
  });

  it('is capped by the slots still missing and says so', () => {
    const near = orderFigures(ownerCtx([term('k19', '2026-11-12', '07:00', '19:00', 'k', 12), term('k19b', '2026-11-13', '07:00', '14:00', 'k', 7)]));
    expect(near.byId.get('k')!.remainingSlots).toBe(1);
    const drag = { day: 0, startMinutes: 420 };
    const p = planSelection(ctx, near, drag, 'k', weekStart, at(900))!;
    expect(p.quantity).toBe(1);
    expect(p).toMatchObject({ isLimit: true, stoppedAtLimit: true, validation: { ok: true } });
  });

  it('refuses an overlap with another term, a closed day and a drop beyond the need', () => {
    const drag = { day: 4, startMinutes: 8 * 60 };
    const over = planSelection(ctx, figures, drag, 's', weekStart, at(8 * 60 + 100))!;
    expect(over.validation).toEqual({ ok: false, reason: 'Čas se překrývá s již vytvořeným termínem.' });
    const free = { day: 0, startMinutes: 8 * 60 };
    const closed = planSelection(ctx, figures, free, 'k', weekStart, at(9 * 60), { '2026-11-09': { date: '2026-11-09', closed: true, label: 'Státní svátek' } })!;
    expect(closed.validation.reason).toBe('V tento den je zavřeno (Státní svátek).');
    expect(planValidation(ctx, figures, { date: '2026-11-20', categoryId: 'k', start: '08:00', end: '09:00', quantity: 25 })).toEqual({
      ok: false,
      reason: 'Zbývá pouze 20 osob. Zkraťte časový úsek.',
    });
  });

  it('with lanes = 1 the geometry is the model\'s selectionFromPointer', () => {
    const demo = makeContext({ categories: demoCategories, demands: demoDemands, baselineSessions: demoBaseline, sessions: demoSessions, today: '2026-11-10' });
    const df = orderFigures(demo);
    const drag = { day: 2, startMinutes: 9 * 60 };
    for (const minute of [9 * 60 + 5, 10 * 60, 11 * 60 + 40, 8 * 60, 7 * 60 + 20]) {
      const mine = planSelection(demo, df, drag, 'physio', '2026-11-23', at(minute));
      const model = selectionFromPointer(demo, drag, 'physio', '2026-11-23', at(minute));
      expect(mine && [mine.start, mine.end, mine.quantity, mine.col, mine.isLimit]).toEqual(model && [model.start, model.end, model.quantity, model.col, model.isLimit]);
    }
  });

  it('a slot of a 2-lane činnost covers 2 players', () => {
    const two = { ...komplexni, parallelCapacity: 2 };
    const f = orderFigures(ownerCtx([], { categories: [two, spiro] }));
    expect(seatsOf(f.byId.get('k')!, 3)).toBe(6);
    expect(seatsOf({ ...f.byId.get('k')!, remaining: 5 }, 3)).toBe(5);
  });
});

describe('one definition of planned: what can not be saved is not counted (owner bug 21. 10. 2026)', () => {
  const zk = (sessions: PlannerSession[]) =>
    makeContext({
      categories: [
        { id: 'z', name: 'Základní', iconKey: 'heart', color: '#00f1dc', slotMinutes: 40, parallelCapacity: 1 },
        { id: 'k', name: 'Komplexní', iconKey: 'heart', color: '#00f1dc', slotMinutes: 60, parallelCapacity: 1 },
      ],
      demands: [{ categoryId: 'z', requested: 7, baselinePlanned: 0 }, { categoryId: 'k', requested: 5, baselinePlanned: 0 }],
      sessions,
      today: '2026-10-21',
    });

  it('new terms on past days plan nothing - 0 / 12, not 12 / 12', () => {
    const f = orderFigures(zk([term('p1', '2026-10-19', '08:00', '12:40', 'z', 7), term('p2', '2026-10-20', '08:00', '13:00', 'k', 5)]));
    expect(f).toMatchObject({ requested: 12, planned: 0, remaining: 12, percent: 0, complete: false, termCount: 0, savableTerms: 0 });
  });

  it('the same terms on future days plan everything and are all savable', () => {
    const f = orderFigures(zk([term('p1', '2026-10-22', '08:00', '12:40', 'z', 7), term('p2', '2026-10-23', '08:00', '13:00', 'k', 5)]));
    expect(f).toMatchObject({ requested: 12, planned: 12, remaining: 0, percent: 100, complete: true, termCount: 2, savableTerms: 2 });
  });

  it('a saved window in the past still counts (history), but there is nothing left to save', () => {
    const f = orderFigures(zk([term('h1', '2026-10-05', '08:00', '12:40', 'z', 7, { clubBlockId: 'b1' }), term('h2', '2026-10-06', '08:00', '13:00', 'k', 5, { clubBlockId: 'b2' })]));
    expect(f).toMatchObject({ planned: 12, complete: true, termCount: 2, savableTerms: 0 });
  });

  it('a mix: past new + future new -> only the future one counts; the past one is reported as ignored', () => {
    const f = orderFigures(zk([term('p1', '2026-10-19', '08:00', '12:40', 'z', 7), term('p2', '2026-10-23', '08:00', '10:40', 'z', 4)]));
    expect(f.byId.get('z')).toMatchObject({ planned: 4, remaining: 3 });
    expect(f).toMatchObject({ savableTerms: 1, pastIgnored: 1 });
  });

  it('the drag preview on a past day is refused with the reason, whatever the činnost needs', () => {
    const ctx = zk([]);
    const figures = orderFigures(ctx);
    const v = planValidation(ctx, figures, { date: '2026-10-20', categoryId: 'z', start: '08:00', end: '08:40', quantity: 1 });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/minulosti/);
    expect(planValidation(ctx, figures, { date: '2026-10-21', categoryId: 'z', start: '08:00', end: '08:40', quantity: 1 }).ok).toBe(true);
  });
});
