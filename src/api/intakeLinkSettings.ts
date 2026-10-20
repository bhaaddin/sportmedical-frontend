/* ══════════════════════════════════════════════════════════════
   The registration link the desk sends a patient (pre-registration).

     GET/PUT /api/v1/settings/intake-link
       { settings: { completionDeadlineHours, emailSubject, emailBody, publicSiteBaseUrl },
         placeholders: [{ token, meaning }], minimumHours, maximumHours, defaults }

   The server has carried this since the pre-registration work and the link service reads it on every
   link it issues (how long it lives, what the e-mail says, which web address the link is built on) - but no
   screen reached it, so none of the four could be changed, and the desk was told "v Nastavení chybí adresa
   webu" with no such field anywhere. The bounds, the defaults and the placeholder list come from the server;
   this module keeps no copy of the rule.

   Read: patients.register. Write: settings.clinic.manage.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface IntakeLinkSettings {
  completionDeadlineHours: number;
  emailSubject: string;
  emailBody: string;
  publicSiteBaseUrl: string;
}

export interface IntakeLinkPlaceholder {
  token: string;
  meaning: string;
}

export interface IntakeLinkSettingsResponse {
  settings: IntakeLinkSettings;
  defaults: IntakeLinkSettings;
  placeholders: IntakeLinkPlaceholder[];
  minimumHours: number;
  maximumHours: number;
}

export const INTAKE_LINK_QUERY_KEY = ['settings', 'intake-link'] as const;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const count = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function settingsOf(raw: unknown): IntakeLinkSettings {
  const body = (raw ?? {}) as Record<string, unknown>;
  return {
    completionDeadlineHours: count(body.completionDeadlineHours, 0),
    emailSubject: text(body.emailSubject),
    emailBody: text(body.emailBody),
    publicSiteBaseUrl: text(body.publicSiteBaseUrl),
  };
}

/** An odd or short answer reads as empty settings and no placeholders, never as a thrown error mid-render. */
export function normalizeIntakeLink(raw: unknown): IntakeLinkSettingsResponse {
  const body = (raw ?? {}) as Record<string, unknown>;
  const placeholders = Array.isArray(body.placeholders)
    ? body.placeholders
        .map((p) => (p ?? {}) as Record<string, unknown>)
        .filter((p) => typeof p.token === 'string' && p.token !== '')
        .map((p) => ({ token: p.token as string, meaning: text(p.meaning) }))
    : [];

  return {
    settings: settingsOf(body.settings),
    defaults: settingsOf(body.defaults),
    placeholders,
    minimumHours: count(body.minimumHours, 1),
    maximumHours: count(body.maximumHours, 720),
  };
}

export const intakeLinkSettingsApi = {
  get: async (): Promise<IntakeLinkSettingsResponse> => {
    const { data } = await client.get('/api/v1/settings/intake-link');
    return normalizeIntakeLink(data);
  },
  put: async (settings: IntakeLinkSettings): Promise<IntakeLinkSettingsResponse> => {
    const { data } = await client.put('/api/v1/settings/intake-link', settings);
    return normalizeIntakeLink(data);
  },
};
