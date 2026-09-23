import { client } from './client';

export interface ServiceItem {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCzk: number;
  isActive: boolean;
}

export interface ServiceItemInput {
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  priceCzk: number;
  isActive: boolean;
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
    return unwrap<ServiceItem[]>(res.data) ?? [];
  },

  getById: async (id: string): Promise<ServiceItem> => {
    const res = await client.get(`/api/services/${id}`);
    return unwrap<ServiceItem>(res.data);
  },

  /* `isActive` is not in the create contract - a new service is always active -
     so it is dropped here rather than sent and silently ignored. */
  create: async (input: ServiceItemInput): Promise<ServiceItem> => {
    const { isActive: _unused, ...body } = input;
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
