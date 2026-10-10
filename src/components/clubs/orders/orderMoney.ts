/*
 * Etapa 12, "ceny doplnit všude": the one reading of an order's money for every club screen - the unit price of a
 * seat, a line's value, an order's total, a group's total and the discount it got. Pure; every amount is the
 * server's (`activitySeats[].unitPriceCzk`, `priceQuote`), this only adds them up and words them. A price that is
 * not known reads "bez ceny", never zero.
 */
import type { ClubOrderView, OrderActivitySeats } from '../../../api/clubOrders';
import { formatCzk } from '../order/orderFormat';
import { isLiveOrder } from './orderWindows';

export const NO_PRICE = 'bez ceny';

/** "1 600 Kč", or "bez ceny" when the server has no price. */
export const priceText = (czk: number | null | undefined): string => (typeof czk === 'number' && Number.isFinite(czk) ? formatCzk(czk) : NO_PRICE);

/** seats × unit price; null without a unit price. */
export const lineValueCzk = (seats: number, unitPriceCzk: number | null | undefined): number | null =>
  typeof unitPriceCzk === 'number' && Number.isFinite(unitPriceCzk) ? seats * unitPriceCzk : null;

export type PricedSeatsLine = Pick<OrderActivitySeats, 'activityName' | 'seats' | 'unitPriceCzk'> & { registered?: number | null };

/**
 * "Základní 4/12 · 200 Kč · Komplexní 3/10 · 400 Kč" - the seats line with the unit price after every činnost
 * (Matko, 10. 10. 2026: "Základní sportovní prohlídka 0/9 · 1 600 Kč"). Činnosti without places are left out; "—" when none.
 */
export function formatPricedSeats(lines: readonly PricedSeatsLine[]): string {
  const shown = lines.filter((l) => l.seats > 0);
  if (shown.length === 0) return '—';
  return shown
    .map((l) => `${l.activityName || 'Činnost'} ${typeof l.registered === 'number' ? `${l.registered}/${l.seats}` : l.seats} · ${priceText(l.unitPriceCzk)}`)
    .join(' · ');
}

/** The order's quoted total; null when the server has not priced it. */
export const orderTotalCzk = (o: Pick<ClubOrderView, 'priceQuote'>): number | null => o.priceQuote?.totalCzk ?? null;

export interface OrderMoney {
  listCzk: number;
  discountCzk: number;
  totalCzk: number;
}

/** One order's quote as list / discount / total; null without a quote. */
export function orderMoney(o: Pick<ClubOrderView, 'priceQuote'>): OrderMoney | null {
  if (o.priceQuote === null) return null;
  const listCzk = o.priceQuote.listTotalCzk;
  const totalCzk = o.priceQuote.totalCzk;
  return { listCzk, discountCzk: Math.max(0, listCzk - totalCzk), totalCzk };
}

/** The quotes of several orders added up (a group card, a club's live orders); null when none of them has a quote. */
export function sumMoney(orders: readonly Pick<ClubOrderView, 'priceQuote'>[]): OrderMoney | null {
  const quoted = orders.map(orderMoney).filter((m): m is OrderMoney => m !== null);
  if (quoted.length === 0) return null;
  return quoted.reduce((a, m) => ({ listCzk: a.listCzk + m.listCzk, discountCzk: a.discountCzk + m.discountCzk, totalCzk: a.totalCzk + m.totalCzk }), { listCzk: 0, discountCzk: 0, totalCzk: 0 });
}

/** "ceník 60 000 Kč · sleva 5 600 Kč" when a discount applies; '' otherwise. */
export const discountText = (m: OrderMoney | null): string =>
  m !== null && m.discountCzk > 0 ? `ceník ${formatCzk(m.listCzk)} · sleva ${formatCzk(m.discountCzk)}` : '';

/** What a club still has on its live (Requested / Confirmed) orders - the "k fakturaci" tile; null without a live quoted order. */
export const liveOrdersTotalCzk = (orders: readonly Pick<ClubOrderView, 'status' | 'priceQuote'>[]): number | null =>
  sumMoney(orders.filter(isLiveOrder))?.totalCzk ?? null;

/** The live orders' totals per club, from one list of every club's orders. */
export function liveTotalsByClub(orders: readonly Pick<ClubOrderView, 'clubId' | 'status' | 'priceQuote'>[]): Map<string, number> {
  const byClub = new Map<string, Pick<ClubOrderView, 'status' | 'priceQuote'>[]>();
  for (const o of orders) byClub.set(o.clubId, [...(byClub.get(o.clubId) ?? []), o]);
  const out = new Map<string, number>();
  for (const [clubId, list] of byClub) {
    const total = liveOrdersTotalCzk(list);
    if (total !== null) out.set(clubId, total);
  }
  return out;
}
