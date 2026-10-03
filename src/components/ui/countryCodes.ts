/*
 * Dialling codes for the telephone field.
 *
 * The owner's rule for the desk: the number is typed the way people say it on
 * the phone - `773 539 001` - and the country sits beside it as a small picker,
 * Česko by default, because this is a Czech clinic and nine numbers in ten are
 * Czech. The chosen country is named under the field as a plain note
 * ("421 = Slovensko jen jako poznámka"): it tells, it does not nag.
 *
 * Nothing here knows how a country groups its numbers or whether a number is
 * valid - that is the server's libphonenumber (`/api/v1/patients/phone/inspect`
 * and the canonicaliser on save). This file only knows which dialling code is
 * which country, so the field can store one `+420773539001` string and read it
 * back into the picker.
 */

export interface CountryCode {
  /** ISO 3166-1 alpha-2, as the server's `regionCode`. */
  code: string;
  /** With the plus: `+420`. */
  dial: string;
  /** Czech name, the way the note under the field says it. */
  name: string;
  /** The flag emoji. */
  flag: string;
}

/** Czech first, Slovak second - the two the desk needs all day - then the rest by name. */
export const COUNTRY_CODES: readonly CountryCode[] = [
  { code: 'CZ', dial: '+420', name: 'Česko', flag: '🇨🇿' },
  { code: 'SK', dial: '+421', name: 'Slovensko', flag: '🇸🇰' },
  { code: 'AT', dial: '+43', name: 'Rakousko', flag: '🇦🇹' },
  { code: 'BE', dial: '+32', name: 'Belgie', flag: '🇧🇪' },
  { code: 'BA', dial: '+387', name: 'Bosna a Hercegovina', flag: '🇧🇦' },
  { code: 'BG', dial: '+359', name: 'Bulharsko', flag: '🇧🇬' },
  { code: 'CN', dial: '+86', name: 'Čína', flag: '🇨🇳' },
  { code: 'DK', dial: '+45', name: 'Dánsko', flag: '🇩🇰' },
  { code: 'FI', dial: '+358', name: 'Finsko', flag: '🇫🇮' },
  { code: 'FR', dial: '+33', name: 'Francie', flag: '🇫🇷' },
  { code: 'HR', dial: '+385', name: 'Chorvatsko', flag: '🇭🇷' },
  { code: 'IE', dial: '+353', name: 'Irsko', flag: '🇮🇪' },
  { code: 'IT', dial: '+39', name: 'Itálie', flag: '🇮🇹' },
  { code: 'KZ', dial: '+7', name: 'Kazachstán', flag: '🇰🇿' },
  { code: 'LT', dial: '+370', name: 'Litva', flag: '🇱🇹' },
  { code: 'LV', dial: '+371', name: 'Lotyšsko', flag: '🇱🇻' },
  { code: 'HU', dial: '+36', name: 'Maďarsko', flag: '🇭🇺' },
  { code: 'MD', dial: '+373', name: 'Moldavsko', flag: '🇲🇩' },
  { code: 'DE', dial: '+49', name: 'Německo', flag: '🇩🇪' },
  { code: 'NL', dial: '+31', name: 'Nizozemsko', flag: '🇳🇱' },
  { code: 'NO', dial: '+47', name: 'Norsko', flag: '🇳🇴' },
  { code: 'PL', dial: '+48', name: 'Polsko', flag: '🇵🇱' },
  { code: 'PT', dial: '+351', name: 'Portugalsko', flag: '🇵🇹' },
  { code: 'RO', dial: '+40', name: 'Rumunsko', flag: '🇷🇴' },
  { code: 'RU', dial: '+7', name: 'Rusko', flag: '🇷🇺' },
  { code: 'GR', dial: '+30', name: 'Řecko', flag: '🇬🇷' },
  { code: 'SI', dial: '+386', name: 'Slovinsko', flag: '🇸🇮' },
  { code: 'RS', dial: '+381', name: 'Srbsko', flag: '🇷🇸' },
  { code: 'GB', dial: '+44', name: 'Spojené království', flag: '🇬🇧' },
  { code: 'US', dial: '+1', name: 'Spojené státy', flag: '🇺🇸' },
  { code: 'ES', dial: '+34', name: 'Španělsko', flag: '🇪🇸' },
  { code: 'SE', dial: '+46', name: 'Švédsko', flag: '🇸🇪' },
  { code: 'CH', dial: '+41', name: 'Švýcarsko', flag: '🇨🇭' },
  { code: 'TR', dial: '+90', name: 'Turecko', flag: '🇹🇷' },
  { code: 'UA', dial: '+380', name: 'Ukrajina', flag: '🇺🇦' },
  { code: 'VN', dial: '+84', name: 'Vietnam', flag: '🇻🇳' },
];

export const DEFAULT_COUNTRY_CODE = 'CZ';

export function countryByCode(code: string | null | undefined): CountryCode | undefined {
  if (!code) return undefined;
  const wanted = code.trim().toUpperCase();
  return COUNTRY_CODES.find((c) => c.code === wanted);
}

export function defaultCountry(code: string = DEFAULT_COUNTRY_CODE): CountryCode {
  return countryByCode(code) ?? COUNTRY_CODES[0];
}

export function digitsOf(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * The country a run of digits (no plus) begins with, by the LONGEST dialling
 * code that fits - `421…` is Slovensko, not `42` of nothing plus `1` of the
 * USA. Two countries sharing a code (Rusko and Kazachstán, `+7`) resolve to
 * whichever the list names first. Undefined when no listed code fits.
 */
export function countryByDialPrefix(digits: string): CountryCode | undefined {
  let best: CountryCode | undefined;
  for (const country of COUNTRY_CODES) {
    const dial = country.dial.slice(1);
    if (digits.startsWith(dial) && (best === undefined || dial.length > best.dial.length - 1)) {
      best = country;
    }
  }
  return best;
}

export interface ParsedPhone {
  /** The country the value names, or the fallback for a national number. Null for a dialling code not on the list. */
  country: CountryCode | null;
  /** The digits after the dialling code; for an unknown code, every digit after the plus. */
  national: string;
  /** True when the value carried its own dialling code (`+…` or `00…`). */
  international: boolean;
}

/**
 * A stored value read back into the picker and the number box.
 *
 *   `+420773539001`      → Česko, `773539001`
 *   `00421908123456`     → Slovensko, `908123456`
 *   `773 539 001`        → the fallback country, `773539001`
 *   `+353…`              → no listed country: shown as typed, nothing invented
 *   ``                   → the fallback country, nothing
 */
export function parsePhoneValue(value: string | null | undefined, fallback: CountryCode = defaultCountry()): ParsedPhone {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return { country: fallback, national: '', international: false };

  const international = trimmed.startsWith('+') || trimmed.startsWith('00');
  if (!international) {
    return { country: fallback, national: digitsOf(trimmed), international: false };
  }

  const digits = digitsOf(trimmed).replace(/^00/, '');
  const country = countryByDialPrefix(digits);
  if (country === undefined) return { country: null, national: digits, international: true };
  return { country, national: digits.slice(country.dial.length - 1), international: true };
}

/** `773539001` → `773 539 001`: threes from the left, which is how a number is read out. */
export function formatNational(digits: string): string {
  const clean = digitsOf(digits);
  return clean.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

/**
 * The one string the field stores: `+420773539001`. Empty when nothing was
 * typed - a telephone is optional in more than one place, and `+420` alone is
 * not a telephone. A national trunk zero (`0908 123 456` the Slovak way) is
 * dropped, because behind a dialling code it is not dialled; Italy keeps its
 * zero because there it is part of the number.
 */
export function composePhone(country: CountryCode, nationalDigits: string): string {
  const digits = digitsOf(nationalDigits);
  if (digits === '') return '';
  const national = country.code === 'IT' ? digits : digits.replace(/^0+/, '');
  if (national === '') return '';
  return `${country.dial}${national}`;
}

/** Lower case, no diacritics, so `slov` finds `Slovensko` and `Slovinsko`. */
export function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * The rows the picker's search leaves: by digits (`421` → Slovensko, `4` →
 * every `+4…` country) or by name or code (`slov` → Slovensko, Slovinsko;
 * `de` → Německo). Empty query: everything.
 */
export function searchCountries(query: string, list: readonly CountryCode[] = COUNTRY_CODES): CountryCode[] {
  const q = query.trim();
  if (q === '') return [...list];
  const digits = digitsOf(q);
  if (digits !== '' && digits.length === q.replace(/[\s+]/g, '').length) {
    return list.filter((c) => c.dial.slice(1).startsWith(digits));
  }
  const folded = foldName(q);
  return list.filter(
    (c) => foldName(c.name).includes(folded) || c.code.toLowerCase() === folded,
  );
}
