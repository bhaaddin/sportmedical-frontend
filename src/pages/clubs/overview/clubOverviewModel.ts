/*
 * The club's PAGE (`/clubs/:clubId`) as pure functions: which figures the statistics shelf shows, the next terms, the last
 * changes, the orders as cards. No React, no network. Every number is something the application already reads
 * (the club's orders, its windows, its summary, its invoices); this only adds them up and words them.
 *
 * A source that could not be read is `'failed'` (or `'denied'` for an invoice list the person may not see) and its figures
 * are `null` with the reason in the hint - never a zero. "0" always means "the server said none".
 */
import type { Invoice } from '../../../api/billing';
import type { ClubBlockView } from '../../../api/clubBlocks';
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type ClubOrderStatus, type ClubOrderView, type ClubSummary } from '../../../api/clubOrders';
import type { Club } from '../../../api/clubs';
import { formatCzk, orderCode } from '../../../components/clubs/order/orderFormat';
import { sumMoney, priceText, orderTotalCzk } from '../../../components/clubs/orders/orderMoney';
import { termsSummary } from '../../../components/clubs/orders/orderLogic';
import { termsWord, windowIsUpcoming, windowLabel, orderWindows } from '../../../components/clubs/orders/orderWindows';
import { formatPragueDateTime } from '../../../utils/time';
import type { ChipTone } from '../../../components/ui/StatusChip';

/** What the page knows about one source: its rows, or why it has none. */
export type Source<T> = T | 'failed';
export type InvoiceSource = Invoice[] | 'failed' | 'denied';

export const MAX_METRICS = 6;

export type MetricKey = 'players' | 'terms' | 'orders' | 'ordered' | 'invoiced' | 'paid';

export interface Metric {
  key: MetricKey;
  label: string;
  /** A number counts up on the card; a string is shown as it is; null = unknown (drawn as a dash with the reason in the hint). */
  value: number | string | null;
  money: boolean;
  hint: string;
  tone: 'grey' | 'red' | 'green';
  /** Where the figure is worked on. */
  to: string;
}

export const FAILED_HINT = 'Nepodařilo se načíst.';
export const DENIED_HINT = 'Bez oprávnění k fakturaci.';

/** Orders that count as ordered: everything the club has asked for and not cancelled (an invitation has no quote yet). */
const ORDERED: readonly ClubOrderStatus[] = ['Requested', 'Confirmed', 'Completed'];
/** Invoices that bill the club for real: not a draft, not a cancellation, not waiting for approval. */
const BILLED = new Set(['Issued', 'PartiallyPaid', 'Paid']);

const plural = (n: number, forms: [string, string, string]): string => (n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2]);

/** The club's live windows: active blocks (the stage's own definition of "a term the club holds"). */
export const activeBlocks = (blocks: readonly ClubBlockView[]): ClubBlockView[] => blocks.filter((b) => b.status === 'Active');

export function statusCounts(orders: readonly Pick<ClubOrderView, 'status'>[]): Record<ClubOrderStatus, number> {
  const out = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<ClubOrderStatus, number>;
  for (const o of orders) out[o.status] += 1;
  return out;
}

/** "2 potvrzeno · 1 odesláno klubem" - the statuses that have an order, most active first. */
export function statusLine(orders: readonly Pick<ClubOrderView, 'status'>[]): string {
  const counts = statusCounts(orders);
  const order: ClubOrderStatus[] = ['Confirmed', 'Requested', 'Invited', 'Completed', 'Cancelled'];
  const parts = order.filter((s) => counts[s] > 0).map((s) => `${counts[s]}× ${ORDER_STATUS_LABEL[s].toLowerCase()}`);
  return parts.length > 0 ? parts.join(' · ') : 'zatím žádná';
}

export interface MetricInput {
  clubId: string;
  today: string;
  orders: Source<ClubOrderView[]>;
  blocks: Source<ClubBlockView[]>;
  summary: Source<ClubSummary>;
  invoices: InvoiceSource;
}

/** The six figures of the statistics shelf. */
export function clubMetrics(input: MetricInput): Metric[] {
  const { clubId, today, orders, blocks, summary, invoices } = input;
  const ordersTo = `/clubs/objednavky?clubId=${encodeURIComponent(clubId)}`;
  const playersTo = `/clubs/hraci?clubId=${encodeURIComponent(clubId)}`;

  const players: Metric = summary === 'failed'
    ? { key: 'players', label: 'Hráči', value: null, money: false, hint: FAILED_HINT, tone: 'grey', to: playersTo }
    : {
        key: 'players', label: 'Hráči', value: `${summary.registered} / ${summary.totalSeats}`, money: false, tone: 'grey', to: playersTo,
        hint: summary.totalSeats === 0 ? 'Klub zatím nemá žádná místa.' : summary.remaining > 0 ? `zbývá ${summary.remaining} ${plural(summary.remaining, ['místo', 'místa', 'míst'])}` : 'všechna místa obsazena',
      };

  let terms: Metric;
  if (blocks === 'failed') terms = { key: 'terms', label: 'Termíny', value: null, money: false, hint: FAILED_HINT, tone: 'grey', to: ordersTo };
  else {
    const planned = activeBlocks(blocks);
    const remaining = planned.filter((b) => windowIsUpcoming(b, today));
    terms = {
      key: 'terms', label: 'Termíny', value: `${remaining.length} / ${planned.length}`, money: false, tone: 'grey', to: ordersTo,
      hint: planned.length === 0 ? 'Zatím nic nenaplánováno.' : `nadcházejících z ${planned.length} naplánovaných`,
    };
  }

  const live = orders === 'failed' ? [] : orders.filter((o) => o.status !== 'Cancelled');
  const ordersMetric: Metric = orders === 'failed'
    ? { key: 'orders', label: 'Objednávky', value: null, money: false, hint: FAILED_HINT, tone: 'grey', to: ordersTo }
    : { key: 'orders', label: 'Objednávky', value: live.length, money: false, hint: statusLine(live), tone: 'grey', to: ordersTo };

  let ordered: Metric;
  if (orders === 'failed') ordered = { key: 'ordered', label: 'Objednáno', value: null, money: true, hint: FAILED_HINT, tone: 'grey', to: ordersTo };
  else {
    const counted = orders.filter((o) => ORDERED.includes(o.status));
    const money = sumMoney(counted);
    const unpriced = counted.filter((o) => o.priceQuote === null).length;
    ordered = {
      key: 'ordered', label: 'Objednáno', value: money === null ? null : money.totalCzk, money: true, tone: 'grey', to: ordersTo,
      hint: money === null ? (counted.length === 0 ? 'Zatím nic objednáno.' : 'Objednávky zatím nemají cenu.') : unpriced > 0 ? `bez ceny u ${unpriced} ${plural(unpriced, ['objednávky', 'objednávek', 'objednávek'])}` : 'celkem po slevě',
    };
  }

  const billingTo = '/clubs/fakturace';
  let invoiced: Metric;
  let paid: Metric;
  if (invoices === 'failed' || invoices === 'denied') {
    const hint = invoices === 'failed' ? FAILED_HINT : DENIED_HINT;
    invoiced = { key: 'invoiced', label: 'Fakturováno', value: null, money: true, hint, tone: 'grey', to: billingTo };
    paid = { key: 'paid', label: 'Zaplaceno', value: null, money: true, hint, tone: 'grey', to: billingTo };
  } else {
    const billed = invoices.filter((i) => BILLED.has(i.status));
    const total = billed.reduce((sum, i) => sum + i.totalCzk, 0);
    const paidCzk = billed.reduce((sum, i) => sum + i.paidCzk, 0);
    const open = Math.max(0, total - paidCzk);
    invoiced = {
      key: 'invoiced', label: 'Fakturováno', value: total, money: true, tone: 'grey', to: billingTo,
      hint: billed.length === 0 ? 'Zatím žádná faktura.' : `${billed.length} ${plural(billed.length, ['faktura', 'faktury', 'faktur'])}`,
    };
    paid = {
      key: 'paid', label: 'Zaplaceno', value: paidCzk, money: true, tone: billed.length > 0 && open === 0 ? 'green' : 'grey', to: billingTo,
      hint: billed.length === 0 ? 'Není co uhradit.' : open > 0 ? `k úhradě ${formatCzk(open)}` : 'vše uhrazeno',
    };
  }
  return [players, terms, ordersMetric, ordered, invoiced, paid];
}

export interface NextTerm {
  id: string;
  /** "Objednávka KO-1A2B3C4D" or the window's own name. */
  title: string;
  /** "po 26. 10. 2026 · 08:00 - 12:00" */
  when: string;
  players: string;
}

/** The three nearest windows that are not over, soonest first. */
export function nextTerms(blocks: readonly ClubBlockView[], orders: readonly ClubOrderView[], today: string, limit = 3): NextTerm[] {
  const byId = new Map(orders.map((o) => [o.id, o]));
  return activeBlocks(blocks)
    .filter((b) => windowIsUpcoming(b, today))
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate) || (a.dailyFrom ?? '').localeCompare(b.dailyFrom ?? '') || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((b) => {
      const order = b.clubOrderId ? byId.get(b.clubOrderId) : undefined;
      return {
        id: b.id,
        title: order !== undefined ? `Objednávka ${orderCode(order.groupId || order.id)}` : (b.name ?? 'Okno bez objednávky'),
        when: windowLabel(b, order),
        players: `${b.registered} / ${b.seats}`,
      };
    });
}

export interface Change {
  key: string;
  orderId: string;
  code: string;
  at: string;
  /** "26. 10. 2026 14:05" */
  atText: string;
  user: string;
  text: string;
}

/** The last `limit` history entries over all the club's orders, newest first. An entry without a time sorts last. */
export function recentChanges(orders: readonly ClubOrderView[], limit = 5): Change[] {
  const all: Change[] = [];
  for (const o of orders) {
    o.history.forEach((h, i) => {
      all.push({
        key: `${o.id}:${i}`, orderId: o.id, code: orderCode(o.groupId || o.id), at: h.atUtc, atText: h.atUtc !== '' ? formatPragueDateTime(h.atUtc) : '',
        user: h.user, text: h.text,
      });
    });
  }
  return all.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key)).slice(0, limit);
}

export interface OrderCard {
  id: string;
  code: string;
  status: ClubOrderStatus;
  statusLabel: string;
  tone: ChipTone;
  /** "Služba · 26. 10. - 30. 10." */
  subtitle: string;
  /** "Hráči 12 / 20 · 14 400 Kč" */
  detail: string;
  /** Dodatek / "+1 dodatek" */
  chip: string;
}

const STATUS_CHIP: Record<ClubOrderStatus, ChipTone> = { Invited: 'beige', Requested: 'blue', Confirmed: 'green', Completed: 'grey', Cancelled: 'red' };

/** The orders as cards: live ones first (most recent first), the cancelled and finished after them. */
export function orderCards(orders: readonly ClubOrderView[]): OrderCard[] {
  const rank = (s: ClubOrderStatus): number => (s === 'Confirmed' ? 0 : s === 'Requested' ? 1 : s === 'Invited' ? 2 : s === 'Completed' ? 3 : 4);
  return [...orders]
    .sort((a, b) => rank(a.status) - rank(b.status) || b.createdAtUtc.localeCompare(a.createdAtUtc) || a.id.localeCompare(b.id))
    .map((o) => {
      const windows = orderWindows(o).length;
      const terms = windows > 0 ? `${windows} ${termsWord(windows)}` : termsSummary(o);
      const seats = o.totalSeats > 0 ? `Hráči ${o.registered} / ${o.totalSeats}` : 'Bez míst';
      const addendum = o.parentOrderId !== null ? 'Dodatek' : o.addenda.length > 0 ? `+${o.addenda.length} ${plural(o.addenda.length, ['dodatek', 'dodatky', 'dodatků'])}` : '';
      return {
        id: o.id,
        code: orderCode(o.id),
        status: o.status,
        statusLabel: ORDER_STATUS_LABEL[o.status],
        tone: STATUS_CHIP[o.status],
        subtitle: [o.serviceName || 'Služba nevybrána', terms].filter((p) => p !== '').join(' · '),
        detail: `${seats} · ${priceText(orderTotalCzk(o))}`,
        chip: addendum,
      };
    });
}

/** The line under the club's name: who to call, and nothing the club has not given. */
export function contactLine(club: Pick<Club, 'contactPerson' | 'contactPhone' | 'contactEmail'>): string {
  const parts = [club.contactPerson, club.contactPhone, club.contactEmail].map((p) => (p ?? '').trim()).filter((p) => p !== '');
  return parts.length > 0 ? parts.join(' · ') : 'Kontakt zatím není vyplněn.';
}

/** The address of the history page of an order. */
export const historyPath = (orderId: string): string => `/clubs/objednavky/${encodeURIComponent(orderId)}/historie`;

/** The order the links shelf and the history link point at: the live order nearest to now, else the newest one. */
export function focusOrder(orders: readonly ClubOrderView[], blocks: readonly ClubBlockView[], today: string): ClubOrderView | null {
  const roots = orders.filter((o) => o.parentOrderId === null);
  const live = roots.filter((o) => o.status === 'Requested' || o.status === 'Confirmed' || o.status === 'Invited');
  const nextStart = (o: ClubOrderView): string => {
    const own = new Set(o.groupId ? [o.groupId, o.id] : [o.id]);
    const dates = activeBlocks(blocks).filter((b) => b.clubOrderId !== null && b.clubOrderId !== undefined && own.has(b.clubOrderId) && windowIsUpcoming(b, today)).map((b) => b.fromDate).sort();
    return dates[0] ?? '9999-12-31';
  };
  const pool = live.length > 0 ? live : roots;
  return [...pool].sort((a, b) => nextStart(a).localeCompare(nextStart(b)) || b.createdAtUtc.localeCompare(a.createdAtUtc) || a.id.localeCompare(b.id))[0] ?? null;
}

/** Which of `MetricKey`s are shown - one place so a test can pin "no more than six". */
export const METRIC_KEYS: readonly MetricKey[] = ['players', 'terms', 'orders', 'ordered', 'invoiced', 'paid'];
