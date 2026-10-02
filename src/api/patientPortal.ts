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
