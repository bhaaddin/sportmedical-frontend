/* ══════════════════════════════════════════════════════════════
   The clinic's marketing-consent choices.

   The intake form used to have the marketing consent's wording written into
   it, always shown. The owner's rule is that this one — the consent that is
   genuinely the clinic's own, never required and pointless for a clinic that
   sends no newsletters — is theirs to word and to switch off in Nastavení.

   The legally required consents (treatment, and the per-činnost report/club
   ones) are NOT here: a clinic cannot word away a legal duty or a činnost's
   own rule, so they stay in the form.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { client } from './client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/*
 * A tokenless client, the same reason publicBooking has one: the intake form is
 * used by somebody with no account, who must never be bounced to a staff login.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

interface ApiResult<T> {
  success: boolean;
  data: T | null;
  message?: string;
}

export interface ConsentSettings {
  communicationVisible: boolean;
  communicationTitle: string;
  communicationDetail: string;
}

/**
 * The wording the form has always shown, so a lost request still asks the
 * marketing consent the way it did rather than dropping it.
 */
export const CONSENT_SETTINGS_OFFLINE: ConsentSettings = {
  communicationVisible: true,
  communicationTitle: 'Novinky a nabídky',
  communicationDetail:
    'Souhlasím se zasíláním novinek a nabídek. Netýká se potvrzení a připomínek k vašemu termínu — ty vám pošleme tak jako tak.',
};

/** Read by the public form (tokenless), so it must not require a session. */
export const readConsentSettings = async (): Promise<ConsentSettings> => {
  const { data } = await publicClient.get<ApiResult<ConsentSettings>>('/api/v1/public/consent-settings');
  return data.data ?? CONSENT_SETTINGS_OFFLINE;
};

export const CONSENT_SETTINGS_QUERY_KEY = ['settings', 'consent'] as const;

/** The marketing-consent settings, or the offline values until (or unless) they arrive. */
export function useConsentSettings(): { settings: ConsentSettings; loaded: boolean } {
  const query = useQuery({
    queryKey: CONSENT_SETTINGS_QUERY_KEY,
    queryFn: readConsentSettings,
    staleTime: 5 * 60 * 1000,
  });

  return {
    settings: query.data ?? CONSENT_SETTINGS_OFFLINE,
    loaded: query.data !== undefined,
  };
}

/** Save, through the signed-in client — the server refuses without settings.clinic.manage. */
export const saveConsentSettings = async (settings: ConsentSettings): Promise<ConsentSettings> => {
  const { data } = await client.put<ConsentSettings>('/api/v1/settings/consent', settings);
  return data;
};
