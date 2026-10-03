/* ══════════════════════════════════════════════════════════════
   THE PUBLIC PRICE LIST — the only source of prices on the public site

   GET /api/public/price-list → [{ category, items: [{ code, name, description,
   priceCzk, durationMinutes }] }]. No price exists anywhere else in the public
   code: a page asks this module, and when the answer is not there (server asleep,
   price not set) it shows "—", never a number it remembered.
   ══════════════════════════════════════════════════════════════ */

import { useQuery } from '@tanstack/react-query';
import { unwrapEnvelope, webHttp } from '../web/http';

export interface PriceItem {
  code: string;
  name: string;
  description: string;
  priceCzk: number | null;
  durationMinutes: number | null;
  /**
   * The price before a package discount (shown crossed out next to `priceCzk`). Optional: the public
   * endpoint may not send it yet; a page then simply shows no crossed-out number.
   */
  listPriceCzk?: number | null;
}

export interface PriceCategory {
  category: string;
  items: PriceItem[];
}

export const PRICE_LIST_KEY = ['web', 'price-list'] as const;

const NBSP = String.fromCharCode(0xa0);

/** Anything the server sent, made into categories; unknown shapes are dropped, never thrown on. */
export function normalizePriceList(raw: unknown): PriceCategory[] {
  const body = unwrapEnvelope(raw);
  if (!Array.isArray(body)) return [];
  return body.flatMap((group): PriceCategory[] => {
    if (group === null || typeof group !== 'object') return [];
    const { category, items } = group as { category?: unknown; items?: unknown };
    if (typeof category !== 'string' || !Array.isArray(items)) return [];
    return [{
      category,
      items: items.flatMap((item): PriceItem[] => {
        if (item === null || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        if (typeof row.name !== 'string' || row.name.trim() === '') return [];
        const listPrice = typeof row.listPriceCzk === 'number' && Number.isFinite(row.listPriceCzk) && row.listPriceCzk > 0 ? row.listPriceCzk : null;
        return [{
          ...(listPrice !== null ? { listPriceCzk: listPrice } : {}),
          code: typeof row.code === 'string' ? row.code : '',
          name: row.name,
          description: typeof row.description === 'string' ? row.description : '',
          priceCzk: typeof row.priceCzk === 'number' && Number.isFinite(row.priceCzk) ? row.priceCzk : null,
          durationMinutes:
            typeof row.durationMinutes === 'number' && Number.isFinite(row.durationMinutes) && row.durationMinutes > 0
              ? row.durationMinutes
              : null,
        }];
      }),
    }];
  });
}

/** Throws when the server is unreachable: the caller keeps the list it already had. */
export async function fetchPriceList(): Promise<PriceCategory[]> {
  const { data } = await webHttp.get<unknown>('/api/public/price-list');
  return normalizePriceList(data);
}

/**
 * The price list. Empty until the first answer; in a prerendered page the build-time answer is
 * already in the cache and this refreshes it, so a price changed in the admin shows within a visit.
 */
export function usePriceList() {
  return useQuery<PriceCategory[]>({
    queryKey: PRICE_LIST_KEY,
    queryFn: fetchPriceList,
    initialData: () => [],
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** "2 200 Kč" with non-breaking spaces (Czech typography), or null for a price nobody has set. */
export function formatCzk(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${value.toLocaleString('cs-CZ').replace(/\p{Zs}/gu, NBSP)}${NBSP}Kč`;
}

/** "40 min" with a non-breaking space, or null. */
export function formatMinutes(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return `${value}${NBSP}min`;
}

/** Lower-case, no diacritics, "₂" → "2": the form names are compared in. */
export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/₂/g, '2')
    .toLowerCase();
}

export interface RowSpec {
  /** Matched against the CATEGORY name (folded) first … */
  category: RegExp;
  /** … and, when no category matches, against each item name (folded). */
  items?: RegExp[];
  /** How many rows at most. */
  limit: number;
}

/**
 * The rows a landing block shows: the items of the category named like the service, in the
 * order the admin keeps them. Matching is by NAME — never by amount — so renaming or repricing in
 * the admin changes the page without a release.
 */
export function pickRows(categories: PriceCategory[], spec: RowSpec): PriceItem[] {
  const byCategory = categories.find((group) => spec.category.test(foldName(group.category)));
  if (byCategory !== undefined) return byCategory.items.slice(0, spec.limit);

  if (spec.items === undefined) return [];
  const all = categories.flatMap((group) => group.items);
  const rows: PriceItem[] = [];
  for (const pattern of spec.items) {
    const found = all.find((item) => pattern.test(foldName(item.name)) && !rows.includes(item));
    if (found !== undefined) rows.push(found);
  }
  return rows.slice(0, spec.limit);
}

/** The cheapest priced item ("Ceník od …"), or null when there is no price at all. */
export function lowestPrice(categories: PriceCategory[]): number | null {
  const prices = categories.flatMap((group) => group.items.map((item) => item.priceCzk))
    .filter((price): price is number => typeof price === 'number' && price > 0);
  return prices.length === 0 ? null : Math.min(...prices);
}
