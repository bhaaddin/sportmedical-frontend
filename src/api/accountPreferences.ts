/* ══════════════════════════════════════════════════════════════
   Můj účet — the theme and the workspace, stored on the account.

     GET /api/v1/account/preferences   what was chosen + the catalogue
     PUT /api/v1/account/preferences   { theme?, workspace? } — a field
                                       left out keeps its value

   The catalogue (key, Czech label, one sentence of help) is the server's;
   the screen draws it rather than keeping a copy of its own.
   ══════════════════════════════════════════════════════════════ */
import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import type { AccountPreferences } from '../auth/preferences';

export interface PreferenceChoice {
  key: string;
  label: string;
  help: string;
}

export interface AccountPreferencesResponse {
  preferences: AccountPreferences;
  themes: PreferenceChoice[];
  workspaces: PreferenceChoice[];
}

export const readAccountPreferences = async (): Promise<AccountPreferencesResponse> => {
  const { data } = await client.get<AccountPreferencesResponse>('/api/v1/account/preferences');
  return data;
};

export const saveAccountPreferences = async (
  change: Partial<AccountPreferences>,
): Promise<AccountPreferencesResponse> => {
  const { data } = await client.put<AccountPreferencesResponse>('/api/v1/account/preferences', change);
  return data;
};

export const ACCOUNT_PREFERENCES_QUERY_KEY = ['account', 'preferences'] as const;

export function useAccountPreferences(enabled = true) {
  return useQuery({
    queryKey: ACCOUNT_PREFERENCES_QUERY_KEY,
    queryFn: readAccountPreferences,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
