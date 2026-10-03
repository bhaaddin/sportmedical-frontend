/*
 * The new document while it is being drawn up, and what it takes to send it -
 * no React, so each rule can be broken in a test.
 *
 * Osoba needs a patient; Skupina needs a name and a headcount; Tým needs a club
 * and a headcount. All three need at least one činnost. The prices are never
 * worked out here: the lines go to the server (`price-quote`, then the invoice)
 * and the server answers with the numbers.
 */
import type {
  CreateInvoiceRequest, InvoiceGroup, PriceQuoteRequest, RecipientType,
} from '../../api/billing';
import type { DraftLine } from './invoicePrefill';

export interface GroupDraft {
  name: string;
  ico: string;
  dic: string;
  address: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}

export interface ClubChoice {
  id: string;
  name: string;
  /** The club's own discount, as the club list reports it. */
  discountPercent?: number | null;
}

export interface InvoiceDraft {
  /** `null` until the desk has chosen who the document is for. */
  type: RecipientType | null;
  patientId: string;
  club: ClubChoice | null;
  group: GroupDraft;
  headcount: string;
  lines: DraftLine[];
  manualPercent: string;
  manualReason: string;
  notes: string;
  appointmentId: string | null;
}

export const EMPTY_GROUP: GroupDraft = {
  name: '', ico: '', dic: '', address: '', contactPerson: '', contactEmail: '', contactPhone: '',
};

export const EMPTY_DRAFT: InvoiceDraft = {
  type: null,
  patientId: '',
  club: null,
  group: EMPTY_GROUP,
  headcount: '',
  lines: [],
  manualPercent: '',
  manualReason: '',
  notes: '',
  appointmentId: null,
};

/** A whole number of people, 1 or more; anything else is "not given". */
export function parseHeadcount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/**
 * The manual discount: empty means none, otherwise 0–100 with at most two
 * decimals. `null` is an invalid entry, which the field marks.
 */
export function parseManualPercent(raw: string): number | null {
  const text = raw.trim().replace(',', '.');
  if (text === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  return n >= 0 && n <= 100 ? n : null;
}

const ICO = /^\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is wrong with the group's form, field by field; empty when it is fine. */
export function groupErrors(group: GroupDraft): Partial<Record<keyof GroupDraft, string>> {
  const errors: Partial<Record<keyof GroupDraft, string>> = {};
  if (group.name.trim() === '') errors.name = 'Zadejte název skupiny nebo firmy.';
  if (group.ico.trim() !== '' && !ICO.test(group.ico.replace(/\s/g, ''))) errors.ico = 'IČO má 8 číslic.';
  if (group.contactEmail.trim() !== '' && !EMAIL.test(group.contactEmail.trim())) {
    errors.contactEmail = 'Zadejte e-mail ve tvaru jmeno@domena.cz.';
  }
  return errors;
}

/** The quote the draft asks for; `null` while there is nothing to price. */
export function buildQuoteRequest(draft: InvoiceDraft): PriceQuoteRequest | null {
  if (draft.type === null || draft.lines.length === 0) return null;
  if (draft.type === 'Team' && draft.club === null) return null;

  const manual = parseManualPercent(draft.manualPercent);
  if (manual === null) return null;
  const headcount = parseHeadcount(draft.headcount);

  return {
    recipientType: draft.type,
    ...(draft.type === 'Team' && draft.club !== null ? { clubId: draft.club.id } : {}),
    ...(draft.type !== 'Person' && headcount !== null ? { headcount } : {}),
    lines: draft.lines.map((l) => ({ activityId: l.activityId, quantity: l.quantity })),
    ...(manual > 0 ? { manualDiscountPercent: manual } : {}),
  };
}

/** What still has to be filled in before the document can go; empty means ready. */
export function draftProblems(draft: InvoiceDraft, patientChosen: boolean): string[] {
  const problems: string[] = [];
  if (draft.type === null) return ['Vyberte, komu doklad vystavujete.'];

  if (draft.type === 'Person' && !patientChosen) problems.push('Vyberte pacienta.');
  if (draft.type === 'Group') {
    if (draft.group.name.trim() === '') problems.push('Zadejte název skupiny.');
    if (Object.keys(groupErrors(draft.group)).length > 0 && draft.group.name.trim() !== '') {
      problems.push('Opravte údaje skupiny.');
    }
  }
  if (draft.type === 'Team' && draft.club === null) problems.push('Vyberte klub.');
  if (draft.type !== 'Person' && parseHeadcount(draft.headcount) === null) problems.push('Zadejte počet osob.');
  if (draft.lines.length === 0) problems.push('Vyberte alespoň jednu činnost z ceníku.');
  if (parseManualPercent(draft.manualPercent) === null) problems.push('Ruční sleva musí být 0–100 %.');
  return problems;
}

function trimmedGroup(group: GroupDraft): InvoiceGroup {
  const out: InvoiceGroup = { name: group.name.trim() };
  const optional: (keyof Omit<GroupDraft, 'name'>)[] = [
    'ico', 'dic', 'address', 'contactPerson', 'contactEmail', 'contactPhone',
  ];
  for (const key of optional) {
    const value = group[key].trim();
    if (value !== '') out[key] = key === 'ico' ? value.replace(/\s/g, '') : value;
  }
  return out;
}

/** The body for `POST /api/billing/invoices`. Call only when `draftProblems` is empty. */
export function buildCreateRequest(draft: InvoiceDraft): CreateInvoiceRequest {
  const type = draft.type ?? 'Person';
  const manual = parseManualPercent(draft.manualPercent) ?? 0;
  const headcount = parseHeadcount(draft.headcount);
  const reason = draft.manualReason.trim();
  const notes = draft.notes.trim();

  return {
    recipientType: type,
    ...(type === 'Person' ? { patientId: draft.patientId } : {}),
    ...(type === 'Person' && draft.appointmentId !== null ? { appointmentId: draft.appointmentId } : {}),
    ...(type === 'Team' && draft.club !== null ? { clubId: draft.club.id } : {}),
    ...(type === 'Group' ? { group: trimmedGroup(draft.group) } : {}),
    ...(type !== 'Person' && headcount !== null ? { headcount } : {}),
    ...(manual > 0 ? { manualDiscountPercent: manual } : {}),
    ...(manual > 0 && reason !== '' ? { manualDiscountReason: reason } : {}),
    ...(notes !== '' ? { notes } : {}),
    lines: draft.lines.map((l) => ({ activityId: l.activityId, quantity: l.quantity })),
  };
}
