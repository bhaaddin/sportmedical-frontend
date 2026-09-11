// Czech birth-number (rodné číslo) helpers:
// format YYMMDD/XXXX, month +50 = woman, +20 = foreigner variant, modulo-11 check.

export function formatRodneCislo(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}/${digits.slice(6)}`;
}

export interface ParsedRC {
  valid: boolean;
  dateOfBirth: string; // yyyy-MM-dd or ''
  sex: 'Male' | 'Female' | '';
  isFemale: boolean;
}

export function parseRodneCislo(raw: string): ParsedRC {
  const empty: ParsedRC = { valid: false, dateOfBirth: '', sex: '', isFemale: false };
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 9 && digits.length !== 10) return empty;

  const year = parseInt(digits.slice(0, 2), 10);
  let month = parseInt(digits.slice(2, 4), 10);
  const day = parseInt(digits.slice(4, 6), 10);

  const isFemale = month > 50;
  if (isFemale) month -= 50;
  if (month > 20) month -= 20; // foreigner variant
  if (month < 1 || month > 12 || day < 1 || day > 31) return empty;

  /*
   * Ten digits: divisible by eleven, no exception. Owner's decision on
   * 10. 9. 2026, and it matches what the backend already enforces in
   * `CzechBirthNumber` - one rule, in two places that agree.
   *
   * What was here before was not a looser rule, it was a hole. It tested
   * `whole % 11 === 10`, which is the signature of a *wrong* check digit; the
   * historic exception gives `whole % 11 === 1`, because a first-nine remainder
   * of ten was written as a check digit of zero. So the branch let bad numbers
   * through the checksum and rejected the ones it was meant to admit. Nothing
   * showed, because `fullYear` was computed as NaN on the same condition and
   * discarded them three lines later - two mistakes cancelling.
   *
   * Whether those exception numbers were ever issued to anyone is not known
   * here. The `app` lane said so plainly, this lane cannot measure it either,
   * and it reached us once as "never issued" through a third party who had not
   * measured it. It is written down as an assumption, not a fact. It does not
   * change the rule: a typo that slips through surfaces on an insurer's
   * invoice, which is worse than refusing a number at the desk.
   */
  if (digits.length === 10 && parseInt(digits, 10) % 11 !== 0) return empty;

  /* Nine digits stopped being issued in 1954, so a year of 54 or more is the
     previous century. Ten-digit numbers start there, so it is the other way. */
  const fullYear =
    digits.length === 9
      ? year < 54
        ? 1900 + year
        : 1800 + year
      : year < 54
        ? 2000 + year
        : 1900 + year;

  const dob = new Date(fullYear, month - 1, day);
  if (dob.getFullYear() !== fullYear || dob.getMonth() !== month - 1 || dob.getDate() !== day) return empty;
  if (dob.getTime() > Date.now()) return empty;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return {
    valid: true,
    dateOfBirth: `${fullYear}-${mm}-${dd}`,
    sex: isFemale ? 'Female' : 'Male',
    isFemale,
  };
}
