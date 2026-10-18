/*
 * A small range is cut out of a bigger one already held or on its way; requests made together are merged;
 * anything that reaches further goes to the server.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDayRowsCover, COVER_MS, MERGE_WINDOW_MS } from './dayRowsCover';
import { resetRequestPolicyForTests } from './requestPolicy';

vi.mock('../services/socketService', () => ({ socketService: { stop: vi.fn() } }));
const { client } = await import('./client');
const originalAdapter = client.defaults.adapter;

const days = (from: string, to: string) => {
  const out: { date: string }[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    out.push({ date: d.toISOString().slice(0, 10) });
  }
  return out;
};
const dates = (rows: { date: string }[]) => rows.map((r) => r.date);

const setup = () => {
  const load = vi.fn(async (_key: string, from: string, to: string) => days(from, to));
  return { load, cover: createDayRowsCover(load) };
};
const settle = () => vi.advanceTimersByTimeAsync(MERGE_WINDOW_MS + 1);

describe('createDayRowsCover', () => {
  beforeEach(() => {
    resetRequestPolicyForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    client.defaults.adapter = originalAdapter;
    vi.useRealTimers();
  });

  it('answers a week from the month that is already here, with exactly the rows of that week', async () => {
    const { load, cover } = setup();

    const month = cover.read('cal-1', '2026-09-28', '2026-11-08');
    await settle();
    expect(await month).toHaveLength(42);

    const week = await cover.read('cal-1', '2026-10-12', '2026-10-18');

    expect(load).toHaveBeenCalledTimes(1);
    expect(dates(week)).toEqual(dates(days('2026-10-12', '2026-10-18')));
  });

  it('sends requests made together that touch each other as one request for the union', async () => {
    const { load, cover } = setup();

    const month = cover.read('cal-1', '2026-09-28', '2026-11-08');
    const horizon = cover.read('cal-1', '2026-10-18', '2026-11-14');
    const week = cover.read('cal-1', '2026-10-12', '2026-10-18');
    await settle();
    const [m, h, w] = await Promise.all([month, horizon, week]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('cal-1', '2026-09-28', '2026-11-14');
    expect(dates(m)).toEqual(dates(days('2026-09-28', '2026-11-08')));
    expect(dates(h)).toEqual(dates(days('2026-10-18', '2026-11-14')));
    expect(dates(w)).toEqual(dates(days('2026-10-12', '2026-10-18')));
  });

  it('does not merge ranges that are far apart, or whose union is too long, or of another calendar', async () => {
    const { load, cover } = setup();

    const reads = [
      cover.read('cal-1', '2026-01-01', '2026-01-07'),
      cover.read('cal-1', '2026-03-01', '2026-03-07'),
      cover.read('cal-1', '2026-03-08', '2027-04-30'),
      cover.read('cal-2', '2026-01-01', '2026-01-07'),
    ];
    await settle();
    await Promise.all(reads);

    expect(load.mock.calls.map(([key, from, to]) => `${key} ${from} ${to}`)).toEqual([
      'cal-1 2026-01-01 2026-01-07',
      'cal-1 2026-03-01 2026-03-07',
      'cal-1 2026-03-08 2027-04-30',
      'cal-2 2026-01-01 2026-01-07',
    ]);
  });

  it('asks the server for a range that reaches beyond what is held', async () => {
    const { load, cover } = setup();

    const first = cover.read('cal-1', '2026-10-12', '2026-10-18');
    await settle();
    await first;
    const wider = cover.read('cal-1', '2026-10-12', '2026-10-25');
    await settle();
    await wider;

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('forgets after a moment', async () => {
    const { load, cover } = setup();

    const month = cover.read('cal-1', '2026-09-28', '2026-11-08');
    await settle();
    await month;
    await vi.advanceTimersByTimeAsync(COVER_MS + 1);
    const week = cover.read('cal-1', '2026-10-12', '2026-10-18');
    await settle();
    await week;

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('is emptied by a write the server accepted', async () => {
    const { load, cover } = setup();
    const month = cover.read('cal-1', '2026-09-28', '2026-11-08');
    await settle();
    await month;

    client.defaults.adapter = async (config) => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config, request: {} });
    await client.put('/api/calendars/cal-1/working-hours/1', {});
    const week = cover.read('cal-1', '2026-10-12', '2026-10-18');
    await settle();
    await week;

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failed request and tells everybody who waited for it', async () => {
    const load = vi
      .fn<(key: string, from: string, to: string) => Promise<{ date: string }[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockImplementation(async (_k, from, to) => days(from, to));
    const cover = createDayRowsCover(load);

    const a = cover.read('cal-1', '2026-09-28', '2026-11-08');
    const b = cover.read('cal-1', '2026-10-12', '2026-10-18');
    const failures = Promise.allSettled([a, b]);
    await settle();
    expect((await failures).map((r) => r.status)).toEqual(['rejected', 'rejected']);

    const again = cover.read('cal-1', '2026-10-12', '2026-10-18');
    await settle();
    await again;

    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('the rules the day and block covers cut by', () => {
  it('a booking belongs to the range its Prague start day lies in', async () => {
    const { DAY_COVER_RULES } = await import('./appointments');
    const lateEvening = { startUtc: '2026-10-18T22:30:00Z' }; /* 00:30 on the 19th in Prague (CEST) */
    expect(DAY_COVER_RULES.inRange(lateEvening, '2026-10-12', '2026-10-18')).toBe(false);
    expect(DAY_COVER_RULES.inRange(lateEvening, '2026-10-19', '2026-10-25')).toBe(true);
    expect(DAY_COVER_RULES.inRange({ startUtc: '2026-10-25T23:30:00Z' }, '2026-10-26', '2026-10-26')).toBe(true); /* CET after the change */
  });

  it('a block belongs to every range that shares a Prague day with it', async () => {
    const { BLOCK_COVER_RULES } = await import('./appointments');
    const overNight = { startUtc: '2026-10-19T20:00:00Z', endUtc: '2026-10-20T06:00:00Z' }; /* 22:00 on the 19th to 08:00 on the 20th */
    expect(BLOCK_COVER_RULES.inRange(overNight, '2026-10-19', '2026-10-19')).toBe(true);
    expect(BLOCK_COVER_RULES.inRange(overNight, '2026-10-20', '2026-10-20')).toBe(true);
    expect(BLOCK_COVER_RULES.inRange(overNight, '2026-10-21', '2026-10-25')).toBe(false);
    expect(BLOCK_COVER_RULES.inRange(overNight, '2026-10-12', '2026-10-18')).toBe(false);
    /* ends exactly at midnight: belongs to the day before, not the day it ends on */
    const toMidnight = { startUtc: '2026-10-19T08:00:00Z', endUtc: '2026-10-19T22:00:00Z' };
    expect(BLOCK_COVER_RULES.inRange(toMidnight, '2026-10-19', '2026-10-19')).toBe(true);
    expect(BLOCK_COVER_RULES.inRange(toMidnight, '2026-10-20', '2026-10-20')).toBe(false);
  });
});
