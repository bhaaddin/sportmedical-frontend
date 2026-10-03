import { client } from './client';

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCzk: number;
  /** Optional crossed-out list price shown on the web next to `priceCzk`; absent/null = none. */
  listPriceCzk?: number | null;
  isActive: boolean;
}

export interface ServiceItemInput {
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCzk: number;
  /** Omitted keeps the stored value; an explicit `null` clears it. */
  listPriceCzk?: number | null;
  isActive: boolean;
}

/** Tolerant: only a finite number above zero is a list price; anything else is "none". */
export function normalizeListPrice(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
}

/* The server answers `{ value: … }` on some routes and the bare body on
   others; both shapes are unwrapped rather than guessed at. */
function unwrap<T>(data: unknown): T {
  const body = data as { value?: T } | T;
  return (body as { value?: T })?.value ?? (body as T);
}

export const servicesApi = {
  getAll: async (): Promise<ServiceItem[]> => {
    const res = await client.get('/api/services');
    const items = unwrap<ServiceItem[]>(res.data) ?? [];
    return Array.isArray(items)
      ? items.map((item) => ({ ...item, listPriceCzk: normalizeListPrice((item as { listPriceCzk?: unknown }).listPriceCzk) }))
      : [];
  },

  /* `isActive` is not in the create contract - a new service is always active -
     so it is dropped here rather than sent and silently ignored. */
  create: async (input: ServiceItemInput): Promise<ServiceItem> => {
    const { isActive: _unused, listPriceCzk, ...rest } = input;
    /* A new row with no list price simply omits the key. */
    const body = listPriceCzk === null || listPriceCzk === undefined ? rest : { ...rest, listPriceCzk };
    const res = await client.post('/api/services', body);
    return unwrap<ServiceItem>(res.data);
  },

  update: async (id: string, input: ServiceItemInput): Promise<ServiceItem> => {
    const res = await client.put(`/api/services/${id}`, input);
    return unwrap<ServiceItem>(res.data);
  },

  /*
   * A soft archive, and a one-way door from this screen: the list route is
   * `GetActiveAsync`, so an archived service is never returned again and its
   * id cannot be found to bring it back. Whoever calls this has to say so
   * before doing it.
   */
  archive: async (id: string): Promise<void> => {
    await client.delete(`/api/services/${id}`);
  },
};
