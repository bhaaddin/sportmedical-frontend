/*
 * R15c (a) - discount presets next to the editable price of the booking dialog.
 *
 * A preset only FILLS the editable agreed price (`priceTyped`); it never sends anything by itself and it is always resettable
 * ("Vrátit ceník" of the field). Percentages are taken from the LIST price (never compounded on an already edited price), rounded to
 * whole Kč, half up, in integer arithmetic (1 187,50 Kč -> 1 188 Kč, never 1 187 because of a float). The group-tier percentages come
 * from the clinic's own group-discount settings; nothing is hard-coded except the two everyday presets the owner named (5 %, 10 %).
 * "Zdarma" is 0 Kč and needs a reason, which travels in the booking's note like any other price reason.
 */
import type { GroupDiscountTier } from '../../../api/groupDiscounts';
import { amountText, parseCzk } from '../price/agreedPrice';

export interface DiscountPreset {
  id: string;
  label: string;
  /** 0..100; `100` for "zdarma". */
  percent: number;
  kind: 'percent' | 'group' | 'free';
  /** Longer words for the tooltip / aria-label. */
  hint: string;
}

export const FIXED_PERCENTS = [5, 10] as const;

/** The percentage as a Czech figure: 7,5 not 7.5. */
export const percentWord = (percent: number): string => `${String(Math.round(percent * 100) / 100).replace('.', ',')} %`;

/** `list` less `percent` %, in whole Kč, half up, exact (integer arithmetic on hundredths of a percent and of a crown). */
export function discountedCzk(listCzk: number, percent: number): number {
  if (!Number.isFinite(listCzk) || listCzk <= 0) return 0;
  const p = Math.min(100, Math.max(0, percent));
  const halers = Math.round(listCzk * 100);
  const basisPoints = Math.round(p * 100);
  /* halers * (10000 - bp) is in units of 1e-6 crown; + half a crown, floor = whole crowns, half up */
  return Math.floor((halers * (10000 - basisPoints) + 500000) / 1_000_000);
}

/** The presets for a price: 5 %, 10 %, one per distinct group-tier percentage, then "Zdarma". Tier percentages that are 0 are left out. */
export function presetsFor(tiers: readonly GroupDiscountTier[] | undefined, options: { allowFree: boolean }): DiscountPreset[] {
  const out: DiscountPreset[] = FIXED_PERCENTS.map((p) => ({ id: `pct-${p}`, label: `−${percentWord(p)}`, percent: p, kind: 'percent' as const, hint: `Sleva ${percentWord(p)} z ceníku` }));
  const seen = new Set<number>(FIXED_PERCENTS);
  for (const tier of [...(tiers ?? [])].sort((a, b) => a.minHeadcount - b.minHeadcount)) {
    if (!(tier.percent > 0) || tier.percent >= 100 || seen.has(tier.percent)) continue;
    seen.add(tier.percent);
    const band = tier.maxHeadcount === null ? `od ${tier.minHeadcount} osob` : tier.minHeadcount === tier.maxHeadcount ? `${tier.minHeadcount} osob` : `${tier.minHeadcount}–${tier.maxHeadcount} osob`;
    out.push({ id: `group-${tier.percent}`, label: `Skupina −${percentWord(tier.percent)}`, percent: tier.percent, kind: 'group', hint: `Skupinová sleva ${percentWord(tier.percent)} (${band}) z nastavení slev` });
  }
  if (options.allowFree) out.push({ id: 'free', label: 'Zdarma', percent: 100, kind: 'free', hint: 'Zdarma (0 Kč) - vyžaduje důvod' });
  return out;
}

/** What the price field shows after the preset: the discounted amount as the field's own text. */
export const presetTyped = (listCzk: number, preset: Pick<DiscountPreset, 'percent'>): string => amountText(discountedCzk(listCzk, preset.percent));

/** The preset whose result is exactly what is typed (the chip that stays pressed), or null. */
export function activePresetId(listCzk: number | null, typed: string | null, presets: readonly DiscountPreset[]): string | null {
  if (listCzk === null || typed === null) return null;
  const value = parseCzk(typed);
  if (value === null) return null;
  return presets.find((p) => discountedCzk(listCzk, p.percent) === value)?.id ?? null;
}

/** A price of 0 Kč is a gift: it books only with a reason (whether it came from the preset or was typed). */
export const freeNeedsReason = (agreedPriceCzk: number | null, reason: string): boolean => agreedPriceCzk === 0 && reason.trim() === '';
