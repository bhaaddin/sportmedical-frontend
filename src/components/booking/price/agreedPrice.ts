import { formatCzk } from '../NewAppointmentDialog.logic';

/*
 * Etapa 12: the price of a visit is the price list's figure until the desk
 * says otherwise (the owner, 10. 10. 2026: "the price must be visible and
 * editable ... as soon as I click, there is a Cena field and I can correct
 * it. No percentages needed").
 *
 * The arithmetic is here, apart from the markup, so the booking dialog and the
 * appointment detail agree on what a typed amount means and what is sent:
 *
 *   - the desk types nothing      -> `agreedPriceCzk: null`, the list price stands;
 *   - the desk types an amount    -> that number, even when it equals the list;
 *   - the desk types nonsense     -> nothing can be sent until it is fixed.
 *
 * Whole Kč or two decimals, never negative. A comma is a decimal point here,
 * because that is what a Czech keyboard produces.
 */

const AMOUNT = /^\d{1,9}([.,]\d{1,2})?$/;

/** `"1 200,50"` -> `1200.5`; `null` for anything that is not an amount. */
export function parseCzk(typed: string): number | null {
  const compact = typed.replace(/[\s ]/g, '');
  if (!AMOUNT.test(compact)) return null;
  const value = Number(compact.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** The amount as the field shows it when prefilled: `1600`, `1200.5`. */
export function amountText(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

/** "bez ceny" when the price list has no figure; the money otherwise. */
export function priceWord(priceCzk: number | null | undefined): string {
  return priceCzk === null || priceCzk === undefined ? 'bez ceny' : formatCzk(priceCzk);
}

export interface PriceState {
  /** The price list's figure; `null` when the list has none. */
  listPriceCzk: number | null;
  /** What the desk typed; `null` while the field was never touched. */
  typed: string | null;
}

export interface PriceView {
  /** What the visit costs now - the list price, or the typed amount when it parses. */
  effectiveCzk: number | null;
  /** `null` while nothing was typed; the typed number otherwise - what goes on the wire. */
  agreedPriceCzk: number | null;
  /** Something is typed and it is not an amount. */
  invalid: boolean;
  /** The typed amount differs from the list price. */
  adjusted: boolean;
  /** The one line under the field. */
  caption: string;
}

export const PRICE_TEXT = {
  label: 'Cena',
  byList: 'podle ceníku',
  adjusted: (list: number | null) => `upraveno (ceník ${priceWord(list)})`,
  restore: 'Vrátit ceník',
  invalid: 'Zadejte částku v Kč — celé koruny nebo dvě desetinná místa, ne méně než 0.',
  noList: 'ceník cenu neuvádí',
};

export function priceView(state: PriceState): PriceView {
  const { listPriceCzk, typed } = state;
  if (typed === null) {
    return {
      effectiveCzk: listPriceCzk,
      agreedPriceCzk: null,
      invalid: false,
      adjusted: false,
      caption: listPriceCzk === null ? PRICE_TEXT.noList : PRICE_TEXT.byList,
    };
  }
  const parsed = parseCzk(typed);
  if (parsed === null) {
    return { effectiveCzk: null, agreedPriceCzk: null, invalid: true, adjusted: false, caption: PRICE_TEXT.invalid };
  }
  const adjusted = listPriceCzk === null || parsed !== listPriceCzk;
  return {
    effectiveCzk: parsed,
    agreedPriceCzk: parsed,
    invalid: false,
    adjusted,
    caption: adjusted ? PRICE_TEXT.adjusted(listPriceCzk) : PRICE_TEXT.byList,
  };
}

/**
 * "1 600 Kč (ceník)" or "1 200 Kč (upraveno, ceník 1 600 Kč)" - the detail's
 * one line about what a booked visit costs. `agreed` `null` means the list stands.
 */
export function priceLine(agreed: number | null | undefined, list: number | null | undefined): string {
  const listOrNull = list ?? null;
  if (agreed === null || agreed === undefined || agreed === listOrNull) {
    return listOrNull === null ? 'bez ceny' : `${formatCzk(listOrNull)} (ceník)`;
  }
  return `${formatCzk(agreed)} (upraveno, ceník ${priceWord(listOrNull)})`;
}
