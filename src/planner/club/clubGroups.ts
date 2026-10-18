/*
 * The orders of ONE club as the club's planner screen reads them (pure, no React).
 *
 * A club has several orders; the ones that belong together (a root and its addenda) are ONE group - the same fold the
 * old club page used (`groupOrders`). The stage plans one group at a time: `defaultGroup` says which one opens first
 * (the live group with the nearest upcoming window, else the most recent), `groupLabel` how it reads in the switcher.
 *
 * What the stage can DO with the selected group: the planner edits ONE order - the root of the group - and only while
 * it is Confirmed (an order the club has not answered yet, one still waiting for the desk's processing, or a finished
 * one has nothing to drag; its figures are on the order overview and its own panel is one click away). The windows of
 * the group's addenda and of every other group stay on the board, read-only, in the club's colour.
 */
import type { ClubOrderView } from '../../api/clubOrders';
import { ORDER_STATUS_LABEL } from '../../api/clubOrders';
import { orderCode } from '../../components/clubs/order/orderFormat';
import { isLiveOrder, orderWindows, windowIsUpcoming } from '../../components/clubs/orders/orderWindows';
import { formatPlayersTotal } from '../../components/clubs/panel/seats';
import { groupOrders, type OrderGroup } from '../../components/clubs/detail/orderGroups';

export interface ClubGroup extends OrderGroup {
  /** The root's id: what `?order=` carries. */
  id: string;
  /** Root and addenda. */
  orders: ClubOrderView[];
  /** "KO-1A2B3C4D". */
  code: string;
  /** The planner can edit it now (the root is Confirmed). */
  editable: boolean;
  /** First / last live window date of the whole group (yyyy-MM-dd), null without a window. */
  firstDate: string | null;
  lastDate: string | null;
  /** The first live window that is not over, null when there is none. */
  nextDate: string | null;
  /** The group's club-block ids (the windows of the root alone are `rootBlockIds`). */
  blockIds: string[];
  rootBlockIds: string[];
  /** Newest `createdAtUtc` of its orders. */
  createdAt: string;
}

export function clubGroups(orders: readonly ClubOrderView[], today: string): ClubGroup[] {
  return groupOrders(orders).map((g) => {
    const all = [g.root, ...g.addenda];
    const windows = all.flatMap((o) => orderWindows(o));
    const from = windows.map((w) => w.fromDate).filter((d) => d !== '').sort();
    const to = windows.map((w) => w.toDate || w.fromDate).filter((d) => d !== '').sort();
    const next = windows.filter((w) => windowIsUpcoming(w, today)).map((w) => w.fromDate).sort()[0] ?? null;
    return {
      ...g,
      id: g.root.id,
      orders: all,
      code: orderCode(g.root.id),
      editable: g.root.status === 'Confirmed',
      firstDate: from[0] ?? null,
      lastDate: to[to.length - 1] ?? null,
      nextDate: next,
      blockIds: windows.map((w) => w.id),
      rootBlockIds: orderWindows(g.root).map((w) => w.id),
      createdAt: all.map((o) => o.createdAtUtc || '').sort().reverse()[0] ?? '',
    };
  });
}

/**
 * The group the stage opens on: of the live groups (Confirmed / Requested) that still have a window ahead, the one whose
 * next window is nearest; none of those - the group created last. Null for a club without a (non-cancelled) order.
 */
export function defaultGroup(groups: readonly ClubGroup[]): ClubGroup | null {
  const ahead = groups
    .filter((g) => isLiveOrder(g.root) && g.nextDate !== null)
    .sort((a, b) => (a.nextDate as string).localeCompare(b.nextDate as string) || a.id.localeCompare(b.id));
  if (ahead[0] !== undefined) return ahead[0];
  return [...groups].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0] ?? null;
}

/** The group `?order=` names, else the default one. */
export function selectedGroup(groups: readonly ClubGroup[], wantedId: string | null): ClubGroup | null {
  return (wantedId !== null ? groups.find((g) => g.id === wantedId || g.orders.some((o) => o.id === wantedId)) : undefined) ?? defaultGroup(groups);
}

/** The services of a group, once each ("Sportovní lékařské prohlídky · Kondiční"). */
export const groupServices = (g: Pick<ClubGroup, 'orders'>): string =>
  [...new Set(g.orders.map((o) => o.serviceName || 'Služba nevybrána'))].join(' · ');

/** Players of the whole group ("18 hráčů"). */
export const groupPlayers = (g: Pick<ClubGroup, 'orders'>): string => formatPlayersTotal(g.orders.flatMap((o) => o.activitySeats));

/** One line of the switcher / the overview: code, služba(s), players, status. */
export const groupLine = (g: ClubGroup): string =>
  `${g.code} · ${groupServices(g)} · ${groupPlayers(g)} · ${ORDER_STATUS_LABEL[g.root.status]}`;

/** The day the board opens on for a club screen: the group's first window ahead (else its first), else the club's. */
export function openingDate(group: ClubGroup | null, groups: readonly ClubGroup[], today: string): string {
  if (group !== null) return group.nextDate ?? group.firstDate ?? today;
  const dates = groups.map((g) => g.nextDate).filter((d): d is string => d !== null).sort();
  return dates[0] ?? today;
}
