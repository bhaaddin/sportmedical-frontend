import { describe, expect, it } from 'vitest';
import { dateProblem, daysBetween, isRealDate, repeatedTimeNote, wallTimeExists, wallTimeProblem, wallTimeRepeats } from './clinicDayRules';

describe('clinic day rules (Europe/Prague)', () => {
  it('knows real dates', () => {
    expect(isRealDate('2026-10-25')).toBe(true);
    expect(isRealDate('2026-02-30')).toBe(false);
    expect(isRealDate('')).toBe(false);
    expect(dateProblem('')).toBe('Vyberte datum.');
    expect(dateProblem('2026-13-01')).toBe('Toto datum neexistuje.');
    expect(dateProblem('2026-10-30')).toBeNull();
  });

  it('spring: 02:30 on 2027-03-28 does not exist, 03:30 and 01:59 do', () => {
    expect(wallTimeExists('2027-03-28', '02:30')).toBe(false);
    expect(wallTimeExists('2027-03-28', '03:30')).toBe(true);
    expect(wallTimeExists('2027-03-28', '01:59')).toBe(true);
    expect(wallTimeExists('2027-03-27', '02:30')).toBe(true);
    expect(wallTimeProblem('2027-03-28', '02:30:00')).toMatch(/neexistuje/);
    expect(wallTimeProblem('2027-03-28', '03:00')).toBeNull();
  });

  it('autumn: 02:30 on 2026-10-25 happens twice, 04:00 once', () => {
    expect(wallTimeExists('2026-10-25', '02:30')).toBe(true);
    expect(wallTimeRepeats('2026-10-25', '02:30')).toBe(true);
    expect(wallTimeRepeats('2026-10-25', '04:00')).toBe(false);
    expect(wallTimeRepeats('2026-10-24', '02:30')).toBe(false);
    expect(repeatedTimeNote('2026-10-25', '02:30')).toMatch(/opakuje/);
    expect(repeatedTimeNote('2026-10-26', '02:30')).toBeNull();
  });

  it('midnight and empty values are fine', () => {
    expect(wallTimeExists('2026-10-30', '00:00')).toBe(true);
    expect(wallTimeProblem('2026-10-30', null)).toBeNull();
    expect(wallTimeProblem('2026-10-30', '')).toBeNull();
  });

  it('lists the days of a span', () => {
    expect(daysBetween('2027-03-27', '2027-03-29')).toEqual(['2027-03-27', '2027-03-28', '2027-03-29']);
  });
});
