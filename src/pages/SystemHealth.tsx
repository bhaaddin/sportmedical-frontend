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
  TableContainer, TableHead, TableRow, Skeleton, Alert, IconButton, Tooltip,
} from '@mui/material';
import {
  MonitorHeart, Speed, People, ErrorOutlined, Refresh, CheckCircle,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

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

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={250} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2].map(i => (
            <Grid key={i} size={{ xs: 12, sm: 6 }}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MonitorHeart color="primary" /> Zdraví systému
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {health
                ? `Změřeno ${formatDateTime(health.timestamp)}`
                : 'Odezva databáze, přihlášení uživatelé a poslední chyby'}
            </Typography>
          </Box>
          <Tooltip title="Obnovit data">
            <span>
              <IconButton onClick={() => { void handleRefresh(); }} disabled={refreshing}>
                <Refresh sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </motion.div>

      {/* ── Measured values ── */}
      {healthFailed ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          Stav systému se nepodařilo načíst.
        </Alert>
      ) : health && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[
            { label: 'Odezva databáze', value: `${health.dbLatencyMs} ms`, color: '#0288D1', icon: <Speed /> },
            { label: 'Aktivní relace', value: health.activeSessions, color: '#7B1FA2', icon: <People /> },
          ].map((stat, i) => (
            <Grid key={stat.label} size={{ xs: 12, sm: 6 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: stat.color }}>{stat.value}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Active Sessions ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              <People sx={{ mr: 1, verticalAlign: 'middle' }} />
              Aktivní relace{sessionsFailed ? '' : ` (${sessions.length})`}
            </Typography>
            {sessionsFailed ? (
              <Alert severity="error">Aktivní relace se nepodařilo načíst.</Alert>
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
      </motion.div>

      {/* ── Recent failures from the audit log ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              <ErrorOutlined sx={{ mr: 1, verticalAlign: 'middle' }} />
              Poslední chyby
            </Typography>
            {errorsFailed ? (
              <Alert severity="error">Poslední chyby se nepodařilo načíst.</Alert>
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
                          <CheckCircle sx={{ fontSize: 48, color: '#E8F5E9', mb: 1 }} />
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
      </motion.div>

      {/* ── Spin animation for refresh ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}
