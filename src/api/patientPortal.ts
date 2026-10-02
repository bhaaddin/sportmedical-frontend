/* ══════════════════════════════════════════════════════════════
   PATIENT PORTAL API CLIENT

   Two calls, two audiences:
   - openPortal(token): anonymous. A patient opens their personal link and sees
     their own dashboard. No account, no bearer — the token IS the identity, the
     same model as the manage and completion links.
   - issuePortalLink(patientId): staff. The desk issues (or re-issues) a patient's
     personal portal link. Uses the shared authenticated client.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import client from './client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/** Anonymous client — no bearer, no redirect to /login. */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

publicClient.interceptors.response.use((res) => {
  if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
    res.data = res.data.data;
  }
  return res;
});

export interface PortalAppointment {
  /** The appointment, for cancelling it from the portal. */
  id: string;
  activityName: string;
  startUtc: string;
  endUtc: string;
  status: string;
  /**
   * Until when the patient may still cancel it themselves (the clinic's deadline,
   * worked out by the server); null when they no longer can, or it is over.
   */
  cancelUntilUtc: string | null;
}

export interface PortalDocument {
  id: string;
  title: string;
  /** When the clinic released it to the patient. */
  issuedAtUtc: string;
}

export interface PortalInvoice {
  number: string;
  issuedAtUtc: string;
  dueAtUtc: string;
  totalCzk: number;
  paidCzk: number;
  remainingCzk: number;
  status: string;
}

export interface PortalDashboard {
  givenName: string;
  familyName: string;
  appointments: PortalAppointment[];
  pastAppointments: PortalAppointment[];
  documents: PortalDocument[];
  /** May be absent when reached through an older API; treat undefined as none. */
  invoices?: PortalInvoice[];
  /**
   * Whether the patient has set a password, so they can sign in by e-mail
   * instead of by link. Absent on an older API — read as false.
   */
  hasPassword?: boolean;
  /** The e-mail they sign in with. Absent on an older API — read as null. */
  email?: string | null;
  /**
   * The questionnaire's state for the next visit, when the API sends it:
   * 'Missing' (not filled in), 'Complete', or 'NotRequired'. Absent otherwise.
   */
  questionnaireStatus?: 'Missing' | 'Complete' | 'NotRequired' | null;
}

/** The patient's own dashboard, or null for an unknown/revoked token. */
export async function openPortal(token: string): Promise<PortalDashboard | null> {
  try {
    const res = await publicClient.get<PortalDashboard>(
      `/api/patient-portal/${encodeURIComponent(token)}`,
    );
    return res.data;
  } catch {
    return null;
  }
}

/* ── Signing in by e-mail and password ── */

/** Where the browser keeps the portal token between pages of one tab. */
export const PORTAL_TOKEN_KEY = 'sm-portal-token';

/**
 * sessionStorage, not localStorage: the portal is the patient's medical
 * record, and a shared computer must forget it when the tab closes. Every
 * read and write is guarded — a private window or blocked storage must not
 * cost anybody the page.
 */
export function rememberPortalToken(token: string): void {
  try {
    window.sessionStorage.setItem(PORTAL_TOKEN_KEY, token);
  } catch {
    /* storage refused — the URL still carries the token */
  }
}

export function readPortalToken(): string | null {
  try {
    const token = window.sessionStorage.getItem(PORTAL_TOKEN_KEY);
    return token !== null && token.trim() !== '' ? token : null;
  } catch {
    return null;
  }
}

export function forgetPortalToken(): void {
  try {
    window.sessionStorage.removeItem(PORTAL_TOKEN_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** A sign-in or password call the server refused, with its status and message. */
export class PortalAuthError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PortalAuthError';
    this.status = status;
  }
}

/**
 * What the patient is told for each refusal of the sign-in form.
 *
 * 401 is always the same neutral sentence — it must not say which of the two
 * fields was wrong. 423 (locked) and 409 (no password yet / conflict) carry the
 * server's own sentence, because only it knows the time or the reason. 429 is
 * the rate limiter.
 */
export function portalSignInMessage(status: number, serverMessage: string | undefined): string {
  const said = serverMessage?.trim() ?? '';
  switch (status) {
    case 401:
      return 'Neplatné přihlašovací údaje.';
    case 423:
      return said !== '' ? said : 'Účet je dočasně uzamčen. Zkuste to prosím později.';
    case 409:
      return said !== '' ? said : 'K tomuto účtu zatím není nastavené heslo. Použijte odkaz, který jste dostali.';
    case 429:
      return 'Příliš mnoho pokusů. Zkuste to prosím za chvíli znovu.';
    case 0:
      return 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.';
    default:
      return said !== '' ? said : 'Přihlášení se nepodařilo. Zkuste to prosím znovu.';
  }
}

const toAuthError = (error: unknown, fallback: string): PortalAuthError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as { message?: string } | undefined;
    return new PortalAuthError(data?.message?.trim() || fallback, status);
  }
  return new PortalAuthError(fallback, 0);
};

/**
 * Signs in with e-mail and password; resolves to the portal token. Refusals
 * arrive as PortalAuthError carrying the HTTP status for portalSignInMessage.
 */
export async function portalLogin(email: string, password: string): Promise<string> {
  try {
    const res = await publicClient.post<{ token: string }>('/api/patient-portal/login', {
      email: email.trim(),
      password,
    });
    const token = res.data?.token;
    if (typeof token !== 'string' || token === '') {
      throw new PortalAuthError('Přihlášení se nepodařilo. Zkuste to prosím znovu.', 500);
    }
    return token;
  } catch (error) {
    if (error instanceof PortalAuthError) throw error;
    throw toAuthError(error, 'Přihlášení se nepodařilo. Zkuste to prosím znovu.');
  }
}

/** Sets the first password for the patient behind this token. */
export async function setPortalPassword(token: string, password: string): Promise<void> {
  try {
    await publicClient.post(`/api/patient-portal/${encodeURIComponent(token)}/password`, { password });
  } catch (error) {
    throw toAuthError(error, 'Heslo se nepodařilo nastavit.');
  }
}

/** Replaces the password; the current one is required. */
export async function changePortalPassword(
  token: string,
  currentPassword: string,
  password: string,
): Promise<void> {
  try {
    await publicClient.post(`/api/patient-portal/${encodeURIComponent(token)}/password`, {
      currentPassword,
      password,
    });
  } catch (error) {
    throw toAuthError(error, 'Heslo se nepodařilo změnit.');
  }
}

/** Revokes every portal session of this patient, this one included. */
export async function signOutEverywhere(token: string): Promise<void> {
  try {
    await publicClient.post(`/api/patient-portal/${encodeURIComponent(token)}/sign-out-everywhere`);
  } catch (error) {
    throw toAuthError(error, 'Odhlášení se nepodařilo.');
  }
}

/**
 * Where a released document opens for this token. A plain link rather than a
 * fetch: the browser shows the PDF or image itself, and the token in the path is
 * the identity, exactly as for the dashboard. The server answers 404 for anything
 * the token's patient was not given.
 */
export function portalDocumentUrl(token: string, documentId: string): string {
  return `${API_BASE}/api/patient-portal/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}`;
}

/** A portal cancellation the server refused, with its own Czech message. */
export class PortalCancelError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PortalCancelError';
    this.status = status;
  }
}

/**
 * Cancels one of the patient's own upcoming appointments from the portal (15.05).
 * The server applies the same deadline the manage link does; a refusal arrives as
 * PortalCancelError with the server's message (too late, not found).
 */
export async function cancelPortalAppointment(token: string, appointmentId: string): Promise<void> {
  try {
    await publicClient.post(
      `/api/patient-portal/${encodeURIComponent(token)}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data as { message?: string } | undefined;
      throw new PortalCancelError(data?.message ?? 'Termín se nepodařilo zrušit.', error.response.status);
    }
    throw error;
  }
}

/** Issues (or re-issues) a patient's personal portal token; returns it once. */
export async function issuePortalLink(patientId: string): Promise<string> {
  const res = await client.post<{ token: string }>(
    `/api/v1/patients/${patientId}/portal-link`,
    {},
  );
  return res.data.token;
}
