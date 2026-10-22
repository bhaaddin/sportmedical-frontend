import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../../api/billing';
import type { ClubBlockView } from '../../../api/clubBlocks';
import { toOrder, type ClubOrderView, type ClubSummary } from '../../../api/clubOrders';
import {
  DENIED_HINT, FAILED_HINT, MAX_METRICS, METRIC_KEYS, clubMetrics, contactLine, focusOrder, historyPath, nextTerms, orderCards, recentChanges,
  statusLine, type MetricInput,
} from './clubOverviewModel';

const TODAY = '2026-10-22';
const A = '80e74a6c-0000-4000-8000-00000000000a';
const B = '80e74a6c-0000-4000-8000-00000000000b';
const C = '80e74a6c-0000-4000-8000-00000000000c';

const win = (id: string, from: string, over: Record<string, unknown> = {}): ClubBlockView => ({
  id, clubId: 'club-1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['c1'], activityIds: [], fromDate: from, toDate: from,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 10, registered: 4, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: A, ...over,
}) as ClubBlockView;

const order = (id: string, over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id, groupId: id, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Sportovní prohlídky', status: 'Confirmed',
    paymentMethod: 'ClubInvoice', activitySeats: [{ activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 10, registered: 4, unitPriceCzk: 200 }],
    totalSeats: 10, registered: 4, priceQuote: { listTotalCzk: 2000, discounts: [], totalCzk: 1800 }, requestedRanges: [], note: '', contact: null,
    createdBy: 'Staff', history: [], addenda: [], blocks: [], createdAtUtc: '2026-10-01T08:00:00Z', ...over,
  });

const summary = (over: Partial<ClubSummary> = {}): ClubSummary => ({
  clubId: 'club-1', totalSeats: 20, registered: 7, remaining: 13, byService: [], byActivity: [],
  ordersByStatus: { Invited: 0, Requested: 0, Confirmed: 1, Completed: 0, Cancelled: 0 }, bookedMinutes: 0, usedMinutes: 0, ...over,
});

const invoice = (status: string, total: number, paid: number): Invoice => ({ id: `i-${status}-${total}`, status, totalCzk: total, paidCzk: paid } as Invoice);

const base = (over: Partial<MetricInput> = {}): MetricInput => ({
  clubId: 'club-1', today: TODAY, orders: [order(A)], blocks: [win('w1', '2026-10-26')], summary: summary(), invoices: [invoice('Issued', 1800, 600)], ...over,
});
const byKey = (m: ReturnType<typeof clubMetrics>, k: string) => m.find((x) => x.key === k)!;

describe('clubMetrics', () => {
  it('is exactly six figures, never more', () => {
    const m = clubMetrics(base());
    expect(m).toHaveLength(MAX_METRICS);
    expect(m.map((x) => x.key)).toEqual([...METRIC_KEYS]);
  });

  it('players needed vs registered, from the summary', () => {
    const m = byKey(clubMetrics(base()), 'players');
    expect(m.value).toBe('7 / 20');
    expect(m.hint).toBe('zbývá 13 míst');
    expect(m.to).toBe('/clubs/hraci?clubId=club-1');
  });

  it('says so when every place is taken or the club has none', () => {
    expect(byKey(clubMetrics(base({ summary: summary({ registered: 20, remaining: 0 }) })), 'players').hint).toBe('všechna místa obsazena');
    expect(byKey(clubMetrics(base({ summary: summary({ registered: 0, totalSeats: 0, remaining: 0 }) })), 'players').hint).toBe('Klub zatím nemá žádná místa.');
  });

  it('terms: upcoming of planned, cancelled windows left out', () => {
    const blocks = [win('w1', '2026-10-26'), win('w2', '2026-10-01'), win('w3', '2026-11-02', { status: 'Cancelled' })];
    const m = byKey(clubMetrics(base({ blocks })), 'terms');
    expect(m.value).toBe('1 / 2');
    expect(m.hint).toBe('nadcházejících z 2 naplánovaných');
  });

  it('terms: none planned is said', () => {
    const m = byKey(clubMetrics(base({ blocks: [] })), 'terms');
    expect(m.value).toBe('0 / 0');
    expect(m.hint).toBe('Zatím nic nenaplánováno.');
  });

  it('orders by status: the cancelled one is not counted, the line names each status', () => {
    const orders = [order(A), order(B, { status: 'Requested' }), order(C, { status: 'Cancelled' })];
    const m = byKey(clubMetrics(base({ orders })), 'orders');
    expect(m.value).toBe(2);
    expect(m.hint).toBe('1× potvrzeno · 1× odesláno klubem');
  });

  it('money ordered is the quotes of the orders the club asked for; an order without a price is said', () => {
    const orders = [order(A), order(B, { priceQuote: null }), order(C, { status: 'Cancelled' })];
    const m = byKey(clubMetrics(base({ orders })), 'ordered');
    expect(m.value).toBe(1800);
    expect(m.money).toBe(true);
    expect(m.hint).toBe('bez ceny u 1 objednávky');
  });

  it('money invoiced and paid come from the issued invoices; a draft or cancelled one is not billing', () => {
    const invoices = [invoice('Issued', 1800, 600), invoice('Paid', 1000, 1000), invoice('Draft', 5000, 0), invoice('Cancelled', 7000, 0)];
    const m = clubMetrics(base({ invoices }));
    expect(byKey(m, 'invoiced').value).toBe(2800);
    expect(byKey(m, 'invoiced').hint).toBe('2 faktury');
    expect(byKey(m, 'paid').value).toBe(1600);
    expect(byKey(m, 'paid').hint).toMatch(/^k úhradě 1\s200\sKč$/u);
  });

  it('everything paid turns the paid card green', () => {
    expect(byKey(clubMetrics(base({ invoices: [invoice('Paid', 1000, 1000)] })), 'paid').tone).toBe('green');
  });

  it('no invoice yet is a real zero with its own words', () => {
    const m = clubMetrics(base({ invoices: [] }));
    expect(byKey(m, 'invoiced').value).toBe(0);
    expect(byKey(m, 'invoiced').hint).toBe('Zatím žádná faktura.');
  });

  describe('a source that cannot be read is never a zero', () => {
    it('summary failed -> players unknown', () => {
      const m = byKey(clubMetrics(base({ summary: 'failed' })), 'players');
      expect(m.value).toBeNull();
      expect(m.hint).toBe(FAILED_HINT);
    });
    it('blocks failed -> terms unknown', () => {
      expect(byKey(clubMetrics(base({ blocks: 'failed' })), 'terms').value).toBeNull();
    });
    it('orders failed -> orders and ordered unknown', () => {
      const m = clubMetrics(base({ orders: 'failed' }));
      expect(byKey(m, 'orders').value).toBeNull();
      expect(byKey(m, 'ordered').value).toBeNull();
      expect(byKey(m, 'ordered').hint).toBe(FAILED_HINT);
    });
    it('invoices failed or denied -> invoiced and paid unknown, each with its reason', () => {
      const failed = clubMetrics(base({ invoices: 'failed' }));
      const denied = clubMetrics(base({ invoices: 'denied' }));
      for (const k of ['invoiced', 'paid']) {
        expect(byKey(failed, k).value).toBeNull();
        expect(byKey(failed, k).hint).toBe(FAILED_HINT);
        expect(byKey(denied, k).value).toBeNull();
        expect(byKey(denied, k).hint).toBe(DENIED_HINT);
      }
    });
  });
});

describe('statusLine', () => {
  it('is "zatím žádná" for no order', () => {
    expect(statusLine([])).toBe('zatím žádná');
  });
});

describe('nextTerms', () => {
  const blocks = [
    win('w4', '2026-11-20'), win('w1', '2026-10-26'), win('w2', '2026-10-28'), win('w3', '2026-11-02'),
    win('past', '2026-09-01'), win('gone', '2026-10-24', { status: 'Cancelled' }),
  ];
  it('is the three nearest windows that are not over, soonest first, cancelled ones left out', () => {
    expect(nextTerms(blocks, [order(A)], TODAY).map((t) => t.id)).toEqual(['w1', 'w2', 'w3']);
  });
  it('names the order the window belongs to and its players', () => {
    const [first] = nextTerms(blocks, [order(A)], TODAY);
    expect(first.title).toBe('Objednávka KO-0000000A');
    expect(first.players).toBe('4 / 10');
    expect(first.when).toMatch(/26/);
  });
  it('a window of no order is named by itself', () => {
    expect(nextTerms([win('x', '2026-10-30', { clubOrderId: null, name: 'Soustředění' })], [], TODAY)[0].title).toBe('Soustředění');
  });
  it('a window that ends today is still ahead; none at all is an empty list', () => {
    expect(nextTerms([win('t', TODAY)], [], TODAY)).toHaveLength(1);
    expect(nextTerms([], [], TODAY)).toEqual([]);
  });
});

describe('recentChanges', () => {
  const history = (n: number, day: number) => Array.from({ length: n }, (_, i) => ({ atUtc: `2026-10-${String(day + i).padStart(2, '0')}T10:00:00Z`, user: 'Jana', text: `změna ${day}-${i}` }));
  it('is the last five over all the orders, newest first', () => {
    const orders = [order(A, { history: history(4, 1) }), order(B, { history: history(4, 10) })];
    const changes = recentChanges(orders);
    expect(changes).toHaveLength(5);
    expect(changes.map((c) => c.text)).toEqual(['změna 10-3', 'změna 10-2', 'změna 10-1', 'změna 10-0', 'změna 1-3']);
    expect(changes[0].code).toBe('KO-0000000B');
  });
  it('nothing in the history is an empty list; an entry without a time goes last', () => {
    expect(recentChanges([order(A)])).toEqual([]);
    const m = recentChanges([order(A, { history: [{ atUtc: '', user: '', text: 'bez času' }, ...history(1, 5)] })]);
    expect(m.map((c) => c.text)).toEqual(['změna 5-0', 'bez času']);
  });
});

describe('orderCards', () => {
  it('lists live orders before finished and cancelled ones', () => {
    const cards = orderCards([order(A, { status: 'Cancelled' }), order(B, { status: 'Requested' }), order(C)]);
    expect(cards.map((c) => c.status)).toEqual(['Confirmed', 'Requested', 'Cancelled']);
  });
  it('carries the code, status, players and price', () => {
    const [card] = orderCards([order(A)]);
    expect(card.code).toBe('KO-0000000A');
    expect(card.statusLabel).toBe('Potvrzeno');
    expect(card.tone).toBe('green');
    expect(card.detail).toMatch(/^Hráči 4 \/ 10 · 1\s800\sKč$/u);
    expect(card.subtitle).toContain('Sportovní prohlídky');
  });
  it('an order without a price says "bez ceny", not zero', () => {
    expect(orderCards([order(A, { priceQuote: null })])[0].detail).toContain('bez ceny');
  });
});

describe('focusOrder', () => {
  it('is the live order with the nearest window', () => {
    const orders = [order(A), order(B)];
    const blocks = [win('w1', '2026-12-01', { clubOrderId: A }), win('w2', '2026-10-30', { clubOrderId: B })];
    expect(focusOrder(orders, blocks, TODAY)?.id).toBe(B);
  });
  it('falls back to the newest order, and is null for a club without one', () => {
    const orders = [order(A, { status: 'Cancelled', createdAtUtc: '2026-01-01T00:00:00Z' }), order(B, { status: 'Cancelled', createdAtUtc: '2026-02-01T00:00:00Z' })];
    expect(focusOrder(orders, [], TODAY)?.id).toBe(B);
    expect(focusOrder([], [], TODAY)).toBeNull();
  });
});

describe('small helpers', () => {
  it('contactLine names only what the club gave', () => {
    expect(contactLine({ contactPerson: 'Jan Trenér', contactPhone: '+420 603 221 004', contactEmail: null })).toBe('Jan Trenér · +420 603 221 004');
    expect(contactLine({ contactPerson: ' ', contactPhone: null, contactEmail: null })).toBe('Kontakt zatím není vyplněn.');
  });
  it('historyPath is the order history page', () => {
    expect(historyPath(A)).toBe(`/clubs/objednavky/${A}/historie`);
  });
});
