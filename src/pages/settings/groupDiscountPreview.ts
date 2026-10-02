/*
 * The arithmetic behind the NÁHLED card on Slevy a cenové hladiny.
 *
 * Pure, so it can be checked without a browser: which tier a headcount falls
 * into, what a sample order comes to, and which činnost the sample is priced
 * on. The tiers are the clinic's (the server's), the price is the price
 * list's; nothing here keeps a number of its own except the board's sample
 * headcount of twelve - and even that gives way when no tier reaches it.
 */
import type { GroupDiscountTier } from '../../api/groupDiscounts';

/** The tier a group of `headcount` people falls into, or -1 for none. */
export function tierIndexFor(tiers: readonly GroupDiscountTier[], headcount: number): number {
  return tiers.findIndex(
    (tier) =>
      headcount >= tier.minHeadcount
      && (tier.maxHeadcount === null || headcount <= tier.maxHeadcount),
  );
}

/**
 * The tiers carry no names of their own - the API has none - so a tier is
 * called by its place: "Hladina 1", "Hladina 2". Not "Malá skupina" or
 * "Celý tým": a name the clinic never typed is a name the screen made up.
 */
export const tierName = (index: number): string => `Hladina ${index + 1}`;

/**
 * How many people the sample order is for. The board shows twelve; when no
 * tier reaches twelve (a clinic whose first tier starts at twenty), the
 * sample moves to the first tier's start so the preview still shows a
 * discount being applied rather than a price with nothing happening to it.
 */
export function sampleHeadcount(tiers: readonly GroupDiscountTier[], preferred = 12): number {
  if (tierIndexFor(tiers, preferred) >= 0) return preferred;
  const starts = tiers.map((t) => t.minHeadcount).filter((n) => Number.isFinite(n) && n > 0);
  return starts.length === 0 ? preferred : Math.min(...starts);
}

export interface PricedActivity {
  name: string;
  priceCzk: number | null;
  isActive: boolean;
}

/** The dearest priced činnost on offer - the one a club books by the dozen. */
export function dearestPriced<T extends PricedActivity>(activities: readonly T[]): T | null {
  let best: T | null = null;
  for (const activity of activities) {
    if (!activity.isActive || activity.priceCzk === null) continue;
    if (best === null || (best.priceCzk ?? 0) < activity.priceCzk) best = activity;
  }
  return best;
}

export interface DiscountPreview {
  headcount: number;
  unitPrice: number;
  subtotal: number;
  /** -1 when no tier applies; then `percent` and `discount` are 0. */
  tierIndex: number;
  percent: number;
  discount: number;
  total: number;
}

/** What `headcount` × `unitPrice` comes to once the matching tier is taken off. */
export function discountPreview(
  tiers: readonly GroupDiscountTier[],
  unitPrice: number,
  headcount: number,
): DiscountPreview {
  const subtotal = unitPrice * headcount;
  const tierIndex = tierIndexFor(tiers, headcount);
  const percent = tierIndex >= 0 ? tiers[tierIndex].percent : 0;
  const discount = Math.round((subtotal * percent) / 100);
  return { headcount, unitPrice, subtotal, tierIndex, percent, discount, total: subtotal - discount };
}
