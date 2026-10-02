/*
 * The four words the desk reads on Fakturace, and the four numbers above them,
 * each derived from the server's invoice and the clock - not stored anywhere.
 */
import { describe, it, expect } from 'vitest';
import type { Invoice } from '../../api/billing';
import {
  doklady, isOverdue, itemsLabel, matchesFilter, matchesSearch, monthIn, statusOf, summarize,
} from './invoiceView';
import { czk } from './money';

const NOW = new Date(2026, 9, 26, 9, 42); // 26. 10. 2026

function invoice(over: Partial<Invoice>): Invoice {
  return {
    id: over.id ?? 'i',
    patientId: 'p1',
    patientName: 'Bohumil Komárek',
    invoiceNumber: '2026-0418',
    status: 'Issued',
    totalCzk: 2200,
    paidCzk: 0,
    remainingCzk: 2200,
    currency: 'CZK',
    issueDateUtc: '2026-10-26T08:00:00Z',
    dueDateUtc: '2026-11-25T08:00:00Z',
    items: [{ id: 'l', description: 'Komplexní prohlídka', serviceCode: 'KP', quantity: 1, unitPriceCzk: 2200, amountCzk: 2200 }],
    ...over,
  };
}

describe('statusOf', () => {
  it('reads a paid invoice as Zaplaceno', () => {
    expect(statusOf(invoice({ status: 'Paid', paidCzk: 2200, remainingCzk: 0 }), NOW))
      .toEqual({ label: 'Zaplaceno', tone: 'green' });
  });

  it("reads a patient's open invoice as Nezaplaceno and a club's as Vystaveno", () => {
    expect(statusOf(invoice({}), NOW)).toEqual({ label: 'Nezaplaceno', tone: 'red' });
    expect(statusOf(invoice({ clubName: 'FK Slaný' }), NOW)).toEqual({ label: 'Vystaveno', tone: 'beige' });
  });

  it('turns any open invoice past its due date into Po splatnosti', () => {
    const late = invoice({ dueDateUtc: '2026-10-20T00:00:00Z' });
    expect(isOverdue(late, NOW)).toBe(true);
    expect(statusOf(late, NOW)).toEqual({ label: 'Po splatnosti', tone: 'red' });
    /* …but a paid one that was late is simply paid. */
    expect(statusOf({ ...late, status: 'Paid', remainingCzk: 0 }, NOW).label).toBe('Zaplaceno');
  });

  it('keeps the states the board has no word for readable', () => {
    expect(statusOf(invoice({ status: 'Cancelled' }), NOW).label).toBe('Zrušeno');
    expect(statusOf(invoice({ status: 'Refunded' }), NOW).label).toBe('Vráceno');
    expect(statusOf(invoice({ status: 'Draft' }), NOW).label).toBe('Návrh');
    expect(statusOf(invoice({ status: 'PartiallyPaid', paidCzk: 200, remainingCzk: 2000 }), NOW).label)
      .toBe('Částečně zaplaceno');
  });
});

describe('summarize', () => {
  const invoices = [
    invoice({ id: 'a', totalCzk: 2200, remainingCzk: 2200 }),
    invoice({ id: 'b', patientId: 'p2', status: 'Paid', totalCzk: 4000, paidCzk: 4000, remainingCzk: 0 }),
    invoice({ id: 'c', patientId: 'p2', totalCzk: 1600, remainingCzk: 1600, dueDateUtc: '2026-10-01T00:00:00Z' }),
    /* Last month: counts as owed, not as this month's turnover. */
    invoice({ id: 'd', patientId: 'p3', totalCzk: 500, remainingCzk: 500, issueDateUtc: '2026-09-10T00:00:00Z', dueDateUtc: '2026-09-20T00:00:00Z' }),
    /* Cancelled: counts nowhere. */
    invoice({ id: 'e', status: 'Cancelled', totalCzk: 9999, remainingCzk: 9999 }),
  ];

  it('adds up the month, what is owed, what is late and the average per patient', () => {
    const s = summarize(invoices, NOW);
    expect(s.invoicedThisMonth).toBe(2200 + 4000 + 1600);
    expect(s.invoicedThisMonthCount).toBe(3);
    expect(s.unpaid).toBe(2200 + 1600 + 500);
    expect(s.overdueCount).toBe(2);
    expect(s.averagePerPatient).toBe(Math.round(7800 / 2));
  });

  it('has no average when nothing was billed this month', () => {
    expect(summarize([], NOW).averagePerPatient).toBeNull();
  });
});

describe('filters and search', () => {
  const late = invoice({ id: 'late', dueDateUtc: '2026-10-01T00:00:00Z' });
  const club = invoice({ id: 'club', clubName: 'FK Slaný', items: [{ id: 'l', description: 'Komplexní prohlídka', serviceCode: 'KP', quantity: 12, unitPriceCzk: 2200, amountCzk: 26400 }] });
  const paid = invoice({ id: 'paid', status: 'Paid', remainingCzk: 0 });

  it('Nezaplacené keeps the open ones, Po splatnosti only the late ones, Kluby only clubs', () => {
    expect([late, club, paid].filter((i) => matchesFilter(i, 'unpaid', NOW)).map((i) => i.id)).toEqual(['late', 'club']);
    expect([late, club, paid].filter((i) => matchesFilter(i, 'overdue', NOW)).map((i) => i.id)).toEqual(['late']);
    expect([late, club, paid].filter((i) => matchesFilter(i, 'clubs', NOW)).map((i) => i.id)).toEqual(['club']);
    expect([late, club, paid].filter((i) => matchesFilter(i, 'all', NOW))).toHaveLength(3);
  });

  it('finds by number, patient, club and item', () => {
    expect(matchesSearch(club, '0418')).toBe(true);
    expect(matchesSearch(club, 'slaný')).toBe(true);
    expect(matchesSearch(late, 'komárek')).toBe(true);
    expect(matchesSearch(late, 'komplexní')).toBe(true);
    expect(matchesSearch(late, 'spiro')).toBe(false);
  });

  it('writes items as "12× Komplexní prohlídka"', () => {
    expect(itemsLabel(club)).toBe('12× Komplexní prohlídka');
    expect(itemsLabel(invoice({ items: [] }))).toBe('—');
  });
});

describe('words', () => {
  it('declines the month and the doklad', () => {
    expect(monthIn(NOW)).toBe('v říjnu');
    expect(monthIn(new Date(2026, 0, 1))).toBe('v lednu');
    expect(doklady(1)).toBe('1 doklad');
    expect(doklady(2)).toBe('2 doklady');
    expect(doklady(5)).toBe('5 dokladů');
  });

  it('writes money as "2 200 Kč"', () => {
    expect(czk(2200)).toMatch(/^2\s200 Kč$/);
    expect(czk(0)).toBe('0 Kč');
    expect(czk(2200.5)).toMatch(/^2\s200,5 Kč$/);
    expect(czk(undefined)).toBe('0 Kč');
  });
});
