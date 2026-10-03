import axios from 'axios';
import { PatientRegistryError } from '../../../api/patientRegistry';
import { resolveRegistrationError } from '../../../services/patientRegistration/registrationErrors';
import type { QuickPatientDraft } from '../NewAppointmentDialog.logic';

/*
 * Why "Rychlá registrace" would not save, in words the desk can act on.
 *
 * Found on 3. 10. 2026, the owner's "nejde mi ukládat": the pre-registration
 * route answers a refusal as an ApiProblemResponse - a code, a Czech sentence
 * ("Bez data narození nelze pacienta založit.", "Telefon není platné číslo.
 * Zadejte ho s předvolbou…") and the field it is about. `preRegister` threw
 * the bare axios error, the drawer handed it to `errorText`, which knows only
 * `BookingApiError`, and every one of those sentences came out as "Něco se
 * pokazilo. Zkuste to prosím znovu." - the one message that tells nobody what
 * to fix. This reads the answer and points it at the box.
 */

export type QuickDraftField = keyof QuickPatientDraft;

/** The registry's field names → the drawer's four boxes. */
const DRAFT_FIELD_BY_DOMAIN: Record<string, QuickDraftField> = {
  firstName: 'name',
  lastName: 'name',
  dateOfBirth: 'dateOfBirth',
  email: 'email',
  phone: 'phone',
  regionCode: 'phone',
};

const GENERIC = 'Pacienta se nepodařilo založit. Zkuste to prosím znovu.';

export class QuickRegisterError extends Error {
  readonly field: QuickDraftField | null;
  readonly code: string;

  constructor(message: string, field: QuickDraftField | null = null, code = 'client.unexpected') {
    super(message);
    this.name = 'QuickRegisterError';
    this.field = field;
    this.code = code;
  }
}

/**
 * The server said the patient was not created - a namesake with the same date
 * of birth needs a look at the register first. Not a failure of the request,
 * a failure of the assumption behind it: the booking must not go on with an id
 * nobody has.
 */
export const NOT_CREATED = new QuickRegisterError(
  'Pacient nebyl založen: v registru už je někdo se stejným jménem a datem narození. Najděte ho přes „Z databáze“, aby nevznikl druhý záznam téhož člověka.',
  'name',
  'patients.registration.candidate_review_required',
);

/** Whatever `preRegister` threw, as one sentence and the box it belongs to. */
export function toQuickRegisterError(error: unknown): QuickRegisterError {
  if (error instanceof QuickRegisterError) return error;

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) {
      return new QuickRegisterError(
        'Nepodařilo se spojit se serverem. Zkontrolujte připojení.',
        null,
        'client.network',
      );
    }
    const payload = error.response?.data as
      | { code?: string; message?: string; errors?: Record<string, string[]>; traceId?: string }
      | undefined;
    const code = payload?.code ?? `http.${status}`;
    const domainField = payload?.errors?.field?.[0] ?? firstErrorKey(payload?.errors);
    const serverMessage = typeof payload?.message === 'string' ? payload.message.trim() : '';

    /* The registration page's table knows the registry's codes; reuse its words
       when the server sent none worth showing. */
    const resolved = resolveRegistrationError(
      new PatientRegistryError(serverMessage || GENERIC, status, code, domainField ?? null, payload?.traceId ?? null),
    );
    const mapped = resolved.message.endsWith(`(${code})`) ? null : resolved.message;
    const message = status === 403
      ? (serverMessage || 'Zakládat pacienty v registru nemáte oprávnění.')
      : (serverMessage || mapped || GENERIC);
    const field = domainField ? (DRAFT_FIELD_BY_DOMAIN[domainField] ?? null) : null;
    return new QuickRegisterError(message, field, code);
  }

  if (error instanceof Error && error.message === 'name') {
    return new QuickRegisterError('Zadejte jméno i příjmení.', 'name', 'client.name');
  }

  return new QuickRegisterError(GENERIC);
}

function firstErrorKey(errors: Record<string, string[]> | undefined): string | undefined {
  if (!errors) return undefined;
  const keys = Object.keys(errors).filter((k) => k !== 'field');
  return keys.length > 0 ? keys[0] : undefined;
}

/** True for the one answer that means "no such patient" - the id was never created. */
export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
