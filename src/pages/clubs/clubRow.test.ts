import { describe, it, expect } from 'vitest';
import type { ClubBlockView } from '../../api/clubBlocks';
import type { Club } from '../../api/clubs';
import { buildClubRow, isBlockLive, sortBlocks } from './clubRow';

const club = (over: Partial<Club> = {}): Club => ({
  id: 'club-1', name: 'FK Slaný', ico: '00000019', paymentTermsDays: 14, isActive: true, createdAt: '', ...over,
});

const block = (over: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id: 'b-1', clubId: 'club-1', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: [], activityIds: [],
  fromDate: '2026-10-26', toDate: '2026-11-03', dailyFrom: null, dailyTo: null, playerCount: 40, seats: 40, registered: 0,
  status: 'Active', registrationToken: null, registrationUrl: null, note: null, createdAtUtc: null, athletes: [], ...over,
});

describe('block order and liveness', () => {
  it('lists active blocks first, then by first day', () => {
    const list = sortBlocks([
      block({ id: 'old', status: 'Cancelled', fromDate: '2026-01-01' }),
      block({ id: 'late', fromDate: '2026-12-01', toDate: '2026-12-02' }),
      block({ id: 'soon', fromDate: '2026-10-26' }),
    ]);
    expect(list.map((b) => b.id)).toEqual(['soon', 'late', 'old']);
  });

  it('is live while active and not over', () => {
    expect(isBlockLive(block(), '2026-11-03')).toBe(true);
    expect(isBlockLive(block(), '2026-11-04')).toBe(false);
    expect(isBlockLive(block({ status: 'Cancelled' }), '2026-10-27')).toBe(false);
  });
});

describe('buildClubRow', () => {
  it('is "none" for a club with nothing, and takes no colour from nowhere', () => {
    const row = buildClubRow(club(), [], [], '2026-10-27');
    expect(row.status).toBe('none');
    expect(row.headcount).toBeNull();
    expect(row.color).toBeNull();
    expect(row.percent).toBeNull();
  });

  it('is active with the players of its live blocks and the colour its blocks carry', () => {
    const row = buildClubRow(club(), [], [block(), block({ id: 'b-2', playerCount: 20 }), block({ id: 'b-x', clubId: 'club-2', playerCount: 999 })], '2026-10-27');
    expect(row.status).toBe('active');
    expect(row.headcount).toBe(60);
    expect(row.color).toBe('#2E7D6B');
    expect(row.blocks.map((b) => b.id)).toEqual(['b-1', 'b-2']);
  });

  it('is finished, not "none", when every block is over or cancelled', () => {
    expect(buildClubRow(club(), [], [block({ status: 'Cancelled' })], '2026-10-27').status).toBe('done');
    expect(buildClubRow(club(), [], [block()], '2027-01-01').status).toBe('done');
  });

  it("shows the club's own discount and colour, never one made from the headcount", () => {
    const row = buildClubRow(club({ discountPercent: 12.5, colorHex: '#112233' }), [], [block({ playerCount: 500 })], '2026-10-27');
    expect(row.percent).toBe(12.5);
    expect(row.color).toBe('#112233');
    expect(buildClubRow(club(), [], [block({ playerCount: 500 })], '2026-10-27').percent).toBeNull();
  });
});
