/*
 * The same dead end on the staff-facing registration form.
 *
 * Two fields here used to end a conversation rather than continue it:
 *
 *   birthNumber - fails the modulo-eleven check for a typo, for one of the
 *     ~1000 numbers issued under the pre-1985 exception, and for any foreign
 *     identifier. All three heard "invalid" and had nowhere to go, even though
 *     the field is optional and clearing it would have let them through.
 *
 *   healthInsuranceNumber - a foreign number is the wrong length, and the mode
 *     that exists for exactly that case is a control further up the form the
 *     person has no reason to have noticed.
 *
 * Both messages now name the way out. The insurance one describes the control
 * instead of quoting it: its label comes from the server
 * (`options.insuranceRegistrationKinds`), and pointing at a button by a name
 * it might not have is worse than not pointing at all.
 */
import { describe, it, expect } from 'vitest';
import {
  createEmptyForm, validateAll, validateField, type RegistrationFormState,
} from './validation';

const VALID = '9005150011';
const EXCEPTION_FORM = '9005150100';
const TYPO = '9005150014';

/*
 * The insurance number in the fixture is deliberately an insurer-assigned one
 * and not a birth number. When it *is* a birth number the form couples the two
 * fields - the stored birth number must be that same value - and that rule,
 * running last, overwrites whatever the checksum said. Two tests below were
 * written with a birth-number fixture and failed on that overwrite, which is
 * how the coupling was found.
 *
 * It does not reach the case these tests are about: a number that fails the
 * checksum is not classified as a birth number in the first place, so somebody
 * whose insurance number is their pre-1985 birth number falls through to
 * "insurer-assigned" and the coupling never fires on them.
 */
const NOT_A_BIRTH_NUMBER = '123456789';

const insuranceStep = (over: Partial<RegistrationFormState>) =>
  validateAll({
    ...createEmptyForm(),
    healthInsuranceNumber: NOT_A_BIRTH_NUMBER,
    ...over,
  });

describe('birth number on the registration form', () => {
  it('lets a number that divides by eleven through', () => {
    expect(insuranceStep({ birthNumber: VALID }).birthNumber).toBeUndefined();
  });

  it('stops a mistyped one', () => {
    expect(insuranceStep({ birthNumber: TYPO }).birthNumber).toBeDefined();
  });

  it('stops the pre-1985 exception form as well', () => {
    expect(insuranceStep({ birthNumber: EXCEPTION_FORM }).birthNumber).toBeDefined();
  });

  it('offers the empty field as the way out, because for some it is the only one', () => {
    const message = insuranceStep({ birthNumber: EXCEPTION_FORM }).birthNumber ?? '';
    expect(message).toMatch(/nechte pole prázdné/);
    expect(message).toMatch(/není povinné/);
  });

  /* Optional means optional: an empty field raises nothing at all. */
  it('says nothing when the field is left empty', () => {
    expect(insuranceStep({ birthNumber: '' }).birthNumber).toBeUndefined();
  });
});

describe('insurance number on the registration form', () => {
  it('sends a foreign number to the mode that exists for it', () => {
    const message = insuranceStep({ healthInsuranceNumber: 'AB1234567' }).healthInsuranceNumber ?? '';
    expect(message).toMatch(/přepněte výše způsob evidence pojištění/);
  });

  /* Described, never quoted - the labels are the server's to word. */
  it('does not quote a label the server owns', () => {
    const message = insuranceStep({ healthInsuranceNumber: 'AB1234567' }).healthInsuranceNumber ?? '';
    expect(message).not.toMatch(/[„"]/);
  });

  it('leaves a nine- or ten-digit number alone', () => {
    expect(insuranceStep({ healthInsuranceNumber: NOT_A_BIRTH_NUMBER }).healthInsuranceNumber).toBeUndefined();
    expect(
      insuranceStep({ healthInsuranceNumber: VALID, birthNumber: VALID }).healthInsuranceNumber,
    ).toBeUndefined();
  });
});

/*
 * One field at a time, so a box can complain when it is left.
 *
 * The owner's complaint was concrete: "email nemam pocit ze funguje to chybna
 * zadanie .. tam som napriklad naprikladvgmail.com a nenapisalo ze je to zly
 * tvar". It was true. Every rule below already existed and every one of them
 * ran only inside submit, so the whole form stayed silent until the last
 * button — and on a screen this long the offending field is usually scrolled
 * off by then.
 *
 * `validateField` is the same rules asked about ONE field. It has to answer
 * about the field it was asked about and no other: the form is only ever
 * half-filled when somebody leaves the first box, so an answer that carried
 * the other twelve fields' complaints would light the whole screen red on the
 * first Tab.
 */
describe('asking about a single field', () => {
  const withEmail = (email: string): RegistrationFormState => ({
    ...createEmptyForm(), email,
  });

  /*
   * The shape of an address is NOT decided here any more.
   *
   * It was, by a regular expression on this form, and it was wrong in both
   * directions against the server measured on 15. 9. 2026 — it refused
   * `jan@localhost`, which the server stores, and passed `jan@example..cz`,
   * which the server refuses. `POST /api/v1/patients/email/inspect` decides it
   * now, on the same canonicaliser that writes it, and what to do with that
   * answer is guarded in `emailInspection.test.ts`.
   *
   * So this asserts the SILENCE. If a shape rule ever creeps back onto the
   * form, the value below is the one that starts failing.
   */
  it('leaves the shape of an address to the server', () => {
    expect(validateField('email', withEmail('napriklad.gmail.com'))).toBeUndefined();
    expect(validateField('email', withEmail('jan@localhost'))).toBeUndefined();
  });

  it('says nothing about an address that is fine', () => {
    expect(validateField('email', withEmail('pacient@example.cz'))).toBeUndefined();
  });

  it('asks for one that is missing', () => {
    expect(validateField('email', withEmail(''))).toMatch(/povinný/);
  });

  /*
   * The one that matters for the screen. An empty form fails nearly every
   * rule; asking about the e-mail must bring back the e-mail's answer only.
   */
  it('answers about the field asked about, not the rest of the form', () => {
    const empty = createEmptyForm();
    expect(validateField('firstName', empty)).toMatch(/povinné|povinný/);
    expect(validateField('email', { ...empty, email: 'pacient@example.cz' }))
      .toBeUndefined();
  });

  /* An optional field left empty is not a complaint. */
  it('stays quiet about an optional field nobody filled', () => {
    expect(validateField('preferredName', createEmptyForm())).toBeUndefined();
    expect(validateField('birthNumber', createEmptyForm())).toBeUndefined();
  });

  /* It is the whole form's rules, not the step's: the coupling between the
     insurance number and the birth number is one of them. */
  it('sees rules that need more than the one field', () => {
    const coupled = {
      ...createEmptyForm(), healthInsuranceNumber: VALID, birthNumber: TYPO,
    };
    expect(validateField('birthNumber', coupled)).toBeDefined();
  });
});
