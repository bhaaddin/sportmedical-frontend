/* ══════════════════════════════════════════════════════════════
   PUBLIC DISCOUNT TIERS

   GET /api/public/discount-tiers does not exist on the server yet (contract C3
   has only the staff endpoint). This module tries it and, when it is missing or
   answers nonsense, says "unknown" — and the page hides the number. It never
   falls back to a figure written in code.

   Accepted shapes: [{ minPersons, percent }] or { tiers: [...] }, optionally in
   the { success, data } envelope.
   ══════════════════════════════════════════════════════════════ */

import { useQuery } from '@tanstack/react-query';
import { unwrapEnvelope, webHttp } from '../web/http';

export interface DiscountTier {
  minPersons: number;
  percent: number;
}

export const DISCOUNT_TIERS_KEY = ['web', 'discount-tiers'] as const;

export function normalizeDiscountTiers(raw: unknown): DiscountTier[] {
  let body = unwrapEnvelope(raw);
  if (body !== null && typeof body === 'object' && !Array.isArray(body) && 'tiers' in body) {
    body = (body as { tiers: unknown }).tiers;
  }
  if (!Array.isArray(body)) return [];
  return body
    .flatMap((item): DiscountTier[] => {
      if (item === null || typeof item !== 'object') return [];
      const { minPersons, percent } = item as { minPersons?: unknown; percent?: unknown };
      if (typeof minPersons !== 'number' || typeof percent !== 'number') return [];
      if (!Number.isFinite(minPersons) || !Number.isFinite(percent) || minPersons < 1 || percent <= 0) return [];
      return [{ minPersons, percent }];
    })
    .sort((a, b) => a.minPersons - b.minPersons);
}

/** [] when the endpoint is missing (404) or unreachable. */
export async function fetchDiscountTiers(): Promise<DiscountTier[]> {
  try {
    const { data } = await webHttp.get<unknown>('/api/public/discount-tiers');
    return normalizeDiscountTiers(data);
  } catch {
    return [];
  }
}

export function useDiscountTiers() {
  return useQuery<DiscountTier[]>({
    queryKey: DISCOUNT_TIERS_KEY,
    queryFn: fetchDiscountTiers,
    initialData: () => [],
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** The biggest tier — "−15 % od 10 osob" — or null when none is known. */
export function topTier(tiers: DiscountTier[]): DiscountTier | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((best, tier) => (tier.percent > best.percent ? tier : best));
}

/** "−15 %" with a non-breaking space; the percent may have decimals ("−12,5 %"). */
export function formatPercent(percent: number): string {
  return `−${percent.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} %`;
}
