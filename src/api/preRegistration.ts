/* ══════════════════════════════════════════════════════════════
   PŘEDREGISTRACE — the desk's quick path and the completion link.

   Backed by Api/Controllers/PatientPreRegistrationController.cs (staff) and
   Api/Controllers/IntakeLinkSettingsController.cs (Nastavení):

     POST /api/patients/pre-registrations            patients.register
     POST /api/patients/{id}/registration-link       patients.register
     GET  /api/patients/{id}/registration-link       patients.view
     GET  /api/v1/settings/intake-link               patients.register
     PUT  /api/v1/settings/intake-link               settings.clinic.manage

   Four facts make a provisional patient; the link is issued after the booking
   so its e-mail can name the appointment. The plain token comes back exactly
   once — the server keeps only a hash — which is why the dialog shows it with
   a copy button and never asks for it again.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import client from './client';
import type { RegistrationCandidate, RegistrationConfirmation, RegistrationOutcome } from './patientRegistry';

/* ── Pre-registration ── */

export interface PreRegisterPatientRequest {
  /** Minted by the screen and kept across a retry: a double click is one person. */
  patientId: string;
  firstName: string;
  lastName: string;
  /** ISO yyyy-MM-dd. */
  dateOfBirth: string;
  email: string;
  /** E.164, or null when the patient gave none. */
  phone: string | null;
  /** The second attempt after a candidate review, with the desk's decision. */
  confirmation?: RegistrationConfirmation;
}

/** The registry's answer — the same shape the full registration form gets. */
export interface PreRegistrationResult {
  outcome: RegistrationOutcome;
  patientId: string;
  registrationFingerprint: string;
  authorizationScopeFingerprint: string | null;
  candidateSetFingerprint: string | null;
  candidates: RegistrationCandidate[];
}

/* ── The link ── */

export interface IssuedRegistrationLink {
  intakeId: string;
  referenceNumber: string;
  /** Shown once. The server keeps a hash and cannot give it back. */
  token: string;
  /** `/dokonceni/{token}` — usable relative to whatever site this runs on. */
  path: string;
  /** The full address when the server knows the public site's address, else null. */
  url: string | null;
  expiresAtUtc: string;
  /** A message with the link waits in the outbox. */
  emailQueued: boolean;
  /** ... and a sender is configured to take it out. When false, hand the link over yourself. */
  emailWillSend: boolean;
  sentTo: string;
}

export type RegistrationLinkState = 'none' | 'pending' | 'expired' | 'completed';

export interface RegistrationLinkStatus {
  state: RegistrationLinkState;
  referenceNumber: string | null;
  issuedAtUtc: string | null;
  expiresAtUtc: string | null;
  completedAtUtc: string | null;
}

/**
 * What to paste into a message: the server's absolute address when it has
 * one, otherwise this site's origin plus the path. Never a bare path — a
 * bare path pasted into WhatsApp is not a link.
 */
export function shareableLink(link: Pick<IssuedRegistrationLink, 'url' | 'path'>, origin: string): string {
  if (link.url !== null && link.url !== '') return link.url;
  return origin.replace(/\/+$/, '') + link.path;
}

/* ── Settings ── */

export interface IntakeLinkSettings {
  completionDeadlineHours: number;
  emailSubject: string;
  emailBody: string;
}

export interface IntakeLinkPlaceholder {
  token: string;
  meaning: string;
}

export interface IntakeLinkSettingsResponse {
  settings: IntakeLinkSettings;
  placeholders: IntakeLinkPlaceholder[];
  minimumHours: number;
  maximumHours: number;
  defaults: IntakeLinkSettings;
}

/* ── Errors ── */

/**
 * A refusal in the shape the screens can put next to a field: the server's
 * own Czech sentence, the field it names, and the status that tells a review
 * (200 with candidates) from a conflict (409) from a mistake (400).
 */
export class PreRegistrationError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, status: number, code: string | null, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'PreRegistrationError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function toError(error: unknown, fallback: string): PreRegistrationError {
  if (!axios.isAxiosError(error)) {
    return new PreRegistrationError(fallback, 0, null);
  }

  const status = error.response?.status ?? 0;
  const payload = error.response?.data as
    | { code?: unknown; message?: unknown; errors?: unknown }
    | undefined;

  const fieldErrors: Record<string, string> = {};
  if (payload?.errors !== null && typeof payload?.errors === 'object') {
    for (const [field, messages] of Object.entries(payload.errors as Record<string, unknown>)) {
      if (Array.isArray(messages) && typeof messages[0] === 'string') fieldErrors[field] = messages[0];
    }
  }

  return new PreRegistrationError(
    typeof payload?.message === 'string' && payload.message.trim() !== ''
      ? payload.message
      : status === 0
        ? 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.'
        : fallback,
    status,
    typeof payload?.code === 'string' ? payload.code : null,
    fieldErrors,
  );
}

/* ── Calls ── */

export const preRegistrationApi = {
  async preRegister(request: PreRegisterPatientRequest): Promise<PreRegistrationResult> {
    try {
      const { data } = await client.post<PreRegistrationResult>('/api/patients/pre-registrations', request);
      return data;
    } catch (error) {
      throw toError(error, 'Předregistraci se nepodařilo uložit.');
    }
  },

  async issueLink(patientId: string): Promise<IssuedRegistrationLink> {
    try {
      const { data } = await client.post<IssuedRegistrationLink>(`/api/patients/${patientId}/registration-link`);
      return data;
    } catch (error) {
      throw toError(error, 'Odkaz se nepodařilo vygenerovat.');
    }
  },

  async linkStatus(patientId: string): Promise<RegistrationLinkStatus> {
    try {
      const { data } = await client.get<RegistrationLinkStatus>(`/api/patients/${patientId}/registration-link`);
      return data;
    } catch (error) {
      throw toError(error, 'Stav odkazu se nepodařilo načíst.');
    }
  },

  async readSettings(): Promise<IntakeLinkSettingsResponse> {
    const { data } = await client.get<IntakeLinkSettingsResponse>('/api/v1/settings/intake-link');
    return data;
  },

  async saveSettings(settings: IntakeLinkSettings): Promise<IntakeLinkSettingsResponse> {
    const { data } = await client.put<IntakeLinkSettingsResponse>('/api/v1/settings/intake-link', settings);
    return data;
  },
};

export const REGISTRATION_LINK_QUERY_KEY = (patientId: string) => ['registration-link', patientId] as const;

export default preRegistrationApi;
