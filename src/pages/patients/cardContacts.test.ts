/*
 * The e-mail and telephone on a patient's card.
 *
 * Both read `—` for every patient in the registry. Three faults were stacked,
 * and the fixture below is the measured one — `GET /api/patients/{id}/profile`
 * for a patient registered through the screen on 15. 9. 2026 — because the
 * third fault was believing the field was called something it is not.
 */
import { describe, it, expect } from 'vitest';
import { contactOfKind, profileContacts } from './cardContacts';

/* Measured, exactly as the server sends it — `type`, not `channel`, and a
   telephone whose `+` arrives as a `\u002B` escape. */
const MEASURED = '[{"type":"email","value":"zaverecny.test@example.cz"},'
  + '{"type":"phone","value":"\u002B420 777 777 779"}]';

describe('reading the contacts off the profile', () => {
  it('finds both of them in what the server actually sends', () => {
    const contacts = profileContacts(MEASURED);
    expect(contacts).toHaveLength(2);
    expect(contactOfKind('email', undefined, contacts))
      .toBe('zaverecny.test@example.cz');
    expect(contactOfKind('phone', undefined, contacts))
      .toBe('+420 777 777 779');
  });

  /*
   * The fault that emptied the row even after the dead code was revived:
   * the previous version asked for `c.channel`, which is never present.
   */
  it('does not look for a field the server does not send', () => {
    const wrongKey = '[{"channel":"email","value":"jan@example.cz"}]';
    expect(profileContacts(wrongKey)).toHaveLength(0);
  });

  it('brings back nothing rather than failing on rubbish', () => {
    expect(profileContacts('{ not json')).toEqual([]);
    expect(profileContacts('"a string"')).toEqual([]);
    expect(profileContacts('{"type":"email"}')).toEqual([]); // an object, not a list
    expect(profileContacts(undefined)).toEqual([]);
    expect(profileContacts(null)).toEqual([]);
    expect(profileContacts('')).toEqual([]);
    expect(profileContacts('   ')).toEqual([]);
  });

  /* A malformed entry beside a good one must not take the good one with it. */
  it('keeps the entries it can read', () => {
    const mixed = '[{"type":"email","value":"jan@example.cz"},{"type":7},null,"x"]';
    const contacts = profileContacts(mixed);
    expect(contacts).toHaveLength(1);
    expect(contactOfKind('email', undefined, contacts)).toBe('jan@example.cz');
  });
});

describe('choosing which one to show', () => {
  const contacts = profileContacts(MEASURED);

  it('says nothing when there is no contact of that kind', () => {
    expect(contactOfKind('fax', undefined, contacts)).toBe('');
    expect(contactOfKind('email', undefined, [])).toBe('');
  });

  /*
   * The patient record wins when it has one. It never does today — the v1
   * endpoint carries no contacts at all — and this is written so the row
   * starts working by itself the day it begins to, rather than needing a
   * second place to be found and changed.
   */
  it('prefers the patient record when it carries one', () => {
    expect(contactOfKind('email', 'novy@example.cz', contacts))
      .toBe('novy@example.cz');
  });

  it('ignores an empty patient record rather than blanking the row', () => {
    expect(contactOfKind('email', '', contacts)).toBe('zaverecny.test@example.cz');
    expect(contactOfKind('email', '   ', contacts)).toBe('zaverecny.test@example.cz');
  });
});
