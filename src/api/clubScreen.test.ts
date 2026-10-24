import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { announceRemoteWrite } from './requestPolicy';
import { calendar, clubSettings, service } from '../planner/api/testSupport';

const get = vi.fn();
const session = vi.hoisted(() => ({ perms: null as string | null, listeners: new Set<() => void>() }));
vi.mock('../auth/localSession', async () => {
  const actual = await vi.importActual<typeof import('../auth/localSession')>('../auth/localSession');
  return { ...actual, permissionsSnapshot: () => session.perms, subscribePermissions: (l: () => void) => (session.listeners.add(l), () => session.listeners.delete(l)) };
});
vi.mock('./client', () => ({ default: { get: (...args: unknown[]) => get(...args) }, client: {} }));
vi.mock('./activities', async () => {
  const actual = await vi.importActual<typeof import('./activities')>('./activities');
  return { ...actual, readActivityList: async (body: unknown) => body };
});

const { makeClubScreenSeeder, resetClubScreenForTests, clubScreenBlocked, clubScreenKeys } = await import('./clubScreen');

const CLUB = 'club-1';
const allowed = () => ['patients.view'];
const ok = (data: unknown) => ({ data });
const orderRaw = (id: string, over: Record<string, unknown> = {}) => ({ id, clubId: CLUB, status: 'Confirmed', ...over });

function screen(patch: Record<string, unknown> = {}) {
  return {
    clubId: CLUB,
    sections: {
      club: ok({ id: CLUB, name: 'FC Sparta', isActive: true }),
      orders: ok([orderRaw('o1'), orderRaw('o2')]),
      clubBlocks: ok([]),
      summary: ok({ totalSeats: 12, ordersByStatus: { confirmed: 2 } }),
      calendars: ok([calendar('cal-a')]),
      activities: ok({ activities: [], warnings: [] }),
      clinicServices: ok([service]),
      clubSettings: ok(clubSettings),
      ...patch,
    },
  };
}

let qc: QueryClient;
beforeEach(() => {
  get.mockReset();
  resetClubScreenForTests();
  qc = new QueryClient();
});

describe('club screen seeder', () => {
  it('fills the keys the club page reads from the one answer', async () => {
    get.mockResolvedValue(ok(screen()));
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(true);

    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![0]).toBe(`/api/v1/screens/club/${CLUB}`);
    expect(get.mock.calls[0]![1].params).toBeUndefined();
    expect(qc.getQueryData<{ name: string }>(clubScreenKeys.club(CLUB))?.name).toBe('FC Sparta');
    expect(qc.getQueryData<unknown[]>(clubScreenKeys.orders(CLUB))).toHaveLength(2);
    expect(qc.getQueryData<unknown[]>(clubScreenKeys.blocks(CLUB))).toEqual([]);
    expect(qc.getQueryData<{ totalSeats: number }>(clubScreenKeys.summary(CLUB))?.totalSeats).toBe(12);
    expect(qc.getQueryData(['calendars'])).toHaveLength(1);
    expect(qc.getQueryData(['clinic-services'])).toHaveLength(1);
  });

  it('passes orderId and seeds that order under the key the order panel reads', async () => {
    get.mockResolvedValue(ok(screen({ order: ok(orderRaw('o7')) })));
    const seeder = makeClubScreenSeeder(qc, allowed);

    await seeder.seed(CLUB, 'o7');

    expect(get.mock.calls[0]![1].params).toEqual({ orderId: 'o7' });
    expect((qc.getQueryData(clubScreenKeys.order('o7')) as { id: string }).id).toBe('o7');
  });

  it('shares one request between two readers that ask together', async () => {
    get.mockResolvedValue(ok(screen()));
    const seeder = makeClubScreenSeeder(qc, allowed);

    await Promise.all([seeder.seed(CLUB), seeder.seed(CLUB)]);

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not ask without patients.view', async () => {
    const seeder = makeClubScreenSeeder(qc, () => ['bookings.create']);

    expect(seeder.willAsk(CLUB)).toBe(false);
    expect(await seeder.seed(CLUB)).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  it('does not ask again for what is fresh', async () => {
    get.mockResolvedValue(ok(screen()));
    const seeder = makeClubScreenSeeder(qc, allowed);
    await seeder.seed(CLUB);

    expect(seeder.willAsk(CLUB)).toBe(false);
    expect(await seeder.seed(CLUB)).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it.each([404, 405])('an older server (%i): nothing seeded, not asked again, the page reads as before', async (status) => {
    get.mockRejectedValue({ response: { status } });
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(false);

    expect(qc.getQueryData(clubScreenKeys.club(CLUB))).toBeUndefined();
    expect(clubScreenBlocked()).toBe(true);
    expect(seeder.willAsk(CLUB)).toBe(false);
    expect(await seeder.seed('club-2')).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    /* remembered for this tab's session, so a reload does not ask a server that has no route */
    expect(window.sessionStorage.getItem('sm.clubScreen.unsupportedUntil')).not.toBeNull();
  });

  it('a club the server does not know is the page\'s own business: the route is not marked missing', async () => {
    get.mockRejectedValue({ response: { status: 404, data: { code: 'club.not_found' } } });
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(false);

    expect(clubScreenBlocked()).toBe(false);
    expect(seeder.willAsk('club-2')).toBe(true);
  });

  it('a failure that may pass (5xx, offline) backs off for a minute without the 10-minute memo', async () => {
    get.mockRejectedValue({ response: { status: 503 } });
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(false);

    expect(clubScreenBlocked()).toBe(true);
    expect(window.sessionStorage.getItem('sm.clubScreen.unsupportedUntil')).toBeNull();
    expect(seeder.willAsk(CLUB)).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a section that failed or does not parse leaves only its own key empty', async () => {
    get.mockResolvedValue(ok(screen({
      orders: { error: { code: 'screen.section_failed', message: 'x' } },
      summary: ok('not an object'),
      calendars: ok({ nonsense: true }),
    })));
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(true);

    expect(qc.getQueryData(clubScreenKeys.club(CLUB))).toBeDefined();
    expect(qc.getQueryData(clubScreenKeys.orders(CLUB))).toBeUndefined();
    expect(qc.getQueryData(clubScreenKeys.summary(CLUB))).toBeUndefined();
    expect(qc.getQueryData(['calendars'])).toBeUndefined();
    expect(qc.getQueryData(['clinic-services'])).toHaveLength(1);
  });

  it('an answer for another club is not taken for this one', async () => {
    get.mockResolvedValue(ok(screen({ club: ok({ id: 'other', name: 'Jiný' }) })));
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(false);

    expect(qc.getQueryData(clubScreenKeys.club(CLUB))).toBeUndefined();
  });

  it('an answer without sections seeds nothing', async () => {
    get.mockResolvedValue(ok({ clubId: CLUB }));
    const seeder = makeClubScreenSeeder(qc, allowed);

    expect(await seeder.seed(CLUB)).toBe(false);

    expect(qc.getQueryData(clubScreenKeys.orders(CLUB))).toBeUndefined();
  });

  it('drops an answer when a write lands while it is on its way (write epoch)', async () => {
    let release: (value: unknown) => void = () => undefined;
    get.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const seeder = makeClubScreenSeeder(qc, allowed);

    const pending = seeder.seed(CLUB);
    announceRemoteWrite();
    release(ok(screen()));

    expect(await pending).toBe(false);
    expect(qc.getQueryData(clubScreenKeys.club(CLUB))).toBeUndefined();
    expect(qc.getQueryData(clubScreenKeys.orders(CLUB))).toBeUndefined();
  });

  it('a new session (other account) forgets what the last one learned about the server', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    const seeder = makeClubScreenSeeder(qc, allowed);
    await seeder.seed(CLUB);
    expect(clubScreenBlocked()).toBe(true);

    session.perms = '["patients.view","x"]';
    session.listeners.forEach((listener) => listener());

    expect(clubScreenBlocked()).toBe(false);
  });
});
