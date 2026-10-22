/*
 * What starts before a screen exists: nothing for a signed-out browser or an unrelated address; the reference reads for a
 * calendar address; a club's own reads for its address (with its account, its code and its stage); and a second start
 * inside the freshness window asks nothing new. A club the club list has already read is drawn from that answer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const m = vi.hoisted(() => ({
  calendars: vi.fn(), activities: vi.fn(), services: vi.fn(), display: vi.fn(), clubSettings: vi.fn(), publicClinic: vi.fn(),
  holidays: vi.fn(), clubById: vi.fn(), clubAll: vi.fn(), orders: vi.fn(), blocks: vi.fn(), blockable: vi.fn(),
}));
const side = vi.hoisted(() => ({ account: vi.fn(), selection: vi.fn(), stage: vi.fn() }));

vi.mock('./calendars', () => ({ calendarsApi: { list: m.calendars } }));
vi.mock('./activities', () => ({ activitiesApi: { list: m.activities } }));
vi.mock('./clinicServices', () => ({ clinicServicesApi: { list: m.services } }));
vi.mock('./clinicSettings', () => ({ readPublicClinic: m.publicClinic }));
vi.mock('./displaySettings', () => ({ CALENDAR_DISPLAY_QUERY_KEY: ['settings', 'calendar-display'], readCalendarDisplay: m.display }));
vi.mock('./holidays', () => ({ holidaysApi: { year: m.holidays } }));
vi.mock('./clubBlocks', () => ({ clubBlocksApi: { list: m.blocks }, fetchBlockableActivities: m.blockable }));
vi.mock('./clubOrders', () => ({ clubOrdersApi: { list: m.orders } }));
vi.mock('./clubs', () => ({
  CLUB_SETTINGS_QUERY_KEY: ['settings', 'clubs'],
  clubSettingsApi: { get: m.clubSettings },
  clubsApi: { getById: m.clubById, getAll: m.clubAll },
}));
vi.mock('../auth/accountRefresh', () => ({ refreshAccount: side.account }));
vi.mock('../planner/ClubPlannerPage', () => ({ default: () => null, clubSelection: side.selection, prefetchClubStage: side.stage }));

const { warmForPath } = await import('./warmStart');
const { prefetchClubScreen, clubRoute, SHARE_MAX_AGE_MS } = await import('./warmReads');
const CLUB = '942e2676-d730-4a13-8016-17f95abd26e2';
const OTHER = '11111111-2222-4333-8444-555555555555';

const calls = () => Object.values(m).reduce((n, fn) => n + fn.mock.calls.length, 0);
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));
const order = (id: string, clubId: string) => ({ id, clubId, status: 'Confirmed', blocks: [] });

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset().mockResolvedValue([]));
  side.account.mockReset().mockResolvedValue(undefined);
  side.selection.mockReset().mockReturnValue({ start: { today: '2026-10-21', openOn: '2026-10-26', session: null } });
  side.stage.mockReset().mockResolvedValue(undefined);
  localStorage.setItem('token', 't');
});

describe('warmForPath', () => {
  it('starts nothing for a signed-out browser', async () => {
    localStorage.removeItem('token');
    warmForPath(new QueryClient(), '/planovani');
    warmForPath(new QueryClient(), `/clubs/${CLUB}`);
    await settle();
    expect(calls()).toBe(0);
    expect(side.account).not.toHaveBeenCalled();
  });

  it('starts nothing for an address whose screen does not start from these reads', async () => {
    warmForPath(new QueryClient(), '/patients');
    warmForPath(new QueryClient(), '/login');
    await settle();
    expect(calls()).toBe(0);
  });

  it('starts the reference reads for the planner, each once', async () => {
    warmForPath(new QueryClient(), '/planovani');
    await settle();
    for (const fn of [m.calendars, m.activities, m.services, m.display, m.clubSettings, m.publicClinic, m.holidays]) {
      expect(fn).toHaveBeenCalledTimes(1);
    }
    expect(m.clubById).not.toHaveBeenCalled();
    expect(m.orders).not.toHaveBeenCalled();
    expect(side.account).not.toHaveBeenCalled();
  });

  it('starts every read of a club screen for its own address at once: club, orders, windows, catalogue, account, settings', async () => {
    warmForPath(new QueryClient(), `/clubs/${CLUB}/kalendar`);
    await settle();
    expect(m.clubById).toHaveBeenCalledWith(CLUB);
    expect(m.orders).toHaveBeenCalledWith({ clubId: CLUB });
    expect(m.blocks).toHaveBeenCalledTimes(1);
    expect(m.calendars).toHaveBeenCalledTimes(1);
    expect(m.blockable).toHaveBeenCalledTimes(1);
    expect(m.display).toHaveBeenCalledTimes(1);
    expect(m.clubSettings).toHaveBeenCalledTimes(1);
    expect(side.account).toHaveBeenCalledWith({ force: true });
  });

  it('starts the stage of the order the address names once the orders are known', async () => {
    const rows = [order('o-1', CLUB)];
    m.orders.mockResolvedValue(rows);
    warmForPath(new QueryClient(), `/clubs/${CLUB}/kalendar`, '?order=o-1', { usr: { clubBlockId: 'b-9' }, key: 'x' });
    await settle();
    expect(side.selection).toHaveBeenCalledWith(rows, [], expect.any(String), { orderId: 'o-1', blockId: 'b-9' });
    expect(side.stage).toHaveBeenCalledTimes(1);
  });

  it('starts the list reads for the club list', async () => {
    warmForPath(new QueryClient(), '/clubs');
    await settle();
    expect(m.clubAll).toHaveBeenCalledTimes(1);
    expect(m.blocks).toHaveBeenCalledTimes(1);
    expect(m.orders).toHaveBeenCalledWith({});
    expect(m.calendars).toHaveBeenCalledTimes(1);
    expect(m.clubById).not.toHaveBeenCalled();
    expect(side.stage).not.toHaveBeenCalled();
  });
});

describe('prefetchClubScreen', () => {
  it('asks nothing new for a club whose reads are still fresh (two screens, one request)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    prefetchClubScreen(client, CLUB);
    await settle();
    const first = calls();
    prefetchClubScreen(client, CLUB);
    await settle();
    expect(calls()).toBe(first);
  });

  it('fetches the screen code with it, unless the screen itself asks (its code is there)', async () => {
    const load = vi.spyOn(clubRoute, 'load');
    prefetchClubScreen(new QueryClient(), CLUB, { stage: false });
    expect(load).not.toHaveBeenCalled();
    prefetchClubScreen(new QueryClient(), CLUB);
    expect(load).toHaveBeenCalledTimes(1);
    await expect(load.mock.results[0]!.value).resolves.toMatchObject({ default: expect.any(Function) });
    load.mockRestore();
  });

  it('draws the club and its orders from what the club list read, and asks each once behind it', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    const club = { id: CLUB, name: 'FK Slaný' };
    const all = [order('o-1', CLUB), order('o-2', OTHER), order('o-3', CLUB)];
    client.setQueryData(['clubs'], [club, { id: OTHER, name: 'Jiný' }]);
    client.setQueryData(['club-orders', '', '', ''], all);
    let answer: (v: unknown) => void = () => undefined;
    m.orders.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    m.clubById.mockResolvedValue(club);

    prefetchClubScreen(client, CLUB, { stage: false });
    /* at once, before any answer */
    expect(client.getQueryData(['clubs', 'one', CLUB])).toEqual(club);
    expect(client.getQueryData(['club-orders', CLUB, '', ''])).toEqual([all[0], all[2]]);
    await settle();
    expect(m.clubById).toHaveBeenCalledTimes(1);
    expect(m.orders).toHaveBeenCalledTimes(1);
    expect(m.orders).toHaveBeenCalledWith({ clubId: CLUB });
    answer([all[0]]);
    await settle();
    /* the real answer replaces the shared copy */
    expect(client.getQueryData(['club-orders', CLUB, '', ''])).toEqual([all[0]]);
  });

  it('shares nothing from an answer that is too old or marked stale by a write', async () => {
    const old = new QueryClient();
    old.setQueryData(['club-orders', '', '', ''], [order('o-1', CLUB)], { updatedAt: Date.now() - SHARE_MAX_AGE_MS - 1 });
    prefetchClubScreen(old, CLUB, { stage: false });
    expect(old.getQueryData(['club-orders', CLUB, '', ''])).toBeUndefined();

    const written = new QueryClient();
    written.setQueryData(['club-orders', '', '', ''], [order('o-1', CLUB)]);
    await written.invalidateQueries({ refetchType: 'none' });
    prefetchClubScreen(written, CLUB, { stage: false });
    expect(written.getQueryData(['club-orders', CLUB, '', ''])).toBeUndefined();
    await settle();
  });
});
