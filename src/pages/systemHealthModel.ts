/*
 * What GET /api/system/health sends, read defensively.
 *
 * The screen used to read `dbLatencyMs` at the top of the body. The server nests it:
 * `database.latencyMs` (measured on the dev API, 2026-10-20), so "Odezva databáze" drew
 * "undefined ms". The same answer also says what the screen never showed - the overall status,
 * the outgoing queue, whether an e-mail server is set up and how much room the document
 * store has - which are exactly the things an owner opens "Zdraví systému" to learn.
 */

export interface HealthView {
  status: 'ok' | 'warning' | 'error' | 'unknown';
  dbLatencyMs: number | null;
  dbReachable: boolean | null;
  pendingMigrations: number | null;
  activeSessions: number | null;
  timestamp: string | null;
  outboxPending: number | null;
  outboxFailed: number | null;
  outboxOldestMinutes: number | null;
  smtpConfigured: boolean | null;
  storageWritable: boolean | null;
  storageFreeBytes: number | null;
  storageTotalBytes: number | null;
  version: string | null;
}

const obj = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const bool = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export function readHealth(raw: unknown): HealthView {
  const root = obj(raw);
  const db = obj(root.database);
  const outbox = obj(root.outbox);
  const smtp = obj(root.smtp);
  const storage = obj(root.storage);
  const app = obj(root.application);
  const status = str(root.status);

  return {
    status: status === 'ok' || status === 'warning' || status === 'error' ? status : 'unknown',
    /* `database.latencyMs` is the contract; the flat name is what the screen used to expect. */
    dbLatencyMs: num(db.latencyMs) ?? num(root.dbLatencyMs),
    dbReachable: bool(db.reachable),
    pendingMigrations: num(db.pendingMigrations),
    activeSessions: num(root.activeSessions),
    timestamp: str(root.timestamp),
    outboxPending: num(outbox.pending),
    outboxFailed: num(outbox.failed),
    outboxOldestMinutes: num(outbox.oldestPendingAgeMinutes),
    smtpConfigured: bool(smtp.configured),
    storageWritable: bool(storage.writable),
    storageFreeBytes: num(storage.freeBytes),
    storageTotalBytes: num(storage.totalBytes),
    version: str(app.version),
  };
}

export const STATUS_TEXT: Record<HealthView['status'], string> = {
  ok: 'V pořádku',
  warning: 'Pozor',
  error: 'Chyba',
  unknown: 'Neznámý',
};

/** "27,5 GB" - the free room, in the units a person reads. */
export function gigabytes(bytes: number | null): string {
  if (bytes === null) return '—';
  return `${(bytes / 1024 ** 3).toFixed(1).replace('.', ',')} GB`;
}

/** 12 min, 5 h, "16 dní 2 h" - how long the oldest queued message has waited. */
export function waitText(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest === 0 ? `${days} dní` : `${days} dní ${rest} h`;
}
