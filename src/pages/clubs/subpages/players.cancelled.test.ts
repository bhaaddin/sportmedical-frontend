/* R21: the players page lists the players of live orders; a cancelled order's players are not live players. */
import { describe, expect, it } from 'vitest';
import { toOrder, type ClubOrderStatus, type ClubOrderView } from '../../../api/clubOrders';
import { collectPlayers } from './players';

const order = (id: string, status: ClubOrderStatus): ClubOrderView =>
  toOrder({
    id, groupId: id, clubId: 'c1', clubName: 'FK Slaný', status, createdAtUtc: '2026-10-01T10:00:00Z',
    blocks: [{ id: `b-${id}`, clubId: 'c1', clubName: 'FK Slaný', status: 'Active', fromDate: '2026-11-02', toDate: '2026-11-02', athletes: [{ id: `a-${id}`, name: `Hráč ${id}`, activityName: 'Základní', status: 'Booked' }] }],
  });

describe('collectPlayers and cancelled orders', () => {
  it('takes the players of every live status and none of a cancelled order', () => {
    const statuses: ClubOrderStatus[] = ['Invited', 'Requested', 'Confirmed', 'Completed', 'Cancelled'];
    const rows = collectPlayers([], statuses.map((s) => order(s.toLowerCase(), s)));
    expect(rows.map((r) => r.name)).toEqual(['Hráč invited', 'Hráč requested', 'Hráč confirmed', 'Hráč completed']);
  });
});
