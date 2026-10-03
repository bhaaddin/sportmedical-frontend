/* ══════════════════════════════════════════════════════════════
   Quick registration — the clinic's own deadlines (Etapa 2, contract C2).

     GET/PUT /api/v1/settings/quick-registration
       { expiryHours (1–720), reminderHoursBeforeExpiry (0–expiryHours),
         requireDateOfBirthOnCompletion }

   The defaults (24 h, 4 h, off) live on the server; this module keeps none.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface QuickRegistrationSettings {
  expiryHours: number;
  reminderHoursBeforeExpiry: number;
  requireDateOfBirthOnCompletion: boolean;
}

export const QUICK_REGISTRATION_QUERY_KEY = ['settings', 'quick-registration'] as const;

export function normalizeQuickRegistration(raw: unknown): QuickRegistrationSettings {
  const b = (raw ?? {}) as Record<string, unknown>;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    expiryHours: n(b.expiryHours),
    reminderHoursBeforeExpiry: n(b.reminderHoursBeforeExpiry),
    requireDateOfBirthOnCompletion: b.requireDateOfBirthOnCompletion === true,
  };
}

export const quickRegistrationSettingsApi = {
  get: async (): Promise<QuickRegistrationSettings> => {
    const { data } = await client.get('/api/v1/settings/quick-registration');
    return normalizeQuickRegistration(data);
  },
  put: async (settings: QuickRegistrationSettings): Promise<QuickRegistrationSettings> => {
    const { data } = await client.put('/api/v1/settings/quick-registration', settings);
    return normalizeQuickRegistration(data);
  },
};
