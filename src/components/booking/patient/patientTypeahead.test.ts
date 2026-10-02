import { describe, expect, it } from 'vitest';
import {
  displayName,
  duplicateNameIds,
  foldName,
  matchesAllTokens,
  searchTerms,
  toHit,
} from './patientTypeahead';
import type { PatientHit } from './patientTypeahead';

const hit = (id: string, firstName: string, lastName: string, dateOfBirth: string | null = null): PatientHit => ({
  id,
  firstName,
  lastName,
  fullName: `${firstName} ${lastName}`,
  dateOfBirth,
});

describe('what is sent to the server', () => {
  it('waits for two letters', () => {
    expect(searchTerms('')).toBeNull();
    expect(searchTerms('  ')).toBeNull();
    expect(searchTerms('F')).toBeNull();
    expect(searchTerms('Fe')).toEqual({ serverQuery: 'Fe', tokens: ['fe'] });
  });

  it('sends the longest word (the later one on a tie), because the server matches one field at a time', () => {
    expect(searchTerms('Filip Fehér')).toEqual({ serverQuery: 'Fehér', tokens: ['filip', 'feher'] });
    expect(searchTerms('  Jan   Novák ')).toEqual({ serverQuery: 'Novák', tokens: ['jan', 'novak'] });
  });
});

describe('narrowing the page to every word typed', () => {
  it('matches each word against the first name or the surname', () => {
    expect(matchesAllTokens(hit('1', 'Filip', 'Fehér'), ['fil', 'feh'])).toBe(true);
    expect(matchesAllTokens(hit('1', 'Filip', 'Fehér'), ['feher', 'filip'])).toBe(true);
    expect(matchesAllTokens(hit('2', 'Petr', 'Fehér'), ['filip', 'feher'])).toBe(false);
  });

  it('ignores diacritics and case, as the server does', () => {
    expect(foldName('  Žofie   NOVÁKOVÁ ')).toBe('zofie novakova');
    expect(matchesAllTokens(hit('1', 'Anna', 'Černá'), ['cerna'])).toBe(true);
  });
});

describe('namesakes', () => {
  it('marks every row whose name repeats, and only those', () => {
    const hits = [
      hit('a', 'Filip', 'Fehér', '1990-01-01'),
      hit('b', 'Filip', 'Fehér', '1985-05-05'),
      hit('c', 'Filip', 'Feher', '2001-02-03'),
      hit('d', 'Jan', 'Novák'),
      hit('e', 'Filip', 'Fehérová'),
    ];
    expect([...duplicateNameIds(hits)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('marks nobody in a list of different people', () => {
    expect(duplicateNameIds([hit('a', 'Jan', 'Novák'), hit('b', 'Jana', 'Nováková')]).size).toBe(0);
  });
});

describe('reading a row of GET /api/patients', () => {
  it('takes the fields it needs and trims the date', () => {
    expect(
      toHit({
        id: 'p1',
        firstName: 'Filip',
        lastName: 'Fehér',
        fullName: 'Filip Fehér',
        dateOfBirth: '1990-01-01',
        sex: 'Male',
      }),
    ).toEqual({ id: 'p1', firstName: 'Filip', lastName: 'Fehér', fullName: 'Filip Fehér', dateOfBirth: '1990-01-01' });
  });

  it('survives missing fields and drops a row without an id', () => {
    expect(toHit({ id: 'p2' })).toEqual({ id: 'p2', firstName: '', lastName: '', fullName: '', dateOfBirth: null });
    expect(toHit({ firstName: 'Nikdo' })).toBeNull();
    expect(toHit(null)).toBeNull();
  });

  it('shows the full name, else the halves', () => {
    expect(displayName({ ...hit('1', 'Filip', 'Fehér'), fullName: '' })).toBe('Filip Fehér');
    expect(displayName({ ...hit('1', 'Filip', 'Fehér'), fullName: 'MUDr. Filip Fehér' })).toBe('MUDr. Filip Fehér');
  });
});
