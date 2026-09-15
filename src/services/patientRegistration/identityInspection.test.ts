/*
 * When the identifier and the typed facts disagree.
 *
 * The form already fills an empty date and sex from an identifier it can read.
 * What it could not do is say anything useful when the two CONTRADICT each
 * other: the operator typed a date, typed a number that decodes to another,
 * and found out from a refusal after the save that named neither value.
 *
 * The rule these guard hardest is the one about `null`: "nothing was stated to
 * compare against" is not "they agree", and reading it that way would clear a
 * patient on an empty field.
 */
import { describe, it, expect } from 'vitest';
import {
  AGREES_TEXT, disagreementText, kindText, readableDate, readableSex,
  verdictOf, worthInspecting,
} from './identityInspection';
import type { IdentityInspection } from '../../api/patientRegistry';

const inspection = (over: Partial<IdentityInspection> = {}): IdentityInspection => ({
  parses: true,
  insuranceNumber: '8704011234',
  kind: 'CzechBirthNumber',
  dateOfBirth: '1987-04-01',
  sex: 'Male',
  rejectionCode: null,
  dateOfBirthMatchesStated: true,
  sexMatchesStated: true,
  ...over,
});

const stated = (dateOfBirth = '1987-04-01', sex = 'Male') => ({ dateOfBirth, sex });

describe('what the identifier says about what was typed', () => {
  it('agrees when everything lines up', () => {
    expect(verdictOf(inspection(), stated())).toBe('agrees');
  });

  it('says nothing before anything has been asked', () => {
    expect(verdictOf(null, stated())).toBe('silent');
  });

  it('calls an identifier that does not decode unreadable', () => {
    expect(verdictOf(inspection({ parses: false }), stated())).toBe('unreadable');
  });

  it('notices a date that contradicts', () => {
    expect(verdictOf(inspection({ dateOfBirthMatchesStated: false }), stated()))
      .toBe('disagrees');
  });

  it('notices a sex that contradicts', () => {
    expect(verdictOf(inspection({ sexMatchesStated: false }), stated()))
      .toBe('disagrees');
  });

  /*
   * The rule worth the most. The server answers `null` when nothing was
   * stated to compare against - an empty field, not a matching one - and
   * reading that as agreement would clear somebody who has typed nothing.
   */
  it('does not treat "nothing to compare" as agreement', () => {
    const empty = inspection({ dateOfBirthMatchesStated: null, sexMatchesStated: null });
    expect(verdictOf(empty, stated('', ''))).toBe('agrees');
    /* and with something typed, a null still is not a disagreement */
    expect(verdictOf(empty, stated())).toBe('agrees');
  });

  /*
   * An empty field cannot disagree with anything, whatever the server says
   * about it - so a false against a blank date is not an alarm.
   */
  it('does not raise a disagreement about a field nobody filled in', () => {
    const saysDate = inspection({ dateOfBirthMatchesStated: false });
    expect(verdictOf(saysDate, stated('', 'Male'))).toBe('agrees');

    /* Both halves, not just the date: the first version of this test covered
       only one, so the sex guard could be deleted and nothing noticed. */
    const saysSex = inspection({ sexMatchesStated: false });
    expect(verdictOf(saysSex, stated('1987-04-01', ''))).toBe('agrees');
  });
});

describe('saying which two values disagree', () => {
  /*
   * "Rodné číslo neodpovídá datu narození" tells somebody that two things they
   * can already see disagree. WHICH one is wrong is the question, and it
   * cannot be answered without both values in the sentence.
   */
  it('puts both dates in the sentence', () => {
    const text = disagreementText(
      inspection({ dateOfBirth: '1987-04-01', dateOfBirthMatchesStated: false }),
      stated('1978-04-01'),
    );
    expect(text).toContain('1. 4. 1987');
    expect(text).toContain('1. 4. 1978');
  });

  it('puts both sexes in the sentence', () => {
    const text = disagreementText(
      inspection({ sex: 'Female', sexMatchesStated: false }),
      stated('1987-04-01', 'Male'),
    );
    expect(text).toContain('žena');
    expect(text).toContain('muž');
  });

  it('says both when both disagree', () => {
    const text = disagreementText(
      inspection({ dateOfBirthMatchesStated: false, sexMatchesStated: false, sex: 'Female' }),
      stated('1978-04-01', 'Male'),
    );
    expect(text).toContain('datum narození');
    expect(text).toContain('pohlaví');
  });

  /* It says what to do, not only that something is wrong. */
  it('says what happens if it is left alone', () => {
    const text = disagreementText(
      inspection({ dateOfBirthMatchesStated: false }),
      stated('1978-04-01'),
    );
    expect(text).toMatch(/odmítne/);
  });

  it('says nothing when nothing disagrees', () => {
    expect(disagreementText(inspection(), stated())).toBe('');
  });
});

describe('reading the values out', () => {
  it('writes a date the Czech way', () => {
    expect(readableDate('1987-04-01')).toBe('1. 4. 1987');
  });

  it('writes a dash where there is nothing', () => {
    expect(readableDate(null)).toBe('—');
    expect(readableDate('')).toBe('—');
    expect(readableSex(null)).toBe('—');
  });

  it('writes the sexes in words', () => {
    expect(readableSex('Male')).toBe('muž');
    expect(readableSex('Female')).toBe('žena');
  });

  it('names what the number turned out to be', () => {
    expect(kindText('CzechBirthNumber')).toBe('rodné číslo');
    expect(kindText('InsuranceEvidenceNumber')).toMatch(/evidenční/);
    expect(kindText(null)).toMatch(/pojištěnce/);
  });

  it('has something to say when it all agrees', () => {
    expect(AGREES_TEXT).toMatch(/sedí/);
  });
});

describe('when to ask the server at all', () => {
  /*
   * Nine digits is the shortest thing that can decode. Asking sooner lights
   * the field red while somebody is still holding the card and typing.
   */
  it('waits until the number could possibly mean something', () => {
    expect(worthInspecting('87040112')).toBe(false);
    expect(worthInspecting('870401123')).toBe(true);
    expect(worthInspecting('8704011234')).toBe(true);
    expect(worthInspecting('')).toBe(false);
  });
});
