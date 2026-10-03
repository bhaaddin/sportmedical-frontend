import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CODES,
  composePhone,
  countryByDialPrefix,
  defaultCountry,
  formatNational,
  parsePhoneValue,
  searchCountries,
} from './countryCodes';

const by = (code: string) => COUNTRY_CODES.find((c) => c.code === code)!;

describe('the dialling-code list', () => {
  it('starts with Česko, then Slovensko, and carries the countries the desk meets', () => {
    expect(COUNTRY_CODES[0].code).toBe('CZ');
    expect(COUNTRY_CODES[1].code).toBe('SK');
    for (const code of ['PL', 'DE', 'AT', 'HU', 'UA', 'GB', 'US', 'FR', 'IT', 'ES', 'NL', 'RU', 'RO', 'BG', 'HR', 'SI', 'RS', 'BA', 'VN', 'CN', 'KZ']) {
      expect(by(code), code).toBeDefined();
    }
    expect(defaultCountry().dial).toBe('+420');
  });

  it('matches the longest dialling code, so 421 is Slovensko and not the USA', () => {
    expect(countryByDialPrefix('421908123456')?.code).toBe('SK');
    expect(countryByDialPrefix('420773539001')?.code).toBe('CZ');
    expect(countryByDialPrefix('380501234567')?.code).toBe('UA');
    expect(countryByDialPrefix('12025550123')?.code).toBe('US');
    expect(countryByDialPrefix('999')).toBeUndefined();
  });
});

describe('reading a stored value back', () => {
  it('splits an E.164 value into the picker and the number', () => {
    expect(parsePhoneValue('+420773539001')).toMatchObject({ country: by('CZ'), national: '773539001', international: true });
    expect(parsePhoneValue('+421 908 123 456')).toMatchObject({ country: by('SK'), national: '908123456' });
    expect(parsePhoneValue('00421908123456')).toMatchObject({ country: by('SK'), national: '908123456' });
  });

  it('reads a national number as the default country', () => {
    expect(parsePhoneValue('773 539 001')).toMatchObject({ country: by('CZ'), national: '773539001', international: false });
    expect(parsePhoneValue('773 539 001', by('SK')).country?.code).toBe('SK');
  });

  it('keeps an unknown dialling code as typed instead of inventing a country', () => {
    expect(parsePhoneValue('+9991234567')).toEqual({ country: null, national: '9991234567', international: true });
  });

  it('is empty for nothing', () => {
    expect(parsePhoneValue('')).toMatchObject({ country: by('CZ'), national: '' });
    expect(parsePhoneValue(null)).toMatchObject({ national: '' });
  });
});

describe('what the field shows and stores', () => {
  it('groups the number in threes for display', () => {
    expect(formatNational('773539001')).toBe('773 539 001');
    expect(formatNational('77')).toBe('77');
    expect(formatNational('7735')).toBe('773 5');
    expect(formatNational('')).toBe('');
  });

  it('stores one string with the dialling code, and nothing for an empty number', () => {
    expect(composePhone(by('CZ'), '773 539 001')).toBe('+420773539001');
    expect(composePhone(by('SK'), '0908 123 456')).toBe('+421908123456');
    expect(composePhone(by('IT'), '06 1234 5678')).toBe('+390612345678');
    expect(composePhone(by('CZ'), '')).toBe('');
    expect(composePhone(by('CZ'), '  ')).toBe('');
  });
});

describe('searching the picker', () => {
  it('finds a country by its digits', () => {
    expect(searchCountries('421').map((c) => c.code)).toEqual(['SK']);
    expect(searchCountries('+421').map((c) => c.code)).toEqual(['SK']);
    expect(searchCountries('42').map((c) => c.code)).toEqual(['CZ', 'SK']);
  });

  it('finds countries by name, without diacritics, and by code', () => {
    expect(searchCountries('slov').map((c) => c.name)).toEqual(['Slovensko', 'Slovinsko']);
    expect(searchCountries('nemec').map((c) => c.code)).toEqual(['DE']);
    expect(searchCountries('de').map((c) => c.code)).toEqual(['DE']);
    expect(searchCountries('')).toHaveLength(COUNTRY_CODES.length);
    expect(searchCountries('xyz')).toEqual([]);
  });
});
