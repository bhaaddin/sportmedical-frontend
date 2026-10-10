/* Etapa 12, "ceny všude": the one reading of an order's money, pinned. */
import { describe, it, expect } from 'vitest';
import { toOrder } from '../../../api/clubOrders';
import { discountText, formatPricedSeats, lineValueCzk, liveOrdersTotalCzk, liveTotalsByClub, orderMoney, orderTotalCzk, priceText, sumMoney } from './orderMoney';

/** Money is written with non-breaking spaces; the assertions read plain ones. */
const plain = (s: string): string => s.replace(/ /g, ' ');

const seat = (activityName: string, seats: number, registered: number, unitPriceCzk: number | null) => ({ activityId: activityName, activityName, durationMinutes: 30, seats, registered, unitPriceCzk });

const quoted = (over: Record<string, unknown> = {}) =>
  toOrder({ id: 'o1', clubId: 'c1', status: 'Confirmed', priceQuote: { listTotalCzk: 4000, discounts: [{ kind: 'Team', label: 'Sleva klubu', percent: 10, amountCzk: 400 }], totalCzk: 3600 }, ...over });

describe('words', () => {
  it('writes a price in Kč and "bez ceny" when there is none - never zero', () => {
    expect(plain(priceText(1600))).toBe('1 600 Kč');
    expect(plain(priceText(0))).toBe('0 Kč');
    expect(priceText(null)).toBe('bez ceny');
    expect(priceText(undefined)).toBe('bez ceny');
    expect(priceText(Number.NaN)).toBe('bez ceny');
  });

  it('puts the unit price after every činnost, in the owner\'s wording', () => {
    expect(plain(formatPricedSeats([seat('Základní sportovní prohlídka', 9, 0, 1600)]))).toBe('Základní sportovní prohlídka 0/9 · 1 600 Kč');
    expect(plain(formatPricedSeats([seat('Základní', 12, 4, 200), seat('Komplexní', 10, 3, null)]))).toBe('Základní 4/12 · 200 Kč · Komplexní 3/10 · bez ceny');
    expect(plain(formatPricedSeats([{ activityName: 'Základní', seats: 5, unitPriceCzk: 100 }]))).toBe('Základní 5 · 100 Kč');
    expect(formatPricedSeats([seat('Nic', 0, 0, 100)])).toBe('—');
  });
});

describe('arithmetic', () => {
  it('values a line as seats × unit price, null without a price', () => {
    expect(lineValueCzk(9, 1600)).toBe(14400);
    expect(lineValueCzk(9, null)).toBeNull();
    expect(lineValueCzk(9, undefined)).toBeNull();
  });

  it('reads one order\'s quote as list / discount / total', () => {
    expect(orderTotalCzk(quoted())).toBe(3600);
    expect(orderMoney(quoted())).toEqual({ listCzk: 4000, discountCzk: 400, totalCzk: 3600 });
    expect(orderMoney(quoted({ priceQuote: null }))).toBeNull();
    expect(orderTotalCzk(quoted({ priceQuote: null }))).toBeNull();
  });

  it('adds several quotes up and words the discount only when there is one', () => {
    const a = quoted();
    const b = quoted({ id: 'o2', priceQuote: { listTotalCzk: 9000, discounts: [], totalCzk: 8000 } });
    const none = quoted({ id: 'o3', priceQuote: null });
    expect(sumMoney([a, b, none])).toEqual({ listCzk: 13000, discountCzk: 1400, totalCzk: 11600 });
    expect(sumMoney([none])).toBeNull();
    expect(plain(discountText(sumMoney([a, b])))).toBe('ceník 13 000 Kč · sleva 1 400 Kč');
    expect(discountText({ listCzk: 100, discountCzk: 0, totalCzk: 100 })).toBe('');
    expect(discountText(null)).toBe('');
  });

  it('counts only the live orders (Requested, Confirmed) towards "k fakturaci", per club', () => {
    const orders = [
      quoted({ id: 'a', clubId: 'c1', status: 'Confirmed' }),
      quoted({ id: 'b', clubId: 'c1', status: 'Requested', priceQuote: { listTotalCzk: 1000, discounts: [], totalCzk: 1000 } }),
      quoted({ id: 'c', clubId: 'c1', status: 'Cancelled', priceQuote: { listTotalCzk: 99999, discounts: [], totalCzk: 99999 } }),
      quoted({ id: 'd', clubId: 'c1', status: 'Completed', priceQuote: { listTotalCzk: 500, discounts: [], totalCzk: 500 } }),
      quoted({ id: 'e', clubId: 'c2', status: 'Invited', priceQuote: null }),
      quoted({ id: 'f', clubId: 'c3', status: 'Confirmed', priceQuote: null }),
    ];
    expect(liveOrdersTotalCzk(orders.filter((o) => o.clubId === 'c1'))).toBe(4600);
    expect(liveOrdersTotalCzk(orders.filter((o) => o.clubId === 'c3'))).toBeNull();
    const byClub = liveTotalsByClub(orders);
    expect([...byClub.entries()]).toEqual([['c1', 4600]]);
  });
});
