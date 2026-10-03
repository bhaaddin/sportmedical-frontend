import client from '../../api/client';

/*
 * The change history (contract C5).
 *
 *   GET /api/v1/settings/changes?scope=<prefix>&take=5   - the panel under a page
 *   GET /api/v1/audit/changes?scope=&from=&to=&user=&take=&skip=  - the full page
 *
 * Both answer { items: [{ at, user, scope, label, before, after }], total }.
 * Secrets are masked by the server; nothing here unmasks or logs a value.
 */
export interface ChangeEntry {
  at: string;
  user: string;
  scope: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface ChangePage {
  items: ChangeEntry[];
  total: number;
}

function parsePage(data: unknown): ChangePage | null {
  const root = data !== null && typeof data === 'object' && 'value' in data ? (data as { value: unknown }).value : data;
  if (root === null || typeof root !== 'object') return null;
  const items = (root as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const rows: ChangeEntry[] = [];
  for (const raw of items) {
    if (raw === null || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.at !== 'string') continue;
    rows.push({
      at: r.at,
      user: typeof r.user === 'string' ? r.user : '',
      scope: typeof r.scope === 'string' ? r.scope : '',
      label: typeof r.label === 'string' ? r.label : '',
      before: r.before ?? null,
      after: r.after ?? null,
    });
  }
  const total = (root as { total?: unknown }).total;
  return { items: rows, total: typeof total === 'number' ? total : rows.length };
}

export async function fetchSettingChanges(scope: string, take = 5): Promise<ChangePage> {
  const res = await client.get('/api/v1/settings/changes', { params: { scope, take } });
  const page = parsePage(res.data);
  if (page === null) throw new Error('unexpected change history');
  return page;
}

export interface ChangeFilter {
  scope?: string;
  from?: string;
  to?: string;
  user?: string;
  take: number;
  skip: number;
}

export async function fetchAuditChanges(filter: ChangeFilter): Promise<ChangePage> {
  const params: Record<string, string | number> = { take: filter.take, skip: filter.skip };
  if (filter.scope) params.scope = filter.scope;
  if (filter.from) params.from = filter.from;
  if (filter.to) params.to = filter.to;
  if (filter.user) params.user = filter.user;
  const res = await client.get('/api/v1/audit/changes', { params });
  const page = parsePage(res.data);
  if (page === null) throw new Error('unexpected change history');
  return page;
}

/** A value as it reads in a "před → po" line: empty is "—", a switch is ano/ne. */
export function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'ano' : 'ne';
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  if (typeof value === 'number') return value.toLocaleString('cs-CZ');
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/** "3. 10. 2026 14:05" */
export function formatChangeTime(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
