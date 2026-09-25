import { describe, expect, it } from 'vitest';
import {
  EMPTY_QUICK_DRAFT,
  candidateLine,
  guessNameFromSearch,
  validateQuickDraft,
} from './quickPreRegistration.logic';

const TODAY = '2026-09-25';

describe('the quick path guesses the name from the search box', () => {
  it('splits two words into first and last name', () => {
    expect(guessNameFromSearch('Jan Novák')).toEqual({ firstName: 'Jan', lastName: 'Novák' });
  });

  it('treats one word as the surname, which is what the desk searches by', () => {
    expect(guessNameFromSearch('  Novák ')).toEqual({ firstName: '', lastName: 'Novák' });
  });

  it('keeps a double surname together', () => {
    expect(guessNameFromSearch('Anna Nováková Malá')).toEqual({ firstName: 'Anna', lastName: 'Nováková Malá' });
  });

  it('guesses nothing from nothing', () => {
    expect(guessNameFromSearch('')).toEqual({ firstName: '', lastName: '' });
  });
});

describe('the quick path refuses an empty box before the server is asked', () => {
  it('names every missing fact, and says why the date of birth and the e-mail are needed', () => {
    const errors = validateQuickDraft(EMPTY_QUICK_DRAFT, TODAY);
    expect(Object.keys(errors).sort()).toEqual(['dateOfBirth', 'email', 'firstName', 'lastName']);
    expect(errors.dateOfBirth).toMatch(/bez něj nelze/);
    expect(errors.email).toMatch(/odkaz/);
  });

  it('lets the telephone stay empty', () => {
    expect(validateQuickDraft(
      { firstName: 'Jan', lastName: 'Novák', dateOfBirth: '1990-01-01', email: 'jan@example.cz', phone: '' },
      TODAY,
    )).toEqual({});
  });

  it('refuses a birth date in the future', () => {
    expect(validateQuickDraft(
      { firstName: 'Jan', lastName: 'Novák', dateOfBirth: '2027-01-01', email: 'jan@example.cz', phone: '' },
      TODAY,
    ).dateOfBirth).toMatch(/budoucnosti/);
  });

  it('refuses an e-mail with no @, and leaves the real check to the server', () => {
    expect(validateQuickDraft(
      { firstName: 'Jan', lastName: 'Novák', dateOfBirth: '1990-01-01', email: 'jan.example.cz', phone: '' },
      TODAY,
    ).email).toMatch(/@/);
  });
});

describe('a review candidate is said with the date of birth', () => {
  it('uses the full name when the registry gives one', () => {
    expect(candidateLine(
      { fullName: 'MUDr. Jan Novák', firstName: 'Jan', lastName: 'Novák', dateOfBirth: '1990-01-01' },
      () => '1. 1. 1990',
    )).toBe('MUDr. Jan Novák · nar. 1. 1. 1990');
  });

  it('builds the name otherwise', () => {
    expect(candidateLine(
      { firstName: 'Jan', lastName: 'Novák', dateOfBirth: '1990-01-01' },
      () => '1. 1. 1990',
    )).toBe('Jan Novák · nar. 1. 1. 1990');
  });
});
