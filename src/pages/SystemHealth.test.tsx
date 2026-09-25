/*
 * Zdraví systému shows what the server measured and nothing in place of a
 * value it could not read: an unreachable database is an error with the
 * server's reason, a queue nobody drains and a missing SMTP are warnings,
 * and a healthy clinic says so.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const health = vi.fn();
const sessions = vi.fn();
const errors = vi.fn();

vi.mock('../api/systemHealth', async () => {
  const actual = await vi.importActual<typeof import('../api/systemHealth')>('../api/systemHealth');
  return { ...actual, systemHealthApi: { health, sessions, errors } };
});

const { default: SystemHealth } = await import('./SystemHealth');
const { databaseState, outboxState, storageState, formatAge, formatBytes } = await import('../api/systemHealth');

const healthy = {
  status: 'ok' as const,
  database: { reachable: true, latencyMs: 4, appliedMigrations: 41, pendingMigrations: 0, error: null },
  outbox: { pending: 0, failed: 0, oldestPendingCreatedAtUtc: null, oldestPendingAgeMinutes: null },
  smtp: { configured: true },
  storage: { root: 'D:\\SportMedical\\documents', writable: true, freeBytes: 80 * 1024 ** 3, totalBytes: 200 * 1024 ** 3, problem: null },
  application: { version: '1.4.0+abc123', startedAtUtc: '2026-09-26T05:00:00Z', environment: 'Production' },
  activeSessions: 3,
  timestamp: '2026-09-26T08:00:00Z',
};

beforeEach(() => {
  health.mockReset().mockResolvedValue(healthy);
  sessions.mockReset().mockResolvedValue([
    { id: 's1', email: 'jana@ordinace.cz', displayName: 'Jana Nová', createdAt: '2026-09-26T07:00:00Z', expiresAt: '2026-09-26T19:00:00Z' },
  ]);
  errors.mockReset().mockResolvedValue([]);
});

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SystemHealth />
    </QueryClientProvider>,
  );

describe('Zdraví systému', () => {
  it('shows the measured facts of a healthy clinic', async () => {
    renderPage();

    expect(await screen.findByTestId('overall-status')).toHaveTextContent('Celkově: V pořádku');
    expect(screen.getByText('4 ms')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('1.4.0+abc123')).toBeInTheDocument();
    expect(screen.getByText('D:\\SportMedical\\documents')).toBeInTheDocument();
    expect(screen.getByText('80 GB')).toBeInTheDocument();
    expect(screen.getByText('Jana Nová')).toBeInTheDocument();
    expect(screen.getByText('Žádné chyby')).toBeInTheDocument();
    expect(screen.getAllByTestId('status-ok').length).toBeGreaterThanOrEqual(5);
  });

  it('reports an unreachable database with the server reason and no numbers in its place', async () => {
    health.mockResolvedValue({
      ...healthy,
      status: 'error',
      database: { reachable: false, latencyMs: null, appliedMigrations: null, pendingMigrations: null, error: 'NpgsqlException: Connection refused' },
      outbox: { pending: null, failed: null, oldestPendingCreatedAtUtc: null, oldestPendingAgeMinutes: null },
      activeSessions: null,
    });
    renderPage();

    expect(await screen.findByTestId('overall-status')).toHaveTextContent('Celkově: Chyba');
    expect(screen.getByText('NpgsqlException: Connection refused')).toBeInTheDocument();
    expect(screen.queryByText('Odezva')).not.toBeInTheDocument();
  });

  it('warns about a stuck queue and missing SMTP', async () => {
    health.mockResolvedValue({
      ...healthy,
      status: 'warning',
      smtp: { configured: false },
      outbox: { pending: 7, failed: 0, oldestPendingCreatedAtUtc: '2026-09-26T05:00:00Z', oldestPendingAgeMinutes: 180 },
    });
    renderPage();

    expect(await screen.findByTestId('overall-status')).toHaveTextContent('Celkově: Vyžaduje pozornost');
    expect(screen.getByText('3 h 0 min')).toBeInTheDocument();
    expect(screen.getByText(/SMTP není nastaveno/)).toBeInTheDocument();
    expect(screen.getAllByTestId('status-warning')).toHaveLength(2);
  });

  it('says plainly when the health call itself failed', async () => {
    health.mockRejectedValue(new Error('403'));
    renderPage();

    expect(await screen.findByText(/Stav systému se nepodařilo načíst/)).toBeInTheDocument();
  });
});

describe('the per-card states agree with the server thresholds', () => {
  it('database: pending migrations warn, unreachable errors', () => {
    expect(databaseState(healthy)).toBe('ok');
    expect(databaseState({ ...healthy, database: { ...healthy.database, pendingMigrations: 1 } })).toBe('warning');
    expect(databaseState({ ...healthy, database: { ...healthy.database, reachable: false } })).toBe('error');
  });

  it('outbox: a failed message or an hour-old pending one warns', () => {
    expect(outboxState({ ...healthy, outbox: { ...healthy.outbox, failed: 1 } })).toBe('warning');
    expect(outboxState({ ...healthy, outbox: { ...healthy.outbox, pending: 1, oldestPendingAgeMinutes: 60 } })).toBe('warning');
    expect(outboxState({ ...healthy, outbox: { ...healthy.outbox, pending: 1, oldestPendingAgeMinutes: 5 } })).toBe('ok');
  });

  it('storage: not writable errors, under 1 GB warns, unknown space is fine', () => {
    expect(storageState({ ...healthy, storage: { ...healthy.storage, writable: false } })).toBe('error');
    expect(storageState({ ...healthy, storage: { ...healthy.storage, freeBytes: 500 * 1024 ** 2 } })).toBe('warning');
    expect(storageState({ ...healthy, storage: { ...healthy.storage, freeBytes: null } })).toBe('ok');
  });

  it('formats ages and sizes in Czech', () => {
    expect(formatAge(null)).toBe('—');
    expect(formatAge(0)).toBe('méně než minutu');
    expect(formatAge(45)).toBe('45 min');
    expect(formatAge(3 * 24 * 60)).toBe('3 dní');
    expect(formatBytes(null)).toBe('neznámo');
    expect(formatBytes(512 * 1024 ** 2)).toBe('512 MB');
  });
});
