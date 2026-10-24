/* R21: the cancelled-orders view's filters, and the live / cancelled split on EVERY status. */
import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, toOrder, type ClubOrderStatus, type ClubOrderView } from '../../../api/clubOrders';
import { cancellationOf, isCancelledOrder, onlyCancelled, withoutCancelled } from '../../../components/clubs/orders/orderLogic';
import { clubOrdersHistoryPath, CLUB_ORDERS_HISTORY_PATH } from '../../../components/shell/plannerRoutes';
import { historyRows, type CancellationInfo } from './ordersHistory';

const make = (id: string, status: ClubOrderStatus, over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({ id, groupId: id, clubId: 'c1', clubName: 'FK Slaný', status, createdAtUtc: '2026-10-01T10:00:00Z', ...over });

const dayKey = (instant: string): string => instant.slice(0, 10);

describe('the live / cancelled split', () => {
  it.each(ORDER_STATUSES.map((s) => [s]))('%s is on exactly one side', (status) => {
    const o = make('x', status);
    expect(isCancelledOrder(o)).toBe(status === 'Cancelled');
    expect(withoutCancelled([o])).toHaveLength(status === 'Cancelled' ? 0 : 1);
    expect(onlyCancelled([o])).toHaveLength(status === 'Cancelled' ? 1 : 0);
  });

  it('Invited, Requested, Confirmed and Completed stay visible; only Zrušeno goes to Historie', () => {
    const all = ORDER_STATUSES.map((s) => make(s, s));
    expect(withoutCancelled(all).map((o) => o.status)).toEqual(['Invited', 'Requested', 'Confirmed', 'Completed']);
    expect(onlyCancelled(all).map((o) => o.status)).toEqual(['Cancelled']);
  });
});

describe('cancellationOf', () => {
  it('takes the newest entry that speaks of a cancellation', () => {
    const entry = cancellationOf([
      { atUtc: '2026-10-01T10:00:00Z', user: 'A', text: 'Objednávka vytvořena' },
      { atUtc: '2026-10-05T10:00:00Z', user: 'B', text: 'Zrušeno: nemoc' },
      { atUtc: '2026-10-03T10:00:00Z', user: 'C', text: 'Objednávka zrušena' },
    ]);
    expect(entry?.text).toBe('Zrušeno: nemoc');
  });
  it('is null without such an entry or without history', () => {
    expect(cancellationOf([{ atUtc: '', user: '', text: 'Potvrzeno' }])).toBeNull();
    expect(cancellationOf(undefined)).toBeNull();
  });
});

describe('historyRows', () => {
  const orders = [
    make('a', 'Cancelled'),
    make('b', 'Cancelled', { clubId: 'c2', clubName: 'Šumavští', createdAtUtc: '2026-10-02T10:00:00Z' }),
    make('c', 'Confirmed'),
  ];
  const none = { search: '', clubId: '', from: '', to: '' };
  const info = new Map<string, CancellationInfo>([
    ['a', { atUtc: '2026-10-05T12:00:00Z', text: 'x' }],
    ['b', { atUtc: '2026-10-09T12:00:00Z', text: null }],
  ]);

  it('lists only the cancelled, most recently cancelled first', () => {
    expect(historyRows(orders, none, info, dayKey).map((o) => o.id)).toEqual(['b', 'a']);
  });
  it('unknown dates sort after the known ones, newest created first', () => {
    const more = [...orders, make('d', 'Cancelled', { createdAtUtc: '2026-10-03T10:00:00Z' })];
    expect(historyRows(more, none, info, dayKey).map((o) => o.id)).toEqual(['b', 'a', 'd']);
  });
  it('searches the club name without accents, and the code', () => {
    expect(historyRows(orders, { ...none, search: 'sumavsti' }, info, dayKey).map((o) => o.id)).toEqual(['b']);
    const long = make('00000000-0000-4000-8000-0000000000aa', 'Cancelled');
    expect(historyRows([long], { ...none, search: 'ko-000000aa' }, info, dayKey)).toHaveLength(1);
    expect(historyRows([long], { ...none, search: 'ko-000000bb' }, info, dayKey)).toHaveLength(0);
  });
  it('filters by club', () => {
    expect(historyRows(orders, { ...none, clubId: 'c2' }, info, dayKey).map((o) => o.id)).toEqual(['b']);
  });
  it('the day filter keeps only orders cancelled inside it (unknown day = out)', () => {
    expect(historyRows(orders, { ...none, from: '2026-10-06' }, info, dayKey).map((o) => o.id)).toEqual(['b']);
    expect(historyRows(orders, { ...none, to: '2026-10-05' }, info, dayKey).map((o) => o.id)).toEqual(['a']);
    expect(historyRows([make('z', 'Cancelled')], { ...none, from: '2026-01-01' }, info, dayKey)).toEqual([]);
  });
});

describe('the address', () => {
  it('spells the view with an optional club', () => {
    expect(CLUB_ORDERS_HISTORY_PATH).toBe('/clubs/objednavky/historie');
    expect(clubOrdersHistoryPath()).toBe('/clubs/objednavky/historie');
    expect(clubOrdersHistoryPath('')).toBe('/clubs/objednavky/historie');
    expect(clubOrdersHistoryPath('a b')).toBe('/clubs/objednavky/historie?clubId=a%20b');
  });
});
