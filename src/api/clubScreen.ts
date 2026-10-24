/*
 * The club screen (network plan b5): `GET /api/v1/screens/club/{clubId}?orderId=` answers in ONE request what the club page
 * (`/clubs/:id`, pages/clubs/overview) reads one by one - the club, its orders, its windows, its summary - and the reference
 * data the club's calendar starts from (calendars, cinnosti, sluzby, club settings).
 *
 * Like `planner/api/plannerScreen.ts` this does not change what the page reads. It only SEEDS the react-query keys the page's
 * own reads already use, shaped by the parsers of the single clients. Anything the screen does not give - an older server
 * (404 / 405), a missing permission, a failed or malformed section - leaves that key empty and the page asks for it the way
 * it always has. So the worst case is today's behaviour.
 *
 *   - a server without the route is not asked again by this tab for 10 minutes (remembered in sessionStorage);
 *   - any other failure (offline, 5xx) is left alone for a minute;
 *   - a write that lands while the answer is on its way makes the answer be dropped (its rows may predate the write);
 *   - only for an account with `patients.view` (what the screen's route asks).
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { readActivityList } from './activities';
import { calendarListSchema, parseResponse } from './bookingContracts';
import client from './client';
import { clinicServiceListSchema } from './clinicServices';
import { asList, toBlock } from './clubBlocks';
import { withManagement, CLUB_SETTINGS_QUERY_KEY, toClubSettings, type Club } from './clubs';
import { toOrder } from './clubOrders';
import { normalizeSummary } from '../components/clubs/orders/orderLogic';
import { onWriteSucceeded } from './requestPolicy';
import { parsePermissions, permissionsSnapshot, subscribePermissions } from '../auth/localSession';

export const CLUB_SCREEN_PERMISSION = 'patients.view';

/** A read this fresh is not asked for again (the page's own queries carry the same staleTime). */
export const CLUB_SCREEN_FRESH_MS = 30_000;
const BACKOFF_MS = 60_000;
const UNSUPPORTED_MS = 10 * 60_000;
const MEMO_KEY = 'sm.clubScreen.unsupportedUntil';

/** The keys the club page reads; one place so the page and the seeder cannot drift apart. */
export const clubScreenKeys = {
  club: (clubId: string) => ['clubs', 'one', clubId] as const,
  orders: (clubId: string) => ['club-orders', clubId, '', ''] as const,
  order: (orderId: string) => ['club-order', orderId] as const,
  blocks: (clubId: string) => ['club-blocks', 'of-club', clubId] as const,
  summary: (clubId: string) => ['club-summary', clubId] as const,
};

const readMemo = (): number => {
  try {
    const at = Number(window.sessionStorage.getItem(MEMO_KEY));
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
};
const writeMemo = (until: number): void => {
  try {
    window.sessionStorage.setItem(MEMO_KEY, String(until));
  } catch {
    /* private window: this load simply asks once more */
  }
};

let blockedUntil = readMemo();

let lastSession = permissionsSnapshot();
subscribePermissions(() => {
  const now = permissionsSnapshot();
  if (now === lastSession) return;
  lastSession = now;
  resetClubScreenForTests();
});

/** Test hook: forget what was learned about the server. */
export function resetClubScreenForTests(): void {
  blockedUntil = 0;
  try {
    window.sessionStorage.removeItem(MEMO_KEY);
  } catch {
    /* nothing stored */
  }
}

/** Whether this tab has learned, lately, that the server has no club screen (or it failed and is being left alone). */
export function clubScreenBlocked(): boolean {
  return Date.now() < blockedUntil;
}

type Section = { data?: unknown; error?: unknown } | null | undefined;

/** The body of a section that arrived, or `undefined` when it failed or is missing. */
function dataOf(section: Section): unknown {
  if (section === null || section === undefined || typeof section !== 'object') return undefined;
  return section.data === null ? undefined : section.data;
}

function isFresh(queryClient: QueryClient, key: QueryKey, ms: number): boolean {
  const state = queryClient.getQueryState(key);
  return state !== undefined && state.data !== undefined && !state.isInvalidated && Date.now() - state.dataUpdatedAt < ms;
}

export interface ClubScreenSeeder {
  /** Seeds the club page's keys from one request when the server can. Never rejects; resolves with whether the club itself was seeded. */
  seed(clubId: string, orderId?: string | null): Promise<boolean>;
  /** Whether a `seed` would ask the server (false: it resolves at once with `false` and the page reads as it always did). */
  willAsk(clubId: string): boolean;
}

export function makeClubScreenSeeder(queryClient: QueryClient, permissions: () => readonly string[]): ClubScreenSeeder {
  const flying = new Map<string, Promise<boolean>>();
  /** Bumped by every write (ours or announced from another person): an answer that started before it may hold rows from before. */
  let writeEpoch = 0;
  onWriteSucceeded(() => {
    writeEpoch += 1;
  });

  async function seedFrom(body: unknown, clubId: string, epoch: number): Promise<boolean> {
    const put = (key: QueryKey, value: unknown) => {
      if (writeEpoch === epoch) queryClient.setQueryData(key, value);
    };
    const putReference = (key: QueryKey, value: unknown) => {
      if (!isFresh(queryClient, key, CLUB_SCREEN_FRESH_MS)) put(key, value);
    };
    const sections = (body as { sections?: Record<string, Section> } | null)?.sections;
    if (sections === undefined || sections === null || typeof sections !== 'object') return false;
    const guard = async (run: () => void | Promise<void>) => {
      try {
        await run();
      } catch {
        /* a section that does not parse is a section the page reads itself */
      }
    };

    let clubSeeded = false;
    await guard(() => {
      const raw = dataOf(sections.club);
      if (raw === undefined || typeof raw !== 'object' || (raw as { id?: unknown }).id !== clubId) return;
      put(clubScreenKeys.club(clubId), withManagement(raw as Club));
      clubSeeded = true;
    });
    await guard(() => {
      const raw = dataOf(sections.orders);
      if (!Array.isArray(raw)) return;
      put(clubScreenKeys.orders(clubId), raw.map(toOrder));
    });
    await guard(() => {
      const raw = dataOf(sections.order);
      if (raw === undefined) return;
      const order = toOrder(raw);
      put(clubScreenKeys.order(order.id), order);
    });
    await guard(() => {
      const raw = dataOf(sections.clubBlocks);
      if (raw === undefined) return;
      put(clubScreenKeys.blocks(clubId), asList(raw).map(toBlock));
    });
    await guard(() => {
      const raw = dataOf(sections.summary);
      if (raw === undefined || typeof raw !== 'object') return;
      put(clubScreenKeys.summary(clubId), normalizeSummary({ ...(raw as object), clubId } as never));
    });
    /* The reference data the club's calendar starts from (the planner's own keys). */
    await guard(() => {
      const raw = dataOf(sections.calendars);
      if (raw !== undefined) putReference(['calendars'], parseResponse(calendarListSchema, raw));
    });
    await guard(async () => {
      const raw = dataOf(sections.activities);
      if (raw !== undefined) putReference(['activities'], await readActivityList(raw));
    });
    await guard(() => {
      const raw = dataOf(sections.clinicServices);
      if (raw !== undefined) putReference(['clinic-services'], parseResponse(clinicServiceListSchema, raw));
    });
    await guard(() => {
      const raw = dataOf(sections.clubSettings);
      if (raw !== undefined) putReference(CLUB_SETTINGS_QUERY_KEY, toClubSettings(raw));
    });
    return clubSeeded;
  }

  const willAsk = (clubId: string): boolean => {
    if (clubId === '' || clubScreenBlocked() || !permissions().includes(CLUB_SCREEN_PERMISSION)) return false;
    return !(
      isFresh(queryClient, clubScreenKeys.club(clubId), CLUB_SCREEN_FRESH_MS)
      && isFresh(queryClient, clubScreenKeys.orders(clubId), CLUB_SCREEN_FRESH_MS)
    );
  };

  return {
    willAsk,
    seed(clubId, orderId = null) {
      if (!willAsk(clubId)) return Promise.resolve(false);
      const key = `${clubId}|${orderId ?? ''}`;
      const going = flying.get(key);
      if (going !== undefined) return going;
      const epoch = writeEpoch;
      const run = (async () => {
        try {
          const res = await client.get(`/api/v1/screens/club/${encodeURIComponent(clubId)}`, {
            params: orderId !== null && orderId !== '' ? { orderId } : undefined,
          });
          /* A write landed while the answer was on its way: its rows may predate it. Drop it; the page asks for itself. */
          if (writeEpoch !== epoch) return false;
          const seeded = await seedFrom(res.data, clubId, epoch);
          return writeEpoch === epoch && seeded;
        } catch (error) {
          const response = (error as { response?: { status?: number; data?: { code?: unknown } } } | undefined)?.response;
          const status = response?.status;
          /* This club does not exist: the route is there, the page's own read says so. Nothing to remember about the server. */
          if (status === 404 && response?.data?.code === 'club.not_found') return false;
          /* 404 / 405: an older server (a 404 for this club is the page's own business: it asks and shows it). Any other failure may pass. */
          const unsupported = status === 404 || status === 405;
          blockedUntil = Date.now() + (unsupported ? UNSUPPORTED_MS : BACKOFF_MS);
          if (unsupported) writeMemo(blockedUntil);
          return false;
        } finally {
          flying.delete(key);
        }
      })();
      flying.set(key, run);
      return run;
    },
  };
}

const seeders = new WeakMap<QueryClient, ClubScreenSeeder>();

/** The one seeder of an application's query client: the page and the hover warm-up share its flights. */
export function clubScreenFor(queryClient: QueryClient): ClubScreenSeeder {
  let seeder = seeders.get(queryClient);
  if (seeder === undefined) {
    seeder = makeClubScreenSeeder(queryClient, () => parsePermissions(permissionsSnapshot()));
    seeders.set(queryClient, seeder);
  }
  return seeder;
}
