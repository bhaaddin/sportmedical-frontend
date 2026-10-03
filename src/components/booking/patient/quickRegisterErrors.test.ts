import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import {
  NOT_CREATED,
  QuickRegisterError,
  isNotFound,
  isQuickConflict,
  quickConflictText,
  toQuickRegisterError,
} from './quickRegisterErrors';

/*
 * "Nejde mi ukládat": the pre-registration route explains every refusal in
 * Czech and names the field; the drawer must say exactly that, at that box.
 */

function axiosFailure(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  const response = { status, statusText: '', headers: {}, config, data } as AxiosResponse;
  return new AxiosError('Request failed', String(status), config, undefined, response);
}

describe('why the quick registration was refused', () => {
  it('shows the server\'s own sentence and points it at the box the server named', () => {
    const error = toQuickRegisterError(
      axiosFailure(400, {
        code: 'intake.registration.phone_unusable',
        message: 'Telefon není platné číslo. Zadejte ho s předvolbou, nebo ho vynechte.',
        errors: { field: ['phone'] },
      }),
    );
    expect(error).toBeInstanceOf(QuickRegisterError);
    expect(error.message).toBe('Telefon není platné číslo. Zadejte ho s předvolbou, nebo ho vynechte.');
    expect(error.field).toBe('phone');
  });

  it('maps the registry\'s field names onto the drawer\'s four boxes', () => {
    /* No date of birth is asked in quick registration, so there is no box for it. */
    expect(toQuickRegisterError(axiosFailure(400, { code: 'x', message: 'Bez data narození nelze pacienta založit.', errors: { field: ['dateOfBirth'] } })).field).toBeNull();
    expect(toQuickRegisterError(axiosFailure(400, { code: 'x', message: 'Prohlídka.', errors: { field: ['activityId'] } })).field).toBe('activityId');
    expect(toQuickRegisterError(axiosFailure(400, { code: 'x', message: 'Příjmení je povinné.', errors: { field: ['lastName'] } })).field).toBe('name');
    expect(toQuickRegisterError(axiosFailure(400, { code: 'x', message: 'E-mail.', errors: { field: ['email'] } })).field).toBe('email');
    /* The controller's own validation puts the field as the key. */
    expect(toQuickRegisterError(axiosFailure(400, { code: 'pre_registration.invalid', message: 'Chybí identifikátor pacienta.', errors: { patientId: ['Chybí identifikátor pacienta.'] } })).field).toBeNull();
  });

  it('falls back to the registration page\'s words when the server sent none, and to a generic sentence after that', () => {
    expect(toQuickRegisterError(axiosFailure(400, { code: 'patients.date_of_birth.required' })).message).toBe('Datum narození je povinné.');
    expect(toQuickRegisterError(axiosFailure(500, {})).message).toBe('Pacienta se nepodařilo založit. Zkuste to prosím znovu.');
  });

  it('says plainly when the account may not register anybody', () => {
    expect(toQuickRegisterError(axiosFailure(403, {})).message).toBe('Zakládat pacienty v registru nemáte oprávnění.');
    expect(toQuickRegisterError(axiosFailure(403, { message: 'Předregistraci vytváří jen ten, kdo smí zakládat pacienty.' })).message)
      .toBe('Předregistraci vytváří jen ten, kdo smí zakládat pacienty.');
  });

  it('reads the codes of the quick booking when the server names no field or sentence', () => {
    const phone = toQuickRegisterError(axiosFailure(400, { code: 'appointments.quick.phone_dialling_code_required' }));
    expect(phone.field).toBe('phone');
    expect(phone.message).toBe('Telefon zadejte s předvolbou, například +420 773 539 001.');
    expect(toQuickRegisterError(axiosFailure(422, { code: 'appointments.quick.email_invalid' })).field).toBe('email');
    expect(toQuickRegisterError(axiosFailure(422, { code: 'appointments.quick.activity_not_offered' })).field).toBe('activityId');
    /* The server's sentence still wins over the hint. */
    expect(toQuickRegisterError(axiosFailure(422, { code: 'appointments.quick.phone_required', message: 'Telefon chybí.' })).message).toBe('Telefon chybí.');
  });

  it('tells a taken slot (409) from a refusal and uses the server sentence for it', () => {
    expect(isQuickConflict(axiosFailure(409, { message: 'Termín už je obsazený.' }))).toBe(true);
    expect(isQuickConflict(axiosFailure(400, {}))).toBe(false);
    expect(quickConflictText(axiosFailure(409, { message: 'Termín už je obsazený.' }))).toBe('Termín už je obsazený.');
    expect(quickConflictText(axiosFailure(409, {}))).toMatch(/obsadil někdo jiný/);
  });

  it('names a server that could not be reached', () => {
    const offline = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(toQuickRegisterError(offline).message).toBe('Nepodařilo se spojit se serverem. Zkontrolujte připojení.');
  });

  it('keeps its own errors and turns the rest into the generic sentence', () => {
    expect(toQuickRegisterError(NOT_CREATED)).toBe(NOT_CREATED);
    expect(NOT_CREATED.field).toBe('name');
    expect(toQuickRegisterError(new Error('boom')).message).toBe('Pacienta se nepodařilo založit. Zkuste to prosím znovu.');
  });

  it('recognises "no such patient" and nothing else', () => {
    expect(isNotFound(axiosFailure(404, {}))).toBe(true);
    expect(isNotFound(axiosFailure(403, {}))).toBe(false);
    expect(isNotFound(new TypeError('x is not a function'))).toBe(false);
  });
});
