/*
 * Small lookups every pure function shares: the session's source, its length,
 * the category and demand of a činnost, the default planning window.
 */
import { timeAsMinutes } from './time';
import type {
  CategoryId,
  OrderDemand,
  PlannerCategory,
  PlannerContext,
  PlannerSession,
  PlanningWindow,
  SessionOrigin,
} from './types';

/** 07:00 – 19:00, the planning window of the prototype (420 … 1140 minutes). */
export const DEFAULT_WINDOW: PlanningWindow = { startMinutes: 420, endMinutes: 1140 };

/** Hours shown on the board: 07:00 … 18:00 labels, `WINDOW_MINUTES` tall. */
export const WINDOW_MINUTES = 720;

/** The prototype's `minutesOf(e)`: length of a term in minutes, never negative. */
export const minutesOf = (e: Pick<PlannerSession, 'start' | 'end'>): number =>
  Math.max(0, timeAsMinutes(e.end) - timeAsMinutes(e.start));

/**
 * Whose term it is. The prototype also treats three demo ids as public; here
 * the origin is explicit data (`PlannerSession.origin`), the demo fixtures
 * carry `origin: 'public'` on those three.
 */
export const sourceFor = (e: Pick<PlannerSession, 'origin'>): SessionOrigin =>
  e.origin === 'public' ? 'public' : 'club';

export function categoryOf(ctx: Pick<PlannerContext, 'categories'>, id: CategoryId): PlannerCategory | undefined {
  return ctx.categories.find((c) => c.id === id);
}

/** Like `categoryOf` but never undefined: an unknown id yields a neutral placeholder. */
export function categoryOrFallback(ctx: Pick<PlannerContext, 'categories'>, id: CategoryId): PlannerCategory {
  return (
    categoryOf(ctx, id) ?? { id, name: id, iconKey: 'info', color: '#6e91a5', slotMinutes: 30 }
  );
}

export function demandOf(ctx: Pick<PlannerContext, 'demands'>, id: CategoryId): OrderDemand | undefined {
  return ctx.demands.find((d) => d.categoryId === id);
}

/** Slot length of a činnost in this order (order override, else the category). */
export function slotMinutesOf(ctx: Pick<PlannerContext, 'categories' | 'demands'>, id: CategoryId): number {
  const d = demandOf(ctx, id);
  const c = categoryOf(ctx, id);
  return d?.slotMinutes ?? c?.slotMinutes ?? 0;
}

/** The činnosti of the order in display order (`visibleOrderTypes()`). */
export const orderCategoryIds = (ctx: Pick<PlannerContext, 'demands'>): CategoryId[] =>
  ctx.demands.map((d) => d.categoryId);

/** Sessions of one day sorted by start (`dayEvents`). */
export function dayEvents(ctx: Pick<PlannerContext, 'sessions'>, date: string): PlannerSession[] {
  return ctx.sessions.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Agenda semantics (`listVisible`): every created term of the ordered činnosti
 * plus every public term, chronological.
 */
export function listVisible(ctx: PlannerContext): PlannerSession[] {
  const ids = orderCategoryIds(ctx);
  return ctx.sessions
    .filter((e) => e.showInList !== false && (sourceFor(e) === 'public' || ids.includes(e.categoryId)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** A context for tests / quick calls: sensible defaults for the omitted parts. */
export function makeContext(partial: Partial<PlannerContext> & Pick<PlannerContext, 'categories'>): PlannerContext {
  return {
    sessions: [],
    demands: [],
    baselineSessions: [],
    dayBudgetMinutes: 720,
    today: '2026-11-20',
    window: DEFAULT_WINDOW,
    ...partial,
  };
}
