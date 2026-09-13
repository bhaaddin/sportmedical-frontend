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
  category: string;
  /* Text, not numbers: these come out of text fields, and an empty field is
     not 0. Parsing at the edge is what lets "" be told apart from "0". */
  priceCzk: string;
  /* No longer typed anywhere - carried through so the save does not blank it. */
  durationMinutes: string;
  isActive: boolean;
}

export type ServiceErrors = Partial<Record<keyof ServiceDraft, string>>;

/** The categories already in use, so the common case is a pick and not typing. */
export function categoriesInUse(services: ServiceItem[]): string[] {
  const seen = new Set(services.map((s) => s.category.trim()).filter((c) => c !== ''));
  return [...seen].sort((a, b) => a.localeCompare(b, 'cs'));
}

/**
 * A number as somebody at a desk would write it.
 *
 * Spaces (including the non-breaking one `toLocaleString('cs-CZ')` puts in)
 * are thousands separators and are dropped; a comma is the decimal point. A
 * lone dot is treated as a decimal point too, because a keyboard's numeric pad
 * has one and people use it.
 */
export function parseCzechNumber(text: string): number | null {
  const cleaned = text.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function draftFrom(service: ServiceItem | null): ServiceDraft {
  if (service === null) {
    return {
      code: '', name: '', description: '', category: '',
      durationMinutes: String(DEFAULT_DURATION_MINUTES), priceCzk: '', isActive: true,
    };
  }
  return {
    code: service.code,
    name: service.name,
    description: service.description,
    category: service.category,
    durationMinutes: String(service.durationMinutes),
    priceCzk: String(service.priceCzk),
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
  if (draft.category.trim() === '') errors.category = 'Zvolte kategorii.';

  const price = parseCzechNumber(draft.priceCzk);
  if (price === null) {
    errors.priceCzk = 'Zadejte cenu v Kč.';
  } else if (price < 0) {
    errors.priceCzk = 'Cena nemůže být záporná.';
  }

  return errors;
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
    category: draft.category.trim(),
    durationMinutes: parseCzechNumber(draft.durationMinutes) ?? DEFAULT_DURATION_MINUTES,
    priceCzk: parseCzechNumber(draft.priceCzk) ?? 0,
    isActive: draft.isActive,
  };
}
