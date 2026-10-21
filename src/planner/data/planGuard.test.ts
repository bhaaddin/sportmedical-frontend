/*
 * "Stop when fulfilled": for many needs, slot lengths, lanes and gestures the planned slots never exceed the need.
 * The guard is the last line: it must agree with the drag's own cap and refuse every write that goes beyond it.
 */
import { describe, expect, it } from 'vitest';
import { addPlannedInterval, makeContext, type PlannerCategory, type PlannerContext, type PlannerSession } from '../model';
import { orderFigures } from '../components/plan/orderFigures';
import { planGuard } from './planGuard';

const TODAY = '2026-10-21';
const DAYS = ['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27'];
const ctxOf = (slot: number, lanes: number, requested: number, sessions: PlannerSession[] = []): PlannerContext => {
  const cat: PlannerCategory = { id: 'z', name: 'Základní', iconKey: 'heart', color: '#00f1dc', slotMinutes: slot, parallelCapacity: lanes };
  return makeContext({ categories: [cat], demands: [{ categoryId: 'z', requested, baselinePlanned: 0 }], sessions, today: TODAY });
};
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const term = (id: string, date: string, startMin: number, slots: number, slot: number, extra: Partial<PlannerSession> = {}): PlannerSession => ({
  id, date, start: clock(startMin), end: clock(startMin + slots * slot),
  categoryId: 'z', capacity: slots, booked: 0, showInList: true, createdByPlanner: true, origin: 'club', ...extra,
});

describe('planGuard · the need can never be exceeded', () => {
  for (const slot of [15, 20, 30, 40, 60, 90]) {
    for (const lanes of [1, 2, 3]) {
      for (const requested of [1, 2, 5, 7, 12, 25]) {
        it(`${requested} players, ${slot} min, ${lanes} lane(s): a drop is allowed exactly while it stays within ${Math.ceil(requested / lanes)} slots`, () => {
          const needed = Math.ceil(requested / lanes);
          for (let planned = 0; planned <= needed; planned += Math.max(1, Math.floor(needed / 3))) {
            const sessions = planned > 0 ? [term('p', DAYS[0]!, 8 * 60, planned, slot)] : [];
            const before = ctxOf(slot, lanes, requested, sessions);
            const sample = new Set([1, 2, 3, needed - planned, needed - planned + 1, needed - planned + 2]);
            for (const k of sample) {
              if (k < 1) continue;
              const r = addPlannedInterval(before, { date: DAYS[1]!, categoryId: 'z', start: '08:00', quantity: k, allowExtra: true }, () => 'n');
              if (!r.ok) continue;
              const verdict = planGuard(before, r.sessions, { orderId: null, touched: r.merged ? [r.merged.id] : [] });
              const within = planned + k <= needed;
              expect(verdict === null, `planned ${planned} + drop ${k} (need ${needed})`).toBe(within);
              if (within) {
                const f = orderFigures({ ...before, sessions: r.sessions });
                expect(f.byId.get('z')!.planned).toBeLessThanOrEqual(requested);
              }
            }
          }
        });
      }
    }
  }

  it('a write that adds nothing beyond the need is never refused, even for an order that is already over-planned', () => {
    const before = ctxOf(30, 1, 3, [term('p', DAYS[0]!, 8 * 60, 5, 30)]);
    const moved = before.sessions.map((s) => ({ ...s, date: DAYS[2]! }));
    expect(planGuard(before, moved, { touched: ['p'] })).toBeNull();
  });

  it('"Přidat termín navíc" (allowExtra) is the one explicit way past the need', () => {
    const before = ctxOf(30, 1, 3, [term('p', DAYS[0]!, 8 * 60, 3, 30)]);
    const r = addPlannedInterval(before, { date: DAYS[1]!, categoryId: 'z', start: '08:00', quantity: 2, allowExtra: true }, () => 'n');
    expect(planGuard(before, r.sessions, { touched: ['n'] })).toMatch(/Klub objednal/);
    expect(planGuard(before, r.sessions, { touched: ['n'], allowExtra: true })).toBeNull();
  });

  it('a touched term on a past day is refused, a saved past window left alone is not', () => {
    const before = ctxOf(30, 1, 10, [term('h', '2026-10-05', 8 * 60, 2, 30, { clubBlockId: 'b' })]);
    const after = [...before.sessions, term('n', '2026-10-20', 9 * 60, 1, 30)];
    expect(planGuard(before, after, { touched: ['n'] })).toMatch(/minulosti/);
    expect(planGuard(before, before.sessions, { touched: ['h'] })).toBeNull();
  });
});
