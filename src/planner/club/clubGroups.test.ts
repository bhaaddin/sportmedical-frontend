/*
 * Which of a club's orders the stage opens on, and how a group reads in the switcher. Pure.
 */
import { describe, expect, it } from 'vitest';
import type { ClubBlockView } from '../../api/clubBlocks';
import { toOrder, type ClubOrderView } from '../../api/clubOrders';
import { clubGroups, defaultGroup, groupLine, openingDate, selectedGroup } from './clubGroups';

const TODAY = '2026-10-18';

const win = (id: string, orderId: string, from: string, to = from): ClubBlockView => ({
  id, clubId: 'club-1', clubOrderId: orderId, clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: ['cal-1'], activityIds: [],
  fromDate: from, toDate: to, dailyFrom: '08:00', dailyTo: '12:00', playerCount: 10, seats: 10, registered: 0,
  status: 'Active', registrationToken: 't', registrationUrl: 'https://app.test/klub/t', note: null, createdAtUtc: null, athletes: [],
});

let n = 0;
function order(over: Partial<Record<string, unknown>> & { id: string }, blocks: ClubBlockView[] = []): ClubOrderView {
  n += 1;
  return toOrder({
    clubId: 'club-1', clubName: 'FK Slaný', serviceName: 'Sportovní lékařské prohlídky', status: 'Confirmed', paymentMethod: 'ClubInvoice',
    requestedRanges: [], note: '', registered: 0, totalSeats: 10, createdAtUtc: `2026-09-${String(10 + n).padStart(2, '0')}T10:00:00Z`,
    parentOrderId: null, groupId: over.id, addenda: [], priceQuote: null,
    activitySeats: [{ activityId: 'a1', activityName: 'Základní', durationMinutes: 30, seats: 10, registered: 0, unitPriceCzk: 500 }],
    ...over, blocks,
  });
}

describe('clubGroups', () => {
  it('folds a root with its addendum into ONE group and leaves the cancelled orders out', () => {
    const root = order({ id: 'aaaa0000-0000-0000-0000-00000000aa01' }, [win('w1', 'r', '2026-11-10')]);
    const add = order({ id: 'bbbb0000-0000-0000-0000-00000000bb02', parentOrderId: root.id, groupId: root.id }, [win('w2', 'a', '2026-11-05')]);
    const dead = order({ id: 'cccc0000-0000-0000-0000-00000000cc03', status: 'Cancelled' }, [win('w3', 'c', '2026-10-20')]);
    const groups = clubGroups([add, root, dead], TODAY);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: root.id, code: 'KO-0000AA01', editable: true, firstDate: '2026-11-05', lastDate: '2026-11-10', nextDate: '2026-11-05' });
    expect(groups[0].orders.map((o) => o.id)).toEqual([root.id, add.id]);
    expect(groups[0].blockIds.sort()).toEqual(['w1', 'w2']);
    expect(groups[0].rootBlockIds).toEqual(['w1']);
  });

  it('only a Confirmed root is editable on the stage', () => {
    const groups = clubGroups([
      order({ id: 'a1' }), order({ id: 'a2', status: 'Invited' }), order({ id: 'a3', status: 'Requested' }), order({ id: 'a4', status: 'Completed' }),
    ], TODAY);
    expect(Object.fromEntries(groups.map((g) => [g.id, g.editable]))).toEqual({ a1: true, a2: false, a3: false, a4: false });
  });
});

describe('defaultGroup', () => {
  it('is the live group whose next window is nearest', () => {
    const far = order({ id: 'far' }, [win('w1', 'far', '2026-12-01')]);
    const near = order({ id: 'near' }, [win('w2', 'near', '2026-10-27'), win('w3', 'near', '2026-11-30')]);
    const past = order({ id: 'past' }, [win('w4', 'past', '2026-09-01')]);
    expect(defaultGroup(clubGroups([far, past, near], TODAY))?.id).toBe('near');
  });

  it('a window that is still running counts as ahead', () => {
    const running = order({ id: 'running' }, [win('w1', 'running', '2026-10-15', '2026-10-19')]);
    const later = order({ id: 'later' }, [win('w2', 'later', '2026-10-25')]);
    expect(defaultGroup(clubGroups([later, running], TODAY))?.id).toBe('running');
  });

  it('a group that is not live never wins over a live one with a window ahead', () => {
    const done = order({ id: 'done', status: 'Completed' }, [win('w1', 'done', '2026-10-20')]);
    const live = order({ id: 'live' }, [win('w2', 'live', '2026-12-20')]);
    expect(defaultGroup(clubGroups([done, live], TODAY))?.id).toBe('live');
  });

  it('with nothing ahead it is the most recent group', () => {
    const old = order({ id: 'old', createdAtUtc: '2026-01-01T10:00:00Z' }, [win('w1', 'old', '2026-02-01')]);
    const newest = order({ id: 'newest', createdAtUtc: '2026-08-01T10:00:00Z' }, [win('w2', 'newest', '2026-08-20')]);
    const invited = order({ id: 'inv', status: 'Invited', createdAtUtc: '2026-05-01T10:00:00Z' });
    expect(defaultGroup(clubGroups([old, invited, newest], TODAY))?.id).toBe('newest');
  });

  it('is null for a club without a live order', () => {
    expect(defaultGroup([])).toBeNull();
    expect(defaultGroup(clubGroups([order({ id: 'x', status: 'Cancelled' })], TODAY))).toBeNull();
  });
});

describe('selectedGroup / openingDate / groupLine', () => {
  const a = order({ id: 'ga' }, [win('w1', 'ga', '2026-11-02')]);
  const addendum = order({ id: 'ga2', parentOrderId: 'ga', groupId: 'ga' }, [win('w2', 'ga2', '2026-11-03')]);
  const b = order({ id: 'gb', serviceName: 'Sportovní diagnostika' }, [win('w3', 'gb', '2026-12-02')]);
  const groups = clubGroups([a, addendum, b], TODAY);

  it('takes the group `?order=` names - by its root or by any order of it - else the default', () => {
    expect(selectedGroup(groups, 'gb')?.id).toBe('gb');
    expect(selectedGroup(groups, 'ga2')?.id).toBe('ga');
    expect(selectedGroup(groups, 'nope')?.id).toBe('ga');
    expect(selectedGroup(groups, null)?.id).toBe('ga');
    expect(selectedGroup([], 'gb')).toBeNull();
  });

  it('opens the board on the group\'s first window ahead, else the club\'s, else today', () => {
    expect(openingDate(groups[1] ?? null, groups, TODAY)).toBe('2026-12-02');
    expect(openingDate(null, groups, TODAY)).toBe('2026-11-02');
    expect(openingDate(null, [], TODAY)).toBe(TODAY);
  });

  it('reads a group as code, služba, players and status', () => {
    expect(groupLine(groups[0])).toBe('KO-GA · Sportovní lékařské prohlídky · 20 hráčů · Potvrzeno');
  });
});
