/* ══════════════════════════════════════════════════════════════
   SYSTEM HEALTH
   What GET /api/system/health, /sessions and /errors return, and
   nothing else: database round trip, signed-in sessions and the
   latest failed operations from the audit log. A section whose
   call failed says so instead of showing anything in its place.

   Shelf look (Phase 2, S-5): "Stav" (the measured figures),
   "Vyžaduje pozornost" (only what the health answer says is wrong,
   each a link to the screen that fixes it), then "Relace" and
   "Poslední chyby" - tables on a desktop, cards on a phone.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { DESKTOP_UP } from '../components/settings/settingsStyle';
import client from '../api/client';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { AttentionCard, MetricCard, MUTED_SX, Shelf, TARGET_SX } from '../ui/shelf';
import { SettingsScreen } from './settings/SettingsFrame';
import { STATUS_TEXT, gigabytes, healthAttention, readHealth, waitText, type HealthView } from './systemHealthModel';

/* ── What the server sends (api/client.ts has already unwrapped the envelope) ── */

interface SystemSessionDto {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  expiresAt: string;
}

interface SystemSessionsResponse {
  items: SystemSessionDto[];
}

interface SystemErrorDto {
  id: string;
  action: string;
  entity: string;
  timestamp: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('cs-CZ');
}

const SESSION_COLUMNS: DataColumn<SystemSessionDto>[] = [
  { key: 'user', header: 'Uživatel', cell: (s) => <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{s.displayName}</Typography>, tablet: true },
  { key: 'email', header: 'E-mail', cell: (s) => s.email, tablet: true },
  { key: 'created', header: 'Přihlášen', cell: (s) => <Typography variant="body2" sx={MUTED_SX}>{formatDateTime(s.createdAt)}</Typography>, tablet: true },
  { key: 'expires', header: 'Platnost do', cell: (s) => <Typography variant="body2" sx={MUTED_SX}>{formatDateTime(s.expiresAt)}</Typography> },
];

const ERROR_COLUMNS: DataColumn<SystemErrorDto>[] = [
  { key: 'time', header: 'Čas', cell: (e) => <Typography variant="body2" sx={{ ...MUTED_SX, whiteSpace: 'nowrap' }}>{formatDateTime(e.timestamp)}</Typography> },
  { key: 'action', header: 'Akce', cell: (e) => e.action },
  { key: 'entity', header: 'Záznam', cell: (e) => e.entity },
];

/* ══════════════════════════════════════════════════════════════ */
export default function SystemHealth() {
  const [health, setHealth] = useState<HealthView | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [sessions, setSessions] = useState<SystemSessionDto[]>([]);
  const [sessionsFailed, setSessionsFailed] = useState(false);
  const [errors, setErrors] = useState<SystemErrorDto[]>([]);
  const [errorsFailed, setErrorsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [healthRes, sessionsRes, errorsRes] = await Promise.allSettled([
      client.get<unknown>('/api/system/health'),
      client.get<SystemSessionsResponse>('/api/system/sessions'),
      client.get<SystemErrorDto[]>('/api/system/errors'),
    ]);

    if (healthRes.status === 'fulfilled') {
      setHealth(readHealth(healthRes.value.data));
      setHealthFailed(false);
    } else {
      setHealth(null);
      setHealthFailed(true);
    }

    if (sessionsRes.status === 'fulfilled') {
      setSessions(sessionsRes.value.data?.items ?? []);
      setSessionsFailed(false);
    } else {
      setSessions([]);
      setSessionsFailed(true);
    }

    if (errorsRes.status === 'fulfilled') {
      setErrors(errorsRes.value.data ?? []);
      setErrorsFailed(false);
    } else {
      setErrors([]);
      setErrorsFailed(true);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
    const iv = setInterval(() => { void fetchAll(); }, 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };
  const retry = () => { void handleRefresh(); };
  const attention = healthAttention(health);

  return (
    <SettingsScreen
      title="Zdraví systému"
      subtitle={health?.timestamp
        ? `Změřeno ${formatDateTime(health.timestamp)}`
        : 'Odezva databáze, přihlášení uživatelé a poslední chyby'}
      aside={false}
      related={false}
      scope={false}
      actions={
        <Button
          variant="outlined"
          color="inherit"
          aria-label="Obnovit data"
          startIcon={<Refresh />}
          onClick={retry}
          disabled={refreshing || loading}
          sx={{ ...TARGET_SX, minHeight: 44, borderColor: 'divider' }}
        >
          {refreshing ? 'Obnovuji…' : 'Obnovit'}
        </Button>
      }
    >
      <Box sx={{ display: 'grid', gap: 3 }}>
        {/* ── Measured values ── */}
        <Shelf
          id="health-status"
          title="Stav"
          layout="grid"
          minCardWidth={210}
          cardHeight={112}
          skeletons={6}
          loading={loading}
          error={healthFailed ? 'Stav systému se nepodařilo načíst.' : false}
          onRetry={retry}
          stagger={false}
        >
          {health !== null && (
            <>
              <MetricCard
                label="Stav systému"
                value={STATUS_TEXT[health.status]}
                tone={health.status === 'ok' ? 'green' : health.status === 'unknown' ? 'grey' : 'red'}
                hint={health.version ?? undefined}
              />
              <MetricCard
                label="Odezva databáze"
                value={health.dbLatencyMs === null ? '—' : `${health.dbLatencyMs} ms`}
                hint={health.dbReachable === false ? 'Databáze neodpovídá' : 'Jedna otázka databázi a zpět'}
                tone={health.dbReachable === false ? 'red' : 'grey'}
              />
              <MetricCard label="Aktivní relace" value={health.activeSessions ?? '—'} hint="Kdo je právě přihlášený" />
              <MetricCard
                label="Fronta zpráv"
                value={health.outboxPending ?? '—'}
                tone={(health.outboxFailed ?? 0) > 0 ? 'red' : 'grey'}
                hint={
                  health.outboxPending
                    ? `Nejstarší čeká ${waitText(health.outboxOldestMinutes)}${(health.outboxFailed ?? 0) > 0 ? ` · selhalo ${health.outboxFailed}` : ''}`
                    : 'Nic nečeká na odeslání'
                }
              />
              <MetricCard
                label="E-mailový server"
                value={health.smtpConfigured === null ? '—' : health.smtpConfigured ? 'Nastaven' : 'Nenastaven'}
                tone={health.smtpConfigured === false ? 'red' : 'grey'}
                hint={health.smtpConfigured === false ? 'Zprávy se nikam neodesílají' : undefined}
              />
              <MetricCard
                label="Úložiště dokumentů"
                value={gigabytes(health.storageFreeBytes)}
                tone={health.storageWritable === false ? 'red' : 'grey'}
                hint={health.storageWritable === false ? 'Nejde do něj zapisovat' : 'Volné místo'}
              />
            </>
          )}
        </Shelf>

        {/* Only what the answer says is wrong, each case a link to its fix; nothing when the answer did not come. */}
        {attention !== null && (
          <Shelf id="health-attention" title="Vyžaduje pozornost" count={attention.count} countTone="red" layout="row" minCardWidth={340} stagger={false}>
            <AttentionCard group={attention} />
          </Shelf>
        )}

        {/* Sessions and errors side by side from 1280, one under the other below. */}
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'start', [DESKTOP_UP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
          <Shelf
            id="health-sessions"
            title="Relace"
            hint="Kdo je přihlášený"
            count={loading || sessionsFailed ? undefined : sessions.length}
            layout="free"
            loading={loading}
            error={sessionsFailed ? 'Aktivní relace se nepodařilo načíst.' : false}
            onRetry={retry}
            empty={sessions.length === 0}
            emptyState={{ text: 'Žádné aktivní relace', action: { label: 'Uživatelé a práva', to: '/staff-management' } }}
          >
            <ResponsiveDataList
              rows={sessions}
              rowKey={(s) => s.id}
              columns={SESSION_COLUMNS}
              ariaLabel="Aktivní relace"
              renderCard={(s) => (
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 650 }}>{s.displayName}</Typography>
                  <Typography sx={{ ...MUTED_SX, fontSize: 13, overflowWrap: 'anywhere' }}>{s.email}</Typography>
                  <Typography sx={{ ...MUTED_SX, fontSize: 12.5, mt: 0.5 }}>
                    {`Přihlášen ${formatDateTime(s.createdAt)} · do ${formatDateTime(s.expiresAt)}`}
                  </Typography>
                </Box>
              )}
            />
          </Shelf>

          {/* ── Recent failures from the audit log ── */}
          <Shelf
            id="health-errors"
            title="Poslední chyby"
            count={loading || errorsFailed ? undefined : errors.length}
            countTone="red"
            layout="free"
            loading={loading}
            error={errorsFailed ? 'Poslední chyby se nepodařilo načíst.' : false}
            onRetry={retry}
            empty={errors.length === 0}
            emptyState={{ text: 'Žádné chyby', action: { label: 'Auditní log', to: '/audit-log' } }}
            viewAll={errors.length > 0 ? { to: '/audit-log', label: 'Auditní log' } : undefined}
          >
            <ResponsiveDataList
              rows={errors}
              rowKey={(e) => e.id}
              columns={ERROR_COLUMNS}
              ariaLabel="Poslední chyby"
              renderCard={(e) => (
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 650, overflowWrap: 'anywhere' }}>{e.action}</Typography>
                  <Typography sx={{ ...MUTED_SX, fontSize: 13 }}>{`${e.entity} · ${formatDateTime(e.timestamp)}`}</Typography>
                </Box>
              )}
            />
          </Shelf>
        </Box>
      </Box>
    </SettingsScreen>
  );
}
