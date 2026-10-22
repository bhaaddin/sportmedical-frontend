/* ══════════════════════════════════════════════════════════════
   EXPORTS (R14f) - may this person save files out of the system?

   GET  /api/v1/exports/policy      { allowed }   the caller's `exports.download`
   POST /api/v1/exports/authorize   { kind, count }  204 | 403 { code: 'export.forbidden' }
                                    for files the browser builds itself; writes the audit row
                                    `export.downloaded` (kind and size, never the content)

   An OLDER backend has neither route (404): the feature is then "unsupported" and nothing is hidden or blocked,
   because the server that would refuse does not exist yet. A newer server always has the last word.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export type ExportPolicy = 'allowed' | 'forbidden' | 'unsupported';

/** The code a refused download carries (contract: docs/contracts/stage5b-contract.md). */
export const EXPORT_FORBIDDEN_CODE = 'export.forbidden';

/** What the screen says to a person who may not download. */
export const EXPORT_FORBIDDEN_MESSAGE = 'Stahování povoluje administrátor.';

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | undefined)?.response?.status;

export const exportsApi = {
  /** `unsupported` when the server does not know the route (an older backend). Other failures are thrown. */
  policy: async (): Promise<ExportPolicy> => {
    try {
      const { data } = await client.get<{ allowed?: boolean }>('/api/v1/exports/policy');
      return data?.allowed === true ? 'allowed' : 'forbidden';
    } catch (error) {
      const status = statusOf(error);
      if (status === 404 || status === 405) return 'unsupported';
      throw error;
    }
  },

  /**
   * Asks before the browser saves a file it built itself. Resolves when the file may be saved (also on an older
   * backend); rejects with the server's 403 when it may not.
   */
  authorize: async (kind: string, count: number): Promise<void> => {
    try {
      await client.post('/api/v1/exports/authorize', { kind, count: Math.max(0, Math.round(count)) });
    } catch (error) {
      const status = statusOf(error);
      if (status === 404 || status === 405) return;
      throw error;
    }
  },
};
