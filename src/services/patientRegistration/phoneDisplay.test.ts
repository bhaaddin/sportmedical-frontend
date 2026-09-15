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
  groupedDisplay, phoneComplaint, phoneDisplayState, worthInspectingPhone,
} from './phoneDisplay';
import type { PhoneInspection } from '../../api/patientRegistry';

/* Measured against the running endpoint on 15. 9. 2026. */
const czechComplete = (): PhoneInspection => ({
  parses: true, isValidForRegion: true,
  e164: '+420777777777', international: '+420 777 777 777', national: '777 777 777',
  regionCode: 'CZ',
});

const czechHalfTyped = (): PhoneInspection => ({
  parses: true, isValidForRegion: false,
  e164: '+420777777', international: '+420 777777', national: '777777',
  regionCode: 'CZ',
});

const unreadable = (): PhoneInspection => ({
  parses: false, isValidForRegion: false,
  e164: '', international: '', national: '', regionCode: 'CZ',
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

describe('the grouping shown under the field', () => {
  it('is the server’s, for the country chosen', () => {
    expect(groupedDisplay(czechComplete())).toBe('777 777 777');
  });

  /* A half-typed number still gets grouped — that is the whole feature. */
  it('shows even while it is still being typed', () => {
    expect(groupedDisplay(czechHalfTyped())).toBe('777777');
  });

  it('shows nothing for something unreadable', () => {
    expect(groupedDisplay(unreadable())).toBe('');
    expect(groupedDisplay(null)).toBe('');
  });

  /* Some regions answer with no national form; the international one is still
     grouped and still better than the raw digits. */
  it('falls back to the international form when there is no national one', () => {
    const noNational: PhoneInspection = {
      ...czechComplete(), national: '', international: '+41 44 668 18 00',
    };
    expect(groupedDisplay(noNational)).toBe('+41 44 668 18 00');
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
