import { describe, expect, it } from 'vitest';
import type { ClubOrderView } from '../../api/clubOrders';
import type { TimeBlock } from '../../api/bookingContracts';
import { enrichClubBlocks, pendingDaysOf, pendingHoldBlocks } from './pendingHolds';
import { clubHolding, holdStateOf, offeredHolding, clubReservedText } from '../components/board/clubHold';

const order = (over: Partial<ClubOrderView>): ClubOrderView =>
  ({ id: 'o1', clubId: 'c1', clubName: 'FK Slaný', clubColorHex: '#EA580C', serviceId: null, status: 'Requested', requestedRanges: [], offeredDates: [], requestedDates: [], blocks: [], registered: 0, totalSeats: 10, ...over }) as unknown as ClubOrderView;

const open = () => ({ from: '08:00', to: '16:00' });
const input = (days: string[], hoursOf: (c: string, d: string) => { from: string; to: string } | null = open) => ({
  calendars: [
    { id: 'cal1', clinicServiceId: 's1' },
    { id: 'cal2', clinicServiceId: 's2' },
  ],
  hoursOf,
  days,
});

describe('pendingDaysOf (R22)', () => {
  it('a Requested order holds its single days and ranges, with the hours when every source gave them', () => {
    const days = pendingDaysOf(order({ requestedDates: ['2026-11-03'], requestedRanges: [{ fromDate: '2026-11-05', toDate: '2026-11-06', dailyFrom: '09:00', dailyTo: '12:00' }] }));
    expect(days).toEqual([
      { day: '2026-11-03', kind: 'requested', from: null, to: null },
      { day: '2026-11-05', kind: 'requested', from: '09:00', to: '12:00' },
      { day: '2026-11-06', kind: 'requested', from: '09:00', to: '12:00' },
    ]);
  });
  it('a day asked for both as a single day and as a timed range is the whole day', () => {
    const d = pendingDaysOf(order({ requestedDates: ['2026-11-05'], requestedRanges: [{ fromDate: '2026-11-05', toDate: '2026-11-05', dailyFrom: '09:00', dailyTo: '10:00' }] }));
    expect(d[0]).toMatchObject({ from: null, to: null });
  });
  it('an Invited order holds its offered days as OFFERED', () => {
    expect(pendingDaysOf(order({ status: 'Invited', offeredDates: ['2026-11-09'] }))).toEqual([{ day: '2026-11-09', kind: 'offered', from: null, to: null }]);
  });
  it('cancelled, confirmed and completed orders hold nothing here (R21: a cancelled order never shows)', () => {
    for (const status of ['Cancelled', 'Confirmed', 'Completed'] as const) {
      expect(pendingDaysOf(order({ status, requestedDates: ['2026-11-03'], offeredDates: ['2026-11-03'] }))).toEqual([]);
    }
  });
});

describe('pendingHoldBlocks (R22)', () => {
  it('makes one stand-in per open day and calendar, over the opening hours, flagged pending', () => {
    const map = pendingHoldBlocks([order({ requestedDates: ['2026-11-03'] })], input(['2026-11-03', '2026-11-04']));
    expect([...map.keys()].sort()).toEqual(['cal1', 'cal2']);
    const b = map.get('cal1')![0]!;
    expect(b).toMatchObject({ kind: 'club', pendingHold: 'requested', clubName: 'FK Slaný', clubOrderId: 'o1', colorHex: '#EA580C' });
    expect(b.startUtc).toBe('2026-11-03T07:00:00.000Z');
    expect(b.endUtc).toBe('2026-11-03T15:00:00.000Z');
  });
  it("follows the order's služba, the club's hours and closed days", () => {
    const map = pendingHoldBlocks(
      [order({ serviceId: 's2', requestedRanges: [{ fromDate: '2026-11-03', toDate: '2026-11-04', dailyFrom: '10:00', dailyTo: '12:00' }] })],
      input(['2026-11-03', '2026-11-04'], (_c, d) => (d === '2026-11-04' ? null : open())),
    );
    expect([...map.keys()]).toEqual(['cal2']);
    expect(map.get('cal2')).toHaveLength(1);
    expect(map.get('cal2')![0]!.startUtc).toBe('2026-11-03T09:00:00.000Z');
  });
  it('ignores days off screen and a request outside the opening hours', () => {
    expect(pendingHoldBlocks([order({ requestedDates: ['2026-12-01'] })], input(['2026-11-03'])).size).toBe(0);
    const late = order({ requestedRanges: [{ fromDate: '2026-11-03', toDate: '2026-11-03', dailyFrom: '18:00', dailyTo: '19:00' }] });
    expect(pendingHoldBlocks([late], input(['2026-11-03'])).size).toBe(0);
  });
  it('requested stand-ins refuse a booking, offered ones only warn', () => {
    const requested = pendingHoldBlocks([order({ requestedDates: ['2026-11-03'] })], input(['2026-11-03'])).get('cal1')!;
    const offered = pendingHoldBlocks([order({ status: 'Invited', offeredDates: ['2026-11-03'] })], input(['2026-11-03'])).get('cal1')!;
    const range = { start: 600, end: 660 };
    expect(clubHolding(requested, '2026-11-03', range)?.pendingHold).toBe('requested');
    expect(clubReservedText(requested[0]!)).toBe('Rezervováno pro klub FK Slaný · čeká na potvrzení');
    expect(offeredHolding(requested, '2026-11-03', range)).toBeNull();
    expect(offeredHolding(offered, '2026-11-03', range)?.clubName).toBe('FK Slaný');
    expect(holdStateOf(offered[0]!)).toBe('offered');
    expect(holdStateOf(requested[0]!)).toBe('requested');
  });
});

describe('enrichClubBlocks (R22, older server)', () => {
  const block = (over: Partial<TimeBlock> = {}): TimeBlock =>
    ({ id: 'b1', startUtc: '2026-11-03T07:00:00Z', endUtc: '2026-11-03T15:00:00Z', reason: 'FK', kind: 'club', clubBlockId: 'cb1', clubName: 'FK Slaný', ...over }) as TimeBlock;
  const confirmed = (registered: number, seats = 30) => order({ status: 'Confirmed', blocks: [{ id: 'cb1', seats, registered } as never] });
  it('completes the order and the hold state of a confirmed order with no players, flagged as derived', () => {
    const [b] = enrichClubBlocks([block()], [confirmed(0)]);
    expect(b).toMatchObject({ clubOrderId: 'o1', seats: 30, registered: 0, playersMissing: true, holdDerived: true });
    expect(holdStateOf(b!)).toBe('waiting');
  });
  it('a filled order is "full"; a block the server already described is left alone; a cancelled order adds nothing', () => {
    expect(holdStateOf(enrichClubBlocks([block()], [confirmed(30)])[0]!)).toBe('full');
    const described = block({ playersMissing: false, clubOrderId: 'x' });
    expect(enrichClubBlocks([described], [confirmed(0)])[0]).toEqual(described);
    expect(enrichClubBlocks([block()], [order({ status: 'Cancelled', blocks: [{ id: 'cb1', seats: 3, registered: 0 } as never] })])[0]).toEqual(block());
  });
  it('a manual block or an unknown club block is untouched', () => {
    const manual = block({ kind: 'manual' });
    expect(enrichClubBlocks([manual, block({ clubBlockId: 'zzz' })], [confirmed(0)])[0]).toBe(manual);
    expect(enrichClubBlocks([block({ clubBlockId: 'zzz' })], [confirmed(0)])[0]!.playersMissing).toBeUndefined();
  });
});
