/*
 * R15c (f) - find a patient by telephone number in the booking dialog's patient picker.
 *
 * The register's search is by name only and its query travels in the URL, so a number is NEVER sent. A query that is a phone number
 * (digits with or without +420 / 00420, spaces, dashes, brackets) is matched here, against the register pages the browser already
 * reads (no query parameter), and nothing is logged. A national number is compared by its digits, so "777 123 456",
 * "+420 777 123 456" and "00420777123456" all find the same row.
 */

/** Digits only, without the country prefix 420 when the number is long enough to carry it: "+420 777 123 456" -> "777123456". */
export function phoneDigits(value: string): string {
  const trimmed = value.trim();
  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  /* an explicit + / 00 prefix is a country code even while the number is half typed; a bare 420... only once it is a whole number */
  if (digits.startsWith('420') && (international || digits.length > 9)) digits = digits.slice(3);
  return digits;
}

/** Fewer digits than this would match half the register. */
export const MIN_PHONE_DIGITS = 4;

/** Is the typed text a phone number query (digits and phone punctuation only, at least `MIN_PHONE_DIGITS` digits)? */
export function looksLikePhone(typed: string): boolean {
  const t = typed.trim();
  return t !== '' && /^[+\d\s().-]+$/.test(t) && t.replace(/\D/g, '').length >= MIN_PHONE_DIGITS;
}

/** The number as a row carries it matches the typed query: the typed digits are contained in the row's national number. */
export function phoneMatches(rowPhone: string | null | undefined, typed: string): boolean {
  if (!rowPhone) return false;
  const wanted = phoneDigits(typed);
  if (wanted.length < MIN_PHONE_DIGITS) return false;
  return phoneDigits(rowPhone).includes(wanted);
}
