import { PRICE_TEXT, priceWord } from '../price/agreedPrice';
import { formatCzk } from '../NewAppointmentDialog.logic';

/*
 * "Ceny doplnit všude" (the owner, 10. 10. 2026): wherever an appointment is
 * shown, its price is shown with it. This is the one reading of what that
 * price is, so the hover card, the grid card, Dnešní přehled, the plocha and
 * the patient's card never disagree:
 *
 *   agreedPriceCzk ?? listPriceCzk ?? the činnost's catalogue price
 *
 * The agreed price is what the desk typed for this visit; the list price is
 * what the price list said when the row was read; the catalogue price is the
 * fallback for a row from a route that carries no money at all. When the
 * agreed figure differs from the list, the caption says so the way the
 * booking dialog does ("upraveno (ceník 1 600 Kč)") - reused from
 * `agreedPrice.ts`, never spelt a second time.
 */

/** Any row that may carry the two Etapa 12 fields; both optional, both nullable. */
export interface PricedRow {
  agreedPriceCzk?: number | null;
  listPriceCzk?: number | null;
}

export interface ShownPrice {
  /** What the visit costs; `null` when nobody knows. */
  amountCzk: number | null;
  /** The price list's figure this amount is measured against; `null` when the list has none. */
  listCzk: number | null;
  /** The agreed amount differs from the list. */
  adjusted: boolean;
  /** "1 600 Kč", or "bez ceny". */
  text: string;
  /** "upraveno (ceník 1 600 Kč)" when adjusted; `null` otherwise. */
  caption: string | null;
}

/** The price to show for one row, with the catalogue's figure as the last resort. */
export function shownPrice(row: PricedRow | null | undefined, cataloguePriceCzk?: number | null): ShownPrice {
  const listCzk = row?.listPriceCzk ?? cataloguePriceCzk ?? null;
  const agreed = row?.agreedPriceCzk ?? null;
  const amountCzk = agreed ?? listCzk;
  const adjusted = agreed !== null && agreed !== listCzk;
  return {
    amountCzk,
    listCzk,
    adjusted,
    text: priceWord(amountCzk),
    caption: adjusted ? PRICE_TEXT.adjusted(listCzk) : null,
  };
}

/** The sum of the rows that have a price; rows without one add nothing. */
export function sumPrices(prices: readonly ShownPrice[]): number {
  return prices.reduce((total, p) => total + (p.amountCzk ?? 0), 0);
}

/** "Celkem dnes: 4 800 Kč" - the day's money, said once. */
export function dayTotalLine(prices: readonly ShownPrice[]): string {
  return `${PRICE_LINE_TEXT.dayTotal} ${formatCzk(sumPrices(prices))}`;
}

export const PRICE_LINE_TEXT = {
  label: PRICE_TEXT.label,
  dayTotal: 'Celkem dnes:',
};

export { formatCzk };
