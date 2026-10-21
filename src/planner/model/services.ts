/*
 * R1 - the main planner's filter lists SLUŽBY (the clinic's four groups), not činnosti, one entry per služba:
 * "Sportovní lékařské prohlídky", "Sportovní diagnostika", ... Two services whose names differ only in accents or case
 * are one entry (the data once held both "Sportovní prohlídky" and an unaccented twin).
 *
 * The filter value is the id of the entry (the first služba of that name) or 'all'. A služba shows EVERY booking of ANY of
 * its činnosti (owner's default answer, Q1). A value that is not an entry any more - an old činnost id, a služba that left
 * the calendars in scope - means 'all' (`normalizeFilter`), so a stale value never empties the board.
 */
import type { CategoryId, PlannerCategory, PlannerContext } from './types';

export const ALL_FILTER = 'all';

export interface PlannerServiceEntry {
  /** The filter value: the id of the first služba carrying this name. */
  id: string;
  name: string;
  /** Every činnost of every služba with this (normalised) name. */
  categoryIds: CategoryId[];
  /** The lowest / highest price among its priced činnosti; null when none is priced. */
  minCzk: number | null;
  maxCzk: number | null;
}

/** "Základní  Diagnostika", "zakladni diagnostika" -> the same key. */
export const serviceKey = (name: string): string =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const cache = new WeakMap<readonly PlannerCategory[], PlannerServiceEntry[]>();

/** The služby of the catalogue, in the order their first činnost appears; činnosti without a služba are not listed. */
export function plannerServices(categories: readonly PlannerCategory[]): PlannerServiceEntry[] {
  const hit = cache.get(categories);
  if (hit) return hit;
  const byKey = new Map<string, PlannerServiceEntry>();
  for (const c of categories) {
    const name = (c.serviceName ?? '').trim();
    if (!c.serviceId || name === '') continue;
    const key = serviceKey(name) || c.serviceId;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { id: c.serviceId, name, categoryIds: [], minCzk: null, maxCzk: null };
      byKey.set(key, entry);
    }
    entry.categoryIds.push(c.id);
    if (typeof c.priceCzk === 'number') {
      entry.minCzk = entry.minCzk === null ? c.priceCzk : Math.min(entry.minCzk, c.priceCzk);
      entry.maxCzk = entry.maxCzk === null ? c.priceCzk : Math.max(entry.maxCzk, c.priceCzk);
    }
  }
  const list = [...byKey.values()];
  cache.set(categories, list);
  return list;
}

/** 'all' or the id of a listed služba; anything else (an unknown id, an old činnost id) becomes 'all'. */
export function normalizeFilter(filter: string | null | undefined, categories: readonly PlannerCategory[]): string {
  if (!filter || filter === ALL_FILTER) return ALL_FILTER;
  return plannerServices(categories).some((s) => s.id === filter) ? filter : ALL_FILTER;
}

/**
 * Does a booking / term of činnost `categoryId` belong under the filter? 'all' - everything; a služba - any of its činnosti;
 * a činnost id - that činnost (the club planner's own filter lists the order's činnosti, and an old value may still be one);
 * anything else is stale and filters nothing.
 */
export function inFilter(categories: readonly PlannerCategory[], filter: string, categoryId: CategoryId): boolean {
  if (filter === ALL_FILTER) return true;
  const entry = plannerServices(categories).find((s) => s.id === filter);
  if (entry) return entry.categoryIds.includes(categoryId);
  if (categories.some((c) => c.id === filter)) return categoryId === filter;
  return true;
}

/** The same for a whole context. */
export const inFilterCtx = (ctx: Pick<PlannerContext, 'categories'>, filter: string, categoryId: CategoryId): boolean => inFilter(ctx.categories, filter, categoryId);
