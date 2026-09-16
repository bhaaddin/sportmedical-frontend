/*
 * What a receptionist reads when the registry refuses a registration.
 *
 * The case these were written for is the one the server got wrong until
 * 15. 9. 2026: a birth number that somebody else already has came back as
 * `patients.registration.concurrency_conflict` — "Údaje se souběžně změnily.
 * Zkuste registraci odeslat znovu." Sending it again does exactly the same
 * thing, forever, and the form being checked was correct.
 *
 * MEASURED against the running registry, three POSTs differing only in the
 * birth number:
 *
 *   9005150011 (taken)   409 patients.registration.identifier_already_registered
 *                            errors.field: ["birthNumber"]
 *   9005150012 (typo)    400 …birth_number_checksum_invalid
 *   9005154004 (free)    200 Created
 */
import { describe, it, expect } from 'vitest';
import { resolveRegistrationError } from './registrationErrors';
import { PatientRegistryError } from '../../api/patientRegistry';

const refusal = (code: string, field: string | null) =>
  new PatientRegistryError('cokoliv ze serveru', 409, code, field, 'trace-1');

const TAKEN = 'patients.registration.identifier_already_registered';

describe('an identifier somebody already has', () => {
  it('says the patient is already in the registry', () => {
    const resolved = resolveRegistrationError(refusal(TAKEN, 'birthNumber'));
    expect(resolved.message).toMatch(/už je v registru zapsán/);
  });

  /*
   * The whole point of the fix. The old answer told somebody to check a form
   * that was fine, and to send it again — which cannot ever work.
   */
  it('does not tell anybody to send it again', () => {
    const resolved = resolveRegistrationError(refusal(TAKEN, 'birthNumber'));
    expect(resolved.message).not.toMatch(/znovu|souběžně/);
  });

  /* It names the way out, like the other dead-end messages on this form. */
  it('names where the patient can be found', () => {
    const resolved = resolveRegistrationError(refusal(TAKEN, 'birthNumber'));
    expect(resolved.message).toMatch(/seznamu pacientů/);
  });

  /*
   * All three fields the server can name are already known to
   * `FIELD_BY_DOMAIN_NAME`, so the right box marks itself and the form jumps
   * to the section holding it. Guarded for all three because only the first
   * was reachable by measurement — a probe for the insurance number hit the
   * coupling rule first, and one for the document was refused on its shape.
   */
  it.each([
    ['birthNumber', 1],
    ['healthInsuranceNumber', 1],
    ['identityDocumentNumber', 1],
  ])('marks %s and points at its section', (field, step) => {
    const resolved = resolveRegistrationError(refusal(TAKEN, field));
    expect(resolved.field).toBe(field);
    expect(resolved.step).toBe(step);
  });

  /*
   * Not a restart. That branch mints fresh identifiers because "the registry
   * already knows them with other facts" — and here what is taken is the
   * number somebody typed, not the generated ids. A new GUID changes nothing
   * about a birth number that belongs to another patient.
   */
  it('does not burn the generated identifiers', () => {
    expect(resolveRegistrationError(refusal(TAKEN, 'birthNumber')).requiresRestart)
      .toBe(false);
  });

  it('carries the code and trace through for the log', () => {
    const resolved = resolveRegistrationError(refusal(TAKEN, 'birthNumber'));
    expect(resolved.code).toBe(TAKEN);
    expect(resolved.traceId).toBe('trace-1');
  });
});

describe('a code nobody has mapped', () => {
  /*
   * The server's own sentence plus the code, rather than a guess. It is how
   * `identifier_already_registered` itself read for the hour between app
   * shipping it and this file learning it.
   */
  it('shows what the server said and names the code', () => {
    const resolved = resolveRegistrationError(refusal('patients.registration.brand_new', null));
    expect(resolved.message).toContain('cokoliv ze serveru');
    expect(resolved.message).toContain('patients.registration.brand_new');
    expect(resolved.field).toBeNull();
  });
});
