/*
 * The checksum dead end, on the public questionnaire.
 *
 * A ten-digit birth number has to divide by eleven, and three different people
 * fail that check for three different reasons:
 *
 *   - somebody mistyped a digit
 *   - somebody holds one of the ~1000 numbers issued before 1985 under the
 *     remainder-ten exception, which are legitimate and do not divide by eleven
 *   - somebody is a foreigner typing an identifier that is not a Czech birth
 *     number at all
 *
 * The form cannot tell them apart, and does not try: the field is optional, so
 * the advice is the same for all three - clear it and carry on. What these
 * tests guard is that the message actually says so. Before this, it said the
 * number was invalid and stopped, which is a wall with no door in it for the
 * second and third person.
 */
import { describe, it, expect } from 'vitest';
import {
  parseBirthNumber, validateEmail, validateInsuranceNumber, validatePhone,
} from './validation';

/* Computed, not invented: 900515001 leaves 1 modulo 11, so 1 is its check
   digit and 9005150011 divides by eleven exactly. */
const VALID = '9005150011';
/* Same date, sequence 010: the first nine digits leave 10, which is the
   historic exception - the check digit written as 0, and the whole number
   then leaves 1 rather than 0. Rejected here, deliberately and strictly. */
const EXCEPTION_FORM = '9005150100';
/* The valid number with its last digit off by three - a plain typo. */
const TYPO = '9005150014';

describe('the ten-digit checksum', () => {
  it('accepts a number that divides by eleven', () => {
    const result = parseBirthNumber(VALID);
    expect(result.ok).toBe(true);
  });

  it('rejects a mistyped number', () => {
    const result = parseBirthNumber(TYPO);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('birthNumber.checksum_invalid');
  });

  it('rejects the pre-1985 exception form too - strict is the decision', () => {
    const result = parseBirthNumber(EXCEPTION_FORM);
    expect(result.ok).toBe(false);
  });

  /*
   * The point of the whole change. Whichever of the three people is holding
   * this number, the message has to tell them the way out, because for two of
   * them there is no correction to make.
   */
  it('tells whoever failed it that the field can be left empty', () => {
    const result = parseBirthNumber(EXCEPTION_FORM);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/nechte pole prázdné/);
    expect(result.error.message).toMatch(/není povinné/);
  });

  it('says the same to a mistyped number, since it cannot tell which it is', () => {
    const typo = parseBirthNumber(TYPO);
    const exception = parseBirthNumber(EXCEPTION_FORM);
    expect(typo.ok).toBe(false);
    expect(exception.ok).toBe(false);
    if (typo.ok || exception.ok) return;
    expect(typo.error.message).toBe(exception.error.message);
  });
});

describe('the insurance number', () => {
  /*
   * A foreign insurance number is the far more common case, and the form does
   * have a branch for it - "Nemám české pojištění", one radio higher up. The
   * person typing a foreign number into this field has no way of knowing that
   * branch exists, so the message names it.
   */
  it('points a foreign number at the branch that exists for it', () => {
    const result = validateInsuranceNumber('AB1234567');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/Nemám české pojištění/);
  });

  it('still accepts a nine- and a ten-digit number', () => {
    expect(validateInsuranceNumber('123456789').ok).toBe(true);
    expect(validateInsuranceNumber('1234567890').ok).toBe(true);
  });
});

/*
 * The e-mail on the public questionnaire.
 *
 * This file had NO test for `validateEmail` while it held sixty lines of
 * hand-written rules mirroring `EmailContactAddressCanonicalizer` — one `@`,
 * a local part of 1–64, a domain with a dot in it, no whitespace, 254 overall.
 * Careful, well meant, untested, and wrong: measured against the running
 * server, it refused `jan@localhost`, which the server stores.
 *
 * That was the THIRD hand-written definition of an e-mail address in this
 * repository. It is now the server's, through
 * `POST /api/public/contact-check/email` — anonymous, and the same
 * canonicaliser as the staff screen rather than another copy.
 *
 * What is left here is whether there is an address at all, which needs no
 * round trip and is true whoever is asked. These tests exist to guard the
 * SILENCE: the values below are the ones that start failing if a shape rule
 * ever creeps back onto the form.
 */
describe('the e-mail on the questionnaire', () => {
  it('asks for one that is missing', () => {
    const result = validateEmail('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('email.required');
      expect(result.error.message).toMatch(/povinný/);
    }
  });

  it('treats a box of spaces as empty', () => {
    expect(validateEmail('   ').ok).toBe(false);
  });

  /* Measured: the server stores this one. The old rule refused it for want of
     a dot in the domain. */
  it('does not refuse an address the server accepts', () => {
    const result = validateEmail('jan@localhost');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('jan@localhost');
  });

  /* Measured: the server refuses this one. The form must not pass judgement
     either way — saying "fine" here would be a second opinion, and the step
     cannot be left without the server's. */
  it('does not pass judgement on an address the server refuses', () => {
    expect(validateEmail('jan@example..cz').ok).toBe(true);
    expect(validateEmail('napriklad.gmail.com').ok).toBe(true);
  });

  /* It trims, because what is stored is the trimmed value and the caller
     passes this on. */
  it('hands back the address without the spaces around it', () => {
    const result = validateEmail('  jan@example.cz  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('jan@example.cz');
  });

  /*
   * A long address is the server's call too. The old rule cut it off at 254
   * with its own sentence; the server answers `display_value.too_long`, and
   * one place saying it is the whole point.
   */
  it('leaves the length to the server as well', () => {
    expect(validateEmail('a'.repeat(300) + '@example.cz').ok).toBe(true);
  });
});

/*
 * The telephone on the public questionnaire.
 *
 * This held five dial prefixes written out by hand — CZ, SK, PL, DE, AT — and
 * an E.164 shape check, and it did not only judge a number: it BUILT the one
 * that was submitted, turning `777777777` + CZ into `+420777777777` by
 * concatenation. A Hungarian could not be described at all, and the value that
 * reached the registry was assembled by a rule that had drifted from the one
 * that stores it.
 *
 * `POST /api/public/contact-check/phone` answers both now, on the same
 * libphonenumber the desk uses. The owner's instruction was the reason:
 * "nechcem mat dva system i u mojej rezervacie a v dotazniku iny … rovnaka
 * logika a premakanost u oboch uplne rovnako."
 *
 * These guard the SILENCE, like the e-mail ones: the values below start
 * failing the day a prefix table or a shape rule creeps back onto the form.
 */
describe('the telephone on the questionnaire', () => {
  const phone = (number: string, regionCode = 'CZ') =>
    validatePhone({ regionCode, number });

  it('asks for one that is missing', () => {
    const result = phone('');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('phone.required');
  });

  it('treats a box of spaces as empty', () => {
    expect(phone('   ').ok).toBe(false);
  });

  /*
   * The person the old list shut out. `+36` was not among the five prefixes,
   * so a Hungarian number could not be described however it was typed.
   * Measured: the server reads it, `detectedRegionCode: HU`.
   */
  it('does not refuse a country the old list had never heard of', () => {
    expect(phone('+36301234567').ok).toBe(true);
    expect(phone('+385911234567').ok).toBe(true);
  });

  /*
   * And it no longer BUILDS anything. The value handed back is what somebody
   * typed — the `+420…` form comes from the server's `e164`, so a number is
   * assembled in one place instead of two.
   */
  it('hands back what was typed, without inventing a dialling code', () => {
    const result = phone('777777777');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('777777777');
      expect(result.value).not.toContain('+420');
    }
  });

  it('keeps the spacing out of the way but leaves the number alone', () => {
    const result = phone('  777 777 777  ');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('777 777 777');
  });

  /* Whether it is plausible for the chosen country is the server's call, so
     nothing here may pass judgement on it either way. */
  it('does not judge a number that is too short', () => {
    expect(phone('7').ok).toBe(true);
  });

  it('does not judge letters either — the server says what it is', () => {
    expect(phone('nevím').ok).toBe(true);
  });
});
