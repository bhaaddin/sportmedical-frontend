/* ══════════════════════════════════════════════════════════════
   SYSTEM HEALTH
   What GET /api/system/health, /sessions and /errors return, and
   nothing else: database round trip, signed-in sessions and the
   latest failed operations from the audit log. A section whose
   call failed says so instead of showing anything in its place.
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Skeleton, Alert, Button, IconButton, Tooltip,
} from '@mui/material';
import {
  People, ErrorOutlined, Refresh, CheckCircle,
} from '@mui/icons-material';
import { DESKTOP_UP } from '../components/settings/settingsStyle';
import client from '../api/client';
import { KpiCard } from '../components/ui';
import { SettingsScreen } from './settings/SettingsFrame';

/* ── What the server sends (api/client.ts has already unwrapped the envelope) ── */
interface SystemHealthDto {
  dbLatencyMs: number;
  activeSessions: number;
  timestamp: string;
}

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

/* ══════════════════════════════════════════════════════════════ */
export default function SystemHealth() {
  const [health, setHealth] = useState<SystemHealthDto | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [sessions, setSessions] = useState<SystemSessionDto[]>([]);
  const [sessionsFailed, setSessionsFailed] = useState(false);
  const [errors, setErrors] = useState<SystemErrorDto[]>([]);
  const [errorsFailed, setErrorsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [healthRes, sessionsRes, errorsRes] = await Promise.allSettled([
      client.get<SystemHealthDto>('/api/system/health'),
      client.get<SystemSessionsResponse>('/api/system/sessions'),
      client.get<SystemErrorDto[]>('/api/system/errors'),
    ]);

    if (healthRes.status === 'fulfilled') {
      setHealth(healthRes.value.data);
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

  /* Loading keeps the frame: the title and the way back are on screen while the numbers arrive. */
  if (loading) {
    return (
      <SettingsScreen
        title="Zdraví systému"
        subtitle="Odezva databáze, přihlášení uživatelé a poslední chyby"
        aside={false}
        related={false}
      >
        <Box aria-busy="true" aria-label="Načítám stav systému">
          <Grid container spacing={3}>
            {[1, 2].map(i => (
              <Grid key={i} size={{ xs: 12, sm: 6 }}>
                <Skeleton variant="rounded" height={120} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen
      title="Zdraví systému"
      subtitle={health
        ? `Změřeno ${formatDateTime(health.timestamp)}`
        : 'Odezva databáze, přihlášení uživatelé a poslední chyby'}
      aside={false}
      related={false}
      scope={false}
      actions={
        <Tooltip title="Obnovit data">
          <span>
            <IconButton aria-label="Obnovit data" onClick={() => { void handleRefresh(); }} disabled={refreshing}>
              <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </span>
        </Tooltip>
      }
    >
      {/* ── Measured values ── */}
      {healthFailed ? (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" startIcon={<Refresh />} onClick={() => { void handleRefresh(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}>
          Stav systému se nepodařilo načíst.
        </Alert>
      ) : health && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <KpiCard label="Odezva databáze" value={`${health.dbLatencyMs} ms`} hint="Jedna otázka databázi a zpět" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <KpiCard label="Aktivní relace" value={health.activeSessions} hint="Kdo je právě přihlášený" />
          </Grid>
        </Grid>
      )}

      {/* Sessions and errors side by side from 1280, one under the other below. */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'start', [DESKTOP_UP]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
      {/* ── Active Sessions ── */}
      <div>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              <People sx={{ mr: 1, verticalAlign: 'middle' }} />
              Aktivní relace{sessionsFailed ? '' : ` (${sessions.length})`}
            </Typography>
            {sessionsFailed ? (
              <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<Refresh />} onClick={() => { void handleRefresh(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}>Aktivní relace se nepodařilo načíst.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Uživatel</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>E-mail</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Přihlášen</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Platnost do</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id} hover>
                        <TableCell>{session.displayName}</TableCell>
                        <TableCell>{session.email}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTime(session.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDateTime(session.expiresAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {sessions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">Žádné aktivní relace</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Recent failures from the audit log ── */}
      <div>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              <ErrorOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
              Poslední chyby
            </Typography>
            {errorsFailed ? (
              <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<Refresh />} onClick={() => { void handleRefresh(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}>Poslední chyby se nepodařilo načíst.</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Akce</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Záznam</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {errors.map((error) => (
                      <TableRow key={error.id} hover>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                            {formatDateTime(error.timestamp)}
                          </Typography>
                        </TableCell>
                        <TableCell>{error.action}</TableCell>
                        <TableCell>{error.entity}</TableCell>
                      </TableRow>
                    ))}
                    {errors.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          <CheckCircle sx={{ fontSize: 48, color: 'success.main', opacity: 0.35, mb: 1 }} />
                          <Typography color="text.secondary">Žádné chyby</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </div>
      </Box>

      {/* ── Spin animation for refresh ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </SettingsScreen>
  );
}
