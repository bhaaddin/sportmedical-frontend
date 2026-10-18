/*
 * What starts before a screen exists: nothing for a signed-out browser or an unrelated address; the reference reads for a
 * calendar address; a club's own reads for its address; and a second start inside the freshness window asks nothing new.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const m = vi.hoisted(() => ({
  calendars: vi.fn(), activities: vi.fn(), services: vi.fn(), display: vi.fn(), clubSettings: vi.fn(), publicClinic: vi.fn(),
  holidays: vi.fn(), clubById: vi.fn(), clubAll: vi.fn(), orders: vi.fn(), blocks: vi.fn(),
}));

vi.mock('./calendars', () => ({ calendarsApi: { list: m.calendars } }));
vi.mock('./activities', () => ({ activitiesApi: { list: m.activities } }));
vi.mock('./clinicServices', () => ({ clinicServicesApi: { list: m.services } }));
vi.mock('./clinicSettings', () => ({ readPublicClinic: m.publicClinic }));
vi.mock('./displaySettings', () => ({ CALENDAR_DISPLAY_QUERY_KEY: ['settings', 'calendar-display'], readCalendarDisplay: m.display }));
vi.mock('./holidays', () => ({ holidaysApi: { year: m.holidays } }));
vi.mock('./clubBlocks', () => ({ clubBlocksApi: { list: m.blocks } }));
vi.mock('./clubOrders', () => ({ clubOrdersApi: { list: m.orders } }));
vi.mock('./clubs', () => ({
  CLUB_SETTINGS_QUERY_KEY: ['settings', 'clubs'],
  clubSettingsApi: { get: m.clubSettings },
  clubsApi: { getById: m.clubById, getAll: m.clubAll },
}));

const { warmForPath } = await import('./warmStart');
const { prefetchClubScreen } = await import('./warmReads');
const CLUB = '942e2676-d730-4a13-8016-17f95abd26e2';

const calls = () => Object.values(m).reduce((n, fn) => n + fn.mock.calls.length, 0);
const settle = () => new Promise((resolve) => setTimeout(resolve, 80));

beforeEach(() => {
  Object.values(m).forEach((fn) => fn.mockReset().mockResolvedValue([]));
  localStorage.setItem('token', 't');
});

describe('warmForPath', () => {
  it('starts nothing for a signed-out browser', async () => {
    localStorage.removeItem('token');
    warmForPath(new QueryClient(), '/planovani');
    await settle();
    expect(calls()).toBe(0);
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
  });

  it('starts the reads of a club screen for its own address', async () => {
    warmForPath(new QueryClient(), `/clubs/${CLUB}`);
    await settle();
    expect(m.clubById).toHaveBeenCalledWith(CLUB);
    expect(m.orders).toHaveBeenCalledWith({ clubId: CLUB });
    expect(m.blocks).toHaveBeenCalledTimes(1);
    expect(m.calendars).toHaveBeenCalledTimes(1);
  });

  it('starts the list reads for the club list', async () => {
    warmForPath(new QueryClient(), '/clubs');
    await settle();
    expect(m.clubAll).toHaveBeenCalledTimes(1);
    expect(m.blocks).toHaveBeenCalledTimes(1);
    expect(m.orders).toHaveBeenCalledWith({});
    expect(m.calendars).toHaveBeenCalledTimes(1);
    expect(m.clubById).not.toHaveBeenCalled();
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
});
