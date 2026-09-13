/*
 * A payer, and what you need from it before you can send it an invoice.
 *
 * The server has carried the whole shape since the beginning - `Club` has
 * `ico`, `dic`, `address`, `city`, `postalCode`, `bankAccount`, `bankCode`,
 * `iban` and `paymentTermsDays` - and the screen collected five fields, none
 * of which lets anybody be billed. A payer with a name, an IČO and a phone
 * number is a contact, not a plátce.
 *
 * What is checked here is only what is checkable without guessing. An IČO has
 * a fixed Czech shape and a check digit; a payment term is a whole number of
 * days. A bank account or an IBAN typed by somebody reading it off a contract
 * is validated for shape, not rejected for being foreign - refusing a valid
 * Slovak or Austrian IBAN because the rule was written for `CZ` would be a
 * worse fault than accepting a typo.
 */

export interface PayerDraft {
  name: string;
  ico: string;
  dic: string;
  address: string;
  city: string;
  postalCode: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  bankAccount: string;
  bankCode: string;
  iban: string;
  /* Text, because an empty field is not a term of zero days. */
  paymentTermsDays: string;
}

export type PayerErrors = Partial<Record<keyof PayerDraft, string>>;

export const EMPTY_PAYER: PayerDraft = {
  name: '', ico: '', dic: '', address: '', city: '', postalCode: '',
  contactPerson: '', contactEmail: '', contactPhone: '',
  bankAccount: '', bankCode: '', iban: '', paymentTermsDays: '14',
};

/** Spaces are how people write these; they are never part of the value. */
function squash(text: string): string {
  return text.replace(/[\s  ]/g, '');
}

/**
 * The Czech IČO check digit.
 *
 * Eight digits alone is not a check - `12345678` passes that and is not an
 * IČO. The weighted modulus is the difference between "looks right" and "is
 * right", and an invoice to a wrong IČO is a document the účetní has to undo.
 */
export function isValidIco(ico: string): boolean {
  const digits = squash(ico);
  if (!/^\d{8}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 7; i += 1) sum += Number(digits[i]) * (8 - i);
  const remainder = sum % 11;
  const expected = remainder === 0 ? 1 : remainder === 1 ? 0 : 11 - remainder;
  return Number(digits[7]) === expected;
}

/**
 * A Czech DIČ: `CZ` and eight to ten digits. Empty is allowed - not every
 * club is registered for VAT, and demanding one would block the ones that
 * are not.
 */
export function isValidDic(dic: string): boolean {
  const value = squash(dic).toUpperCase();
  if (value === '') return true;
  return /^CZ\d{8,10}$/.test(value);
}

/**
 * An IBAN's shape and its checksum, for any country.
 *
 * The checksum is worth the few lines: it catches a transposed pair of digits,
 * which is the typo somebody makes copying an account off a contract and the
 * one that sends money to a stranger.
 */
export function isValidIban(iban: string): boolean {
  const value = squash(iban).toUpperCase();
  if (value === '') return true;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value)) return false;

  const rearranged = value.slice(4) + value.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));

  /* Mod 97 in chunks: the whole number would overflow a double. */
  let remainder = 0;
  for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/** A Czech bank code is four digits. Empty is allowed; an IBAN can stand alone. */
export function isValidBankCode(code: string): boolean {
  const value = squash(code);
  return value === '' || /^\d{4}$/.test(value);
}

export function validatePayer(draft: PayerDraft): PayerErrors {
  const errors: PayerErrors = {};

  if (draft.name.trim() === '') errors.name = 'Název je povinný.';

  if (squash(draft.ico) === '') errors.ico = 'IČO je povinné.';
  else if (!isValidIco(draft.ico)) errors.ico = 'Tohle IČO neexistuje — zkontrolujte číslice.';

  if (!isValidDic(draft.dic)) errors.dic = 'DIČ má tvar CZ a 8 až 10 číslic.';
  if (!isValidBankCode(draft.bankCode)) errors.bankCode = 'Kód banky má čtyři číslice.';
  if (!isValidIban(draft.iban)) errors.iban = 'Tenhle IBAN neprošel kontrolou — zkontrolujte jej.';

  if (draft.contactEmail.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contactEmail.trim())) {
    errors.contactEmail = 'Tohle není e-mailová adresa.';
  }

  const term = squash(draft.paymentTermsDays);
  if (term === '') {
    errors.paymentTermsDays = 'Zadejte splatnost ve dnech.';
  } else if (!/^\d+$/.test(term)) {
    errors.paymentTermsDays = 'Splatnost je celý počet dnů.';
  } else if (Number(term) > 365) {
    /* Not a rule of law, a typo guard: 140 instead of 14 is the mistake, and
       it turns an unpaid invoice into one nobody chases for four months. */
    errors.paymentTermsDays = 'Splatnost delší než rok je nejspíš překlep.';
  }

  return errors;
}

export function hasPayerErrors(errors: PayerErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The draft as the server wants it. Only call once `validatePayer` is clean. */
export function toPayerRequest(draft: PayerDraft) {
  return {
    name: draft.name.trim(),
    ico: squash(draft.ico),
    dic: squash(draft.dic).toUpperCase(),
    address: draft.address.trim(),
    city: draft.city.trim(),
    postalCode: squash(draft.postalCode),
    contactPerson: draft.contactPerson.trim(),
    contactEmail: draft.contactEmail.trim(),
    contactPhone: draft.contactPhone.trim(),
    bankAccount: squash(draft.bankAccount),
    bankCode: squash(draft.bankCode),
    iban: squash(draft.iban).toUpperCase(),
    paymentTermsDays: Number(squash(draft.paymentTermsDays)),
  };
}

/**
 * Whether this payer can actually be invoiced.
 *
 * Separate from validity on purpose: a club saved with a name and an IČO is a
 * legitimate record, it just cannot be sent a bill. The list says which are
 * which, so nobody discovers it at the moment of invoicing.
 */
export function canBeInvoiced(club: {
  bankAccount?: string | null;
  iban?: string | null;
  address?: string | null;
}): boolean {
  const hasAccount = (club.bankAccount ?? '') !== '' || (club.iban ?? '') !== '';
  return hasAccount && (club.address ?? '') !== '';
}
