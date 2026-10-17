/*
 * "Potvrdit objednávku" with players still without a slot, or with places planned beyond the players (money
 * lost): the desk decides, nothing is created or trimmed silently (constitution IV). The same rules as the
 * calendar's pick mode (`usePickOrder`), on the planner's figures:
 *
 *   shortfallOf   what is missing / spare, per činnost, with the money the spare places would earn
 *   trimOps       "Zkrátit na potřebu": every term that holds whole slots no player needs is cut back to what its
 *                 players use (`trimToNeed`) - a term nothing uses goes. Only on the desk's click.
 */
import { moreNeeded, trimToNeed } from '../../../components/booking/calendar/pickPlan';
import { minutesAsTime, type PlannerContext, type PlannerSession } from '../../model';
import type { Shortfall } from '../../../components/booking/calendar/usePickOrder';
import { coverageActivities, orderWindows, type OrderFigures } from './orderFigures';

export function shortfallOf(figures: OrderFigures, editing: boolean): Shortfall {
  const c = figures.coverage;
  const short = c.perActivity.filter((a) => a.remainingSeats > 0);
  return {
    totalSeats: c.totalSeats,
    remainingSeats: c.remainingSeats,
    perActivity: short.map((a) => ({ activityId: a.activityId, name: a.name, remainingSeats: a.remainingSeats })),
    neededMinutes: short.reduce((n, a) => n + moreNeeded(a, null).minutes, 0),
    unusedMinutes: c.unusedMinutes,
    spare: c.perActivity
      .filter((a) => a.spareSeats > 0)
      .map((a) => {
        const price = figures.byId.get(a.activityId)?.priceCzk ?? null;
        return { activityId: a.activityId, name: a.name, seats: a.spareSeats, minutes: a.spareMinutes, lostCzk: price === null ? null : price * a.spareSeats };
      }),
    spareSeats: c.spareSeats,
    editing,
  };
}

/** Something to ask about before the order is written. */
export const needsShortfallConfirm = (figures: OrderFigures): boolean => figures.coverage.remainingSeats > 0 || figures.coverage.spareSeats > 0;

export type TrimOp =
  | { kind: 'delete'; id: string }
  | { kind: 'update'; id: string; date: string; categoryId: string; start: string; end: string; capacity: number; version: string | null };

export function trimOps(ctx: PlannerContext, figures: OrderFigures, orderId?: string | null): TrimOp[] {
  const windows = orderWindows(ctx, orderId);
  const changes = trimToNeed(coverageActivities(ctx), windows);
  const bySession = new Map<string, PlannerSession>(ctx.sessions.map((s) => [s.id, s]));
  const ops: TrimOp[] = [];
  for (const change of changes) {
    const session = bySession.get(change.id);
    if (!session) continue;
    if (change.range === null) {
      ops.push({ kind: 'delete', id: change.id });
      continue;
    }
    const report = figures.coverage.windows.find((w) => w.id === change.id);
    const used = report ? report.parts.reduce((n, p) => n + p.seats, 0) : session.capacity;
    ops.push({
      kind: 'update',
      id: change.id,
      date: session.date,
      categoryId: session.categoryId,
      start: session.start,
      end: minutesAsTime(change.range.end),
      capacity: Math.max(1, used),
      version: session.version ?? null,
    });
  }
  return ops;
}
