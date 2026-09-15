/*
 * What to do with the server's verdict on an e-mail address.
 *
 * The owner found this one by typing it: "email nemam pocit ze funguje to
 * chybna zadanie .. tam som napriklad naprikladvgmail.com a nenapisalo ze je
 * to zly tvar ... toto ale nemam byt tvoj vymysel ale pozri je to v back ende".
 * Both halves of that were right. The screen said nothing, and the rule it
 * would have said it with was this frontend's own regular expression rather
 * than the code that actually stores the address.
 *
 * MEASURED AGAINST THE RUNNING SERVER, 15. 9. 2026 — the regex was wrong in
 * both directions, which is the whole argument for not having one:
 *
 *   jan@localhost      regex: refuse   server: stores it
 *   jan@example..cz    regex: accept   server: refuses it
 *   jan@háčková.cz     regex: accept   server: stores jan@xn--hkov-5nad81a.cz
 *
 * So nothing here decides whether an address is valid. It decides what to SAY
 * about an answer that has already been given.
 */
import type { EmailInspection } from '../../api/patientRegistry';

export type EmailDisplayState =
  /** Empty, or nothing asked yet. Say nothing. */
  | 'idle'
  /** The server would store this. */
  | 'valid'
  /** The server would refuse it. */
  | 'invalid';

export function emailDisplayState(
  inspection: EmailInspection | null,
  typed: string,
): EmailDisplayState {
  if (typed.trim() === '') return 'idle';
  if (inspection === null) return 'idle';
  return inspection.parses ? 'valid' : 'invalid';
}

/*
 * The codes a person at the desk can actually cause, copied from
 * `ContactAddressErrorCodes.cs` rather than from anybody's description of it.
 *
 * That distinction earned itself within the hour: app's message spelled the
 * second one `email.local_part_too_long` and the constant is
 * `email.local_part.too_long`. Taking the message would have shipped a key
 * that never matches, and a real complaint would have surfaced as the
 * catch-all below — right-looking and wrong.
 */
const EMAIL_INVALID = 'patients.contact_address.email.invalid';
const LOCAL_PART_TOO_LONG = 'patients.contact_address.email.local_part.too_long';
const DISPLAY_VALUE_TOO_LONG = 'patients.contact_address.display_value.too_long';

/**
 * What to put under the field.
 *
 * Every other code in that file — `representations_mismatch`,
 * `canonical_value_mismatch`, `search_key_mismatch`, the `canonical_value.*`
 * and `canonicalization_scheme.*` families — describes a value the server
 * builds FROM this input, so no typing can produce one. App put it plainly:
 * if one of those ever arrives it is not a bad address, it is a fault on their
 * side. They fall through to the last line, deliberately, and it says the
 * address could not be checked rather than blaming what somebody typed.
 */
export function emailComplaint(inspection: EmailInspection | null): string {
  if (inspection === null || inspection.parses) return '';

  switch (inspection.rejectionCode) {
    case EMAIL_INVALID:
      return 'E-mail není ve správném tvaru.';
    case LOCAL_PART_TOO_LONG:
      return 'Část před zavináčem je příliš dlouhá.';
    case DISPLAY_VALUE_TOO_LONG:
      return 'E-mailová adresa je příliš dlouhá.';
    default:
      return 'E-mail se nepodařilo ověřit. Zkuste to znovu, nebo ho zadejte jinak.';
  }
}

/**
 * The address as it will be stored, when that differs from what was typed.
 *
 * `  Jan@Example.CZ  ` is stored `Jan@Example.CZ`; the summary card is
 * supposed to show what will be saved, and showing the raw box instead makes
 * it a mirror rather than a statement.
 *
 * Falls back to the typed value whenever there is no answer yet, so the card
 * never blanks out while a request is in flight.
 */
export function storedAs(
  inspection: EmailInspection | null,
  typed: string,
): string {
  if (inspection === null || !inspection.parses) return typed.trim();
  return inspection.displayValue !== '' ? inspection.displayValue : typed.trim();
}

/**
 * Whether the address is worth asking about.
 *
 * Only that there is something in the box. Unlike the telephone there is no
 * "still typing" length to wait for — the question is asked when somebody
 * leaves the field, not on every keystroke, because `j`, `ja` and `jan@` are
 * all `parses: false` and a box that is red for the whole first word is a box
 * people stop reading.
 */
export function worthInspectingEmail(typed: string): boolean {
  return typed.trim() !== '';
}
