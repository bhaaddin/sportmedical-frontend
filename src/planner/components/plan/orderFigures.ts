/*
 * The numbers of club planning - ONE calculation.
 *
 * The owner's rule (10. 10. 2026, Dukla Jižní Město): a club order is counted INDIVIDUALLY per činnost, window
 * by window, with the slot length, the parallel capacity and the calendars - never one pool of minutes. That
 * counter is `src/components/booking/calendar/pickPlan.ts` (`pickCoverage`). The planner's cards, command
 * panel, summary, drag preview and the shortfall check all read their figures from here, and this reads them
 * from `pickCoverage`; there is no second copy of the arithmetic.
 *
 * Each club term of the order is one window of ONE činnost, as many whole slots long as it holds players or
 * minutes (`windowOfSession`); every slot carries the činnost's parallel capacity.
 *
 * Pure: no React, no network.
 */
import {
  categoryOrFallback,
  countsForOrder,
  isUnsavedPast,
  orderCategoryIds,
  plannedFrom,
  slotMinutesOf,
  timeAsMinutes,
  timeLeft,
  type CategoryId,
  type PlannerContext,
  type PlannerSession,
} from '../../model';
import { capacityOf, type CoverageActivity } from '../../../components/clubs/order/coverage';
import {
  pickCoverage,
  type PickActivityCoverage,
  type PickCoverage,
  type PlanWindow,
} from '../../../components/booking/calendar/pickPlan';

/** The id every planner window carries as its calendar: the planner has one board, not one grid per calendar. */
export const PLANNER_CALENDAR_ID = 'planner';
/** The grid step of the board's drag (minutes). */
export const PLAN_STEP = 5;

export interface FigureOptions {
  /** Only terms of this order count (a shared calendar also holds other clubs' terms). */
  orderId?: string | null;
  /** Extra windows laid on top of the real ones: the live drag preview. */
  extraWindows?: readonly PlanWindow[];
  /** Enlarging a saved order ("Přidat hráče"): the saved činnosti, so only the added players are counted. */
  baseline?: readonly CoverageActivity[];
}

export interface CategoryFigure {
  categoryId: CategoryId;
  name: string;
  subtitle: string;
  color: string;
  iconKey: string;
  /** Players ordered (in additive mode: the added players). */
  requested: number;
  /** Players planned outside any term of the list (the demo's `baselinePlanned`); 0 for real data. */
  outside: number;
  /** Players covered by whole slots of the windows, never more than the need. */
  covered: number;
  /** `outside + covered`, never above `requested`. */
  planned: number;
  remaining: number;
  /** 0-100, `planned / requested` rounded. */
  percent: number;
  done: boolean;
  slotMinutes: number;
  /** Players of one slot (the činnost's parallel capacity). */
  lanes: number;
  remainingSlots: number;
  /** Calendar minutes the missing players still need, whole slots. */
  remainingMinutes: number;
  /** Places planned beyond the players (whole slots × lanes), and the minutes they hold. */
  spareSeats: number;
  spareMinutes: number;
  /** List price of one player in CZK, null when none is known. */
  priceCzk: number | null;
}

export interface OrderFigures {
  coverage: PickCoverage;
  list: CategoryFigure[];
  byId: Map<CategoryId, CategoryFigure>;
  requested: number;
  planned: number;
  remaining: number;
  percent: number;
  remainingMinutes: number;
  spareSeats: number;
  /** Players left over in sum of all činnosti with a price: the money lost by the places beyond the players. */
  lostCzk: number | null;
  /** Club terms of the ordered činnosti and the seats of those created in this session. */
  termCount: number;
  /** Terms the save would write: those of today or later (a saved window of the past is history, not a write). */
  savableTerms: number;
  /** Terms of the order that lie in the past and were never saved: they count for nothing and are never written. */
  pastIgnored: number;
  newSlots: number;
  /** Every player of every činnost has a place. */
  complete: boolean;
  /** Enlarging mode: the figures are those of the added players only. */
  additive: boolean;
}

/** The činnosti of the order as the counter reads them (order of the order, seats still to plan). */
export function coverageActivities(ctx: PlannerContext): CoverageActivity[] {
  return ctx.demands.map((d) => {
    const c = categoryOrFallback(ctx, d.categoryId);
    const outside = plannedFrom(ctx, [], d.categoryId);
    return {
      activityId: d.categoryId,
      name: c.name,
      seats: Math.max(0, d.requested - outside),
      minutesPerSeat: slotMinutesOf(ctx, d.categoryId),
      parallelCapacity: Math.max(1, c.parallelCapacity ?? 1),
    };
  });
}

/**
 * The window one club term occupies for the counter, in whole slots of its činnost. The term's own length gives
 * `floor(minutes / slot)` slots, its `capacity` (players) `ceil(capacity / lanes)`; the larger one counts, so a
 * term made of whole slots by the planner (capacity = slots) and a window loaded from the saved order (capacity
 * = players, spare slots included) are both read right, and so is a term whose clock times were never exact.
 */
export function windowOfSession(
  s: Pick<PlannerSession, 'id' | 'date' | 'start' | 'end' | 'capacity' | 'categoryId'>,
  slotMinutes: number,
  lanes: number,
): PlanWindow | null {
  const start = timeAsMinutes(s.start);
  const end = timeAsMinutes(s.end);
  const seats = Math.max(0, Math.floor(Number(s.capacity) || 0));
  if (!Number.isFinite(start) || !(slotMinutes > 0)) return null;
  const byTime = Number.isFinite(end) && end > start ? Math.floor((end - start) / slotMinutes + 1e-9) : 0;
  const slots = Math.max(byTime, Math.ceil(seats / Math.max(1, lanes)));
  if (slots === 0) return null;
  return {
    id: s.id,
    range: { start, end: start + slots * slotMinutes },
    dayKey: s.date,
    activityIds: [s.categoryId],
    step: PLAN_STEP,
  };
}

/** A window for a placement that does not exist yet (the drag preview, a dialog, a trim). */
export function previewWindow(
  id: string,
  date: string,
  categoryId: CategoryId,
  startMinutes: number,
  slots: number,
  slotMinutes: number,
): PlanWindow {
  return {
    id,
    range: { start: startMinutes, end: startMinutes + Math.max(0, slots) * slotMinutes },
    dayKey: date,
    activityIds: [categoryId],
    step: PLAN_STEP,
  };
}

/** The club terms of the ordered činnosti that belong to this order. */
export function orderTerms(ctx: PlannerContext, orderId?: string | null): PlannerSession[] {
  const ids = orderCategoryIds(ctx);
  return ctx.sessions.filter(
    (s) =>
      countsForOrder(ctx, s) &&
      ids.includes(s.categoryId) &&
      (orderId == null || s.orderId == null || s.orderId === orderId),
  );
}

/** Windows of every club term of the order. */
export function orderWindows(ctx: PlannerContext, orderId?: string | null): PlanWindow[] {
  const out: PlanWindow[] = [];
  for (const s of orderTerms(ctx, orderId)) {
    const c = categoryOrFallback(ctx, s.categoryId);
    const w = windowOfSession(s, slotMinutesOf(ctx, s.categoryId), Math.max(1, c.parallelCapacity ?? 1));
    if (w) out.push(w);
  }
  return out;
}

const percentOf = (planned: number, requested: number): number =>
  requested > 0 ? Math.max(0, Math.min(100, Math.round((100 * planned) / requested))) : 0;

export function orderFigures(ctx: PlannerContext, options: FigureOptions = {}): OrderFigures {
  const activities = coverageActivities(ctx);
  const windows = [...orderWindows(ctx, options.orderId), ...(options.extraWindows ?? [])];
  const coverage = pickCoverage(activities, windows, options.baseline ? { baseline: options.baseline } : {});
  const additive = coverage.additional === true;
  const baselineIds = new Set(ctx.baselineSessions.map((b) => b.id));
  const terms = orderTerms(ctx, options.orderId);

  const list: CategoryFigure[] = ctx.demands.map((d) => {
    const c = categoryOrFallback(ctx, d.categoryId);
    const slotMinutes = slotMinutesOf(ctx, d.categoryId);
    const lanes = capacityOf({ parallelCapacity: c.parallelCapacity ?? 1 });
    const outside = additive ? 0 : plannedFrom(ctx, [], d.categoryId);
    const row: PickActivityCoverage | undefined = coverage.perActivity.find((a) => a.activityId === d.categoryId);
    const requested = additive ? (row?.seats ?? 0) : Math.max(0, d.requested);
    const covered = row?.coveredSeats ?? 0;
    const planned = additive ? covered : Math.min(requested, outside + covered);
    const remaining = Math.max(0, requested - planned);
    const remainingSlots = Math.ceil(remaining / lanes - 1e-9);
    return {
      categoryId: d.categoryId,
      name: c.name,
      subtitle: c.subtitle ?? '',
      color: c.color,
      iconKey: c.iconKey,
      requested,
      outside,
      covered,
      planned,
      remaining,
      percent: percentOf(planned, requested),
      done: requested > 0 ? remaining === 0 : true,
      slotMinutes,
      lanes,
      remainingSlots,
      remainingMinutes: remainingSlots * slotMinutes,
      spareSeats: row?.spareSeats ?? 0,
      spareMinutes: row?.spareMinutes ?? 0,
      priceCzk: c.priceCzk ?? null,
    };
  });

  const requested = list.reduce((n, f) => n + f.requested, 0);
  const planned = list.reduce((n, f) => n + f.planned, 0);
  const lostParts = list.filter((f) => f.spareSeats > 0).map((f) => (f.priceCzk === null ? null : f.priceCzk * f.spareSeats));
  return {
    coverage,
    list,
    byId: new Map(list.map((f) => [f.categoryId, f])),
    requested,
    planned,
    remaining: Math.max(0, requested - planned),
    percent: percentOf(planned, requested),
    remainingMinutes: list.reduce((n, f) => n + f.remainingMinutes, 0),
    spareSeats: list.reduce((n, f) => n + f.spareSeats, 0),
    lostCzk: lostParts.length === 0 || lostParts.some((p) => p === null) ? null : lostParts.reduce<number>((n, p) => n + (p ?? 0), 0),
    termCount: terms.length,
    savableTerms: terms.filter((s) => s.date >= ctx.today).length,
    pastIgnored: ctx.sessions.filter((s) => s.origin !== 'public' && !s.foreign && orderCategoryIds(ctx).includes(s.categoryId) && (options.orderId == null || s.orderId == null || s.orderId === options.orderId) && isUnsavedPast(ctx, s)).length,
    newSlots: terms.filter((s) => !baselineIds.has(s.id)).reduce((n, s) => n + Number(s.capacity || 0), 0),
    complete: requested > 0 && planned >= requested,
    additive,
  };
}

/* ------------------------------ the live drag preview ------------------------------ */

export interface PreviewFigures {
  /** The figures with the dragged window counted in. */
  after: OrderFigures;
  /** Players the window adds to its činnost (0 when it covers nothing new). */
  added: number;
  /** The window makes the činnost complete. */
  willComplete: boolean;
}

/** The figures as they would be with one more window - the card, the ring and the command panel preview it live. */
export function previewFigures(
  ctx: PlannerContext,
  before: OrderFigures,
  window: PlanWindow,
  options: Omit<FigureOptions, 'extraWindows'> = {},
): PreviewFigures {
  const after = orderFigures(ctx, { ...options, extraWindows: [window] });
  const categoryId = window.activityIds?.[0] ?? '';
  const was = before.byId.get(categoryId);
  const now = after.byId.get(categoryId);
  const added = Math.max(0, (now?.planned ?? 0) - (was?.planned ?? 0));
  return { after, added, willComplete: added > 0 && (now?.done ?? false) };
}

/* ------------------------------ words ------------------------------ */

export const personsWord = (n: number): string => (n === 1 ? 'osoba' : n >= 2 && n <= 4 ? 'osoby' : 'osob');

/** "126 osob zbývá naplánovat" / "✓ Požadavek klubu splněn". */
export const remainingSentence = (f: Pick<OrderFigures, 'remaining'>): string =>
  f.remaining > 0 ? `${f.remaining} osob zbývá naplánovat` : '✓ Požadavek klubu splněn';

/** "20 min / osoba · 6 h 40 min" - slot length and the time the missing players still need. */
export const durationLine = (f: Pick<CategoryFigure, 'slotMinutes' | 'remainingMinutes'>): string =>
  `${f.slotMinutes} min / osoba · ${timeLeft(f.remainingMinutes)}`;
