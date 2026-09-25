/*
 * "Asi nepřišel" is a flag on the clock and the setting, never a status; the
 * patient's own window is start minus the deadline. Both are told in Czech
 * with the real instant in the sentence.
 */
import { describe, expect, it } from 'vitest';
import { formatDeadline, patientChangeDeadline, patientChangeSentence, probablyAbsent } from './attendance';

const START = '2026-09-24T07:00:00.000Z'; // 09:00 Prague
const SCHEDULED = 0;
const CONFIRMED = 1;
const CHECKED_IN = 2;
const COMPLETED = 3;
const CANCELLED = 4;
const NO_SHOW = 5;

describe('probablyAbsent', () => {
  it('is off before the start and until the setting says so', () => {
    expect(probablyAbsent(START, SCHEDULED, 30, new Date('2026-09-24T06:59:00Z'))).toBe(false);
    expect(probablyAbsent(START, SCHEDULED, 30, new Date('2026-09-24T07:29:59Z'))).toBe(false);
  });

  it('is on from exactly the setting onwards, for Objednán and Potvrzen', () => {
    expect(probablyAbsent(START, SCHEDULED, 30, new Date('2026-09-24T07:30:00Z'))).toBe(true);
    expect(probablyAbsent(START, CONFIRMED, 30, new Date('2026-09-24T08:00:00Z'))).toBe(true);
  });

  it('honours the clinic number, not a built-in one', () => {
    expect(probablyAbsent(START, SCHEDULED, 10, new Date('2026-09-24T07:10:00Z'))).toBe(true);
    expect(probablyAbsent(START, SCHEDULED, 90, new Date('2026-09-24T08:00:00Z'))).toBe(false);
  });

  it('never flags somebody who already has an answer', () => {
    const late = new Date('2026-09-24T12:00:00Z');
    for (const status of [CHECKED_IN, COMPLETED, CANCELLED, NO_SHOW]) {
      expect(probablyAbsent(START, status, 30, late)).toBe(false);
    }
  });

  it('does not flag an unreadable start', () => {
    expect(probablyAbsent('not a date', SCHEDULED, 30, new Date())).toBe(false);
  });
});

describe('the patient change window', () => {
  const fmt = (d: Date) => d.toISOString();

  it('is start minus the deadline hours', () => {
    expect(patientChangeDeadline(START, 24).toISOString()).toBe('2026-09-23T07:00:00.000Z');
    expect(patientChangeDeadline(START, 48).toISOString()).toBe('2026-09-22T07:00:00.000Z');
  });

  it('says "může do" while open and "uplynula" after, with the instant', () => {
    expect(patientChangeSentence(START, SCHEDULED, 24, new Date('2026-09-22T12:00:00Z'), fmt)).toBe(
      'Pacient může termín sám změnit nebo zrušit do 2026-09-23T07:00:00.000Z.',
    );
    expect(patientChangeSentence(START, SCHEDULED, 24, new Date('2026-09-23T12:00:00Z'), fmt)).toContain(
      'už uplynula',
    );
  });

  it('writes the instant the way the contract does: "čt 24. 9. 09:00"', () => {
    expect(formatDeadline(new Date(START))).toBe('čt 24. 9. 09:00');
    expect(formatDeadline(new Date('2026-09-23T07:00:00Z'))).toBe('st 23. 9. 09:00');
  });

  it('says nothing about a booking that is over', () => {
    expect(patientChangeSentence(START, COMPLETED, 24, new Date(), fmt)).toBeNull();
    expect(patientChangeSentence(START, CANCELLED, 24, new Date(), fmt)).toBeNull();
  });
});
