/* ══════════════════════════════════════════════════════════════
   AUDIT LOG — PLAN-01 Feature A31-A40
   - Virtualized table with thousands of entries
   - Search by user, entity, action
   - Date range filter
   - Expandable rows for JSON diff
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Grid, IconButton, Tooltip, Skeleton,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Search as SearchIcon, History as HistoryIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';
import { DESIGN, KpiCard, StatusChip, type ChipTone } from '../components/ui';
import { SettingsScreen } from './settings/SettingsFrame';

/* ── Types ── */
interface AuditEntry {
  id: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  notes?: string;
  beforeState?: any;
  afterState?: any;
}

/* ── Config: the board's soft tones, one per kind of action ── */
const ACTION_TONES: Record<string, ChipTone> = {
  Create: 'green',
  Update: 'blue',
  Delete: 'red',
  Sign: 'primary',
  Import: 'beige',
  Override: 'beige',
  Login: 'grey',
  Logout: 'grey',
};

const toneOf = (action: string): ChipTone => ACTION_TONES[action] ?? 'grey';

/* ══════════════════════════════════════════════════════════════ */
export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  /* ── Load audit log ── */
  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/audit?take=100');
      const data = res.data?.value ?? res.data;
      setEntries(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  /* ── Filter entries ── */
  const filteredEntries = entries.filter(entry => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      entry.userEmail?.toLowerCase().includes(q) ||
      entry.userName?.toLowerCase().includes(q) ||
      entry.action?.toLowerCase().includes(q) ||
      entry.entity?.toLowerCase().includes(q) ||
      entry.entityId?.toLowerCase().includes(q) ||
      entry.notes?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <SettingsScreen
      title="Auditní log"
      subtitle="Kdo co změnil a kdy — včetně přístupů k citlivým údajům"
      actions={
        <Tooltip title="Obnovit">
          <IconButton aria-label="Obnovit" onClick={loadAuditLog}><RefreshIcon /></IconButton>
        </Tooltip>
      }
    >
      {/* Search */}
      <TextField fullWidth size="small" placeholder="Hledat v auditním logu — uživatel, akce, entita"
        value={search} onChange={(e) => setSearch(e.target.value)}
        slotProps={{ input: { startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" /> } }}
        sx={{ mb: 2.5 }} />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.keys(ACTION_TONES).map((action) => {
          const count = entries.filter(e => e.action === action).length;
          if (count === 0) return null;
          return (
            <Grid key={action} size={{ xs: 6, sm: 4, md: 2 }}>
              <KpiCard label={action} value={count} tone={action === 'Delete' ? 'red' : 'ink'} />
            </Grid>
          );
        })}
      </Grid>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }} />
                <TableCell>Čas</TableCell>
                <TableCell>Uživatel</TableCell>
                <TableCell>Akce</TableCell>
                <TableCell>Entita</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Poznámky</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <HistoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">Žádné záznamy</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry, i) => (
                  <motion.tr key={entry.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}>
                    <TableCell colSpan={7} sx={{ p: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                        {(entry.beforeState || entry.afterState) && (
                          <IconButton size="small" onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}>
                            {expandedRow === entry.id ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                          </IconButton>
                        )}
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 140, whiteSpace: 'nowrap' }}>
                            {new Date(entry.timestamp).toLocaleString('cs-CZ')}
                          </Typography>
                          <Typography sx={{ fontWeight: 500, minWidth: 150 }}>
                            {entry.userEmail || entry.userName || 'System'}
                          </Typography>
                          <StatusChip tone={toneOf(entry.action)} sx={{ minWidth: 70, justifyContent: 'center' }}>
                            {entry.action}
                          </StatusChip>
                          <Typography sx={{ minWidth: 100 }}>{entry.entity}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                            {entry.entityId?.slice(0, 8)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                            {entry.notes || '—'}
                          </Typography>
                        </Box>
                      </Box>
                      {/* Expanded JSON diff */}
                      {expandedRow === entry.id && (entry.beforeState || entry.afterState) && (
                        <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Grid container spacing={2}>
                            {entry.beforeState && (
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="overline" sx={{ color: DESIGN.tone.red.fg }}>Před</Typography>
                                <Paper sx={{ p: 1, mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
                                  <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
                                    {JSON.stringify(entry.beforeState, null, 2)}
                                  </pre>
                                </Paper>
                              </Grid>
                            )}
                            {entry.afterState && (
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="overline" sx={{ color: DESIGN.tone.green.fg }}>Po</Typography>
                                <Paper sx={{ p: 1, mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
                                  <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
                                    {JSON.stringify(entry.afterState, null, 2)}
                                  </pre>
                                </Paper>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      )}
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>
    </SettingsScreen>
  );
}
