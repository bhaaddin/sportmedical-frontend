/*
 * What the summary card, the "Celková objednávka" command centre, the finish and the publish dialogs say about
 * the order: status, readiness, the figures per činnost, the terms, the money and the order's reference.
 * Built on `orderFigures` (the one calculation) - the model's `orderSnapshot` is not used because it counts
 * with one pool of players.
 */
import {
  categoryOrFallback,
  contactReady,
  dateOf,
  printable,
  timeLeft,
  type ClubProfile,
  type PlannerContext,
  type PlannerOrder,
  type PlannerSession,
} from '../../model';
import { formatCzk } from '../../../components/clubs/order/orderFormat';
import { NO_PRICE } from '../../../components/clubs/orders/orderMoney';
import { orderTerms, type CategoryFigure, type OrderFigures } from './orderFigures';

export interface OrderSummary {
  figures: OrderFigures;
  /** Czech sentences; empty = ready. */
  issues: string[];
  contactReady: boolean;
  planExists: boolean;
  fullyPlanned: boolean;
  /** Everything is in place: all players planned, a contact, at least one term. */
  ready: boolean;
  status: 'PŘIPRAVENO' | 'V PRŮBĚHU';
  readiness: string;
  terms: PlannerSession[];
  /** Seats of all club terms of the order. */
  slots: number;
  /** The first four rows are the bars of the summary card. */
  topRows: CategoryFigure[];
}

export function orderSummary(ctx: PlannerContext, figures: OrderFigures, profile: ClubProfile, orderId?: string | null): OrderSummary {
  const terms = orderTerms(ctx, orderId);
  const isContactReady = contactReady(profile);
  const planExists = terms.length > 0;
  const fullyPlanned = figures.requested > 0 ? figures.remaining === 0 : false;
  const issues: string[] = [];
  if (!fullyPlanned) issues.push(`${figures.remaining} osob ještě není naplánováno`);
  if (!isContactReady) issues.push('Chybí kontakt klubu');
  if (!planExists) issues.push('Zatím nebyl vytvořen klubový termín');
  const ready = fullyPlanned && isContactReady && planExists;
  return {
    figures,
    issues,
    contactReady: isContactReady,
    planExists,
    fullyPlanned,
    ready,
    status: ready ? 'PŘIPRAVENO' : 'V PRŮBĚHU',
    readiness: issues.length ? issues.slice(0, 2).join(' · ') : 'Všechny požadované kapacity a kontakty jsou připraveny ke kontrole',
    terms,
    slots: terms.reduce((n, s) => n + Number(s.capacity || 0), 0),
    topRows: figures.list.slice(0, 4),
  };
}

/** "47 % naplánováno · zbývá 12 osob · 4 h vyšetření". */
export const detailLine = (f: CategoryFigure): string =>
  `${f.percent}% naplánováno · zbývá ${f.remaining} osob · ${timeLeft(f.remainingMinutes)} vyšetření`;

/** Terms of the "Termíny" sheet, chronological. */
export function termRows(summary: Pick<OrderSummary, 'terms'>, ctx: PlannerContext) {
  return [...summary.terms]
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .map((e) => ({
      id: e.id,
      name: categoryOrFallback(ctx, e.categoryId).name,
      meta: `${e.date} · ${e.start}–${e.end}`,
      capacityLabel: `${Number(e.capacity || 0)} slotů`,
    }));
}

/* ------------------------------ money ------------------------------ */

export interface OrderMoneyView {
  /** Per činnost: the list price of one player and the value of the order's players. */
  lines: { categoryId: string; name: string; seats: number; unitCzk: number | null; valueCzk: number | null }[];
  /** List total of the priced lines; null when nothing has a price. */
  listCzk: number | null;
  /** The server's total after the discount; null until the order is quoted. */
  totalCzk: number | null;
  discountCzk: number;
  /** Some činnost has no price: the total is partial. */
  incomplete: boolean;
  /** The numbers are the price list's, not the server's quote. */
  estimated: boolean;
}

export function orderMoneyView(figures: OrderFigures, order: Pick<PlannerOrder, 'quote'> | null): OrderMoneyView {
  const lines = figures.list.map((f) => ({
    categoryId: f.categoryId,
    name: f.name,
    seats: f.requested,
    unitCzk: f.priceCzk,
    valueCzk: f.priceCzk === null ? null : f.priceCzk * f.requested,
  }));
  const priced = lines.filter((l) => l.valueCzk !== null);
  const listFromCatalogue = priced.length === 0 ? null : priced.reduce((n, l) => n + (l.valueCzk ?? 0), 0);
  const quote = order?.quote ?? null;
  if (quote) {
    return {
      lines,
      listCzk: quote.listCzk,
      totalCzk: quote.totalCzk,
      discountCzk: Math.max(0, quote.listCzk - quote.totalCzk),
      incomplete: false,
      estimated: false,
    };
  }
  return {
    lines,
    listCzk: listFromCatalogue,
    totalCzk: null,
    discountCzk: 0,
    incomplete: priced.length < lines.filter((l) => l.seats > 0).length,
    estimated: true,
  };
}

export const moneyText = (czk: number | null): string => (czk === null ? NO_PRICE : formatCzk(czk));

/** "ceník 60 000 Kč · sleva 5 600 Kč" when a discount applies; '' otherwise. */
export const discountLine = (m: OrderMoneyView): string =>
  m.discountCzk > 0 && m.listCzk !== null ? `ceník ${formatCzk(m.listCzk)} · sleva ${formatCzk(m.discountCzk)}` : '';

/* ------------------------------ the order's reference ------------------------------ */

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/** "KO-1A2B3C4D": the server's code, else derived from a real id; null for a draft that has no id yet (the demo). */
export function orderReference(order: Pick<PlannerOrder, 'id' | 'code'> | null, finishedCode?: string | null): string | null {
  if (finishedCode) return finishedCode;
  if (!order) return null;
  if (order.code) return order.code;
  if (UUID.test(order.id)) return `KO-${order.id.replace(/-/g, '').slice(-8).toUpperCase()}`;
  return null;
}

/** "26. 11. 08:00–10:00 · 12 míst" - a row of the club form preview. */
export const termMeta = (e: Pick<PlannerSession, 'date' | 'start' | 'end' | 'capacity'>): string =>
  `${printable(dateOf(e.date))} ${e.start}–${e.end} · ${e.capacity} míst`;
