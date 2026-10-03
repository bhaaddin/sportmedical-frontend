/* ══════════════════════════════════════════════════════════════
   WHAT THE PUBLIC SITE KNOWS AT RENDER TIME

   `WebBootstrap` is the build-time snapshot of the four public API answers
   (prices, clinic, site content, discount tiers). The prerender script fetches
   them, `render()` seeds a react-query cache with them so the HTML contains the
   real numbers, the page embeds them as `window.__SM_WEB__`, and the browser
   seeds its cache with the same object before hydrating — so server and client
   render the same first frame, and the queries then refresh everything.
   ══════════════════════════════════════════════════════════════ */

import { QueryClient, useQuery } from '@tanstack/react-query';
import type { PublicClinic } from '../api/clinicSettings';
import { webHttp, unwrapEnvelope } from './http';
import { DISCOUNT_TIERS_KEY, normalizeDiscountTiers } from '../api/publicDiscounts';
import type { DiscountTier } from '../api/publicDiscounts';
import { PRICE_LIST_KEY, normalizePriceList } from '../api/priceList';
import type { PriceCategory } from '../api/priceList';
import { SITE_CONTENT_KEY, normalizeSiteContent } from '../api/siteContent';
import type { SiteContent } from '../api/siteContent';

export const CLINIC_KEY = ['web', 'clinic'] as const;

export interface WebBootstrap {
  /** Epoch ms of the snapshot; cache entries are dated with it, so they count as stale right away. */
  builtAt: number;
  priceList: PriceCategory[] | null;
  clinic: PublicClinic | null;
  siteContent: SiteContent | null;
  discountTiers: DiscountTier[] | null;
}

export const EMPTY_BOOTSTRAP: WebBootstrap = {
  builtAt: 0,
  priceList: null,
  clinic: null,
  siteContent: null,
  discountTiers: null,
};

const NO_CLINIC: PublicClinic = { name: '', email: '', phone: '', address: '', bookingEnabled: true };

export function normalizeClinic(raw: unknown): PublicClinic | null {
  const body = unwrapEnvelope(raw);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  const hours = typeof data.openingHours === 'string' ? data.openingHours.trim() : '';
  return {
    name: text(data.name),
    email: text(data.email),
    phone: text(data.phone),
    address: text(data.address),
    bookingEnabled: data.bookingEnabled !== false,
    ...(hours !== '' ? { openingHours: hours } : {}),
  };
}

/** Raw answers (any of them may be missing) → the typed snapshot. Never throws. */
export function normalizeBootstrap(
  raw: { priceList?: unknown; clinic?: unknown; siteContent?: unknown; discountTiers?: unknown },
  builtAt: number = Date.now(),
): WebBootstrap {
  const priceList = raw.priceList === undefined || raw.priceList === null ? null : normalizePriceList(raw.priceList);
  const discounts = raw.discountTiers === undefined || raw.discountTiers === null ? null : normalizeDiscountTiers(raw.discountTiers);
  return {
    builtAt,
    // An empty price list is "the build could not get one": the page shows "—" and the browser refreshes.
    priceList: priceList !== null && priceList.length > 0 ? priceList : null,
    clinic: raw.clinic === undefined || raw.clinic === null ? null : normalizeClinic(raw.clinic),
    siteContent: raw.siteContent === undefined || raw.siteContent === null ? null : normalizeSiteContent(raw.siteContent),
    discountTiers: discounts !== null && discounts.length > 0 ? discounts : null,
  };
}

/** The query client of the public bundle (the staff one pulls in the live connection; not used here). */
export function createWebQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 60_000 },
    },
  });
}

/** Puts a snapshot into a cache, dated with the build time so every entry refreshes on mount. */
export function seedQueryClient(client: QueryClient, data: WebBootstrap | null | undefined): void {
  if (data === null || data === undefined) return;
  const updatedAt = data.builtAt > 0 ? data.builtAt : 1;
  if (data.priceList !== null) client.setQueryData(PRICE_LIST_KEY, data.priceList, { updatedAt });
  if (data.clinic !== null) client.setQueryData(CLINIC_KEY, data.clinic, { updatedAt });
  if (data.siteContent !== null) client.setQueryData(SITE_CONTENT_KEY, data.siteContent, { updatedAt });
  if (data.discountTiers !== null) client.setQueryData(DISCOUNT_TIERS_KEY, data.discountTiers, { updatedAt });
}

export async function fetchPublicClinic(): Promise<PublicClinic> {
  const { data } = await webHttp.get<unknown>('/api/public/clinic');
  const clinic = normalizeClinic(data);
  if (clinic === null) throw new Error('clinic: unexpected response');
  return clinic;
}

/** The clinic's public details (phone, e-mail, address, hours). Empty fields mean "not filled in". */
export function usePublicClinic(): PublicClinic {
  const { data } = useQuery<PublicClinic>({
    queryKey: CLINIC_KEY,
    queryFn: fetchPublicClinic,
    initialData: () => NO_CLINIC,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  return data ?? NO_CLINIC;
}

/** What the browser finds in the page when it was prerendered. */
declare global {
  interface Window {
    __SM_WEB__?: WebBootstrap;
  }
}
