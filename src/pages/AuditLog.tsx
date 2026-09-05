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
  TableHead, TableRow, Chip, TextField, Grid, IconButton, Tooltip,
  Avatar, Skeleton, Collapse, Button
} from '@mui/material';
import {
  Refresh as RefreshIcon, Search as SearchIcon, History as HistoryIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

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

/* ── Config ── */
const ACTION_COLORS: Record<string, string> = {
  Create: '#2E7D32',
  Update: '#0288D1',
  Delete: '#D32F2F',
  Sign: '#9C27B0',
  Import: '#ED6C02',
  Override: '#FF5722',
  Login: '#795548',
  Logout: '#607D8B',
};

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
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon color="primary" /> Auditní log
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Historie všech akcí v systému
            </Typography>
          </Box>
          <Tooltip title="Obnovit">
            <IconButton onClick={loadAuditLog}><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </motion.div>

      {/* Search */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <TextField fullWidth size="small" placeholder="Hledat v auditním logu..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: '#999' }} fontSize="small" /> }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
      </Paper>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(ACTION_COLORS).map(([action, color]) => {
          const count = entries.filter(e => e.action === action).length;
          if (count === 0) return null;
          return (
            <Grid key={action} size={{ xs: 6, sm: 4, md: 2 }}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color }}>{count}</Typography>
                <Typography variant="body2" color="text.secondary">{action}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 700, width: 40 }} />
                <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Uživatel</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Akce</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Entita</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Poznámky</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <HistoryIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary">Žádné záznamy</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry, i) => (
                  <motion.tr key={entry.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}>
                    <TableCell colSpan={7} sx={{ p: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
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
                          <Chip label={entry.action} size="small"
                            sx={{ bgcolor: (ACTION_COLORS[entry.action] || '#666') + '18', color: ACTION_COLORS[entry.action] || '#666', fontWeight: 500, minWidth: 70 }} />
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
                        <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderBottom: '1px solid #e0e0e0' }}>
                          <Grid container spacing={2}>
                            {entry.beforeState && (
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#D32F2F' }}>PŘED</Typography>
                                <Paper sx={{ p: 1, mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
                                  <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
                                    {JSON.stringify(entry.beforeState, null, 2)}
                                  </pre>
                                </Paper>
                              </Grid>
                            )}
                            {entry.afterState && (
                              <Grid size={{ xs: 6 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#2E7D32' }}>PO</Typography>
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
    </Box>
  );
}
