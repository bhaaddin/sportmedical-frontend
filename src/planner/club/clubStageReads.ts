/*
 * THE READS THE CLUB SCREEN'S STAGE STARTS FROM, STARTED AS SOON AS THE CLUB'S ORDERS ARE KNOWN
 *
 * Opening `/clubs/:clubId/kalendar` used to be a serial chain: the club's orders -> (code, draw) -> the order -> the preview of
 * its days -> the days, blocks, club windows and previews of the visible range -> the board's own week. Each level
 * waited for the one before, so the screen cost the SUM of six round trips. Nothing after the orders really depends on
 * anything but the orders and the calendar list, so this file works out - from those two answers alone - every read
 * the stage will make when it draws, and starts them all at once:
 *
 *   order days   `ApiDataSource.load` -> the preview of the edited order's days (its open pieces)
 *   range        `listSessions` / `listDayMarks` -> day + blocks + club windows + previews of the visible range
 *   look-ahead   `getCatalogue` / `getDayBudget` -> the previews of the next 28 days
 *   holidays     `listDayMarks` -> the holidays of every year of the range
 *   board week   `useBoardCalendar` (the real calendar) -> day + previews of the shown week, every active calendar
 *   inquiries    `useInquiries` -> every club's orders (unfiltered)
 *
 * They go through the SAME query keys and read functions (`defaultApiDeps`, the board's / inquiries' keys) with the
 * same staleness, so when the stage asks, its answer is already in the cache (or on its way: an identical key joins the
 * running request) - nothing is fetched twice. Previews asked in one burst for the same calendar are merged into one
 * request by the preview cover (`dayRowsCover`). Every failure is dropped: the stage asks again when it draws.
 *
 * `chunk` / `LOOKAHEAD_DAYS` / the shown calendars mirror `ApiDataSource`; `clubStageReads.test.ts` runs the real data
 * source against recording deps and fails when the two drift apart.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { Calendar } from '../../api/bookingContracts';
import type { ClubBlockView } from '../../api/clubBlocks';
import { clubOrdersApi, type ClubOrderView } from '../../api/clubOrders';
import { editBlockRefs, firstWindowDate } from '../../components/clubs/order/editSession';
import type { PickSession } from '../../components/clubs/order/pickSession';
import { defaultApiDeps, type ApiDeps } from '../api/deps';
import { eachDay, windowsOfOrder } from '../api/mappers';
import { addDays, type IsoDate } from '../model';
import { createInitialState } from '../state/plannerState';
import { selectVisibleRange } from '../state/selectors';
import { clubGroups, openingDate, selectedGroup, type ClubGroup } from './clubGroups';

/** The data source reads at most this many days per request (`ApiDataSource.chunk`). */
export const MAX_RANGE_DAYS = 62;
/** How far ahead the data source looks for the day budget and the planning window. */
export const LOOKAHEAD_DAYS = 28;
/** The board's inquiry marks (`useInquiries`). */
export const INQUIRIES_KEY = ['club-orders', 'inquiries'] as const;
/** The club list's unfiltered read of every order (`ClubsPage`, `warmClubList`). */
export const ALL_ORDERS_KEY = ['club-orders', '', '', ''] as const;

export interface StageStart {
  today: IsoDate;
  /** The day the board opens on. */
  openOn: IsoDate;
  /**
   * What the stage plans: null = the club's context only (no order on the stage); otherwise the session's služba and -
   * for an edit / processing session - the order it loads (the list row of it).
   */
  session: { serviceId: string; order: ClubOrderView | null } | null;
}

export interface ClubSelection {
  groups: ClubGroup[];
  /** The group in view (null for a club without a live order). */
  selected: ClubGroup | null;
  /** The day the board opens on. */
  openOn: IsoDate;
  /** What the stage will start from (see `stageReads`). */
  start: StageStart;
}

/**
 * Which group of the club's orders the screen shows and the day its board opens on - the club screen's rule
 * (`useClubPlannerData`), as a pure function so the warm-up can work it out before the screen exists:
 *   - a window the caller names (`blockId`, the calendar's "Otevřít klub") picks the group that owns it, and its day;
 *   - else `?order=` (`orderId`), else the default group; the board opens on the group's first window ahead.
 * `session` is a session the router state hands over (it replaces the group's own, as `ClubPlannerScreen` does).
 *
 * Reviewer 2.3: opening a club is NOT planning. The stage plans the group in view only when the person chose a planning
 * action (`planning`: the URL's `plan=1`, or a session handed over); until then it is the club's overview - the club's
 * context, its windows on the board, the quick actions - and nothing of the order is put on the stage.
 */
export function clubSelection(
  orders: readonly ClubOrderView[],
  blocks: readonly ClubBlockView[],
  today: IsoDate,
  wanted: { orderId: string | null; blockId: string | null; session?: PickSession | null; planning?: boolean },
): ClubSelection {
  const groups = clubGroups(orders, today);
  const owner = wanted.blockId === null ? null : (groups.find((g) => g.blockIds.includes(wanted.blockId as string)) ?? null);
  const selected = wanted.orderId === null && owner !== null ? owner : selectedGroup(groups, wanted.orderId);
  const blockDate = wanted.blockId === null
    ? null
    : ((orders.flatMap((o) => o.blocks).find((b) => b.id === wanted.blockId) ?? blocks.find((b) => b.id === wanted.blockId))?.fromDate ?? null);
  const sessionDate = selected?.editable ? firstWindowDate(editBlockRefs(selected.root), today) : null;
  const openOn = blockDate ?? sessionDate ?? openingDate(selected, groups, today);

  const routed = wanted.session ?? null;
  const start: StageStart = routed !== null
    ? {
        today,
        openOn: routed.editOrder?.firstDate ?? today,
        session: { serviceId: routed.serviceId, order: routed.editOrder ? (orders.find((o) => o.id === routed.editOrder?.orderId) ?? null) : null },
      }
    : { today, openOn, session: wanted.planning === true && selected?.editable ? { serviceId: selected.root.serviceId ?? '', order: selected.root } : null };
  return { groups, selected, openOn, start };
}

export type StageRead =
  | { kind: 'previews'; ids: string[]; from: IsoDate; to: IsoDate }
  | { kind: 'range'; ids: string[]; from: IsoDate; to: IsoDate }
  | { kind: 'blocks'; id: string; from: IsoDate; to: IsoDate }
  | { kind: 'clubBlocks'; from: IsoDate; to: IsoDate }
  | { kind: 'holidays'; year: number };

/** `ApiDataSource.chunk`: a range in pieces of at most MAX_RANGE_DAYS days. */
export function chunkRange(range: { from: IsoDate; to: IsoDate }): { from: IsoDate; to: IsoDate }[] {
  const days = eachDay(range.from, range.to);
  const out: { from: IsoDate; to: IsoDate }[] = [];
  for (let i = 0; i < days.length; i += MAX_RANGE_DAYS) {
    out.push({ from: days[i]!, to: days[Math.min(i + MAX_RANGE_DAYS, days.length) - 1]! });
  }
  return out;
}

/** Every read the stage makes when it first draws, from the calendar list and the session alone (pure). */
export function stageReads(start: StageStart, calendars: readonly Calendar[]): StageRead[] {
  const active = calendars.filter((c) => c.isActive);
  const windows = start.session?.order ? windowsOfOrder(start.session.order) : [];
  const out: StageRead[] = [];

  /* `ApiDataSource.openPiecesTest`: the preview of the edited order's days. */
  const dates = windows.flatMap((w) => [w.range.fromDate, w.range.toDate || w.range.fromDate]).filter(Boolean).sort();
  const ownIds = [...new Set(windows.flatMap((w) => w.calendarIds))];
  if (dates.length > 0 && ownIds.length > 0) {
    for (const part of chunkRange({ from: dates[0]!, to: dates[dates.length - 1]! })) out.push({ kind: 'previews', ids: ownIds, ...part });
  }

  /* `ApiDataSource.shownCalendars`: the order's own calendars and its služba's; else every active one. */
  let shown = active;
  if (start.session) {
    const own = new Set(ownIds);
    const serviceId = start.session.serviceId;
    const related = active.filter((c) => own.has(c.id) || (serviceId !== '' && c.clinicServiceId === serviceId));
    if (related.length > 0) shown = related;
  }
  const ids = shown.map((c) => c.id);

  /* `listSessions` + `listDayMarks` over the visible range (the mini calendar's month and the board's week). */
  const range = selectVisibleRange(createInitialState({ today: start.today, selectedDate: start.openOn }));
  if (ids.length > 0) {
    for (const part of chunkRange(range)) {
      out.push({ kind: 'range', ids, ...part });
      for (const id of ids) out.push({ kind: 'blocks', id, ...part });
      out.push({ kind: 'clubBlocks', ...part });
      out.push({ kind: 'previews', ids, ...part });
    }
    /* `lookAhead` (catalogue, day budget). */
    out.push({ kind: 'previews', ids, from: start.today, to: addDays(start.today, LOOKAHEAD_DAYS - 1) });
  }
  for (const year of new Set(eachDay(range.from, range.to).map((d) => Number(d.slice(0, 4))))) out.push({ kind: 'holidays', year });

  /* `useBoardCalendar`: the shown week of every active calendar. */
  const allIds = active.map((c) => c.id);
  if (allIds.length > 0) {
    const weekStart = createInitialState({ today: start.today, selectedDate: start.openOn }).weekStart;
    const week = { from: weekStart, to: addDays(weekStart, 6) };
    out.push({ kind: 'range', ids: allIds, ...week });
    out.push({ kind: 'previews', ids: allIds, ...week });
  }
  return out;
}

/** The read through the data source's own deps (= its query key and read function). */
export function runStageRead(deps: ApiDeps, read: StageRead): Promise<unknown> {
  switch (read.kind) {
    case 'previews':
      return deps.previews(read.ids, read.from, read.to);
    case 'range':
      return deps.range(read.from, read.to, read.ids);
    case 'blocks':
      return deps.blocks(read.id, read.from, read.to);
    case 'clubBlocks':
      return deps.clubBlocks(read.from, read.to);
    case 'holidays':
      return deps.holidays(read.year);
  }
}

/**
 * The board's inquiry marks read every club's orders. When the club list already holds that answer (and it is still
 * current) it is the same request: the marks take it, with its age, instead of asking again. Otherwise they ask once.
 */
export function shareAllOrders(queryClient: QueryClient, maxAgeMs = 30_000): boolean {
  const have = queryClient.getQueryState(INQUIRIES_KEY);
  if (have?.data !== undefined && !have.isInvalidated && Date.now() - have.dataUpdatedAt < maxAgeMs) return true;
  const all = queryClient.getQueryState<ClubOrderView[]>(ALL_ORDERS_KEY);
  if (all?.data === undefined || all.isInvalidated || Date.now() - all.dataUpdatedAt >= maxAgeMs) return false;
  queryClient.setQueryData(INQUIRIES_KEY, all.data, { updatedAt: all.dataUpdatedAt });
  return true;
}

/** The single read of an order (`deps.order`, key `['club-order', id]`). */
export const orderKey = (id: string) => ['club-order', id] as const;
/** An answer of the order's own read this young still counts for the stage's FIRST load (it was asked for this screen). */
export const ORDER_START_FRESH_MS = 10_000;

/** Whether the order's own read has a current answer, is on its way, or neither. */
export function orderReadState(queryClient: QueryClient, id: string, now = Date.now()): 'current' | 'running' | 'none' {
  const state = queryClient.getQueryState(orderKey(id));
  if (state === undefined) return 'none';
  if (state.fetchStatus === 'fetching') return 'running';
  if (state.data !== undefined && !state.isInvalidated && now - state.dataUpdatedAt < ORDER_START_FRESH_MS) return 'current';
  return 'none';
}

/** A list answer this young (and not marked stale by a write) is current: the 30 s every ordinary read gets. */
export const LIST_SHARE_MAX_AGE_MS = 30_000;

/**
 * The order as a current list of orders already carries it (any `['club-orders', ...]` answer - they all come from the
 * same `clubOrdersApi.list` mapper). On the dev API a row of the list is the single read except `history`, which the
 * stage does not use (`scripts/club-planning/speed.mjs` checks it); the single read still runs behind it.
 */
export function orderFromLists(queryClient: QueryClient, id: string, now = Date.now()): ClubOrderView | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ['club-orders'] })) {
    const state = query.state;
    if (!Array.isArray(state.data) || state.isInvalidated || now - state.dataUpdatedAt >= LIST_SHARE_MAX_AGE_MS) continue;
    const row = (state.data as ClubOrderView[]).find((o) => o !== null && typeof o === 'object' && o.id === id);
    if (row !== undefined) return row;
  }
  return undefined;
}

const warm = (promise: Promise<unknown>): void => void promise.catch(() => undefined);

/**
 * Starts every read of the stage (see the top of the file). `deps` defaults to the application's clients on this query
 * client - the very object the data source is built with.
 */
export async function prefetchClubStage(queryClient: QueryClient, start: StageStart, deps: ApiDeps = defaultApiDeps(queryClient)): Promise<void> {
  if (!shareAllOrders(queryClient)) {
    warm(queryClient.prefetchQuery({ queryKey: INQUIRIES_KEY, queryFn: () => clubOrdersApi.list({}), staleTime: 30_000 }));
  }
  /* The order the stage loads: its own read starts now, beside the rest (the data source takes it when it has landed). */
  const order = start.session?.order ?? null;
  if (order !== null && orderReadState(queryClient, order.id) === 'none') warm(deps.order(order.id));
  const calendars = await deps.calendars();
  for (const read of stageReads(start, calendars)) warm(runStageRead(deps, read));
}
