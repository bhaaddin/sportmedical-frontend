import client from '../../api/client';

/*
 * GET/PUT /api/v1/settings/integrations (contract C5).
 *
 *   { adam: { enabled, baseUrl, username, hasPassword, password? (write-only) },
 *     medistar: { status: "retired" } }
 *
 * Stored only - nothing here (or on the server) calls ADAM. The password goes
 * out on a PUT when somebody typed one and never comes back: a read says only
 * `hasPassword`.
 */
export interface AdamSettings {
  enabled: boolean;
  baseUrl: string;
  username: string;
  hasPassword: boolean;
}

export interface IntegrationsSettings {
  adam: AdamSettings;
  medistar: { status: string };
}

export interface AdamUpdate {
  enabled: boolean;
  baseUrl: string;
  username: string;
  /** Only when changed - leaving it out keeps the stored one. */
  password?: string;
}

function parse(data: unknown): IntegrationsSettings {
  const root = data !== null && typeof data === 'object' && 'value' in data ? (data as { value: unknown }).value : data;
  const r = (root ?? {}) as { adam?: Partial<AdamSettings>; medistar?: { status?: string } };
  if (root === null || typeof root !== 'object' || r.adam === undefined) {
    throw new Error('unexpected integrations');
  }
  return {
    adam: {
      enabled: r.adam.enabled === true,
      baseUrl: r.adam.baseUrl ?? '',
      username: r.adam.username ?? '',
      hasPassword: r.adam.hasPassword === true,
    },
    medistar: { status: r.medistar?.status ?? 'retired' },
  };
}

export const integrationsApi = {
  get: async (): Promise<IntegrationsSettings> => {
    const res = await client.get('/api/v1/settings/integrations');
    return parse(res.data);
  },
  save: async (adam: AdamUpdate): Promise<IntegrationsSettings> => {
    const res = await client.put('/api/v1/settings/integrations', { adam });
    return parse(res.data);
  },
};

/** The server's own words for a refusal, else a fixed Czech sentence - never the raw exception. */
export function integrationsErrorText(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  if (data !== null && typeof data === 'object') {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return fallback;
}
