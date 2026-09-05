/* ══════════════════════════════════════════════════════════════
   AUDIT LOG — Immutable audit trail viewer
   Admin-only, displays every system action with timestamp,
   actor, role, target, action type, and expandable JSON diff.
   ══════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Collapse,
} from '@mui/material';
import {
  History, ContentCopy, ExpandMore, ExpandLess, FilterList,
  Create, Delete, Edit, SwapHoriz, Shield,
} from '@mui/icons-material';
import PermissionGate from '../auth/PermissionGate';

/* ── Types ── */
export interface AuditEntry {
  id: string;
  timestamp: string; // ISO 8601
  actorId: string;
  actorName: string;
  actorRole: string;
  targetEntity: string;
  targetType: 'Patient' | 'Appointment' | 'Diagnosis' | 'Prescription' | 'Invoice' | 'System' | 'User';
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'OVERRIDE' | 'LOGIN' | 'LOGOUT';
  description: string;
  preState?: Record<string, unknown>;
  postState?: Record<string, unknown>;
  ipAddress?: string;
}

/* ── Action type config ── */
const ACTION_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  CREATE: { color: '#16A34A', icon: <Create sx={{ fontSize: 14 }} />, label: 'Vytvořeno' },
  UPDATE: { color: '#0284C7', icon: <Edit sx={{ fontSize: 14 }} />, label: 'Upraveno' },
  DELETE: { color: '#DC2626', icon: <Delete sx={{ fontSize: 14 }} />, label: 'Smazáno' },
  OVERRIDE: { color: '#EA580C', icon: <SwapHoriz sx={{ fontSize: 14 }} />, label: 'Přepsáno' },
  LOGIN: { color: '#7C3AED', icon: <Shield sx={{ fontSize: 14 }} />, label: 'Přihlášení' },
  LOGOUT: { color: '#64748B', icon: <Shield sx={{ fontSize: 14 }} />, label: 'Odhlášení' },
};

/* ── Sample data (would come from API) ── */
const sampleEntries: AuditEntry[] = [
  {
    id: '1', timestamp: '2026-09-01T10:15:32.000Z', actorId: 'u1', actorName: 'MUDr. Novák',
    actorRole: 'Doctor', targetEntity: 'P-2026-0412', targetType: 'Patient', actionType: 'CREATE',
    description: 'Vytvořen nový pacient', preState: undefined,
    postState: { firstName: 'Jan', lastName: 'Svoboda', dateOfBirth: '1990-05-15' },
  },
  {
    id: '2', timestamp: '2026-09-01T10:22:18.000Z', actorId: 'u2', actorName: 'Mgr. Dvořáková',
    actorRole: 'Receptionist', targetEntity: 'APT-8834', targetType: 'Appointment', actionType: 'CREATE',
    description: 'Vytvořena schůzka: Jan Svoboda, 08:00–09:00',
    postState: { patientId: 'P-2026-0412', startTime: '2026-09-02T08:00:00', room: 'GreenLine' },
  },
  {
    id: '3', timestamp: '2026-09-01T11:05:44.000Z', actorId: 'u1', actorName: 'MUDr. Novák',
    actorRole: 'Doctor', targetEntity: 'APT-8834', targetType: 'Appointment', actionType: 'UPDATE',
    description: 'Přesun schůzky z 08:00 na 14:00',
    preState: { startTime: '2026-09-02T08:00:00', endTime: '2026-09-02T09:00:00' },
    postState: { startTime: '2026-09-02T14:00:00', endTime: '2026-09-02T15:00:00' },
  },
  {
    id: '4', timestamp: '2026-09-01T14:30:01.000Z', actorId: 'u1', actorName: 'MUDr. Novák',
    actorRole: 'Doctor', targetEntity: 'APT-8830', targetType: 'Appointment', actionType: 'OVERRIDE',
    description: 'Vynucené přepsání přes přestávku',
    preState: { startTime: '2026-09-01T12:00:00', endTime: '2026-09-01T12:30:00', type: 'break' },
    postState: { deleted: true },
  },
];

/* ══════════════════════════════════════════════════════════════ */
export default function AuditLog() {
  const [entries] = useState<AuditEntry[]>(sampleEntries);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterAction !== 'all' && e.actionType !== filterAction) return false;
      if (filterRole !== 'all' && e.actorRole !== filterRole) return false;
      return true;
    });
  }, [entries, filterAction, filterRole]);

  const handleCopyJson = (entry: AuditEntry) => {
    const json = JSON.stringify({ preState: entry.preState, postState: entry.postState }, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <PermissionGate permission="admin:view_audit">
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <History sx={{ color: 'var(--color-primary)' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Audit Log</Typography>
          <Chip label={`${filtered.length} záznamů`} size="small" sx={{ ml: 1 }} />
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
          <FilterList sx={{ fontSize: 18, color: 'text.secondary' }} />
          <TextField select size="small" value={filterAction} onChange={e => setFilterAction(e.target.value)}
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <MenuItem value="all">Všechny akce</MenuItem>
            {Object.entries(ACTION_CONFIG).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" value={filterRole} onChange={e => setFilterRole(e.target.value)}
            sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}>
            <MenuItem value="all">Všechny role</MenuItem>
            <MenuItem value="SuperAdmin">SuperAdmin</MenuItem>
            <MenuItem value="Admin">Admin</MenuItem>
            <MenuItem value="Doctor">Doctor</MenuItem>
            <MenuItem value="Nurse">Nurse</MenuItem>
            <MenuItem value="Receptionist">Receptionist</MenuItem>
          </TextField>
        </Box>

        {/* Table */}
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, width: 30 }} />
                <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Uživatel</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Akce</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cíl</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Popis</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 60 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(entry => {
                const cfg = ACTION_CONFIG[entry.actionType] || ACTION_CONFIG.UPDATE;
                const isExpanded = expandedId === entry.id;
                const hasDiff = entry.preState || entry.postState;

                return (
                  <>
                    <TableRow key={entry.id} hover sx={{ cursor: hasDiff ? 'pointer' : 'default' }}
                      onClick={() => hasDiff && setExpandedId(isExpanded ? null : entry.id)}>
                      <TableCell>
                        {hasDiff && (
                          <IconButton size="small">
                            {isExpanded ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" className="tabular-nums" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatTime(entry.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.actorName}</Typography>
                          <Typography variant="caption" color="text.secondary">{entry.actorRole}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={cfg.icon}
                          label={cfg.label}
                          size="small"
                          sx={{ bgcolor: `${cfg.color}14`, color: cfg.color, fontWeight: 600, fontSize: 11 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{entry.targetEntity}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({entry.targetType})</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: 13 }}>{entry.description}</Typography>
                      </TableCell>
                      <TableCell>
                        {hasDiff && (
                          <Tooltip title="Kopírovat JSON">
                            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCopyJson(entry); }}>
                              <ContentCopy sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                    {/* Expanded JSON diff */}
                    {isExpanded && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={7} sx={{ p: 0, borderBottom: '2px solid var(--color-border)' }}>
                          <Collapse in={isExpanded}>
                            <Box sx={{ p: 2, bgcolor: 'var(--color-bg-hover)', display: 'flex', gap: 2 }}>
                              {entry.preState && (
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#DC2626' }}>PŘED</Typography>
                                  <pre style={{
                                    margin: 0, padding: 8, borderRadius: 8, fontSize: 11,
                                    background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)',
                                    overflow: 'auto', maxHeight: 200, fontFamily: 'monospace',
                                  }}>
                                    {JSON.stringify(entry.preState, null, 2)}
                                  </pre>
                                </Box>
                              )}
                              {entry.postState && (
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#16A34A' }}>PO</Typography>
                                  <pre style={{
                                    margin: 0, padding: 8, borderRadius: 8, fontSize: 11,
                                    background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.15)',
                                    overflow: 'auto', maxHeight: 200, fontFamily: 'monospace',
                                  }}>
                                    {JSON.stringify(entry.postState, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">Žádné záznamy</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </PermissionGate>
  );
}
