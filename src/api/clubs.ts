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
  /**
   * The club's own colour (C4), stable per club and chosen by the server from
   * its palette. Absent on a server that does not send it: the screens then
   * take the colour from the club's blocks, or draw the neutral chip.
   */
  colorHex?: string | null;
  /**
   * Vedení klubu (Etapa 12): the statutory body as ARES lists it (`source:
   * "ares"`) and the people the desk adds by hand (`source: "manual"`). Sent
   * whole on create/update; the server replaces the list. Absent on a server
   * that does not send it, which the reader turns into an empty list.
   */
  management?: ClubManager[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export type ClubManagerSource = 'ares' | 'manual';

export interface ClubManager {
  id?: string;
  fullName: string;
  role: string;
  phone: string | null;
  email: string | null;
  source: ClubManagerSource;
}

/** The management list, tolerant: not an array → nobody; a row without a name is skipped; an unknown source is manual. */
export function readClubManagement(data: unknown): ClubManager[] {
  if (!Array.isArray(data)) return [];
  const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const out: ClubManager[] = [];
  for (const row of data) {
    const m = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const fullName = text(m.fullName);
    if (fullName === null) continue;
    out.push({
      ...(typeof m.id === 'string' ? { id: m.id } : {}),
      fullName,
      role: text(m.role) ?? '',
      phone: text(m.phone),
      email: text(m.email),
      source: m.source === 'ares' ? 'ares' : 'manual',
    });
  }
  return out;
}

/** A club as the screens expect it: `management` is always a list. */
const withManagement = (club: Club): Club => ({ ...club, management: readClubManagement(club.management) });

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
  if (Array.isArray(data)) return (data as Club[]).map(withManagement);
  if (data && typeof data === 'object') {
    const inner = (data as { value?: unknown; items?: unknown }).value ?? (data as { items?: unknown }).items;
    if (Array.isArray(inner)) return (inner as Club[]).map(withManagement);
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
      return withManagement(res.data as Club);
    }),

  create: (data: Partial<Club>): Promise<Club> =>
    request(async () => {
      const res = await client.post('/api/clubs', data);
      return withManagement(res.data as Club);
    }),

  update: (id: string, data: Partial<Club>): Promise<Club> =>
    request(async () => {
      const res = await client.put(`/api/clubs/${id}`, data);
      return withManagement(res.data as Club);
    }),

  /** `DELETE` deactivates; the record and its orders stay. */
  deactivate: (id: string): Promise<void> =>
    request(async () => {
      await client.delete(`/api/clubs/${id}`);
    }),
};

/* ── Settings of the club blocks - `GET/PUT /api/v1/settings/clubs` (C4) ── */

export interface ClubSettings {
  /** How many days a club's registration link stays valid. */
  registrationLinkValidityDays: number;
  /**
   * Below this a block is only warned about - informational, never refused.
   * `null` = no minimum (the default); there is no number in code.
   */
  minimumPlayers: number | null;
  /**
   * Etapa 4 (D4): how many days before a club order's window starts the part of it
   * that the order does not need is opened to the public. `null` = never (default).
   */
  releaseUnusedDaysBefore: number | null;
  /** Etapa 4 (D2): one club order may hold more than one služba. Off by default. */
  allowMultiServiceOrders: boolean;
  /** Owned by the palette settings; carried through untouched so a save here cannot wipe it. */
  blockPalette?: unknown;
}

export const CLUB_SETTINGS_QUERY_KEY = ['settings', 'clubs'] as const;

function toClubSettings(data: unknown): ClubSettings {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    registrationLinkValidityDays: num(r.registrationLinkValidityDays, 14),
    minimumPlayers: typeof r.minimumPlayers === 'number' && Number.isFinite(r.minimumPlayers) ? r.minimumPlayers : null,
    releaseUnusedDaysBefore:
      typeof r.releaseUnusedDaysBefore === 'number' && Number.isFinite(r.releaseUnusedDaysBefore) ? r.releaseUnusedDaysBefore : null,
    allowMultiServiceOrders: r.allowMultiServiceOrders === true,
    ...(r.blockPalette !== undefined ? { blockPalette: r.blockPalette } : {}),
  };
}

export const clubSettingsApi = {
  get: (): Promise<ClubSettings> =>
    request(async () => {
      const res = await client.get('/api/v1/settings/clubs');
      return toClubSettings(res.data);
    }),

  /** A refused value comes back `400` with `errors: { field: [sentence] }`; the caller reads it off the error. */
  put: async (settings: ClubSettings): Promise<ClubSettings> => {
    const res = await client.put('/api/v1/settings/clubs', settings);
    return toClubSettings(res.data);
  },
};

export default clubsApi;
