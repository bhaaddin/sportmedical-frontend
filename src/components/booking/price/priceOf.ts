/*
 * R8 - ONE answer to "what does this činnost cost": the figure the server read through the činnost's price-list
 * link, else the price-list item the link points at, else the (active) price-list item that carries the činnost's
 * name (accents and case ignored). `null` only when the price list truly has no figure for it, and only then do the
 * screens say "bez ceny".
 *
 * Why the extra steps: the server's `priceCzk` is read through `serviceItemId` and is null when that link was never
 * made, although the price list has the item (live data, 21. 10. 2026: "Základní sportovní prohlídka · bez ceny" next
 * to a list that says 1 600 Kč).
 */
import type { ServiceItem } from '../../../api/services';

export type PriceItem = Pick<ServiceItem, 'id' | 'name' | 'priceCzk'> & { isActive?: boolean };

export interface PricedActivity {
  name: string;
  priceCzk?: number | null;
  serviceItemId?: string | null;
}

/** `Základní  Diagnostika` and `zakladni diagnostika` are the same name. */
export const normalizeName = (name: string): string =>
  name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const figure = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export type PriceVia = 'own' | 'link' | 'name' | null;

/** The price and where it came from. */
export function priceFor(activity: PricedActivity, items: readonly PriceItem[] = []): { priceCzk: number | null; via: PriceVia } {
  const own = figure(activity.priceCzk);
  if (own !== null) return { priceCzk: own, via: 'own' };
  if (activity.serviceItemId) {
    const linked = figure(items.find((i) => i.id === activity.serviceItemId)?.priceCzk);
    if (linked !== null) return { priceCzk: linked, via: 'link' };
  }
  const wanted = normalizeName(activity.name);
  if (wanted !== '') {
    const named = items
      .filter((i) => normalizeName(i.name) === wanted && figure(i.priceCzk) !== null)
      .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false))[0];
    if (named) return { priceCzk: figure(named.priceCzk), via: 'name' };
  }
  return { priceCzk: null, via: null };
}

/** The price of a činnost in CZK, or null when the price list has none. */
export const priceOf = (activity: PricedActivity, items: readonly PriceItem[] = []): number | null => priceFor(activity, items).priceCzk;
