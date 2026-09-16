/* ══════════════════════════════════════════════════════════════
   PUBLIC INTAKE — CLIENT-SIDE VALIDATION

   Mirrors the backend domain rules 1:1 so the public questionnaire
   never accepts a value the server will reject. The backend remains
   the authority; this exists only to give the patient a readable
   error at the field instead of a 400 after submit.

   Sources mirrored (SportMedical.Diagnostics.Domain / .Application):
     - Patients/CzechBirthNumber.cs          (Normalize, DecodeMonth, Parse)
     - Patients/Identity/InsuranceNumber.cs  (CZ policy: ^\d{9,10}$)
     - Patients/CzechHealthInsurerCode.cs    (111..213)
     - Patients/EmailContactAddressContract.cs
     - Patients/Canonicalization/EmailContactAddressCanonicalizer.cs
     - Patients/Canonicalization/PhoneContactAddressCanonicalizer.cs
   ══════════════════════════════════════════════════════════════ */

/* ── Result type ── */

export interface FieldError {
  /** Stable code, mirrors the backend error code where one exists. */
  code: string;
  /** Czech, patient-readable. Never contains a technical code. */
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: FieldError };

const fail = (code: string, message: string): { ok: false; error: FieldError } => ({
  ok: false,
  error: { code, message },
});

const pass = <T,>(value: T): { ok: true; value: T } => ({ ok: true, value });

/* ── Sex (erasableSyntaxOnly forbids `enum`) ── */

export const Sex = {
  Male: 'Male',
  Female: 'Female',
} as const;

export type Sex = (typeof Sex)[keyof typeof Sex];

/* ══════════════════════════════════════════════════════════════
   Czech birth number (rodné číslo)
   ══════════════════════════════════════════════════════════════ */

export interface ParsedBirthNumber {
  /** Digits only, no slash — matches CzechBirthNumber.CanonicalValue. */
  canonicalValue: string;
  /** ISO date derived from the number itself. */
  dateOfBirth: string;
  sex: Sex;
}

const isAsciiDigits = (value: string): boolean => /^[0-9]+$/.test(value);

/** Mirrors CzechBirthNumber.Normalize. */
function normalizeBirthNumber(input: string): ValidationResult<string> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return fail('birthNumber.required', 'Rodné číslo je povinné.');
  }

  // Optional slash after the sixth digit: "990101/1234" -> "9901011234".
  const canonical =
    (trimmed.length === 10 || trimmed.length === 11) && trimmed[6] === '/'
      ? trimmed.slice(0, 6) + trimmed.slice(7)
      : trimmed;

  if ((canonical.length !== 9 && canonical.length !== 10) || !isAsciiDigits(canonical)) {
    return fail(
      'birthNumber.format_invalid',
      'Rodné číslo musí mít 9 nebo 10 číslic, lomítko za šestou číslicí je volitelné. Například 9901011234 nebo 990101/1234.',
    );
  }

  return pass(canonical);
}

/** Mirrors CzechBirthNumber.DecodeMonth — female offset +50, alternate ranges +20/+70. */
function decodeMonth(encodedMonth: number): { month: number; sex: Sex } | null {
  if (encodedMonth >= 1 && encodedMonth <= 12) return { month: encodedMonth, sex: Sex.Male };
  if (encodedMonth >= 21 && encodedMonth <= 32) return { month: encodedMonth - 20, sex: Sex.Male };
  if (encodedMonth >= 51 && encodedMonth <= 62) return { month: encodedMonth - 50, sex: Sex.Female };
  if (encodedMonth >= 71 && encodedMonth <= 82) return { month: encodedMonth - 70, sex: Sex.Female };
  return null;
}

/** True only if y-m-d is a real calendar date (rejects 31.02. etc.). */
function isRealDate(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

const toIsoDate = (year: number, month: number, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/**
 * Mirrors CzechBirthNumber.Parse, including the century split at 53, the
 * forbidden "000" serial on nine-digit numbers, and the modulo-11 checksum
 * on ten-digit numbers.
 */
export function parseBirthNumber(input: string): ValidationResult<ParsedBirthNumber> {
  const normalized = normalizeBirthNumber(input);
  if (!normalized.ok) return normalized;

  const canonical = normalized.value;
  const yearPart = Number(canonical.slice(0, 2));
  const encodedMonth = Number(canonical.slice(2, 4));
  const day = Number(canonical.slice(4, 6));

  const decoded = decodeMonth(encodedMonth);
  if (decoded === null) {
    return fail('birthNumber.date_invalid', 'Rodné číslo neobsahuje platný měsíc narození.');
  }

  const year =
    canonical.length === 9
      ? yearPart > 53
        ? 1800 + yearPart
        : 1900 + yearPart
      : yearPart > 53
        ? 1900 + yearPart
        : 2000 + yearPart;

  if (!isRealDate(year, decoded.month, day)) {
    return fail('birthNumber.date_invalid', 'Rodné číslo neobsahuje platné datum narození.');
  }

  if (canonical.length === 9) {
    if (canonical.slice(6) === '000') {
      return fail('birthNumber.format_invalid', 'Devítimístné rodné číslo nesmí končit na 000.');
    }
  } else if (Number(canonical) % 11 !== 0) {
    return fail(
      'birthNumber.checksum_invalid',
      /* Optional field: say so, rather than leaving somebody stuck on a number
         they have copied correctly. About a thousand numbers issued before
         1985 fail this check legitimately, and a foreign number fails it by
         not being a Czech birth number at all. */
      'Rodné číslo neprošlo kontrolou. Zkontrolujte opis — pokud je správný, ' +
        'nechte pole prázdné a pokračujte, není povinné.',
    );
  }

  return pass({
    canonicalValue: canonical,
    dateOfBirth: toIsoDate(year, decoded.month, day),
    sex: decoded.sex,
  });
}

/* ══════════════════════════════════════════════════════════════
   Health insurance
   ══════════════════════════════════════════════════════════════ */

/** Mirrors CzechHealthInsurerCode. Order is the order shown in the picker. */
export const CZECH_INSURERS = [
  { code: 111, short: 'VZP', name: 'Všeobecná zdravotní pojišťovna' },
  { code: 201, short: 'VoZP', name: 'Vojenská zdravotní pojišťovna' },
  { code: 205, short: 'ČPZP', name: 'Česká průmyslová zdravotní pojišťovna' },
  { code: 207, short: 'OZP', name: 'Oborová zdravotní pojišťovna' },
  { code: 209, short: 'ZPŠ', name: 'Zaměstnanecká pojišťovna Škoda' },
  { code: 211, short: 'ZPMV', name: 'Zdravotní pojišťovna ministerstva vnitra' },
  { code: 213, short: 'RBP', name: 'Revírní bratrská pokladna' },
] as const;

const INSURER_CODES: ReadonlySet<number> = new Set(CZECH_INSURERS.map((i) => i.code));

export function validateInsurerCode(code: number | null): ValidationResult<number> {
  if (code === null) {
    return fail('insurer.required', 'Vyberte prosím svou zdravotní pojišťovnu.');
  }
  if (!INSURER_CODES.has(code)) {
    return fail('insurer.unknown', 'Tuto zdravotní pojišťovnu neznáme. Vyberte prosím ze seznamu.');
  }
  return pass(code);
}

/** Mirrors InsuranceNumber CZ policy: ^\d{9,10}$. Structure only, no checksum. */
export function validateInsuranceNumber(input: string): ValidationResult<string> {
  const trimmed = input.trim().replace(/\s|\//g, '');

  if (trimmed.length === 0) {
    return fail('insuranceNumber.required', 'Číslo pojištěnce je povinné.');
  }
  if (!/^\d{9,10}$/.test(trimmed)) {
    return fail(
      'insuranceNumber.format_invalid',
      /* The form has a branch for people without Czech insurance; somebody
         typing a foreign number here has no way of knowing that. */
      'Číslo pojištěnce musí mít 9 nebo 10 číslic. Najdete ho na kartičce ' +
        'pojištěnce. Pokud české pojištění nemáte, zvolte výše „Nemám české pojištění".',
    );
  }
  return pass(trimmed);
}

/* ══════════════════════════════════════════════════════════════
   Email — asked of the server, not decided here

   This block used to MIRROR `EmailContactAddressCanonicalizer`: one `@`,
   a local part of 1–64, a domain containing a dot and not starting or
   ending with one, no whitespace, 254 overall. Careful, well meant, and
   wrong — the same way the staff screen's regular expression was wrong,
   measured against the running server on 15. 9. 2026:

     jan@localhost     the form refused it (no dot); the server stores it
     jan@háčková.cz    both accept it; the server stores
                       jan@xn--hkov-5nad81a.cz

   A mirror is a copy that agrees until the original changes. App built
   `POST /api/public/contact-check/email` — anonymous, no token, the SAME
   canonicaliser rather than another copy — so the shape is decided in one
   place for the desk and the public form alike.

   What stays here is whether there is an address at all. That needs no
   round trip and it is true whoever is asked.
   ══════════════════════════════════════════════════════════════ */

export function validateEmail(input: string): ValidationResult<string> {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return fail('email.required', 'E-mail je povinný — pošleme na něj potvrzení rezervace.');
  }

  return pass(trimmed);
}

/* ══════════════════════════════════════════════════════════════
   Phone — asked of the server, not decided here

   This block used to hold five dial prefixes written out by hand
   (CZ, SK, PL, DE, AT) and an E.164 shape check, and it did not only
   judge a number — it BUILT the one that was submitted, turning
   `777777777` + CZ into `+420777777777` by concatenation.

   Two things were wrong with that. A Hungarian could not be described
   at all, because `+36` was not in the list; and the value that reached
   the registry was assembled by a rule that had drifted from the one
   that stores it. `POST /api/public/contact-check/phone` answers both
   on the same libphonenumber the desk uses — the owner asked for
   exactly that: "rovnaka logika a premakanost u oboch uplne rovnako".

   What stays here is whether there is a number at all.
   ══════════════════════════════════════════════════════════════ */

export interface PhoneInput {
  /** ISO 3166-1 alpha-2, from the country picker. */
  regionCode: string;
  /** Raw as typed by the patient. */
  number: string;
}

export function validatePhone({ number }: PhoneInput): ValidationResult<string> {
  const trimmed = number.trim();

  if (trimmed.length === 0) {
    return fail('phone.required', 'Telefon je povinný — ozveme se na něj, pokud bude potřeba.');
  }

  return pass(trimmed);
}

/* ══════════════════════════════════════════════════════════════
   Names
   ══════════════════════════════════════════════════════════════ */

const NAME_MAX = 100;

export function validateName(input: string, field: 'given' | 'family'): ValidationResult<string> {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  const label = field === 'given' ? 'Jméno' : 'Příjmení';

  if (trimmed.length === 0) {
    return fail(`${field}Name.required`, `${label} je povinné.`);
  }
  if (trimmed.length > NAME_MAX) {
    return fail(`${field}Name.too_long`, `${label} je příliš dlouhé (maximálně ${NAME_MAX} znaků).`);
  }
  if (/\d/.test(trimmed)) {
    return fail(`${field}Name.format_invalid`, `${label} nesmí obsahovat číslice.`);
  }

  return pass(trimmed);
}

/* ══════════════════════════════════════════════════════════════
   Date of birth (typed directly, when no birth number is given)
   ══════════════════════════════════════════════════════════════ */

const MAX_AGE_YEARS = 130;

export function validateDateOfBirth(isoDate: string, today = new Date()): ValidationResult<string> {
  if (isoDate.trim().length === 0) {
    return fail('dateOfBirth.required', 'Datum narození je povinné.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return fail('dateOfBirth.format_invalid', 'Datum narození musí být ve tvaru DD.MM.RRRR.');
  }

  const [year, month, day] = isoDate.split('-').map(Number);
  if (!isRealDate(year, month, day)) {
    return fail('dateOfBirth.format_invalid', 'Toto datum neexistuje.');
  }

  const value = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  if (value > todayUtc) {
    return fail('dateOfBirth.in_future', 'Datum narození nemůže být v budoucnosti.');
  }
  if (year < today.getUTCFullYear() - MAX_AGE_YEARS) {
    return fail('dateOfBirth.implausible', 'Zkontrolujte prosím rok narození.');
  }

  return pass(isoDate);
}

/**
 * The birth number encodes date of birth and sex. When the patient supplies
 * both, they must agree — a mismatch is the single most common sign of a
 * mistyped birth number, and catching it here keeps bad identity data out of
 * the matching pipeline entirely.
 */
export function crossCheckBirthNumber(
  parsed: ParsedBirthNumber,
  declaredDateOfBirth: string,
  declaredSex: Sex,
): ValidationResult<true> {
  if (parsed.dateOfBirth !== declaredDateOfBirth) {
    return fail(
      'birthNumber.date_mismatch',
      'Rodné číslo neodpovídá zadanému datu narození. Zkontrolujte prosím obě pole.',
    );
  }
  if (parsed.sex !== declaredSex) {
    return fail(
      'birthNumber.sex_mismatch',
      'Rodné číslo neodpovídá zadanému pohlaví. Zkontrolujte prosím obě pole.',
    );
  }
  return pass(true);
}
