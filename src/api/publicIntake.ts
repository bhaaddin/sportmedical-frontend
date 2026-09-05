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

export interface IntakeRequest {
  identity: IntakeIdentity;
  contact: IntakeContact;
  insurance: IntakeInsurance;
  /** Must include a granted 'treatment' consent or the server rejects. */
  consents: IntakeConsent[];
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
