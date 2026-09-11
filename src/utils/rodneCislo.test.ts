/*
 * Czech birth numbers: the checksum, and what the digits say about a person.
 *
 * This function derives the date of birth and sex that the receptionist would
 * otherwise type a second time, having already typed the birth number that
 * contains both. It is not wired into the registration form yet - so these
 * tests exist before the first caller, deliberately, because the moment it is
 * wired in it starts deciding which real people can register.
 *
 * The rule is strict by the owner's decision on 10. 9. 2026: a ten-digit
 * number must be divisible by eleven, with no exception. The backend enforces
 * the same rule in `CzechBirthNumber`.
 *
 * What would have to break for these to fail: relaxing the modulo test,
 * reinstating the `whole % 11 === 10` branch that used to let wrong check
 * digits through, or flipping either century rule.
 */
import { describe, it, expect } from 'vitest';
import { parseRodneCislo, formatRodneCislo } from './rodneCislo';

/* Ten-digit numbers divisible by eleven, built rather than invented, so the
   test cannot accidentally assert against a number that is simply wrong. */
const validTen = (prefix9: string): string => {
  for (let d = 0; d <= 9; d += 1) {
    const candidate = prefix9 + String(d);
    if (parseInt(candidate, 10) % 11 === 0) return candidate;
  }
  throw new Error(`no valid check digit for ${prefix9}`);
};

describe('parseRodneCislo - what it reads out', () => {
  it('reads the date of birth and sex a man typed without asking him again', () => {
    const rc = validTen('900515000');
    expect(parseRodneCislo(rc)).toMatchObject({
      valid: true,
      dateOfBirth: '1990-05-15',
      sex: 'Male',
      isFemale: false,
    });
  });

  it('reads a woman from the month, which carries +50', () => {
    const rc = validTen('905515000');
    expect(parseRodneCislo(rc)).toMatchObject({
      valid: true,
      dateOfBirth: '1990-05-15',
      sex: 'Female',
      isFemale: true,
    });
  });

  it('handles the +20 foreigner variant', () => {
    const rc = validTen('902515000');
    const parsed = parseRodneCislo(rc);
    expect(parsed.valid).toBe(true);
    expect(parsed.dateOfBirth).toBe('1990-05-15');
  });

  it('accepts the slashed form people actually write', () => {
    const rc = validTen('900515000');
    const slashed = `${rc.slice(0, 6)}/${rc.slice(6)}`;
    expect(parseRodneCislo(slashed)).toEqual(parseRodneCislo(rc));
  });
});

describe('parseRodneCislo - the checksum, strict', () => {
  it('accepts a ten-digit number divisible by eleven', () => {
    expect(parseRodneCislo('9005150000').valid).toBe(true);
  });

  /*
   * The number that started this. It was once reported as evidence that the
   * exception was mishandled; it is simply a bad number - its first nine give
   * a remainder of one, so the check digit should be 1 and is 0. Strict says
   * no, and the old hole said yes.
   */
  it('rejects a wrong check digit, including the one the old branch let through', () => {
    expect(parseInt('900515001', 10) % 11).toBe(1);
    expect(parseRodneCislo('9005150010').valid).toBe(false);
  });

  /*
   * The historic exception form: first nine give ten, so the check digit was
   * written as zero and the whole number leaves remainder one. Strict rejects
   * these. Whether they were ever issued to anyone is unmeasured by every lane
   * that has looked - recorded as an assumption, not a fact.
   */
  it('rejects the historic exception form, which is what strict means', () => {
    for (const rc of ['9005150100', '9005150210', '9005150320']) {
      expect(parseInt(rc.slice(0, 9), 10) % 11).toBe(10);
      expect(parseInt(rc, 10) % 11).toBe(1);
      expect(parseRodneCislo(rc).valid).toBe(false);
    }
  });

  it('leaves exactly 910 of the 10 000 endings valid for one birth date', () => {
    const accepted = Array.from({ length: 10_000 }, (_, i) =>
      '900515' + String(i).padStart(4, '0'),
    ).filter((rc) => parseRodneCislo(rc).valid);
    expect(accepted).toHaveLength(910);
  });
});

describe('parseRodneCislo - the century, and what it refuses', () => {
  /* Nine digits stopped being issued in 1954, so a high year is the 1800s. */
  it('reads a nine-digit number as the previous century when the year is 54 or more', () => {
    expect(parseRodneCislo('900515432').dateOfBirth).toBe('1890-05-15');
  });

  it('does not apply the checksum to nine-digit numbers, which never carried one', () => {
    expect(parseRodneCislo('900515432').valid).toBe(true);
    expect(parseInt('900515432', 10) % 11).not.toBe(0);
  });

  it('refuses an impossible date rather than inventing one', () => {
    expect(parseRodneCislo(validTen('901315000')).valid).toBe(false); // month 13
    expect(parseRodneCislo(validTen('900532000')).valid).toBe(false); // day 32
  });

  it('refuses a birth date in the future', () => {
    const nextYear = String((new Date().getFullYear() + 1) % 100).padStart(2, '0');
    expect(parseRodneCislo(validTen(`${nextYear}0515000`)).valid).toBe(false);
  });

  it('refuses anything that is not nine or ten digits', () => {
    for (const rc of ['', '123', '90051500001', '900515']) {
      expect(parseRodneCislo(rc).valid).toBe(false);
    }
  });
});

describe('formatRodneCislo', () => {
  it('adds the slash once there are more than six digits, and never a stray one', () => {
    expect(formatRodneCislo('900515')).toBe('900515');
    expect(formatRodneCislo('9005150000')).toBe('900515/0000');
    expect(formatRodneCislo('900515/0000')).toBe('900515/0000');
  });

  it('stops at ten digits instead of letting the field grow', () => {
    expect(formatRodneCislo('90051500001234')).toBe('900515/0000');
  });
});
