import { QueryClient } from '@tanstack/react-query';
import { announceRemoteWrite } from '../../api/requestPolicy';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appt, calendar, CAL_A, CAL_B, clubSettings, display, preview, service, activity, A_MEDICAL } from './testSupport';

const get = vi.fn();
const session = vi.hoisted(() => ({ perms: null as string | null, listeners: new Set<() => void>() }));
vi.mock('../../auth/localSession', async () => {
  const actual = await vi.importActual<typeof import('../../auth/localSession')>('../../auth/localSession');
  return { ...actual, permissionsSnapshot: () => session.perms, subscribePermissions: (l: () => void) => (session.listeners.add(l), () => session.listeners.delete(l)) };
});
vi.mock('../../api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) }, client: {} }));
vi.mock('../../api/activities', async () => {
  const actual = await vi.importActual<typeof import('../../api/activities')>('../../api/activities');
  return { ...actual, readActivityList: async (body: unknown) => body };
});

const { makePlannerScreenSeeder, resetPlannerScreenForTests, plannerScreenBlocked } = await import('./plannerScreen');

const RANGE = { from: '2026-10-26', to: '2026-11-01' };
const ok = (data: unknown) => ({ data });
const failedSection = { error: { code: 'screen.section_failed', message: 'x' } };

function screen(patch: Record<string, unknown> = {}) {
  return {
    from: RANGE.from,
    to: RANGE.to,
    calendarIds: [CAL_A, CAL_B],
    sections: {
      calendars: ok([calendar(CAL_A), calendar(CAL_B), calendar('cal-off', { isActive: false })]),
      activities: ok({ activities: [activity(A_MEDICAL)], warnings: [] }),
      clinicServices: ok([service]),
      calendarDisplay: ok(display),
      clubSettings: ok(clubSettings),
      holidays: ok([
        { date: '2026-10-28', name: 'Den vzniku', isHoliday: true },
        { date: '2026-11-01', name: 'Jiny', isHoliday: true },
      ]),
      previews: ok({ [CAL_A]: [preview('2026-10-26')], [CAL_B]: [preview('2026-10-26')] }),
      blocks: ok({ [CAL_A]: [], [CAL_B]: [] }),
      day: ok([
        appt('a1', { calendarId: CAL_A, startUtc: '2026-10-27T08:00:00Z', endUtc: '2026-10-27T08:30:00Z' }),
        appt('a2', { calendarId: 'cal-off', startUtc: '2026-10-27T08:00:00Z', endUtc: '2026-10-27T08:30:00Z' }),
      ]),
      clubBlocks: ok([]),
      ...patch,
    },
  };
}

const allowed = () => ['patients.view', 'bookings.create'];
let qc: QueryClient;
beforeEach(() => {
  get.mockReset();
  resetPlannerScreenForTests();
  qc = new QueryClient();
});

describe('planner screen seeder', () => {
  it('fills the keys the planner reads from the one answer, for the active calendars only', async () => {
    get.mockResolvedValue({ data: screen() });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![0]).toBe('/api/v1/screens/planner');
    expect(get.mock.calls[0]![1]).toEqual({ params: { from: RANGE.from, to: RANGE.to, calendarIds: undefined } });
    expect(qc.getQueryData<unknown[]>(['calendars'])).toHaveLength(3);
    expect(qc.getQueryData(['clinic-services'])).toHaveLength(1);
    expect(qc.getQueryData(['holidays', 2026])).toHaveLength(2);
    const ids = `${CAL_A},${CAL_B}`;
    const day = qc.getQueryData<{ id: string }[]>(['day-range', RANGE.from, RANGE.to, ids]);
    expect(day?.map((r) => r.id)).toEqual(['a1']);
    const previews = qc.getQueryData<Map<string, Map<string, unknown>>>(['grid-preview', RANGE.from, RANGE.to, ids]);
    expect(previews?.get(CAL_A)?.get('2026-10-26')).toBeDefined();
    expect(qc.getQueryData(['blocks', CAL_A, RANGE.from, RANGE.to])).toEqual([]);
    expect(qc.getQueryData(['club-blocks', 'details', RANGE.from, RANGE.to])).toEqual([]);
  });

  it('asks only for the calendars the source shows when it names some', async () => {
    get.mockResolvedValue({ data: screen() });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE, [CAL_B]);
    expect(get.mock.calls[0]![1]).toEqual({ params: { from: RANGE.from, to: RANGE.to, calendarIds: CAL_B } });
    expect(qc.getQueryData(['day-range', RANGE.from, RANGE.to, CAL_B])).toBeDefined();
  });

  it('an older server (404): nothing is seeded, and it is not asked again in this session', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    await expect(seeder.seed(RANGE)).resolves.toBeUndefined();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(plannerScreenBlocked()).toBe(true);
    expect(Number(sessionStorage.getItem('sm.plannerScreen.unsupportedUntil'))).toBeGreaterThan(Date.now());
    await seeder.seed({ from: '2026-11-02', to: '2026-11-08' });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a failure that may pass (500) seeds nothing and is not retried at once, but is not remembered across page loads', async () => {
    get.mockRejectedValue({ response: { status: 500 } });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    await seeder.seed(RANGE);
    await seeder.seed({ from: '2026-11-02', to: '2026-11-08' });
    expect(get).toHaveBeenCalledTimes(1);
    expect(plannerScreenBlocked()).toBe(true);
    expect(sessionStorage.getItem('sm.plannerScreen.unsupportedUntil')).toBeNull();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  it('an account without patients.view never asks (a 403 would announce itself to the whole application)', async () => {
    await makePlannerScreenSeeder(qc, () => ['bookings.create']).seed(RANGE);
    expect(get).not.toHaveBeenCalled();
  });

  it('a section that failed is left for the planner to read itself; the rest is seeded', async () => {
    get.mockResolvedValue({ data: screen({ day: failedSection, previews: failedSection }) });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    const ids = `${CAL_A},${CAL_B}`;
    expect(qc.getQueryData(['day-range', RANGE.from, RANGE.to, ids])).toBeUndefined();
    expect(qc.getQueryData(['grid-preview', RANGE.from, RANGE.to, ids])).toBeUndefined();
    expect(qc.getQueryData(['blocks', CAL_A, RANGE.from, RANGE.to])).toEqual([]);
    expect(qc.getQueryData(['calendars'])).toBeDefined();
  });

  it('without the calendar list nothing calendar-bound is seeded', async () => {
    get.mockResolvedValue({ data: screen({ calendars: failedSection }) });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(qc.getQueryData(['calendars'])).toBeUndefined();
    expect(qc.getQueryData(['blocks', CAL_A, RANGE.from, RANGE.to])).toBeUndefined();
    expect(qc.getQueryData(['holidays', 2026])).toHaveLength(2);
  });

  it('a malformed section is skipped without failing the others', async () => {
    get.mockResolvedValue({ data: screen({ day: ok('not a list') }) });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(qc.getQueryData(['day-range', RANGE.from, RANGE.to, `${CAL_A},${CAL_B}`])).toBeUndefined();
    expect(qc.getQueryData(['blocks', CAL_A, RANGE.from, RANGE.to])).toEqual([]);
  });

  it('a garbage body changes nothing', async () => {
    get.mockResolvedValue({ data: '<html>' });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
  });

  it('reads that arrive together share one request', async () => {
    get.mockResolvedValue({ data: screen() });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    await Promise.all([seeder.seed(RANGE), seeder.seed(RANGE), seeder.seed(RANGE)]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not ask while the window is fresh in the cache, and asks again once it is marked stale', async () => {
    get.mockResolvedValue({ data: screen() });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(get).toHaveBeenCalledTimes(1);
    await qc.invalidateQueries({ queryKey: ['day-range'] });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('reads of one render are one request for the union, and each smaller window is cut out of it', async () => {
    const week = { from: '2026-10-26', to: '2026-11-01' };
    const month = { from: '2026-10-05', to: '2026-11-15' };
    get.mockResolvedValue({
      data: screen({
        day: ok([
          appt('in-week', { calendarId: CAL_A, startUtc: '2026-10-27T08:00:00Z', endUtc: '2026-10-27T08:30:00Z' }),
          appt('in-month', { calendarId: CAL_A, startUtc: '2026-11-10T08:00:00Z', endUtc: '2026-11-10T08:30:00Z' }),
        ]),
        previews: ok({ [CAL_A]: [preview('2026-10-27'), preview('2026-11-10')], [CAL_B]: [] }),
      }),
    });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    await Promise.all([seeder.seed(week), seeder.seed(month)]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]![1].params).toMatchObject({ from: month.from, to: month.to });
    const ids = `${CAL_A},${CAL_B}`;
    expect(qc.getQueryData<{ id: string }[]>(['day-range', month.from, month.to, ids])?.map((r) => r.id)).toEqual(['in-week', 'in-month']);
    expect(qc.getQueryData<{ id: string }[]>(['day-range', week.from, week.to, ids])?.map((r) => r.id)).toEqual(['in-week']);
    const weekPreview = qc.getQueryData<Map<string, Map<string, unknown>>>(['grid-preview', week.from, week.to, ids]);
    expect([...(weekPreview?.get(CAL_A)?.keys() ?? [])]).toEqual(['2026-10-27']);
  });

  it('windows that cannot share one request (more than 62 days apart) are asked for one by one', async () => {
    get.mockResolvedValue({ data: screen() });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    await Promise.all([seeder.seed({ from: '2026-01-05', to: '2026-01-11' }), seeder.seed({ from: '2026-10-26', to: '2026-11-01' })]);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('willAsk says whether a read would wait: not without the permission, not once blocked, not when fresh', async () => {
    get.mockResolvedValue({ data: screen() });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    expect(seeder.willAsk(RANGE)).toBe(true);
    expect(makePlannerScreenSeeder(qc, () => []).willAsk(RANGE)).toBe(false);
    await seeder.seed(RANGE);
    expect(seeder.willAsk(RANGE)).toBe(false);
  });

  it('an answer that started before a write does not seed rows from before it', async () => {
    let release: (v: unknown) => void = () => undefined;
    get.mockReturnValue(new Promise((r) => (release = r)));
    const seeder = makePlannerScreenSeeder(qc, allowed);
    const pending = seeder.seed(RANGE);
    await vi.waitFor(() => expect(get).toHaveBeenCalled());
    announceRemoteWrite();
    release({ data: screen() });
    await pending;
    expect(qc.getQueryData(['day-range', RANGE.from, RANGE.to, `${CAL_A},${CAL_B}`])).toBeUndefined();
    expect(qc.getQueryData(['calendars'])).toBeUndefined();
  });

  it('an answer without a day section is not asked for again for a while', async () => {
    get.mockResolvedValue({ data: screen({ day: failedSection }) });
    const seeder = makePlannerScreenSeeder(qc, allowed);
    await seeder.seed(RANGE);
    expect(seeder.willAsk(RANGE)).toBe(false);
    await seeder.seed(RANGE);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('a new session forgets that the server had no screen', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    await makePlannerScreenSeeder(qc, allowed).seed(RANGE);
    expect(plannerScreenBlocked()).toBe(true);
    session.perms = '["x"]';
    session.listeners.forEach((l) => l());
    expect(plannerScreenBlocked()).toBe(false);
    expect(window.sessionStorage.getItem('sm.plannerScreen.unsupportedUntil')).toBeNull();
  });
});
