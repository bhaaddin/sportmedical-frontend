/*
 * R14a: ONE timeline for the order GROUP (the root order and every addendum), pure and tested.
 *
 * The server records what happens to an order as lines of text on that order (`order.history`): the status, the
 * addenda (on the root AND on the addendum), the seats, the windows, the messages to the club, the invoices. This
 * module merges the lines of every order of the group, newest first, gives each one the kinds it belongs to (a
 * line may belong to several: "Objednávka upravena: místa (...); časové bloky (...)" is about players AND windows)
 * and a link to the thing it is about (an addendum -> its order, an invoice -> /billing).
 *
 * The kinds are read from the wording the backend writes (docs/contracts/stage5b-contract.md names the lines); a
 * line this module does not know is "Ostatní", never dropped, so a new wording on the server still shows up.
 */

import type { ClubOrderView, OrderHistoryItem } from '../../../api/clubOrders';
import { orderCode } from '../../../components/clubs/order/orderFormat';

export type HistoryKind = 'status' | 'addendum' | 'invoice' | 'message' | 'players' | 'window' | 'other';

/** The order the chips are drawn in, and the order a line's label is picked from. */
export const HISTORY_KINDS: readonly HistoryKind[] = ['status', 'addendum', 'players', 'window', 'message', 'invoice', 'other'];

export const HISTORY_KIND_LABEL: Record<HistoryKind, string> = {
  status: 'Stav',
  addendum: 'Dodatky',
  players: 'Hráči',
  window: 'Termíny',
  message: 'Zprávy klubu',
  invoice: 'Faktury',
  other: 'Ostatní',
};

/** Which kinds a line of text belongs to. Never empty. */
export function classifyHistoryText(text: string): HistoryKind[] {
  const kinds = new Set<HistoryKind>();
  const t = text.trim();

  if (
    /^Objednávka (založena|zadána|potvrzena|zrušena|dokončena)/.test(t)
    || /^Objednávka byla zrušena ordinací/.test(t)
    || /^Klub odeslal objednávku/.test(t)
    || /Odkaz na formulář čeká/.test(t)
    || /^Ordinace potvrdila termíny/.test(t)
  ) kinds.add('status');
  if (/dodatk|dodatek|slouč|spolu s hlavní objednávkou/i.test(t)) kinds.add('addendum');
  if (/faktur/i.test(t)) kinds.add('invoice');
  if (/Zpráva ordinace:/.test(t)) kinds.add('message');
  if (/hráč|sportovc|místa \(/i.test(t)) kinds.add('players');
  if (/termín|časov[ée]+ bloky|uvolněn|uvolnila|Nabídnuté dny|Nabídnuto \d|v kalendáři/i.test(t)) kinds.add('window');

  return kinds.size === 0 ? ['other'] : HISTORY_KINDS.filter((kind) => kinds.has(kind));
}

/** Where an entry leads. `order` opens that order's panel on /clubs/objednavky, `billing` the invoices. */
export type HistoryLink =
  | { kind: 'order'; orderId: string; label: string }
  | { kind: 'billing'; label: string };

export interface TimelineEntry {
  /** Unique within the timeline. */
  key: string;
  atUtc: string;
  user: string;
  text: string;
  /** All the kinds the line belongs to; `kinds[0]` is the one it is labelled with. */
  kinds: HistoryKind[];
  visibleToClub: boolean;
  /** The order the line was written on. */
  orderId: string;
  /** `KO-xxxxxxxx` of that order. */
  orderCode: string;
  /** The line is on an addendum, not on the root. */
  isAddendum: boolean;
  link: HistoryLink | null;
}

/** The orders of one group; the root first. */
export interface HistoryGroup {
  root: ClubOrderView;
  addenda: readonly ClubOrderView[];
}

/** The lines an addendum writes about itself that the root already says (kept out so a creation is one entry, not two). */
const REDUNDANT_ON_ADDENDUM = [/^Dodatek k objednávce /, /^Objednávka zrušena spolu s hlavní objednávkou /];

const CODE = /KO-[0-9A-F]{8}/g;

const time = (atUtc: string): number => {
  const parsed = Date.parse(atUtc);
  return Number.isNaN(parsed) ? -Infinity : parsed;
};

function linkFor(item: OrderHistoryItem, kinds: readonly HistoryKind[], own: ClubOrderView, root: ClubOrderView, byCode: ReadonlyMap<string, string>): HistoryLink | null {
  if (kinds.includes('invoice')) return { kind: 'billing', label: 'Otevřít faktury' };

  if (kinds.includes('addendum') || kinds.includes('status')) {
    /* A line that names another order of the group leads to it ("Přidán dodatek KO-…"). */
    const named = (item.text.match(CODE) ?? []).map((code) => byCode.get(code)).find((id) => id !== undefined && id !== own.id);
    if (named !== undefined) return { kind: 'order', orderId: named, label: `Otevřít ${orderCode(named)}` };
    /* A line written on an addendum leads to that addendum's order. */
    if (own.id !== root.id && kinds.includes('addendum')) return { kind: 'order', orderId: own.id, label: `Otevřít dodatek ${orderCode(own.id)}` };
  }

  return null;
}

/** The merged timeline of the group, newest first; lines with no time last; equal times keep the root first. */
export function buildTimeline(group: HistoryGroup): TimelineEntry[] {
  const orders = [group.root, ...group.addenda.filter((a) => a.id !== group.root.id)];
  const byCode = new Map(orders.map((order) => [orderCode(order.id), order.id]));
  const rows: { entry: TimelineEntry; at: number; index: number }[] = [];
  let index = 0;

  for (const order of orders) {
    const isAddendum = order.id !== group.root.id;

    order.history.forEach((item, position) => {
      if (isAddendum && REDUNDANT_ON_ADDENDUM.some((pattern) => pattern.test(item.text.trim()))) return;

      const kinds = classifyHistoryText(item.text);
      rows.push({
        at: time(item.atUtc),
        index: index++,
        entry: {
          key: `${order.id}-${position}`,
          atUtc: item.atUtc,
          user: item.user,
          text: item.text,
          kinds,
          visibleToClub: item.visibleToClub === true,
          orderId: order.id,
          orderCode: orderCode(order.id),
          isAddendum,
          link: linkFor(item, kinds, order, group.root, byCode),
        },
      });
    });
  }

  return rows.sort((a, b) => (b.at !== a.at ? (b.at > a.at ? 1 : -1) : a.index - b.index)).map((row) => row.entry);
}

export type TimelineView = 'all' | 'club';

/**
 * The entries a view and a set of chips leave. No chip chosen = every kind; several chips = any of them. The club
 * view is the lines the club reads in its portal, whatever the chips.
 */
export function filterTimeline(entries: readonly TimelineEntry[], view: TimelineView, kinds: ReadonlySet<HistoryKind>): TimelineEntry[] {
  return entries.filter((entry) => (view === 'all' || entry.visibleToClub) && (kinds.size === 0 || entry.kinds.some((kind) => kinds.has(kind))));
}

/** How many entries each chip would show in this view (a line with two kinds counts in both). */
export function kindCounts(entries: readonly TimelineEntry[], view: TimelineView): Record<HistoryKind, number> {
  const counts: Record<HistoryKind, number> = { status: 0, addendum: 0, invoice: 0, message: 0, players: 0, window: 0, other: 0 };
  for (const entry of entries) {
    if (view === 'club' && !entry.visibleToClub) continue;
    for (const kind of entry.kinds) counts[kind] += 1;
  }
  return counts;
}

/** The ids of the orders of the group the opened order belongs to, root first: its own addenda, or its root and the siblings. */
export function groupOrderIds(order: ClubOrderView, root: ClubOrderView | undefined): string[] {
  const top = order.parentOrderId === null ? order : root;
  if (top === undefined) return [order.id];
  return [top.id, ...top.addenda.map((a) => a.id)];
}
