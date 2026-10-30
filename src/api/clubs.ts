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
export const withManagement = (club: Club): Club => ({ ...club, management: readClubManagement(club.management) });

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

/* ── The clubs a patient belongs to - `GET /api/clubs/by-patient/{patientId}` (patients.view), active first ── */
export interface PatientClubMembership {
  memberId: string;
  clubId: string;
  clubName: string;
  memberNumber: string | null;
  position: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  isActive: boolean;
}

const orNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** Rows without a club id are left out; anything that is not a list is "no clubs". */
export function readPatientClubs(data: unknown): PatientClubMembership[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((raw): PatientClubMembership[] => {
    if (raw === null || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.clubId !== 'string' || r.clubId === '') return [];
    return [{
      memberId: typeof r.memberId === 'string' ? r.memberId : `${r.clubId}`,
      clubId: r.clubId,
      clubName: orNull(r.clubName) ?? 'Klub',
      memberNumber: orNull(r.memberNumber),
      position: orNull(r.position),
      joinedAt: orNull(r.joinedAt),
      leftAt: orNull(r.leftAt),
      isActive: r.isActive !== false,
    }];
  });
}

export const patientClubsApi = {
  byPatient: async (patientId: string): Promise<PatientClubMembership[]> =>
    readPatientClubs((await client.get(`/api/clubs/by-patient/${encodeURIComponent(patientId)}`)).data),
};

/* ── Summaries of many clubs in one call - `GET /api/v1/clubs/summaries?clubIds=a,b,c` ──
 *
 * The club list used to ask `/api/v1/clubs/{id}/summary` once per card. The batch route answers an ARRAY of exactly
 * what the single route answers, in the order asked. A server that does not have it yet answers 404 / 405: that is
 * detected once, remembered for the rest of the session, and the callers go back to one request per club.
 */

/** How many ids go into one call (a GUID is 37 characters with its comma; the server takes 500, a URL far fewer). */
export const CLUB_SUMMARIES_CHUNK = 100;

/** `null` = not asked yet, `true` = the route answered, `false` = the server has no such route. */
let summariesRoute: boolean | null = null;

/** Test hook. */
export function resetClubSummariesRouteForTests(): void {
  summariesRoute = null;
}

/** Whether this session already learned that the server has no batch route. */
export const clubSummariesRouteMissing = (): boolean => summariesRoute === false;

const statusOf = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } } | null)?.response?.status;

/** The answer as a list, whatever envelope it comes in; anything else is "no answer". */
function asSummaryList(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const r = data as { data?: unknown; value?: unknown; items?: unknown };
    for (const inner of [r.data, r.value, r.items]) if (Array.isArray(inner)) return inner;
  }
  return null;
}

export const clubSummariesApi = {
  /**
   * The summaries of these clubs, raw (callers normalize them), one list in the order asked - or `null` when the
   * server has no batch route (404 / 405; remembered, so the next call answers `null` without a request). Any other
   * failure is thrown and not remembered.
   */
  fetch: async (clubIds: string[]): Promise<unknown[] | null> => {
    if (summariesRoute === false) return null;
    if (clubIds.length === 0) return [];

    const chunks: string[][] = [];
    for (let i = 0; i < clubIds.length; i += CLUB_SUMMARIES_CHUNK) chunks.push(clubIds.slice(i, i + CLUB_SUMMARIES_CHUNK));

    try {
      const answers = await Promise.all(
        chunks.map(async (ids) => {
          const res = await client.get('/api/v1/clubs/summaries', { params: { clubIds: ids.join(',') } });
          return asSummaryList(res.data);
        }),
      );
      /* A 200 that is not a list (a static fallback page) is not the batch route either. */
      if (answers.some((a) => a === null)) {
        summariesRoute = false;
        return null;
      }
      summariesRoute = true;
      return answers.flatMap((a) => a ?? []);
    } catch (error) {
      const status = statusOf(error);
      if (status === 404 || status === 405) {
        summariesRoute = false;
        return null;
      }
      throw error;
    }
  },
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
  /**
   * Stage 2, R13 (`clubHold.holdUntilDaysBefore`): a club's held time that nobody filled is flagged "Hold vypršel" this many days before
   * its day (0 = never; the server's default is 7, range 0-365). `undefined` = the server does not have the setting (an older build): the
   * field is hidden. A PUT that leaves it out keeps the stored value.
   */
  holdUntilDaysBefore?: number;
  /** Owned by the palette settings; carried through untouched so a save here cannot wipe it. */
  blockPalette?: unknown;
  /**
   * The sentence parents read about who pays when the club is invoiced / when each parent pays.
   * `null` = the clinic has written none and the default below is shown. On a PUT `null` KEEPS the
   * stored sentence and `""` clears it (measured on the dev API), so the screen sends text or "".
   */
  payerTextClubInvoice?: string | null;
  payerTextPerPerson?: string | null;
  /** The sentences used while the two above are empty - the server's, shown as the placeholder. */
  defaultPayerTextClubInvoice?: string;
  defaultPayerTextPerPerson?: string;
}

export const CLUB_SETTINGS_QUERY_KEY = ['settings', 'clubs'] as const;

export function toClubSettings(data: unknown): ClubSettings {
  const r = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  return {
    registrationLinkValidityDays: num(r.registrationLinkValidityDays, 14),
    minimumPlayers: typeof r.minimumPlayers === 'number' && Number.isFinite(r.minimumPlayers) ? r.minimumPlayers : null,
    releaseUnusedDaysBefore:
      typeof r.releaseUnusedDaysBefore === 'number' && Number.isFinite(r.releaseUnusedDaysBefore) ? r.releaseUnusedDaysBefore : null,
    allowMultiServiceOrders: r.allowMultiServiceOrders === true,
    ...(typeof r.holdUntilDaysBefore === 'number' && Number.isFinite(r.holdUntilDaysBefore) ? { holdUntilDaysBefore: r.holdUntilDaysBefore } : {}),
    payerTextClubInvoice: typeof r.payerTextClubInvoice === 'string' && r.payerTextClubInvoice.trim() !== '' ? r.payerTextClubInvoice : null,
    payerTextPerPerson: typeof r.payerTextPerPerson === 'string' && r.payerTextPerPerson.trim() !== '' ? r.payerTextPerPerson : null,
    defaultPayerTextClubInvoice: typeof r.defaultPayerTextClubInvoice === 'string' ? r.defaultPayerTextClubInvoice : '',
    defaultPayerTextPerPerson: typeof r.defaultPayerTextPerPerson === 'string' ? r.defaultPayerTextPerPerson : '',
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
