/*
 * The rules the price list has to hold on its own.
 *
 * Measured on the server before a line of this was written: `POST` and `PUT
 * /api/services` check nothing beyond "the field is present". No unique code,
 * no non-negative price, no non-zero duration. A service saved with a duration
 * of 0 is not merely odd - the card divides the price by it and prints
 * "Infinity Kč/min". A duplicate code makes two rows that look identical in
 * every list that shows the code and nowhere else.
 *
 * So the checking lives here, in front, in a module with no React in it, so
 * each rule can be broken in a test and seen to fail.
 *
 * Prices are typed by a Czech-speaking person at a desk: "1 500", "1500,50",
 * "1.500". All three mean the same amount and all three are accepted.
 */
import type { ServiceItem } from '../../api/services';
import { FIELD_LIMITS } from '../../api/fieldLimits';

/*
 * What goes in the column nobody reads any more.
 *
 * Length is a fact about the činnost - the time it takes in a calendar - and
 * a doklad has no use for it. Booking measured that the price-list duration
 * was read in one place in the whole system, a comparison against the
 * činnost's own, and deleted it along with the `price.duration_drift` warning
 * it raised. The column stays, so a new row needs something in it; existing
 * rows keep whatever they have.
 */
export const DEFAULT_DURATION_MINUTES = 30;

export interface ServiceDraft {
  code: string;
  name: string;
  description: string;
  /* Text, not numbers: these come out of text fields, and an empty field is
     not 0. Parsing at the edge is what lets "" be told apart from "0". */
  priceCzk: string;
  /* Optional crossed-out price; "" = none. */
  listPriceCzk: string;
  /* No longer typed anywhere - carried through so the save does not blank it. */
  durationMinutes: string;
  isActive: boolean;
}

export type ServiceErrors = Partial<Record<keyof ServiceDraft, string>>;

/**
 * A number as somebody at a desk would write it.
 *
 * Spaces (including the non-breaking one `toLocaleString('cs-CZ')` puts in)
 * are thousands separators and are dropped; a comma is the decimal point. A
 * lone dot is treated as a decimal point too, because a keyboard's numeric pad
 * has one and people use it.
 */
export function parseCzechNumber(text: string): number | null {
  let cleaned = text.replace(/[\s\u00A0\u202F]/g, '');
  /*
   * "1.500,50" and "1.500" are the Czech way to write one thousand five hundred:
   * a dot is a thousands separator when a comma follows it, or when it splits
   * groups of exactly three digits ("1.500", "12.345.678"). "1500.50" and "0.5"
   * stay decimals - money has two decimals, never three. Without this "1.500"
   * was saved as 1,5 K\u010D, which the header above promised not to do.
   */
  if (cleaned.includes(',')) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(cleaned)) cleaned = cleaned.replace(/\./g, '');
  if (cleaned === '') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function draftFrom(service: ServiceItem | null): ServiceDraft {
  if (service === null) {
    return {
      code: '', name: '', description: '',
      durationMinutes: String(DEFAULT_DURATION_MINUTES), priceCzk: '', listPriceCzk: '', isActive: true,
    };
  }
  return {
    code: service.code,
    name: service.name,
    description: service.description,
    durationMinutes: String(service.durationMinutes),
    priceCzk: String(service.priceCzk),
    listPriceCzk: typeof service.listPriceCzk === 'number' && service.listPriceCzk > 0 ? String(service.listPriceCzk) : '',
    isActive: service.isActive,
  };
}

/**
 * What is wrong with this draft, field by field.
 *
 * `editingId` is the service being changed, so its own code does not count as
 * a clash with itself - without it, opening a service and pressing save is an
 * error.
 */
export function validateService(
  draft: ServiceDraft,
  existing: ServiceItem[],
  editingId: string | null,
): ServiceErrors {
  const errors: ServiceErrors = {};
  const code = draft.code.trim();
  const name = draft.name.trim();

  if (code === '') {
    errors.code = 'Kód je povinný.';
  } else if (
    existing.some(
      (s) => s.id !== editingId && s.code.trim().toLowerCase() === code.toLowerCase(),
    )
  ) {
    errors.code = 'Tenhle kód už jedna položka má.';
  }

  if (name === '') errors.name = 'Název je povinný.';
  else if (name.length > FIELD_LIMITS.priceItemName) errors.name = `Název může mít nejvýše ${FIELD_LIMITS.priceItemName} znaků.`;

  if (code.length > FIELD_LIMITS.priceItemCode && errors.code === undefined) {
    errors.code = `Kód může mít nejvýše ${FIELD_LIMITS.priceItemCode} znaků.`;
  }
  if (draft.description.trim().length > FIELD_LIMITS.priceItemDescription) {
    errors.description = `Popis může mít nejvýše ${FIELD_LIMITS.priceItemDescription} znaků.`;
  }

  const price = parseCzechNumber(draft.priceCzk);
  if (price === null) {
    errors.priceCzk = 'Zadejte cenu v Kč.';
  } else if (price < 0) {
    errors.priceCzk = 'Cena nemůže být záporná.';
  } else if (!hasAtMostTwoDecimals(price)) {
    errors.priceCzk = 'Cena může mít nejvýše dvě desetinná místa.';
  }

  if ((draft.listPriceCzk ?? '').trim() !== '') {
    const list = parseCzechNumber(draft.listPriceCzk ?? '');
    if (list === null) {
      errors.listPriceCzk = 'Zadejte původní cenu v Kč, nebo pole nechte prázdné.';
    } else if (!hasAtMostTwoDecimals(list)) {
      errors.listPriceCzk = 'Původní cena může mít nejvýše dvě desetinná místa.';
    } else if (list <= 0 || (price !== null && list <= price)) {
      errors.listPriceCzk = 'Původní cena musí být vyšší než cena.';
    }
  }

  return errors;
}

/** Koruny and haléře: the server stores whatever it is sent, so three decimals would end up on an invoice. */
export function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

export function hasErrors(errors: ServiceErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The draft as the server wants it. Only call once `validateService` is clean. */
export function toRequest(draft: ServiceDraft) {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    durationMinutes: parseCzechNumber(draft.durationMinutes) ?? DEFAULT_DURATION_MINUTES,
    priceCzk: parseCzechNumber(draft.priceCzk) ?? 0,
    /* Empty = none: an explicit null clears a stored value on update. */
    listPriceCzk: (draft.listPriceCzk ?? '').trim() === '' ? null : parseCzechNumber(draft.listPriceCzk ?? ''),
    isActive: draft.isActive,
  };
}
