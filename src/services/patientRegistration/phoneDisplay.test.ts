/*
 * Showing a telephone number the way its own country groups it.
 *
 * The rule these guard hardest is app's: a half-typed number comes back
 * GROUPED and `isValidForRegion: false`, and it gets the grouping and no
 * complaint. A red border on every second keystroke is a red border people
 * learn to ignore, and by the time it means something they have stopped
 * looking at it.
 *
 * Nothing here knows how any country groups its numbers, and that is
 * deliberate: app wrote a test for this and got the German grouping wrong —
 * expected `0151 47110815`, the plan says `01514 7110815` — which is exactly
 * what anybody grouping by hand does. The server has libphonenumber; this only
 * decides what to do with its answer.
 */
import { describe, it, expect } from 'vitest';
import {
  groupedDisplay, phoneComplaint, phoneDisplayState, storedNumberDisplay,
  worthInspectingPhone,
} from './phoneDisplay';
import type { PhoneInspection } from '../../api/patientRegistry';

/* Measured against the running endpoint on 15. 9. 2026. */
const czechComplete = (): PhoneInspection => ({
  parses: true, isValid: true, isValidForRegion: true,
  e164: '+420777777777', international: '+420 777 777 777', national: '777 777 777',
  regionCode: 'CZ', detectedRegionCode: 'CZ',
});

const czechHalfTyped = (): PhoneInspection => ({
  parses: true, isValid: false, isValidForRegion: false,
  e164: '+420777777', international: '+420 777777', national: '777777',
  regionCode: 'CZ', detectedRegionCode: 'CZ',
});

const unreadable = (): PhoneInspection => ({
  parses: false, isValid: false, isValidForRegion: false,
  e164: '', international: '', national: '', regionCode: 'CZ', detectedRegionCode: '',
});

describe('what the field is showing', () => {
  it('says nothing about an empty box', () => {
    expect(phoneDisplayState(czechComplete(), '')).toBe('idle');
    expect(phoneDisplayState(czechComplete(), '   ')).toBe('idle');
  });

  it('says nothing before an answer has arrived', () => {
    expect(phoneDisplayState(null, '777')).toBe('idle');
  });

  it('accepts a complete number for the chosen country', () => {
    expect(phoneDisplayState(czechComplete(), '777777777')).toBe('valid');
  });

  /*
   * The one that matters. `isValidForRegion: false` says both "not finished"
   * and "belongs elsewhere", and the difference is whether somebody is still
   * going — so it is decided on length, not on the verdict.
   */
  it('treats a half-typed number as typing, not as wrong', () => {
    expect(phoneDisplayState(czechHalfTyped(), '77777')).toBe('typing');
  });

  it('calls a finished number that does not fit the country wrong', () => {
    expect(phoneDisplayState(czechHalfTyped(), '777777')).toBe('wrong-region');
    expect(phoneDisplayState(czechHalfTyped(), '908 123 456')).toBe('wrong-region');
  });

  it('calls something that is not a number unreadable', () => {
    expect(phoneDisplayState(unreadable(), 'abc')).toBe('unreadable');
  });

  /*
   * Punctuation is not length. `"+420 7"` is six characters and four digits —
   * still being typed — and the first version of this test used `"77 77"`,
   * which is short either way, so counting characters instead of digits
   * changed nothing it could see.
   */
  it('counts digits rather than characters', () => {
    expect(phoneDisplayState(czechHalfTyped(), '77 77')).toBe('typing');
    expect(phoneDisplayState(czechHalfTyped(), '+420 7')).toBe('typing');
    expect(phoneDisplayState(czechHalfTyped(), '(777) 7')).toBe('typing');
  });
});

/* Measured: a Slovak number, as the endpoint answers it. */
const slovak = (): PhoneInspection => ({
  parses: true, isValid: true, isValidForRegion: true,
  e164: '+421908123456', international: '+421 908 123 456', national: '0908 123 456',
  regionCode: 'SK', detectedRegionCode: 'SK',
});

/*
 * A number written with its own dialling code.
 *
 * The owner asked for one behaviour on both forms — "rovnaka logika a
 * premakanost u oboch uplne rovnako" — and the questionnaire is where it
 * showed: its picker offers five countries, so `+36 30 123 4567` was told to
 * "check the dialling code" and pointed at a list with no Hungary in it. The
 * dialling code was right. The list was the problem.
 *
 * MEASURED on the public endpoint with no token:
 *   +36301234567 asked as CZ → parses ✓ isValid ✓ isValidForRegion ✗
 *                              detectedRegionCode HU
 *
 * `isValidForRegion: false` there does not mean "wrong". It means "not
 * Czech", which is true of a Hungarian number and is nobody's mistake.
 */
describe('a number that carries its own dialling code', () => {
  const foreignButValid = (): PhoneInspection => ({
    parses: true, isValid: true, isValidForRegion: false,
    e164: '+36301234567', international: '+36 30 123 4567',
    national: '06 30 123 4567', regionCode: 'CZ', detectedRegionCode: 'HU',
  });

  it('accepts it whatever the picker says', () => {
    expect(phoneDisplayState(foreignButValid(), '+36301234567')).toBe('valid');
    expect(phoneDisplayState(foreignButValid(), '+36 30 123 4567')).toBe('valid');
  });

  it('says nothing about it', () => {
    const state = phoneDisplayState(foreignButValid(), '+36301234567');
    expect(phoneComplaint(state, 'CZ')).toBe('');
  });

  /*
   * The `+` is what makes the country explicit. The same digits typed WITHOUT
   * one are a national number for the country that was picked, and being wrong
   * for it is a real complaint — this is the line between the two.
   */
  /*
   * The case that corrected this rule. `00` is how a great many people write a
   * dialling code, and an earlier version keyed on a literal `+` — it would
   * have refused this while accepting the identical `+421…`. A mutation that
   * removed the `+` half survived, and it survived because it was right.
   *
   * MEASURED, no token: 00421908123456 asked as CZ → isValid ✓, forRegion ✗,
   * detected SK, e164 +421908123456.
   */
  it('accepts a dialling code written as 00, not only as +', () => {
    const doubleZero: PhoneInspection = {
      parses: true, isValid: true, isValidForRegion: false,
      e164: '+421908123456', international: '+421 908 123 456',
      national: '0908 123 456', regionCode: 'CZ', detectedRegionCode: 'SK',
    };
    expect(phoneDisplayState(doubleZero, '00421908123456')).toBe('valid');
    expect(phoneComplaint(phoneDisplayState(doubleZero, '00421908123456'), 'CZ')).toBe('');
  });

  it('still complains about a national number that does not fit', () => {
    const nationalMisfit: PhoneInspection = {
      ...foreignButValid(), isValid: false, e164: '', international: '',
    };
    expect(phoneDisplayState(nationalMisfit, '36301234567')).toBe('wrong-region');
  });

  /* And a `+` in front of something unreadable is still unreadable. */
  it('does not rescue something that is not a number', () => {
    const rubbish: PhoneInspection = {
      parses: false, isValid: false, isValidForRegion: false,
      e164: '', international: '', national: '', regionCode: 'CZ',
      detectedRegionCode: '',
    };
    expect(phoneDisplayState(rubbish, '+abc')).toBe('unreadable');
  });

  /* A leading `+` on a number the server does not consider valid anywhere is
     not a way past the check. */
  it('does not accept a plus in front of an invalid number', () => {
    const half: PhoneInspection = { ...foreignButValid(), isValid: false };
    expect(phoneDisplayState(half, '+3630123')).not.toBe('valid');
  });
});

describe('the grouping shown', () => {
  /* A local number is written without its dialling code — everybody reading it
     knows where they are. */
  it('writes a home number without its dialling code', () => {
    expect(groupedDisplay(czechComplete())).toBe('777 777 777');
  });

  /*
   * The one the owner caught: `0908 123 456` on a Czech patient card is a
   * Slovak number written the Slovak way — unreadable at the desk and
   * impossible to dial. Anything foreign carries its code.
   */
  it('keeps the dialling code on anything foreign', () => {
    expect(groupedDisplay(slovak())).toBe('+421 908 123 456');
    expect(groupedDisplay(slovak())).not.toBe('0908 123 456');
  });

  /* A half-typed number still gets grouped — that is the whole feature. */
  it('shows even while it is still being typed', () => {
    expect(groupedDisplay(czechHalfTyped())).toBe('777777');
  });

  /*
   * The row that moved this off the picked region. A Hungarian number on a
   * form with CZ selected came out `06 30 123 4567` — the Hungarian national
   * form with no dialling code, on a Czech screen. The owner's original
   * complaint, reached from a third direction.
   */
  it('keeps the dialling code on a number from somewhere else entirely', () => {
    const hungarian: PhoneInspection = {
      parses: true, isValid: true, isValidForRegion: false,
      e164: '+36301234567', international: '+36 30 123 4567',
      national: '06 30 123 4567', regionCode: 'CZ', detectedRegionCode: 'HU',
    };
    expect(groupedDisplay(hungarian)).toBe('+36 30 123 4567');
    expect(groupedDisplay(hungarian)).not.toBe('06 30 123 4567');
  });

  it('shows nothing for something unreadable', () => {
    expect(groupedDisplay(unreadable())).toBe('');
    expect(groupedDisplay(null)).toBe('');
  });

  /* A home number with no national form still has to show something. */
  it('falls back to the international form when there is no national one', () => {
    const noNational: PhoneInspection = {
      ...czechComplete(), national: '', international: '+420 777 777 777',
    };
    expect(groupedDisplay(noNational)).toBe('+420 777 777 777');
  });

  /* And a foreign one with no international form falls the other way. */
  it('falls back to the national form when there is no international one', () => {
    const noInternational: PhoneInspection = {
      ...slovak(), international: '',
    };
    expect(groupedDisplay(noInternational)).toBe('0908 123 456');
  });
});

describe('when to complain at all', () => {
  /* Silence while typing is the point: a border that is red half the time is
     a border nobody reads by the time it means something. */
  it('says nothing while somebody is still typing', () => {
    expect(phoneComplaint('typing', 'CZ')).toBe('');
    expect(phoneComplaint('valid', 'CZ')).toBe('');
    expect(phoneComplaint('idle', 'CZ')).toBe('');
  });

  it('names the country when the number does not fit it', () => {
    expect(phoneComplaint('wrong-region', 'SK')).toContain('SK');
    expect(phoneComplaint('wrong-region', 'SK')).toMatch(/předvolbu/);
  });

  it('says so when it is not a number at all', () => {
    expect(phoneComplaint('unreadable', 'CZ')).toMatch(/nevypadá/);
  });
});

describe('when to ask the server', () => {
  /* One request per keystroke for an answer nobody can use yet. */
  it('waits for a few digits', () => {
    expect(worthInspectingPhone('')).toBe(false);
    expect(worthInspectingPhone('77')).toBe(false);
    expect(worthInspectingPhone('777')).toBe(true);
  });

  it('counts digits, not punctuation', () => {
    expect(worthInspectingPhone('+ () -')).toBe(false);
    expect(worthInspectingPhone('+420 7')).toBe(true);
  });
});

/*
 * A number read back out of the database, on a patient's card.
 *
 * This is a different question from the registration field's. The field knows
 * which country the receptionist picked; a card has a number and nothing else,
 * and the `regionCode` on the answer says only what the screen asked about.
 *
 * MEASURED on 15. 9. 2026: `+421 908 123 456` asked about as `CZ` comes back
 * `regionCode: 'CZ'`, `detectedRegionCode: 'SK'`. Going by `regionCode` there
 * would call a Slovak number Czech and strip its dialling code — the exact
 * fault the owner reported, arrived at from the other direction.
 */
describe('a number on a patient card', () => {
  /* Measured: the stored `+420 777 777 779` asked about as CZ. */
  const storedCzech = (): PhoneInspection => ({
    parses: true, isValid: true, isValidForRegion: true,
    e164: '+420777777779', international: '+420 777 777 779', national: '777 777 779',
    regionCode: 'CZ', detectedRegionCode: 'CZ',
  });

  /* Measured: the stored `+421 908 123 456` asked about as CZ. */
  const storedSlovak = (): PhoneInspection => ({
    parses: true, isValid: true, isValidForRegion: false,
    e164: '+421908123456', international: '+421 908 123 456', national: '0908 123 456',
    regionCode: 'CZ', detectedRegionCode: 'SK',
  });

  it('drops the dialling code from a home number', () => {
    expect(storedNumberDisplay(storedCzech(), '+420 777 777 779')).toBe('777 777 779');
  });

  /*
   * The one that separates this from `groupedDisplay`: the region ASKED about
   * is CZ and the number is Slovak. Going by the asked-about region would
   * print `0908 123 456` on a Czech card.
   */
  it('keeps the dialling code on a foreign number asked about as a home one', () => {
    expect(storedNumberDisplay(storedSlovak(), '+421 908 123 456'))
      .toBe('+421 908 123 456');
    expect(storedNumberDisplay(storedSlovak(), '+421 908 123 456'))
      .not.toBe('0908 123 456');
  });

  /* A card must never lose a number it was already showing. */
  it('keeps showing what it had when there is no answer', () => {
    expect(storedNumberDisplay(null, '+420 777 777 779')).toBe('+420 777 777 779');
    expect(storedNumberDisplay(unreadable(), '+420 777 777 779'))
      .toBe('+420 777 777 779');
  });

  it('falls back to what it had when the answer carries no forms', () => {
    const empty: PhoneInspection = {
      ...storedSlovak(), international: '', national: '',
    };
    expect(storedNumberDisplay(empty, '+421 908 123 456')).toBe('+421 908 123 456');
  });

  it('says nothing about nothing', () => {
    expect(storedNumberDisplay(null, '')).toBe('');
  });
});
