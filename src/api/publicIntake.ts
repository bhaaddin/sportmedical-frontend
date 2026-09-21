/* ══════════════════════════════════════════════════════════════
   PUBLIC INTAKE API CLIENT

   Anonymous — no auth header, no account. Backed by
   POST /api/public/intake (to be implemented server-side; this file
   is the authoritative request/response contract for that endpoint).

   Idempotency: the form mints ONE uuid per questionnaire session and
   sends it as `Idempotency-Key`. The server keys receipts on
   (endpoint, key) and returns the existing receipt on retry, so a
   double-tapped Submit or a flaky mobile connection can never create
   two patients.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import type { Sex } from '../services/publicIntake/validation';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Deliberately NOT the shared `client` from ./client: that one attaches
 * the bearer token and redirects to /login on 401. This endpoint is
 * anonymous, and a patient filling in a questionnaire must never be
 * bounced to a staff login screen.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

publicClient.interceptors.response.use((res) => {
  // Backend wraps responses in { success, data, message, isSuccess }.
  if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
    res.data = res.data.data;
  }
  return res;
});

/* ── Request ── */

export interface IntakeIdentity {
  givenName: string;
  familyName: string;
  /** ISO yyyy-MM-dd. */
  dateOfBirth: string;
  sex: Sex;
  /** Digits only, no slash. Optional — improves matching when present. */
  birthNumber: string | null;
}

export interface IntakeContact {
  email: string;
  /** E.164, e.g. +420601234567. */
  phone: string;
}

/** Patient holds Czech public health insurance. */
export interface CzechInsurance {
  kind: 'czech';
  /** 9–10 digits. */
  insuranceNumber: string;
  /**
   * The same number typed a second time, or null when the form did not ask.
   *
   * Asked for only when the number is not shaped like a birth number: that
   * shape checks itself, an insurer-assigned number does not. The server
   * refuses a missing or mismatched confirmation, so this is the question, not
   * the rule.
   */
  insuranceNumberConfirmation: string | null;
  /** One of 111/201/205/207/209/211/213. */
  insurerCode: number;
}

/** Patient has no Czech insurance — identified by travel document instead. */
export interface ForeignInsurance {
  kind: 'foreign';
  documentType: 'IdentityCard' | 'Passport';
  /** ISO 3166-1 alpha-2. */
  issuingCountry: string;
  documentNumber: string;
}

export type IntakeInsurance = CzechInsurance | ForeignInsurance;

export interface IntakeConsent {
  /** Policy code, e.g. 'treatment' (Art. 9), 'communication', 'club'. */
  policyCode: string;
  granted: boolean;
}

/**
 * Where the patient lives, as the register spells it.
 *
 * One field, and it is the code - not the street, not the town, not the postal
 * code. The server looks those up itself, so there is nothing here to mistype
 * and nothing to disagree with the catalogue about. Required: without it the
 * whole submission is refused with `errors.Address`, which is how it was found
 * that this form could never be submitted at all.
 */
/**
 * One answer, in whichever of the three shapes its question has. The server
 * stores it verbatim and interprets none of it — the questions are defined in
 * this repo today, so there is nothing on that side to validate against.
 */
export interface IntakeHealthAnswer {
  questionId: string;
  text?: string | null;
  yesNo?: boolean | null;
  choices?: string[] | null;
}

export interface IntakeHealthQuestionnaire {
  /** Which set of questions these answers belong to. */
  definitionKey: string;
  /** Bumped when the questions change, so old rows stay readable. */
  schemaVersion: number;
  answers: IntakeHealthAnswer[];
}

export interface IntakeAddress {
  ruianAddressPointCode: number;
}

export interface IntakeRequest {
  identity: IntakeIdentity;
  contact: IntakeContact;
  address: IntakeAddress;
  insurance: IntakeInsurance;
  /** Must include a granted 'treatment' consent or the server rejects. */
  consents: IntakeConsent[];
  /**
   * The zdravotní dotazník, when the patient filled any of it in.
   *
   * Optional both here and on the server, and left out entirely rather than
   * sent empty when nothing was answered: a stored `{"answers":[]}` says
   * somebody opened the form and answered nothing, which is a different fact
   * from never having opened it.
   */
  healthQuestionnaire?: IntakeHealthQuestionnaire;

  /**
   * The slot being claimed, when this registration is finishing a booking.
   *
   * Optional, and left off entirely for somebody who came straight to the
   * questionnaire. The server keeps the registration whether or not the claim
   * succeeds — a hold that lapsed mid-form must not cost the patient everything
   * they typed.
   */
  holdToken?: string;
  /**
   * Anti-abuse honeypot. Rendered visually hidden and never focusable;
   * a non-empty value means a bot filled the form. Always sent as ''.
   */
  websiteUrl: string;
}

/* ── Response ── */

/** Mirrors Application/Patients/Registration PatientRegistrationOutcome. */
export const IntakeOutcome = {
  Created: 'Created',
  Existing: 'Existing',
  CandidateReviewRequired: 'CandidateReviewRequired',
} as const;

export type IntakeOutcome = (typeof IntakeOutcome)[keyof typeof IntakeOutcome];

export interface IntakeResponse {
  /** Shown to the patient on the confirmation screen. */
  referenceNumber: string;
  outcome: IntakeOutcome;
  /**
   * Token for the existing manage/{token} flow. Absent when the
   * submission went to the review queue — there is nothing to manage
   * until a member of staff resolves it.
   */
  manageToken: string | null;

  /**
   * Whether a confirmation e-mail is genuinely on its way.
   *
   * The server answers this, because only the server knows: a message is
   * queued either way, but it leaves only when there is a configured sender to
   * take it out of the queue. The screen said "we have e-mailed you"
   * unconditionally until 19. 9. 2026, while nothing at all was being sent.
   */
  confirmationEmailExpected: boolean;

  /**
   * The appointment, when this registration was finishing a booking.
   *
   * The server has returned these three since the booking flow was built and
   * this contract never declared them, so the confirmation screen showed a
   * reference number and nothing else — somebody who had just booked a time was
   * never told what time. Null for anybody who came straight to the
   * questionnaire without booking.
   */
  appointmentId: string | null;
  appointmentStartUtc: string | null;
  appointmentEndUtc: string | null;

  /**
   * True when the patient came with a held slot and leaves without an
   * appointment.
   *
   * Their registration is saved either way. What this stops is the screen
   * showing an ordinary confirmation to somebody who believes they now have a
   * time and does not.
   */
  bookingFailed: boolean;
}

/* ── Errors ── */

export interface IntakeFieldError {
  field: string;
  code: string;
  message: string;
}

export class IntakeError extends Error {
  readonly status: number;
  readonly fieldErrors: IntakeFieldError[];
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    status: number,
    fieldErrors: IntakeFieldError[] = [],
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'IntakeError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/* ── Idempotency key ── */

const IDEMPOTENCY_STORAGE_KEY = 'sportmedical.intake.idempotencyKey';

/**
 * One key per questionnaire session, stable across retries and reloads.
 * sessionStorage (not localStorage) so a genuinely new visit in a new tab
 * gets a fresh key rather than colliding with a completed submission.
 */
export function getIdempotencyKey(): string {
  try {
    const existing = sessionStorage.getItem(IDEMPOTENCY_STORAGE_KEY);
    if (existing !== null && existing.length > 0) return existing;
  } catch {
    // Private mode / blocked storage — fall through to a per-call key.
  }

  const key = crypto.randomUUID();

  try {
    sessionStorage.setItem(IDEMPOTENCY_STORAGE_KEY, key);
  } catch {
    // Non-fatal: without storage the retry simply creates a new receipt.
  }

  return key;
}

/** Call after a successful submit so a second questionnaire starts clean. */
export function clearIdempotencyKey(): void {
  try {
    sessionStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/* ── Call ── */

export async function submitIntake(request: IntakeRequest): Promise<IntakeResponse> {
  try {
    const response = await publicClient.post<IntakeResponse>('/api/public/intake', request, {
      headers: { 'Idempotency-Key': getIdempotencyKey() },
    });
    return response.data;
  } catch (error) {
    if (!axios.isAxiosError(error)) {
      throw new IntakeError('Odeslání se nezdařilo. Zkuste to prosím znovu.', 0);
    }

    const status = error.response?.status ?? 0;
    const payload = error.response?.data as
      | { message?: string; errors?: IntakeFieldError[] }
      | undefined;

    if (status === 429) {
      const header = error.response?.headers?.['retry-after'];
      const retryAfter = typeof header === 'string' ? Number(header) : null;
      throw new IntakeError(
        'Příliš mnoho pokusů. Zkuste to prosím za chvíli.',
        status,
        [],
        Number.isFinite(retryAfter) ? retryAfter : null,
      );
    }

    if (status === 0) {
      throw new IntakeError('Nepodařilo se spojit se serverem. Zkontrolujte připojení.', status);
    }

    throw new IntakeError(
      payload?.message ?? 'Odeslání se nezdařilo. Zkuste to prosím znovu.',
      status,
      payload?.errors ?? [],
    );
  }
}
