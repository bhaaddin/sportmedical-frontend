/*
 * The one gate every write of the club draft passes (drop, "Vytvořit termín", edge pull, smart edit, "Přidat další
 * den", a month pick): the planned time can NEVER exceed what the club ordered. The drag and the pickers already stop
 * short of the need; this is the check that does not trust them, so a path that forgets to clamp is still refused.
 *
 * "Exceeds" is counted in whole slots, the way the order is counted (`pickCoverage` reports the minutes planned beyond
 * the players as spare whole slots): a činnost of 7 players on 2 lanes needs 4 slots, so the 4th slot is fine and a 5th
 * is refused. A write that does not ADD spare slots (moves, trims, edits of an already over-planned order) is never
 * refused by this check.
 */
import { orderFigures } from '../components/plan/orderFigures';
import { PAST_REFUSAL, orderCategoryIds, type PlannerContext, type PlannerSession } from '../model';
import type { CoverageActivity } from '../../components/clubs/order/coverage';

export interface GuardOptions {
  orderId?: string | null;
  baseline?: readonly CoverageActivity[];
  /** "Přidat termín navíc": the desk chose to plan beyond the players. */
  allowExtra?: boolean;
  /** Terms the write created or changed: none of them may lie in the past. */
  touched?: readonly string[];
}

const slotsOf = (ctx: PlannerContext, options: GuardOptions) => {
  const figures = orderFigures(ctx, { orderId: options.orderId ?? null, ...(options.baseline ? { baseline: options.baseline } : {}) });
  return new Map(
    figures.list.map((f) => {
      const row = figures.coverage.perActivity.find((a) => a.activityId === f.categoryId);
      return [f.categoryId, { spare: row?.spareMinutes ?? 0, name: f.name, requested: f.requested }] as const;
    }),
  );
};

/** null = the write may go on; otherwise the Czech sentence the desk reads. */
export function planGuard(before: PlannerContext, afterSessions: readonly PlannerSession[], options: GuardOptions = {}): string | null {
  const after: PlannerContext = { ...before, sessions: afterSessions };
  for (const id of options.touched ?? []) {
    const s = afterSessions.find((x) => x.id === id);
    if (!s || s.origin === 'public' || s.foreign || s.date >= before.today) continue;
    /* A saved window of the past that the write left where it was is history, not a new term in the past. */
    const was = before.sessions.find((b) => b.id === id);
    if (was && s.clubBlockId && was.date === s.date && was.start === s.start) continue;
    return PAST_REFUSAL;
  }
  if (options.allowExtra) return null;
  const was = slotsOf(before, options);
  const now = slotsOf(after, options);
  for (const id of orderCategoryIds(before)) {
    const a = now.get(id);
    const b = was.get(id);
    if (!a || !b) continue;
    if (a.spare > b.spare) {
      return `Klub objednal pro ${a.name} jen ${a.requested} osob. Víc termínů už naplánovat nelze.`;
    }
  }
  return null;
}
