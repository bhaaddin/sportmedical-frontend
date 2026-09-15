/*
 * What to do with the server's verdict on an e-mail address.
 *
 * The fixtures below are not invented: every one was measured against the
 * running `POST /api/v1/patients/email/inspect` on 15. 9. 2026, including the
 * exact value the owner typed when he found the screen saying nothing.
 *
 * What these guard hardest is that NOTHING HERE DECIDES WHAT AN ADDRESS IS.
 * The frontend's own regular expression was wrong in both directions against
 * that server, and a test that re-encoded a rule would re-encode that.
 */
import { describe, it, expect } from 'vitest';
import {
  emailComplaint, emailDisplayState, storedAs, worthInspectingEmail,
} from './emailInspection';
import type { EmailInspection } from '../../api/patientRegistry';

const refused = (rejectionCode: string): EmailInspection => ({
  parses: false, canonical: '', displayValue: '', rejectionCode,
});

const accepted = (canonical: string, displayValue: string): EmailInspection => ({
  parses: true, canonical, displayValue, rejectionCode: null,
});

/* Measured, all four. */
const ownersTypo = () => refused('patients.contact_address.email.invalid');
const plain = () => accepted('jan@example.cz', 'jan@example.cz');
const shouted = () => accepted('Jan@example.cz', 'Jan@Example.CZ');
const accented = () => accepted('jan@xn--hkov-5nad81a.cz', 'jan@háčková.cz');

describe('what the field is showing', () => {
  it('says nothing about an empty box', () => {
    expect(emailDisplayState(plain(), '')).toBe('idle');
    expect(emailDisplayState(ownersTypo(), '   ')).toBe('idle');
  });

  it('says nothing before an answer has arrived', () => {
    expect(emailDisplayState(null, 'jan@example.cz')).toBe('idle');
  });

  it('accepts what the server would store', () => {
    expect(emailDisplayState(plain(), 'jan@example.cz')).toBe('valid');
  });

  /* The value that started this. */
  it('refuses what the server would refuse', () => {
    expect(emailDisplayState(ownersTypo(), 'napriklad.gmail.com')).toBe('invalid');
  });

  /*
   * The two rows that made the regular expression indefensible. Neither is a
   * rule this module holds — it holds the server's answer, and that is the
   * point of both.
   */
  it('takes an address the old regex refused', () => {
    const localhost = accepted('jan@localhost', 'jan@localhost');
    expect(emailDisplayState(localhost, 'jan@localhost')).toBe('valid');
  });

  it('refuses one the old regex let through', () => {
    expect(emailDisplayState(ownersTypo(), 'jan@example..cz')).toBe('invalid');
  });
});

describe('what it says under the field', () => {
  it('stays quiet when there is nothing wrong', () => {
    expect(emailComplaint(plain())).toBe('');
    expect(emailComplaint(null)).toBe('');
  });

  it('names a bad shape', () => {
    expect(emailComplaint(ownersTypo())).toMatch(/tvaru/);
  });

  /*
   * The dot matters. App's message spelled this `email.local_part_too_long`
   * and the constant in `ContactAddressErrorCodes.cs` is
   * `email.local_part.too_long` — taking the message would have shipped a key
   * that never matches and a real complaint would have come out as the
   * catch-all, which looks right and is not.
   */
  it('uses the code as the backend spells it, dot and all', () => {
    const measured = refused('patients.contact_address.email.local_part.too_long');
    expect(emailComplaint(measured)).toMatch(/před zavináčem/);

    const misspelt = refused('patients.contact_address.email.local_part_too_long');
    expect(emailComplaint(misspelt)).not.toMatch(/před zavináčem/);
  });

  it('names an address that is too long', () => {
    expect(emailComplaint(refused('patients.contact_address.display_value.too_long')))
      .toMatch(/příliš dlouhá/);
  });

  /*
   * Everything else in that file describes a value the server builds from this
   * input, so no typing can cause one. App was explicit: if one arrives it is
   * a fault on their side, not a bad address — so the message must not blame
   * what somebody typed.
   */
  it('does not blame the typist for a fault it cannot explain', () => {
    const internal = refused('patients.contact_address.email.canonical_value_mismatch');
    const said = emailComplaint(internal);
    expect(said).not.toBe('');
    expect(said).not.toMatch(/tvaru/);
    expect(said).toMatch(/ověřit/);
  });

  /* A refusal with no code at all still has to say something. */
  it('says something even when no code came back', () => {
    expect(emailComplaint({ ...refused(''), rejectionCode: null })).not.toBe('');
  });
});

describe('what the summary card shows', () => {
  /*
   * The card claims to show what will be SAVED, and a mirror of the box is not
   * that claim.
   *
   * Proving it needs a value the server writes back differently, and the first
   * two attempts here did not have one: `  Jan@Example.CZ  ` and
   * `jan@háčková.cz` both come back byte-for-byte equal to the trimmed input,
   * so a version that ignored the server entirely passed both. They were
   * mutation-tested and survived, which is how this was found.
   *
   * MEASURED: an `a` followed by a combining acute accent (U+0301) comes back
   * COMPOSED as `á` (U+00E1) — ADR-0007 runs `Normalize(FormC)` before
   * anything else. The two strings look identical on screen and are not equal,
   * which is exactly the case a mirror gets wrong. It is not exotic either:
   * some keyboard layouts and a good deal of pasted text arrive decomposed.
   */
  const DECOMPOSED = 'jan@háckova.cz';
  const COMPOSED = 'jan@háckova.cz';

  it('shows the address as the server writes it, not as it was typed', () => {
    expect(DECOMPOSED).not.toBe(COMPOSED); // different strings, same picture
    const normalised = accepted('jan@xn--hckova-pta.cz', COMPOSED);
    expect(storedAs(normalised, DECOMPOSED)).toBe(COMPOSED);
  });

  it('shows the address as the server reads it back', () => {
    expect(storedAs(shouted(), '  Jan@Example.CZ  ')).toBe('Jan@Example.CZ');
    expect(storedAs(accented(), 'jan@háčková.cz')).toBe('jan@háčková.cz');
  });

  it('shows the typed value while no answer has arrived', () => {
    expect(storedAs(null, '  jan@example.cz ')).toBe('jan@example.cz');
  });

  /* A refused address has an empty `displayValue`; the card must not go blank
     while the field beneath it is red. */
  it('keeps showing a refused address rather than emptying', () => {
    expect(storedAs(ownersTypo(), 'napriklad.gmail.com')).toBe('napriklad.gmail.com');
  });

  /*
   * Deliberately a shape the server does NOT send today: every refusal
   * measured came back with `displayValue: ''`, so the `parses` check in
   * `storedAs` is unreachable through the real endpoint and a mutation that
   * deleted it survived.
   *
   * It is kept, and this reaches it. The card says what will be saved, and a
   * refused address is not going to be saved at all — printing a server's
   * tidied-up version of one would promise a row that never gets written.
   */
  it('never promises to save something the server refused', () => {
    const refusedButTidied: EmailInspection = {
      parses: false, canonical: '', displayValue: 'jan@example.cz',
      rejectionCode: 'patients.contact_address.email.invalid',
    };
    expect(storedAs(refusedButTidied, 'jan@example..cz')).toBe('jan@example..cz');
  });

  it('falls back when the server sent no display form', () => {
    const noDisplay: EmailInspection = { ...plain(), displayValue: '' };
    expect(storedAs(noDisplay, 'jan@example.cz')).toBe('jan@example.cz');
  });
});

describe('when to ask the server', () => {
  it('asks once there is something in the box', () => {
    expect(worthInspectingEmail('j')).toBe(true);
  });

  it('does not ask about an empty box', () => {
    expect(worthInspectingEmail('')).toBe(false);
    expect(worthInspectingEmail('   ')).toBe(false);
  });
});
