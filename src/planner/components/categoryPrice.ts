/*
 * The owner's rule "prices everywhere": wherever a činnost is named in the planner its price stands next to it.
 * One činnost has one price (the price list's figure, `PlannerCategory.priceCzk`), so there is no range here -
 * `formatCzk`, or "bez ceny" when the list has none. (A služba's "od 1 600 Kč" range lives in
 * `pages/booking/serviceOverview.ts` for the places that name a služba.)
 */
import { priceWord } from '../../components/booking/price/agreedPrice';
import { formatCzk } from '../../components/booking/NewAppointmentDialog.logic';
import type { PlannerCategory, PlannerServiceEntry } from '../model';

type Priced = Pick<PlannerCategory, 'priceCzk'>;
type Named = Priced & Pick<PlannerCategory, 'name'>;

/** "1 600 Kč" / "bez ceny". */
export const categoryPriceText = (c: Priced): string => priceWord(c.priceCzk);

/** "Základní prohlídka · 1 600 Kč" - an entry of a native list, a tooltip, an accessible name. */
export const categoryWithPrice = (c: Named, name: string = c.name): string => `${name} · ${categoryPriceText(c)}`;

/** "od 1 200 Kč" when the činnosti of a služba differ, "1 200 Kč" when they agree, "bez ceny" when none is priced. */
export const servicePriceText = (s: Pick<PlannerServiceEntry, 'minCzk' | 'maxCzk'>): string =>
  s.minCzk === null || s.maxCzk === null ? 'bez ceny' : s.minCzk === s.maxCzk ? formatCzk(s.minCzk) : `od ${formatCzk(s.minCzk)}`;

/** "Sportovní diagnostika · od 1 200 Kč" - an entry of the služba filter. */
export const serviceWithPrice = (s: PlannerServiceEntry): string => `${s.name} · ${servicePriceText(s)}`;
