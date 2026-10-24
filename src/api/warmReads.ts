/* ══════════════════════════════════════════════════════════════
   THE READS A SCREEN WILL NEED, STARTED BEFORE THE SCREEN IS THERE

   (The decision which address starts which of these is in warmStart.ts, which is
   deliberately tiny: this file pulls in the API clients and is loaded on demand.)

   A screen cannot ask for anything until its code has arrived and drawn once,
   and its first reads (the calendars) decide what the next ones are (one per
   calendar). Cheap moves take whole round trips off that chain:

     - when the page is opened straight on a calendar / club address (a
       reload, a bookmark, a link from the e-mail), the reference reads start
       NOW, while the screen's code is still downloading;
     - on the club list, a card the pointer rests on (or that gets focus, or
       is clicked) starts the reads of its own screen and fetches its code,
       so the click finds them;
     - the club screen's stage reads (planner/club/clubStageReads.ts) start as
       soon as the club's orders are known, all at once.

   All use the SAME query keys and read functions as the screens, so what is
   fetched here is exactly what the screen would ask for: nothing twice, and
   whatever is still fresh is not fetched (the client's staleness tiers
   decide). A failure is dropped; the screen asks again when it opens.
   ══════════════════════════════════════════════════════════════ */
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { pragueDateKey } from '../utils/time';
import { parsePermissions, permissionsSnapshot } from '../auth/localSession';
import { activitiesApi } from './activities';
import { calendarsApi } from './calendars';
import { readPublicClinic } from './clinicSettings';
import { clinicServicesApi } from './clinicServices';
import { clubBlocksApi, fetchBlockableActivities, type ClubBlockView } from './clubBlocks';
import { clubOrdersApi, type ClubOrderView } from './clubOrders';
import { CLUB_SETTINGS_QUERY_KEY, clubSettingsApi, clubsApi, type Club } from './clubs';
import { CALENDAR_DISPLAY_QUERY_KEY, readCalendarDisplay } from './displaySettings';
import { holidaysApi } from './holidays';
import { normalizeSummary } from '../components/clubs/orders/orderLogic';
import { newestOrderIds } from '../pages/clubs/overview/clubOverviewModel';

/** How long the pointer rests on a card before it counts as an intention to open it. */
export const HOVER_INTENT_MS = 200;

/** A list answer this young (and not marked stale by a write) still counts: the 30 s every ordinary read gets. */
export const SHARE_MAX_AGE_MS = 30_000;

const warm = (promise: Promise<unknown>): void => void promise.catch(() => undefined);

/** What every calendar screen (the planner, a club's planner) starts from. */
export function warmReferenceData(queryClient: QueryClient, year = new Date().getFullYear()): void {
  warm(queryClient.prefetchQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list }));
  warm(queryClient.prefetchQuery({ queryKey: ['activities'], queryFn: () => activitiesApi.list() }));
  warm(queryClient.prefetchQuery({ queryKey: ['clinic-services'], queryFn: clinicServicesApi.list }));
  warm(queryClient.prefetchQuery({ queryKey: CALENDAR_DISPLAY_QUERY_KEY, queryFn: readCalendarDisplay }));
  warm(queryClient.prefetchQuery({ queryKey: CLUB_SETTINGS_QUERY_KEY, queryFn: clubSettingsApi.get }));
  warm(queryClient.prefetchQuery({ queryKey: ['public-clinic'], queryFn: readPublicClinic }));
  warm(queryClient.prefetchQuery({ queryKey: ['holidays', year], queryFn: () => holidaysApi.year(year) }));
}

/** What a warm-up of the club screen knows about where it is going (all optional). */
export interface ClubScreenWarmOptions {
  /** `?order=` of the address. */
  orderId?: string | null;
  /** A window the router state names (`clubBlockId`). */
  blockId?: string | null;
  year?: number;
  /**
   * Also fetch the screen's code (the lazy route chunk) and start the stage's reads once the orders are known; default
   * true. The screen itself passes false: its code is there and it starts its stage with the exact selection.
   */
  stage?: boolean;
}

/**
 * When a current answer already in the cache carries `target`'s answer, it is put under `target` at once (with the age
 * of the answer it came from) and `target` is still asked once, in the background: the screen draws from the shared
 * copy and the real answer replaces it a round trip later (an identical answer changes nothing on screen). Nothing is
 * seeded over an answer `target` already has.
 */
export function seedFrom<S, T>(
  queryClient: QueryClient,
  target: QueryKey,
  source: QueryKey,
  pick: (s: S) => T | undefined,
  queryFn: () => Promise<T>,
): boolean {
  if (queryClient.getQueryData(target) !== undefined) return false;
  const state = queryClient.getQueryState<S>(source);
  if (state?.data === undefined || state.isInvalidated || Date.now() - state.dataUpdatedAt >= SHARE_MAX_AGE_MS) return false;
  const value = pick(state.data);
  if (value === undefined) return false;
  queryClient.setQueryData(target, value, { updatedAt: state.dataUpdatedAt });
  warm(queryClient.prefetchQuery({ queryKey: target, queryFn, staleTime: 0 }));
  return true;
}

const ordersOf = (clubId: string) => () => clubOrdersApi.list({ clubId });

/** The club screen's code: the same module the route loads lazily, so the router then finds it fetched. */
export const clubRoute = { load: () => import('../planner/ClubPlannerPage') };
const NO_WINDOWS: never[] = [];

/** The club, its orders and the club windows: what the club's page AND the club's calendar both start from. */
function warmClubCore(queryClient: QueryClient, clubId: string): { orders: Promise<ClubOrderView[]>; blocks: Promise<ClubBlockView[]> } {
  seedFrom<Club[], Club>(
    queryClient,
    ['clubs', 'one', clubId],
    ['clubs'],
    (list) => (Array.isArray(list) ? list.find((c) => c.id === clubId) : undefined),
    () => clubsApi.getById(clubId),
  );
  seedFrom<ClubOrderView[], ClubOrderView[]>(
    queryClient,
    ['club-orders', clubId, '', ''],
    ['club-orders', '', '', ''],
    (all) => (Array.isArray(all) ? all.filter((o) => o.clubId === clubId) : undefined),
    ordersOf(clubId),
  );
  warm(queryClient.prefetchQuery({ queryKey: ['clubs', 'one', clubId], queryFn: () => clubsApi.getById(clubId) }));
  const orders = queryClient.fetchQuery({ queryKey: ['club-orders', clubId, '', ''], queryFn: ordersOf(clubId) });
  const blocks = queryClient.fetchQuery({ queryKey: ['club-blocks', 'list'], queryFn: () => clubBlocksApi.list() });
  warm(orders);
  warm(blocks);
  return { orders, blocks };
}

/** The club page's code: the lazy route module, fetched ahead of the click. */
export const clubPageRoute = { load: () => import('../pages/clubs/overview/ClubOverviewPage') };

/** The query key of a club's summary - the one `useClubSummary` reads (`components/clubs/orders/ClubSummaryCard`, pinned by a test). */
const clubSummaryKey = (clubId: string) => ['club-summary', clubId] as const;

/**
 * The reads of a club's own PAGE (`/clubs/:clubId/kalendar`, pages/clubs/overview): the club, its orders and windows (taken from the
 * club list's answers when they are fresh), its summary, the history of the orders touched last, and the page's code. Nothing of the calendar - its code and stage
 * reads start when the pointer rests on the page's "Kalendář" button (`prefetchClubScreen`).
 */
export function prefetchClubPage(queryClient: QueryClient, clubId: string): void {
  warm(clubPageRoute.load());
  /* An account without patients.view, or a tab that learned the server has no club screen: today's reads, started at once
     (from the club list's answers when they are here). */
  if (!clubScreenMayAnswer()) {
    warmClubPageReads(queryClient, clubId);
    return;
  }
  /* The screen's module is loaded on demand: the planner shares this file and must not carry it. */
  warm(
    import('./clubScreen').then(({ clubScreenFor }) => {
      const screen = clubScreenFor(queryClient);
      if (!screen.willAsk(clubId)) {
        warmClubPageReads(queryClient, clubId);
        return undefined;
      }
      /* The server may answer the club page in one request (network plan b5); when it did not, today's reads go. */
      return screen.seed(clubId).then((seeded) => {
        if (!seeded) {
          warmClubPageReads(queryClient, clubId);
          return undefined;
        }
        const orders = queryClient.getQueryData<ClubOrderView[]>(['club-orders', clubId, '', '']) ?? [];
        return Promise.all(newestOrderIds(orders).map((id) => queryClient.prefetchQuery({ queryKey: ['club-order', id], queryFn: () => clubOrdersApi.get(id), staleTime: 60_000 })));
      });
    }),
  );
}

/** Cheap and synchronous: could the club screen be worth asking (the permission it needs, and not remembered as missing)? */
function clubScreenMayAnswer(): boolean {
  if (!parsePermissions(permissionsSnapshot()).includes('patients.view')) return false;
  try {
    return Date.now() >= Number(window.sessionStorage.getItem('sm.clubScreen.unsupportedUntil') ?? 0);
  } catch {
    return true;
  }
}

/** The club page's reads one by one: what an older server (or a failed screen) leaves to do. */
function warmClubPageReads(queryClient: QueryClient, clubId: string): void {
  const { orders, blocks } = warmClubCore(queryClient, clubId);
  /* "Poslední změny": the list answers carry no history, so the few orders touched last are read one by one - started the
     moment the orders are known, not after the page has drawn (the same key and read as the page's own). */
  warm(orders.then((list) => Promise.all(newestOrderIds(list).map((id) => queryClient.prefetchQuery({ queryKey: ['club-order', id], queryFn: () => clubOrdersApi.get(id), staleTime: 60_000 })))));
  warm(queryClient.prefetchQuery({ queryKey: clubSummaryKey(clubId), queryFn: async () => normalizeSummary(await clubOrdersApi.clubSummary(clubId)), staleTime: 60_000 }));
  /* The page reads the club's own windows (the screen's `clubBlocks` section): they are the club's rows of the list just asked for. */
  warm(blocks.then((all) => queryClient.setQueryData(['club-blocks', 'of-club', clubId], all.filter((b) => b.clubId === clubId))));
}

/**
 * The reads of a club's own screen (`/clubs/:clubId/kalendar`, see `useClubPlannerData` and `planner/club/clubStageReads.ts`),
 * all started together instead of one after the other:
 *   - the club and its orders - taken from the club list's answers when they are here (`/api/clubs` and the unfiltered
 *     `club-orders` carry exactly what `/api/clubs/{id}` and `club-orders?clubId=` return), each still asked once
 *     behind the shared copy;
 *   - the club windows, the činnost catalogue an edited order needs (`/api/activities`: the very request the reference
 *     činnosti make, the HTTP layer shares it), the reference data and the settings;
 *   - the screen's code (the lazy route), and
 *   - as soon as the orders are known: everything the stage reads when it draws (the order, its days, the visible range,
 *     the board's week, the inquiries).
 */
export function prefetchClubScreen(queryClient: QueryClient, clubId: string, options: ClubScreenWarmOptions = {}): void {
  const { orders, blocks } = warmClubCore(queryClient, clubId);
  warm(queryClient.prefetchQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities }));
  warmReferenceData(queryClient, options.year);
  if (options.stage === false) return;
  /* the screen's code; the stage's planning comes with it (the route module hands it out) */
  const route = clubRoute.load();
  warm(route);
  const blockId = options.blockId ?? null;
  warm(
    Promise.all([orders, blockId === null ? NO_WINDOWS : blocks, route]).then(([list, windows, stage]) => {
      const { start } = stage.clubSelection(list, windows, pragueDateKey(new Date()), { orderId: options.orderId ?? null, blockId });
      return stage.prefetchClubStage(queryClient, start);
    }),
  );
}

/** Opened straight on a club's address: the account (the permissions) is read now too, not after the shell has drawn. */
export function warmAccount(): void {
  /* loaded on demand: a static import would pull the signed-in session code into what the public site shares */
  warm(import('../auth/accountRefresh').then(({ refreshAccount }) => refreshAccount({ force: true })));
}

/** The reads of the club list: the clubs, their blocks and orders, and the calendars the older reservations hang on. */
export function warmClubList(queryClient: QueryClient): void {
  warm(
    queryClient.prefetchQuery({
      queryKey: ['clubs'],
      queryFn: async () => {
        const list = await clubsApi.getAll(false);
        return Array.isArray(list) ? list : [];
      },
    }),
  );
  warm(queryClient.prefetchQuery({ queryKey: ['club-blocks', 'list'], queryFn: () => clubBlocksApi.list() }));
  warm(queryClient.prefetchQuery({ queryKey: ['club-orders', '', '', ''], queryFn: () => clubOrdersApi.list({}) }));
  warm(queryClient.prefetchQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list }));
}
