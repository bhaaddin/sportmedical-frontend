import { describe, expect, it } from 'vitest';
import { combinedSchema } from '../../../api/clubOneOrder';
import { collapseToRoots, invoiceableMonths, invoiceSubset, monthLabel, scopeReady, splitBlocker, splitProblem } from './oneOrderModel';

const day = (orderId: string, over: Record<string, unknown> = {}) => ({
  orderId, reference: `KO-${orderId}`, serviceName: 'P', seats: 5, registered: 0, status: 'Confirmed',
  ranges: [{ fromDate: '2026-11-05', toDate: '2026-11-05' }], ...over,
});
const combined = combinedSchema.parse({
  rootId: 'r', reference: 'KO-r', days: [
    day('r'), day('a'), day('inv', { invoiceId: 'i1', invoiceNumber: '2026001' }), day('x', { status: 'Cancelled' }),
    day('dec', { ranges: [{ fromDate: '2026-12-02', toDate: '2026-12-02' }] }),
  ],
});

describe('split rules', () => {
  it('names why a day cannot move', () => {
    const by = (id: string) => combined.days.find((d) => d.orderId === id)!;
    expect(splitBlocker(by('r'), 'r')).toMatch(/Základ/);
    expect(splitBlocker(by('inv'), 'r')).toMatch(/faktuře/);
    expect(splitBlocker(by('x'), 'r')).toMatch(/zrušená/);
    expect(splitBlocker(by('a'), 'r')).toBeNull();
  });
  it('needs at least one day and never all of them', () => {
    expect(splitProblem([], combined)).toMatch(/aspoň jeden/);
    expect(splitProblem(['a'], combined)).toBeNull();
    expect(splitProblem(combined.days.map((d) => d.orderId), combined)).toMatch(/Nelze oddělit všechno/);
  });
});

describe('invoice subset', () => {
  it('one day = orderIds, month = month, the rest = nothing', () => {
    expect(invoiceSubset('day', { orderId: 'a' })).toEqual({ orderIds: ['a'] });
    expect(invoiceSubset('month', { month: '2026-11' })).toEqual({ month: '2026-11' });
    expect(invoiceSubset('rest', { orderId: 'a', month: '2026-11' })).toBeUndefined();
  });
  it('a day or month scope waits for the pick', () => {
    expect(scopeReady('day', {})).toBe(false);
    expect(scopeReady('month', { month: '2026-11' })).toBe(true);
    expect(scopeReady('rest', {})).toBe(true);
  });
  it('offers only the months that still have something to bill', () => {
    expect(invoiceableMonths(combined)).toEqual(['2026-11', '2026-12']);
    expect(monthLabel('2026-11')).toMatch(/listopad/);
  });
});

describe('orders list', () => {
  const o = (id: string, clubId: string, parentOrderId: string | null) => ({ id, clubId, parentOrderId });
  it('hides the added days of a one-order club behind their root, leaves the others', () => {
    const live = [o('r', 'c1', null), o('a', 'c1', 'r'), o('b', 'c2', null), o('e', 'c2', 'b')];
    expect(collapseToRoots(live, ['c1']).map((x) => x.id)).toEqual(['r', 'b', 'e']);
    expect(collapseToRoots(live, []).map((x) => x.id)).toEqual(['r', 'a', 'b', 'e']);
  });
  it('keeps an added day whose root is not in the list', () => {
    expect(collapseToRoots([o('a', 'c1', 'gone')], ['c1']).map((x) => x.id)).toEqual(['a']);
  });
});
