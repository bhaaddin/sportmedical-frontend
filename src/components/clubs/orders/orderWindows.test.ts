import { describe, expect, it } from 'vitest';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { editBlockRefs, firstWindowDate, mergeSessionInto } from '../order/editSession';
import {
  heldMinutes, isLiveOrder, orderWindows, rangesWithout, shortSplit, termsWord, windowDates, windowLabel, windowMinutes,
} from './orderWindows';

const block = (id: string, from: string, to: string, over: Record<string, unknown> = {}) => ({
  id, clubId: 'c1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['cal-1'], activityIds: [], fromDate: from, toDate: to,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: 'o1', ...over,
});

const order = (blocks: ReturnType<typeof block>[], over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: 'o1', clubId: 'c1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a1', activityName: 'Základní prohlídka', durationMinutes: 30, seats: 12, registered: 0, unitPriceCzk: 200 },
      { activityId: 'a2', activityName: 'Komplexní prohlídka', durationMinutes: 60, seats: 10, registered: 0, unitPriceCzk: 400 },
    ],
    totalSeats: 22, registered: 0, note: 'x', blocks, ...over,
  });

describe('windows of one order', () => {
  const o = order([block('b2', '2026-10-29', '2026-10-30'), block('b1', '2026-10-26', '2026-10-27'), block('bx', '2026-11-02', '2026-11-02', { status: 'Cancelled' })]);

  it('lists only live windows, earliest first', () => {
    expect(orderWindows(o).map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('reads a window as date and hours', () => {
    expect(windowDates('2026-10-26', '2026-10-26')).toBe('Po 26. 10.');
    expect(windowDates('2026-10-26', '2026-10-27')).toBe('26.–27. 10.');
    expect(windowDates('2026-10-30', '2026-11-02')).toBe('30. 10. – 2. 11.');
    expect(windowLabel(o.blocks[1])).toBe('26.–27. 10. · 08:00–12:00');
    expect(windowLabel({ fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: null, dailyTo: null })).toBe('Po 26. 10.');
  });

  it('splits the činnosti by first word', () => {
    expect(shortSplit(o)).toBe('Základní 12 · Komplexní 10');
    expect(termsWord(1)).toBe('termín');
    expect(termsWord(3)).toBe('termíny');
    expect(termsWord(7)).toBe('termínů');
  });

  it('counts the minutes the windows hold (days x daily hours), or null when one has no hours', () => {
    expect(windowMinutes(o.blocks[1])).toBe(2 * 240);
    expect(heldMinutes(o)).toBe(4 * 240);
    expect(heldMinutes(order([block('w', '2026-10-26', '2026-10-26', { dailyFrom: null, dailyTo: null })]))).toBeNull();
    expect(heldMinutes(order([]))).toBe(0);
  });

  it('says which orders are live', () => {
    expect(isLiveOrder({ status: 'Requested' })).toBe(true);
    expect(isLiveOrder({ status: 'Confirmed' })).toBe(true);
    expect(isLiveOrder({ status: 'Cancelled' })).toBe(false);
    expect(isLiveOrder({ status: 'Completed' })).toBe(false);
  });
});

describe('the range set that drops exactly one window', () => {
  const o = order([block('b1', '2026-10-26', '2026-10-27'), block('b2', '2026-10-29', '2026-10-29'), block('b3', '2026-11-10', '2026-11-10')]);

  it('keeps every other window, as pick mode would send them', () => {
    const { ranges, calendarIds } = rangesWithout(o, 'b2');
    expect(ranges).toEqual([
      { fromDate: '2026-10-26', toDate: '2026-10-27', dailyFrom: '08:00', dailyTo: '12:00' },
      { fromDate: '2026-11-10', toDate: '2026-11-10', dailyFrom: '08:00', dailyTo: '12:00' },
    ]);
    expect(calendarIds).toEqual(['cal-1']);
  });

  it('keeps a window that is already over (nothing but the removed one goes)', () => {
    const past = order([block('p', '2020-01-06', '2020-01-06'), block('f', '2099-01-05', '2099-01-05')]);
    expect(rangesWithout(past, 'f').ranges).toEqual([{ fromDate: '2020-01-06', toDate: '2020-01-06', dailyFrom: '08:00', dailyTo: '12:00' }]);
  });

  it('with null drops nothing', () => {
    expect(rangesWithout(o, null).ranges).toHaveLength(3);
  });
});

describe('pick mode on an existing order', () => {
  const o = order([block('b2', '2026-10-29', '2026-10-29'), block('b1', '2026-10-26', '2026-10-27')]);

  it('hands over every live window, earliest first', () => {
    expect(editBlockRefs(o).map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(firstWindowDate(editBlockRefs(o), '2026-10-28')).toBe('2026-10-29');
    expect(firstWindowDate(editBlockRefs(o), '2027-01-01')).toBe('2026-10-26');
  });

  it('adds new players on top of the order: the same činnost sums up, a new one is appended', () => {
    const merged = mergeSessionInto(
      o,
      {
        clubId: 'c1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Prohlídky', paymentMethod: 'PerPerson', note: '',
        activities: [
          { activityId: 'a1', name: 'Základní prohlídka', seats: 3, minutesPerSeat: 30, parallelCapacity: 1 },
          { activityId: 'a3', name: 'Rychlá', seats: 5, minutesPerSeat: 15, parallelCapacity: 1 },
        ],
      },
      [{ id: 'a3', name: 'Rychlá', durationMinutes: 15, clinicServiceId: 's1', colorHex: '#000', parallelCapacity: 2 }],
      '2026-10-01',
    );
    expect(merged.activities.map((a) => [a.activityId, a.seats])).toEqual([['a1', 15], ['a2', 10], ['a3', 5]]);
    expect(merged.editOrder).toMatchObject({ mode: 'edit', orderId: 'o1', dirty: true });
    expect(merged.editOrder?.blocks.map((b) => b.id)).toEqual(['b1', 'b2']);
    /* The order keeps ITS payment and note. */
    expect(merged.paymentMethod).toBe('ClubInvoice');
    expect(merged.note).toBe('x');
  });
});
