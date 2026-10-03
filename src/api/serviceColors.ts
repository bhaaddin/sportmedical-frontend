/* ══════════════════════════════════════════════════════════════
   The colour palette (Etapa 2, contract C1).

     GET/PUT /api/v1/settings/service-colors   { palette: string[] }

   At least six colours, each #RRGGBB. A new služba is coloured from it
   automatically (on the server); a činnost gets a shade of its služba's colour.
   ══════════════════════════════════════════════════════════════ */

import { client } from './client';

export interface ServiceColorSettings {
  palette: string[];
}

export const SERVICE_COLORS_QUERY_KEY = ['settings', 'service-colors'] as const;

/** The smallest palette the server accepts (contract C1). */
export const MIN_PALETTE_SIZE = 6;

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeServiceColors(raw: unknown): ServiceColorSettings {
  const b = (raw ?? {}) as { palette?: unknown };
  return {
    palette: Array.isArray(b.palette) ? b.palette.filter((c): c is string => typeof c === 'string') : [],
  };
}

export const serviceColorsApi = {
  get: async (): Promise<ServiceColorSettings> => {
    const { data } = await client.get('/api/v1/settings/service-colors');
    return normalizeServiceColors(data);
  },
  put: async (settings: ServiceColorSettings): Promise<ServiceColorSettings> => {
    const { data } = await client.put('/api/v1/settings/service-colors', settings);
    return normalizeServiceColors(data);
  },
};
