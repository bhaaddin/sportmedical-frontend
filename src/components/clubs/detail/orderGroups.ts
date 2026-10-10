/*
 * Etapa 12: the club page shows ONE card per group (constitution III: one order is one thing). Pure helpers: the
 * non-cancelled orders of a club folded by `groupId` into a root with its addenda, in the page's order, and the live
 * roots that "Sloučit do jedné objednávky" can offer.
 */
import type { ClubOrderView } from '../../../api/clubOrders';
import { isLiveOrder, orderWindows } from '../orders/orderWindows';

export interface OrderGroup {
  /** The order the card stands on: the root, or - when the root is not among the shown orders - the earliest addendum. */
  root: ClubOrderView;
  /** The other shown orders of the group, oldest first. */
  addenda: ClubOrderView[];
}

const RANK: Record<string, number> = { Confirmed: 0, Requested: 1, Invited: 2, Completed: 3 };

const firstDate = (orders: readonly ClubOrderView[]): string =>
  orders.flatMap((o) => orderWindows(o).map((w) => w.fromDate)).sort()[0] ?? '9999-12-31';

const byCreated = (a: ClubOrderView, b: ClubOrderView): number => (a.createdAtUtc || '').localeCompare(b.createdAtUtc || '') || a.id.localeCompare(b.id);

/**
 * The cards of the club page: cancelled orders are left out (they have their own compact list), the rest fold by
 * `groupId`. Confirmed first, then Requested, Invited, Completed; within a status by the group's earliest window.
 */
export function groupOrders(orders: readonly ClubOrderView[]): OrderGroup[] {
  const byGroup = new Map<string, ClubOrderView[]>();
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const key = o.groupId || o.parentOrderId || o.id;
    byGroup.set(key, [...(byGroup.get(key) ?? []), o]);
  }
  const groups: OrderGroup[] = [];
  for (const members of byGroup.values()) {
    const sorted = [...members].sort(byCreated);
    const root = sorted.find((o) => o.parentOrderId === null) ?? sorted[0];
    groups.push({ root, addenda: sorted.filter((o) => o.id !== root.id) });
  }
  return groups.sort((a, b) =>
    (RANK[a.root.status] ?? 9) - (RANK[b.root.status] ?? 9) || firstDate([a.root, ...a.addenda]).localeCompare(firstDate([b.root, ...b.addenda])),
  );
}

/** The roots that can be merged: Requested or Confirmed, standing at the head of their group. Oldest first. */
export const mergeableRoots = (groups: readonly OrderGroup[]): ClubOrderView[] =>
  groups.map((g) => g.root).filter((o) => o.parentOrderId === null && isLiveOrder(o)).sort(byCreated);

/** The default "Hlavní objednávka": the oldest Confirmed root, or the oldest live one. */
export const defaultMainOrder = (roots: readonly ClubOrderView[]): ClubOrderView | undefined =>
  [...roots].sort(byCreated).find((o) => o.status === 'Confirmed') ?? [...roots].sort(byCreated)[0];
