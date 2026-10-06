import { describe, expect, it } from 'vitest';
import type { ClubOrderView } from '../../../api/clubOrders';
import { inquiriesByDay, inquiryDaysOf, inquiryLabel } from './inquiries';

const order = (o: Partial<ClubOrderView>): ClubOrderView => ({ id: 'o1', clubName: 'Dukla', status: 'Requested', requestedRanges: [], ...o }) as ClubOrderView;

describe('inquiries - club orders that block no time yet', () => {
  it('Invited draws the offered days, Requested the chosen days and the ranges', () => {
    expect(inquiryDaysOf(order({ status: 'Invited', offeredDates: ['2026-11-03', '2026-11-02'] }))).toEqual(['2026-11-02', '2026-11-03']);
    expect(inquiryDaysOf(order({ requestedDates: ['2026-11-30'], requestedRanges: [{ fromDate: '2026-11-02', toDate: '2026-11-03', dailyFrom: null, dailyTo: null }] })))
      .toEqual(['2026-11-02', '2026-11-03', '2026-11-30']);
  });

  it('a confirmed, completed or cancelled order draws nothing (its blocks do)', () => {
    for (const status of ['Confirmed', 'Completed', 'Cancelled'] as const) {
      expect(inquiryDaysOf(order({ status, requestedDates: ['2026-11-30'], offeredDates: ['2026-11-30'] }))).toEqual([]);
    }
  });

  it('groups by day and marks the order being processed as "Klub žádá"', () => {
    const map = inquiriesByDay([order({ requestedDates: ['2026-11-30'] }), order({ id: 'o2', clubName: 'Slavia', status: 'Invited', offeredDates: ['2026-11-30'] })], 'o1');
    const day = map.get('2026-11-30') ?? [];
    expect(day.map(inquiryLabel)).toEqual(['Klub žádá', 'Poptávka · Slavia']);
  });

  it('Etapa 10: a requested period restricted to a činnost says which (the other days stay plain)', () => {
    const o = order({
      activitySeats: [
        { activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 4, registered: 0, unitPriceCzk: null },
        { activityId: 'a2', activityName: 'Spiroergometrie', durationMinutes: 60, seats: 2, registered: 0, unitPriceCzk: null },
      ],
      requestedDates: ['2026-11-30'],
      requestedRanges: [{ fromDate: '2026-11-02', toDate: '2026-11-03', dailyFrom: null, dailyTo: null, activityIds: ['a2'] }],
    });
    const map = inquiriesByDay([o], null);
    expect((map.get('2026-11-02') ?? []).map(inquiryLabel)).toEqual(['Poptávka · Dukla · Spiroergometrie']);
    expect((map.get('2026-11-30') ?? []).map(inquiryLabel)).toEqual(['Poptávka · Dukla']);
    expect((inquiriesByDay([o], 'o1').get('2026-11-03') ?? []).map(inquiryLabel)).toEqual(['Klub žádá · Spiroergometrie']);
  });
});
