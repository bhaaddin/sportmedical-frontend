import client from './client';
import { toBookingError } from './apiError';

/*
 * Clubs and corporate payers - `/api/clubs`.
 *
 * Replaces `src/services/clubsApi.ts` for the Kluby a týmy screen. That module
 * built its URL as `${VITE_API_BASE_URL || '/api'}/clubs`: with the variable
 * empty (the dev proxy) it asked `/api/clubs` and worked; with the variable set
 * to the API's origin - which is what a build served from Vercel needs, because
 * `vercel.json` rewrites every path to `index.html` and proxies nothing - it
 * asked `https://<api>/clubs`, a route that does not exist, and the whole page
 * said "Kluby se nepodařilo načíst". Every other module in `src/api` writes the
 * path as `/api/...` and lets the client's `baseURL` carry the origin, so this
 * one does the same (3. 10. 2026).
 */

export interface Club {
  id: string;
  name: string;
  ico: string;
  dic?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  bankAccount?: string | null;
  bankCode?: string | null;
  iban?: string | null;
  paymentTermsDays: number;
  /**
   * The administrator's discount for this club (3. 10. 2026): 0–100, two
   * decimals at most, `null` for none. Nothing derives it from a headcount.
   */
  discountPercent?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toBookingError(error);
  }
}

/**
 * The list, whatever envelope it comes in. The controller answers a bare
 * array; an older build answered `{ value: [...] }` and the ApiResult wrapper
 * is unwrapped by the client. Anything else is "no clubs", not a crash.
 */
function asClubList(data: unknown): Club[] {
  if (Array.isArray(data)) return data as Club[];
  if (data && typeof data === 'object') {
    const inner = (data as { value?: unknown; items?: unknown }).value ?? (data as { items?: unknown }).items;
    if (Array.isArray(inner)) return inner as Club[];
  }
  return [];
}

export const clubsApi = {
  getAll: (activeOnly = false): Promise<Club[]> =>
    request(async () => {
      const res = await client.get('/api/clubs', { params: { activeOnly } });
      return asClubList(res.data);
    }),

  getById: (id: string): Promise<Club> =>
    request(async () => {
      const res = await client.get(`/api/clubs/${id}`);
      return res.data as Club;
    }),

  create: (data: Partial<Club>): Promise<Club> =>
    request(async () => {
      const res = await client.post('/api/clubs', data);
      return res.data as Club;
    }),

  update: (id: string, data: Partial<Club>): Promise<Club> =>
    request(async () => {
      const res = await client.put(`/api/clubs/${id}`, data);
      return res.data as Club;
    }),

  /** `DELETE` deactivates; the record and its orders stay. */
  deactivate: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/clubs/${id}`);
    }),
};

export default clubsApi;
