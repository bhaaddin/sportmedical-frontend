import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { editBlockRefs } from '../order/editSession';
import { rangeText } from './orderLogic';
import { orderWindows, rangesWithout, windowActivityIds, windowLabel } from './orderWindows';
import { UncoveredNotice, uncoveredNames } from './UncoveredNotice';
import { WindowPills } from './WindowPills';

const block = (id: string, from: string, over: Record<string, unknown> = {}) => ({
  id, clubId: 'c1', clubName: 'FK Slaný', colorHex: null, name: null, calendarIds: ['cal-1'], activityIds: ['a1', 'a2'], fromDate: from, toDate: from,
  dailyFrom: '08:00', dailyTo: '12:00', playerCount: 0, seats: 0, registered: 0, status: 'Active', registrationToken: null, registrationUrl: null,
  note: null, createdAtUtc: null, athletes: [], clubOrderId: 'o1', ...over,
});

const order = (over: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id: 'o1', clubId: 'c1', clubName: 'FK Slaný', serviceId: 's1', serviceName: 'Prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    activitySeats: [
      { activityId: 'a1', activityName: 'Základní sportovní prohlídka', durationMinutes: 30, seats: 4, registered: 0, unitPriceCzk: 200 },
      { activityId: 'a2', activityName: 'Spiroergometrie', durationMinutes: 60, seats: 2, registered: 0, unitPriceCzk: 400 },
    ],
    totalSeats: 6, registered: 0, note: '', ...over,
  });

const restricted = () =>
  order({
    blocks: [block('b1', '2026-10-26', { activityIds: ['a2'] }), block('b2', '2026-10-27', { activityIds: ['a1'] }), block('b3', '2026-10-28')],
    requestedRanges: [
      { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00', activityIds: ['a2'] },
      { fromDate: '2026-10-27', toDate: '2026-10-27', dailyFrom: '08:00', dailyTo: '12:00', activityIds: ['a1'] },
      { fromDate: '2026-10-28', toDate: '2026-10-28', dailyFrom: '08:00', dailyTo: '12:00', activityIds: null },
    ],
  });

describe('a window that allows only some činnosti says so', () => {
  it('the label of an unrestricted window is unchanged, a restricted one gets the činnost', () => {
    const o = restricted();
    const [w1, w2, w3] = orderWindows(o);
    expect(windowLabel(w1, o)).toBe('Po 26. 10. · 08:00–12:00 · Spiroergometrie');
    expect(windowLabel(w2, o)).toBe('Út 27. 10. · 08:00–12:00 · Základní sportovní prohlídka');
    expect(windowLabel(w3, o)).toBe('St 28. 10. · 08:00–12:00');
    /* without the order nothing is known: the old label */
    expect(windowLabel(w1)).toBe('Po 26. 10. · 08:00–12:00');
  });

  it('the order period is the authority, a block alone falls back to the činnosti it carries', () => {
    const o = restricted();
    expect(windowActivityIds(o.blocks[0], o)).toEqual(['a2']);
    expect(windowActivityIds(o.blocks[2], o)).toBeNull();
    const noPeriods = order({ blocks: [block('b1', '2026-10-26', { activityIds: ['a2'] })] });
    expect(windowActivityIds(noPeriods.blocks[0], noPeriods)).toEqual(['a2']);
    /* a single-činnost order can never be restricted */
    const single = order({ activitySeats: [{ activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 4, registered: 0, unitPriceCzk: null }], blocks: [block('b1', '2026-10-26', { activityIds: ['a1'] })] });
    expect(windowActivityIds(single.blocks[0], single)).toBeNull();
  });

  it('pills show it on the order card, the detail and the calendar popover', () => {
    const o = restricted();
    render(<WindowPills order={o} today="2026-10-01" testId="order-card-windows" />);
    const pills = within(screen.getByTestId('order-card-windows')).getAllByTestId('order-window').map((p) => p.textContent);
    expect(pills).toEqual([
      'Po 26. 10. · 08:00–12:00 · Spiroergometrie',
      'Út 27. 10. · 08:00–12:00 · Základní sportovní prohlídka',
      'St 28. 10. · 08:00–12:00',
    ]);
  });

  it('a requested period says it too', () => {
    const o = restricted();
    expect(rangeText(o.requestedRanges[0], o)).toBe('26. 10. 2026, 08:00–12:00 · Spiroergometrie');
    expect(rangeText(o.requestedRanges[2], o)).toBe('28. 10. 2026, 08:00–12:00');
    expect(rangeText(o.requestedRanges[0])).toBe('26. 10. 2026, 08:00–12:00');
  });

  it('editing prefills each window with its činnosti; removing a window keeps the others restricted', () => {
    const o = restricted();
    const refs = editBlockRefs(o);
    expect(refs.map((r) => r.range.activityIds ?? null)).toEqual([['a2'], ['a1'], null]);
    const { ranges } = rangesWithout(o, 'b3');
    expect(ranges).toEqual([
      { fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00', activityIds: ['a2'] },
      { fromDate: '2026-10-27', toDate: '2026-10-27', dailyFrom: '08:00', dailyTo: '12:00', activityIds: ['a1'] },
    ]);
  });
});

describe('činnosti with no window', () => {
  it('reads uncoveredActivityIds tolerantly and names them', () => {
    expect(order().uncoveredActivityIds).toEqual([]);
    const o = order({ uncoveredActivityIds: ['a2'], blocks: [block('b1', '2026-10-26', { activityIds: ['a1'] })] });
    expect(o.uncoveredActivityIds).toEqual(['a2']);
    expect(uncoveredNames(o)).toEqual(['Spiroergometrie']);
    render(<UncoveredNotice order={o} />);
    expect(screen.getByTestId('order-uncovered')).toHaveTextContent('Bez termínu: Spiroergometrie');
  });

  it('says nothing for a cancelled order or when every činnost has a window', () => {
    expect(uncoveredNames(order({ status: 'Cancelled', uncoveredActivityIds: ['a2'] }))).toEqual([]);
    expect(uncoveredNames(order({ uncoveredActivityIds: [] }))).toEqual([]);
  });

  it('absent activityIds on a stored period reads as all', () => {
    const o = order({ requestedRanges: [{ fromDate: '2026-10-26', toDate: '2026-10-26', dailyFrom: '08:00', dailyTo: '12:00' }] });
    expect(o.requestedRanges[0].activityIds).toBeNull();
  });
});
