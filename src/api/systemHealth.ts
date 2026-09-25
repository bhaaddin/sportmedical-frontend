/* ══════════════════════════════════════════════════════════════
   Zdraví systému — what GET /api/system/health measures right now.

   Every value is measured on the server at the moment of the call:
   nothing is remembered, nothing is assumed from configuration.
   Needs settings.clinic.manage.
   ══════════════════════════════════════════════════════════════ */
import { client } from './client';

export type HealthStatus = 'ok' | 'warning' | 'error';

export interface SystemHealth {
  /** The worst of the parts: ok, warning or error. */
  status: HealthStatus;
  database: {
    reachable: boolean;
    latencyMs: number | null;
    appliedMigrations: number | null;
    /** Migrations this build carries that the database has not run. */
    pendingMigrations: number | null;
    error: string | null;
  };
  outbox: {
    pending: number | null;
    failed: number | null;
    oldestPendingCreatedAtUtc: string | null;
    oldestPendingAgeMinutes: number | null;
  };
  smtp: { configured: boolean };
  storage: {
    root: string;
    writable: boolean;
    freeBytes: number | null;
    totalBytes: number | null;
    problem: string | null;
  };
  application: {
    version: string;
    startedAtUtc: string;
    environment: string;
  };
  /** Signed-in sessions, or null when the database could not be asked. */
  activeSessions: number | null;
  timestamp: string;
}

export interface SystemSession {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  expiresAt: string;
}

export interface SystemError {
  id: string;
  action: string;
  entity: string;
  timestamp: string;
}

export const systemHealthApi = {
  health: async (): Promise<SystemHealth> => {
    const { data } = await client.get<SystemHealth>('/api/system/health');
    return data;
  },
  sessions: async (): Promise<SystemSession[]> => {
    const { data } = await client.get<{ items: SystemSession[] }>('/api/system/sessions');
    return data?.items ?? [];
  },
  errors: async (): Promise<SystemError[]> => {
    const { data } = await client.get<SystemError[]>('/api/system/errors');
    return data ?? [];
  },
};

/** The same thresholds the server uses for its overall status, so the cards agree with the headline. */
export const OUTBOX_STUCK_AFTER_MINUTES = 60;
export const STORAGE_LOW_FREE_BYTES = 1024 * 1024 * 1024;

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'neznámo';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toLocaleString('cs-CZ', { maximumFractionDigits: 1 })} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} MB`;
}

export function formatAge(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 1) return 'méně než minutu';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} dní`;
}

/* ── Each card's own state, from the same facts the headline uses ── */

export function databaseState(h: SystemHealth): HealthStatus {
  if (!h.database.reachable) return 'error';
  return (h.database.pendingMigrations ?? 0) > 0 ? 'warning' : 'ok';
}

export function outboxState(h: SystemHealth): HealthStatus {
  if (!h.database.reachable) return 'error';
  if ((h.outbox.failed ?? 0) > 0) return 'warning';
  if ((h.outbox.oldestPendingAgeMinutes ?? 0) >= OUTBOX_STUCK_AFTER_MINUTES) return 'warning';
  return 'ok';
}

export function smtpState(h: SystemHealth): HealthStatus {
  return h.smtp.configured ? 'ok' : 'warning';
}

export function storageState(h: SystemHealth): HealthStatus {
  if (!h.storage.writable) return 'error';
  if (h.storage.freeBytes !== null && h.storage.freeBytes < STORAGE_LOW_FREE_BYTES) return 'warning';
  return 'ok';
}
