/*
 * Reviewer 2.2 in the reservation drawer: the individual bookings of one činnost fold into ONE card and ONE record line; windows and
 * lone bookings stay what they are; every member still opens its own record.
 */
import { describe, expect, it } from 'vitest';
import { dayEventCardModel, makeContext, type PlannerCategory, type PlannerSession } from '../../../model';
import { foldRecords, type DayRecord } from './dayRecords';
import { foldCards } from './foldCards';

const DAY = '2026-12-07';
const komplex: PlannerCategory = { id: 'k', name: 'Komplexní prohlídka', iconKey: 'heart', color: '#e9c46a', slotMinutes: 60, parallelCapacity: 2 };
const zaklad: PlannerCategory = { id: 'z', name: 'Základní prohlídka', iconKey: 'heart', color: '#e76f51', slotMinutes: 40, parallelCapacity: 1 };

const term = (id: string, categoryId: string, start: string, end: string, booked: number, capacity: number): PlannerSession => ({
  id, date: DAY, start, end, categoryId, booked, capacity, origin: 'public', showInList: true,
  appointmentIds: [id], appointments: [{ id, calendarId: 'c1', patientName: `P ${id}`, status: 0, heads: booked, priceCzk: 1000 }],
});
const window_ = (id: string): PlannerSession => ({ id, date: DAY, start: '08:00', end: '12:00', categoryId: 'k', booked: 0, capacity: 6, origin: 'club', showInList: true });

describe('foldCards', () => {
  const sessions = [term('a', 'k', '08:00', '09:00', 1, 2), term('b', 'k', '09:00', '10:00', 1, 2), term('c', 'k', '10:00', '11:00', 1, 2), term('z1', 'z', '08:00', '08:40', 1, 1), window_('w')];
  const ctx = makeContext({ categories: [zaklad, komplex], sessions, today: '2026-10-21' });
  const cards = sessions.map((s) => dayEventCardModel(ctx, s));

  it('three bookings of a činnost with two parallel places are one card: 3 people, not the 6 seats', () => {
    const folded = foldCards(ctx, cards);
    const group = folded.find((c) => c.folded);
    expect(group).toMatchObject({ id: 'group:k', name: 'Komplexní prohlídka ×3', timeRange: '08:00–11:00', slotsLabel: '3 sloty', confirmed: 3, cap: 6, statusText: '3 volných', progressPercent: 50 });
    expect(group?.folded).toEqual({ people: 3, ids: ['a', 'b', 'c'] });
    expect(group).toMatchObject({ canAddClub: false, canAddPublic: false });
  });

  it('a lone booking and a club window keep their own cards', () => {
    const folded = foldCards(ctx, cards);
    expect(folded.map((c) => c.id)).toEqual(['group:k', 'z1', 'w']);
    expect(folded.filter((c) => c.folded)).toHaveLength(1);
  });

  it('a day with one booking per činnost folds nothing', () => {
    const one = foldCards(ctx, [cards[3]!, cards[4]!]);
    expect(one.map((c) => c.id)).toEqual(['z1', 'w']);
  });
});

describe('foldRecords', () => {
  const rec = (key: string, categoryId: string | null, heads: number, price: number | null, window = false): DayRecord => ({
    key,
    ref: window ? { type: 'clubWindow', clubBlockId: key, clubOrderId: null, clubId: null } : { type: 'appointment', appointmentId: key, calendarId: 'c1' },
    date: DAY, start: '09:00', end: '10:00', categoryId, title: categoryId === 'k' ? 'Komplexní prohlídka' : 'Základní prohlídka', subtitle: null, tone: '#e9c46a',
    origin: window ? 'club' : 'public', window, channel: window ? 'club' : 'unknown', priceText: price === null ? 'bez ceny' : `${price} Kč`, priceCaption: null, priceCzk: price, heads,
  });

  it('folds two or more bookings of a činnost into one line with the people, the span and the summed price', () => {
    const items = foldRecords([rec('a', 'k', 1, 1000), { ...rec('b', 'k', 3, 500), start: '10:00', end: '11:00' }, rec('z', 'z', 1, null), rec('w', null, 0, null, true)]);
    expect(items.map((i) => i.type)).toEqual(['fold', 'record', 'record']);
    const first = items[0]!;
    const fold = first.type === 'fold' ? first.fold : null;
    expect(fold).toMatchObject({ title: 'Komplexní prohlídka ×4', count: 4, start: '09:00', end: '11:00', priceCzk: 1500 });
    expect(fold?.records.map((r) => r.key)).toEqual(['a', 'b']);
  });

  it('a činnost with no priced row says "bez ceny"', () => {
    const items = foldRecords([rec('a', 'k', 1, null), rec('b', 'k', 1, null)]);
    const first = items[0]!;
    expect(first.type === 'fold' && first.fold.priceText).toBe('bez ceny');
  });

  it('thirty bookings of one činnost are one item', () => {
    const many = Array.from({ length: 30 }, (_, i) => rec(`p${i}`, 'k', 1, 1000));
    const items = foldRecords(many);
    expect(items).toHaveLength(1);
    const first = items[0]!;
    expect(first.type === 'fold' && first.fold.count).toBe(30);
  });
});
