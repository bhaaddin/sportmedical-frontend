import { z } from 'zod';
import client from './client';
import { toBookingError } from './apiError';
import { parseResponse } from './bookingContracts';

/*
 * The audit trail, read by entity.
 *
 * `GET /api/audit/entity/{entity}/{id}` has existed (returning the masked
 * `AuditLogDto[]`), but nothing showed a *patient-scoped* history — staff could
 * see the global log, never "what happened to this one person." This client is
 * the read behind that view. Values come back already scrubbed by the server
 * (`AuditController.Scrub`), so a birth number cannot reach the screen.
 */

const auditEntrySchema = z.object({
  id: z.string(),
  userId: z.string().nullable().optional(),
  userEmail: z.string().nullable().optional(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  timestamp: z.string(),
  // Server-scrubbed; shape varies by action (string or a field map), so kept loose.
  oldValue: z.unknown().nullable().optional(),
  newValue: z.unknown().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const auditListSchema = z.array(auditEntrySchema);

export type AuditEntry = z.infer<typeof auditEntrySchema>;

/** Entity names the server audits under (`AuditTrail.AuditAllowlist`). */
export const AUDIT_ENTITY = {
  patient: 'Patient',
} as const;

export const auditApi = {
  /** Every recorded change to one entity, newest first as the server returns them. */
  listByEntity: (entity: string, entityId: string): Promise<AuditEntry[]> => {
    const run = async () => {
      const res = await client.get(
        `/api/audit/entity/${encodeURIComponent(entity)}/${encodeURIComponent(entityId)}`,
      );
      return parseResponse(auditListSchema, res.data);
    };
    return run().catch((error) => {
      // Not logged: an audit value could carry patient detail even scrubbed.
      throw toBookingError(error);
    });
  },
};

/* ── NET-09: the server-side search, the filter catalogue, the sensitive-access view and the CSV export ── */

export interface AuditSearchParams {
  user?: string;
  action?: string;
  entity?: string;
  /** Free text over notes and the recorded values. */
  search?: string;
  /** yyyy-MM-dd; the server reads them as the start / end of that day. */
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface AuditPage {
  items: AuditEntry[];
  /** `null` when the route does not count (the sensitive-access list): the caller then pages by "a full page means maybe more". */
  totalCount: number | null;
  page: number;
  pageSize: number;
}

export interface AuditCatalogue {
  actions: string[];
  entities: string[];
  users: string[];
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** The body, whether or not the interceptor already took the ApiResult envelope off. */
const bodyOf = (data: unknown): unknown => {
  if (data && typeof data === 'object' && !Array.isArray(data) && 'success' in data && 'data' in data) return (data as { data: unknown }).data;
  if (data && typeof data === 'object' && !Array.isArray(data) && 'value' in data) return (data as { value: unknown }).value;
  return data;
};

const clean = (params: Record<string, string | number | undefined>): Record<string, string | number> =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string | number>;

const toPage = (data: unknown, page: number, pageSize: number): AuditPage => {
  const body = bodyOf(data);
  if (Array.isArray(body)) return { items: auditListSchema.parse(body), totalCount: null, page, pageSize };
  const o = (body ?? {}) as { items?: unknown; totalCount?: unknown };
  return {
    items: auditListSchema.parse(Array.isArray(o.items) ? o.items : []),
    totalCount: typeof o.totalCount === 'number' ? o.totalCount : null,
    page,
    pageSize,
  };
};

export const auditSearchApi = {
  /** `GET /api/audit/search` - the server filters and pages. */
  search: async (p: AuditSearchParams): Promise<AuditPage> => {
    const res = await client.get('/api/audit/search', {
      params: clean({ user: p.user, action: p.action, entity: p.entity, search: p.search, from: p.from, to: p.to, page: p.page, pageSize: p.pageSize }),
    });
    return toPage(res.data, p.page, p.pageSize);
  },

  /** `GET /api/audit/sensitive-access` - who looked at what is sensitive (the list is not counted). */
  sensitiveAccess: async (p: Pick<AuditSearchParams, 'from' | 'to' | 'page' | 'pageSize'>): Promise<AuditPage> => {
    const res = await client.get('/api/audit/sensitive-access', { params: clean({ from: p.from, to: p.to, page: p.page, pageSize: p.pageSize }) });
    return toPage(res.data, p.page, p.pageSize);
  },

  /** `GET /api/audit/catalogue` - what the filter boxes offer. A server without the route answers 404; the caller shows free text then. */
  catalogue: async (): Promise<AuditCatalogue> => {
    const res = await client.get('/api/audit/catalogue');
    const o = (bodyOf(res.data) ?? {}) as Record<string, unknown>;
    return { actions: strings(o.actions), entities: strings(o.entities), users: strings(o.users) };
  },

  /** `GET /api/audit/export?format=csv` - the server filters by period only (not user/action/entity), so the screen hides it where the view is narrower. the server builds, masks, gates and audits the file. */
  exportCsv: async (p: Pick<AuditSearchParams, 'from' | 'to'>): Promise<Blob> => {
    const res = await client.get('/api/audit/export', { params: clean({ from: p.from, to: p.to, format: 'csv' }), responseType: 'blob' });
    return res.data as Blob;
  },
};

export default auditApi;
