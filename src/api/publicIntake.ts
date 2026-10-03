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
  /**
   * ISO yyyy-MM-dd. `null` when the patient did not give one — allowed only when
   * the clinic does not ask for it on a desk-started completion link (Etapa 2,
   * decision 7: the switch is `requireDateOfBirthOnCompletion`, default off).
   */
  dateOfBirth: string | null;
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
  /** 0 when the address came from Mapy.cz (whole republic); the parts carry it. */
  ruianAddressPointCode: number;
  street?: string | null;
  number?: string | null;
  municipalityPart?: string | null;
  municipality?: string | null;
  zip?: string | null;
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

  /**
   * The patient's personal portal token, when finishing a desk-started
   * registration created one. The confirmation screen offers "Můj portál" so the
   * patient keeps a way back to their appointments. Null otherwise.
   */
  portalToken?: string | null;
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

/** What the completion link opens with: the patient's own facts, pre-filled. */
export interface CompletionOpen {
  referenceNumber: string;
  givenName: string;
  familyName: string;
  email: string;
  phoneE164: string | null;
  expiresAtUtc: string;
  activityName?: string | null;
  startUtc?: string | null;
}

/** One document the činnost asks the patient to deal with (the admin's template). */
export interface CompletionDocument {
  templateId: string;
  name: string;
}

/** The booking the desk made, as the completion link describes it. */
export interface CompletionAppointment {
  activityName: string;
  serviceName: string;
  startUtc: string;
  endUtc: string | null;
  /** Empty is normal: the admin picks documents per činnost and the default is none. */
  requiredDocuments: CompletionDocument[];
}

/**
 * What the completion link opens with, normalised (Etapa 2, contract C2).
 *
 * The server's names moved while this was built (givenName/firstName,
 * phone/phoneE164, appointmentStartUtc/appointment.startUtc), so the raw answer
 * is read tolerantly here and the page only ever sees this shape.
 */
export interface CompletionView {
  referenceNumber: string;
  givenName: string;
  familyName: string;
  email: string;
  phoneE164: string | null;
  /** Until when the registration can be finished: registrationDeadlineUtc, else the link's expiry. */
  deadlineUtc: string | null;
  appointment: CompletionAppointment | null;
  /** The admin's switch; when the server sends none, the form asks as it always did. */
  requireDateOfBirth: boolean;
  /** Whether the health questionnaire is asked for on this link (default: not asked). */
  questionnaire: 'NotAsked' | 'Optional' | 'Required';
}

export type CompletionResult =
  | { status: 'ok'; view: CompletionView }
  /** 410: the deadline passed; the reservation is cancelled and the slot is free again. */
  | { status: 'expired'; message: string | null }
  /** 404: unknown or already used. */
  | { status: 'missing' }
  | { status: 'error' };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** Reads the raw completion answer into a CompletionView (exported for the tests). */
export function normaliseCompletion(raw: Record<string, unknown>): CompletionView {
  const nested = (raw.appointment ?? null) as Record<string, unknown> | null;
  const startUtc = textOrNull(nested?.startUtc) ?? textOrNull(raw.appointmentStartUtc) ?? textOrNull(raw.startUtc);
  const activityName = textOrNull(nested?.activityName) ?? textOrNull(raw.activityName);

  const documents = Array.isArray(nested?.requiredDocuments)
    ? (nested?.requiredDocuments as Array<Record<string, unknown>>)
      .map((d) => ({ templateId: text(d.templateId), name: text(d.name) }))
      .filter((d) => d.name !== '')
    : [];

  const appointment: CompletionAppointment | null = startUtc !== null || activityName !== null
    ? {
        activityName: activityName ?? '',
        serviceName: text(nested?.serviceName),
        startUtc: startUtc ?? '',
        endUtc: textOrNull(nested?.endUtc),
        requiredDocuments: documents,
      }
    : null;

  const required = raw.requireDateOfBirthOnCompletion ?? raw.requireDateOfBirth;
  const questionnaireRaw = raw.questionnaireRequirement;
  const questionnaire: CompletionView['questionnaire'] =
    questionnaireRaw === 'Required' || questionnaireRaw === 2 ? 'Required'
      : questionnaireRaw === 'Optional' || questionnaireRaw === 1 ? 'Optional'
        : raw.questionnaireRequired === true ? 'Required' : 'NotAsked';

  return {
    referenceNumber: text(raw.referenceNumber),
    givenName: text(raw.firstName) || text(raw.givenName),
    familyName: text(raw.lastName) || text(raw.familyName),
    email: text(raw.email),
    phoneE164: textOrNull(raw.phone) ?? textOrNull(raw.phoneE164),
    deadlineUtc: textOrNull(raw.registrationDeadlineUtc) ?? textOrNull(raw.expiresAtUtc),
    appointment,
    requireDateOfBirth: typeof required === 'boolean' ? required : true,
    questionnaire,
  };
}

/**
 * Opens a completion link and tells the four outcomes apart, which
 * {@link openCompletion} cannot: 410 is "the deadline passed and the reservation
 * is gone" (a calm page with a way to book again), 404 is "unknown or used",
 * anything else is a failed load worth a "Zkusit znovu".
 */
export async function openCompletionResult(token: string): Promise<CompletionResult> {
  try {
    const res = await publicClient.get<Record<string, unknown>>(
      `/api/public/intake/complete/${encodeURIComponent(token)}`,
    );
    return { status: 'ok', view: normaliseCompletion(res.data ?? {}) };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      if (status === 410) {
        return { status: 'expired', message: textOrNull((error.response?.data as { message?: unknown } | undefined)?.message) };
      }
      if (status === 404) return { status: 'missing' };
    }
    return { status: 'error' };
  }
}

/**
 * Loads a desk-started registration by its link token, to pre-fill the form.
 * Returns null when the link is unknown, used or expired (the server gives one
 * answer for all three).
 */
export async function openCompletion(token: string): Promise<CompletionOpen | null> {
  try {
    const res = await publicClient.get<CompletionOpen>(
      `/api/public/intake/complete/${encodeURIComponent(token)}`,
    );
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Submits the intake. With `completionToken` it finishes a desk-started
 * registration (writes onto that patient); without it, it is the anonymous
 * public form.
 */
export async function submitIntake(
  request: IntakeRequest,
  completionToken?: string,
): Promise<IntakeResponse> {
  const url = completionToken
    ? `/api/public/intake/complete/${encodeURIComponent(completionToken)}`
    : '/api/public/intake';
  try {
    const response = await publicClient.post<IntakeResponse | { referenceNumber: string }>(url, request, {
      headers: { 'Idempotency-Key': getIdempotencyKey() },
    });
    if (completionToken) {
      // The completion endpoint now returns the appointment the desk booked plus
      // a freshly-minted manage token, so the confirmation screen can show the
      // time and offer "Přidat do kalendáře" / "Správa rezervace" -- exactly like
      // the online booking flow. All appointment fields are null when the patient
      // had no upcoming appointment; the screen then just shows a reference number
      // (and never "Invalid Date", because the guards key off appointmentStartUtc).
      const data = response.data as {
        referenceNumber?: string;
        manageToken?: string | null;
        appointmentId?: string | null;
        appointmentStartUtc?: string | null;
        appointmentEndUtc?: string | null;
        portalToken?: string | null;
      };
      return {
        referenceNumber: data.referenceNumber ?? '',
        outcome: IntakeOutcome.Created,
        manageToken: data.manageToken ?? null,
        confirmationEmailExpected: false,
        appointmentId: data.appointmentId ?? null,
        appointmentStartUtc: data.appointmentStartUtc ?? null,
        appointmentEndUtc: data.appointmentEndUtc ?? null,
        bookingFailed: false,
        portalToken: data.portalToken ?? null,
      };
    }
    return response.data as IntakeResponse;
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
