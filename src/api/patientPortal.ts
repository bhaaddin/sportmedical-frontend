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
  activityName: string;
  startUtc: string;
  endUtc: string;
  status: string;
}

export interface PortalDocument {
  id: string;
  title: string;
  issuedAtUtc: string;
}

export interface PortalDashboard {
  givenName: string;
  familyName: string;
  appointments: PortalAppointment[];
  documents: PortalDocument[];
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

/** Issues (or re-issues) a patient's personal portal token; returns it once. */
export async function issuePortalLink(patientId: string): Promise<string> {
  const res = await client.post<{ token: string }>(
    `/api/v1/patients/${patientId}/portal-link`,
    {},
  );
  return res.data.token;
}
