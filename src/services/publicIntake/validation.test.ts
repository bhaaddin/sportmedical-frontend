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
import { parseBirthNumber, validateInsuranceNumber } from './validation';

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
