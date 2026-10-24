/* ══════════════════════════════════════════════════════════════
   AUDIT LOG — PLAN-01 Feature A31-A40
   - The latest 100 entries
   - Search by user, entity, action, id, notes
   - Expandable rows for the value before and after

   Shelf look (Phase 2, S-5): "Nejčastější akce" (a figure per
   action), then "Události" - the search in its header, the table
   taking the height that is left (a stack of cards on a phone);
   an entry about a patient, an invoice, a club ... names it with a
   connected chip.
   ══════════════════════════════════════════════════════════════ */
import { Fragment, useState, useEffect } from 'react';
import {
  Box, Button, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Grid, IconButton, InputAdornment,
} from '@mui/material';
import {
  Refresh as RefreshIcon, Search as SearchIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import client from '../api/client';
import { StackTable } from '../components/ui/StackTable';
import { TONE_CSS, StatusChip, type ChipTone } from '../components/ui';
import { useIsPhone } from '../layout/useDevice';
import { EntityChip, MetricCard, MUTED_SX, Shelf, TARGET_SX } from '../ui/shelf';
import { SettingsScreen } from './settings/SettingsFrame';
import { auditSubject, stateAfter, stateBefore, toneOfAction, topActions } from './auditLogModel';

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
  /** What the API sends (the scrubbed value before and after). */
  oldValue?: unknown;
  newValue?: unknown;
  /** Older names, kept so an entry that still carries them is read too. */
  beforeState?: unknown;
  afterState?: unknown;
}

/* ── Config: the board's soft tones, one per kind of action (auditLogModel.toneOfAction) ── */
const toneOf = (action: string): ChipTone => toneOfAction(action);

/* ══════════════════════════════════════════════════════════════ */
export default function AuditLog() {
  const phone = useIsPhone();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  /* ── Load audit log ── */
  useEffect(() => {
    void loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await client.get('/api/audit?take=100');
      const data = res.data?.value ?? res.data;
      setEntries(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      /* Not "Žádné záznamy": an empty log and a log that did not load are different things. */
      setEntries([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  const reload = () => { void loadAuditLog(); };

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
  const top = topActions(entries);

  const searchField = (
    <TextField
      size="small"
      placeholder="Hledat v auditním logu — uživatel, akce, entita"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      disabled={loading || loadError}
      slotProps={{
        htmlInput: { 'aria-label': 'Hledat v auditním logu' },
        input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={MUTED_SX} /></InputAdornment> },
      }}
      sx={{ width: { xs: '100%', sm: 380 }, '& .MuiInputBase-root': { minHeight: phone ? 44 : 36 } }}
    />
  );

  return (
    <SettingsScreen
      title="Auditní log"
      subtitle="Kdo co změnil a kdy — včetně přístupů k citlivým údajům"
      aside={false}
      related={false}
      scope={false}
      actions={
        <Button
          variant="outlined"
          color="inherit"
          aria-label="Obnovit"
          startIcon={<RefreshIcon />}
          onClick={reload}
          disabled={loading}
          sx={{ ...TARGET_SX, minHeight: 44, borderColor: 'divider' }}
        >
          Obnovit
        </Button>
      }
    >
      {/* The section fills its column: "Události" takes what is left and scrolls inside (tablet, desktop). */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, ...(phone ? {} : { height: '100%', minHeight: 0 }) }}>
        {!loadError && (loading || top.length > 0) && (
          <Shelf id="audit-top" title="Nejčastější akce" hint="V posledních 100 záznamech" layout="grid" minCardWidth={170} cardHeight={96} skeletons={4} loading={loading} stagger={false}>
            {top.map(({ action, count }) => (
              <MetricCard key={action} label={action} value={count} tone={toneOf(action) === 'red' ? 'red' : 'grey'} />
            ))}
          </Shelf>
        )}

        <Shelf
          id="audit-events"
          title="Události"
          count={loading || loadError ? undefined : filteredEntries.length}
          layout="free"
          grow
          controls={searchField}
          loading={loading}
          error={loadError ? 'Auditní log se nepodařilo načíst.' : false}
          onRetry={reload}
          empty={filteredEntries.length === 0}
          emptyState={
            search !== ''
              ? { text: 'Žádné záznamy', action: { label: 'Zrušit hledání', onClick: () => setSearch('') } }
              : { text: 'Žádné záznamy', action: { label: 'Historie změn', to: '/nastaveni/historie-zmen' } }
          }
        >
          <StackTable
            component={Paper}
            sx={phone ? undefined : { flex: '1 1 0', minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain' }}
          >
            <Table stickyHeader={!phone} aria-label="Události">
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
                {filteredEntries.map((entry) => {
                  const before = stateBefore(entry);
                  const after = stateAfter(entry);
                  const hasDiff = before !== null || after !== null;
                  const subject = auditSubject(entry);
                  return (
                    <Fragment key={entry.id}>
                      <TableRow hover>
                        <TableCell sx={{ width: 48, p: 0.5 }}>
                          {hasDiff && (
                            <IconButton
                              size="small"
                              aria-label="Zobrazit změnu"
                              aria-expanded={expandedRow === entry.id}
                              onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                              sx={TARGET_SX}
                            >
                              {expandedRow === entry.id ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                            </IconButton>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={MUTED_SX}>
                            {new Date(entry.timestamp).toLocaleString('cs-CZ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                            {entry.userEmail || entry.userName || 'System'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <StatusChip tone={toneOf(entry.action)} sx={{ justifyContent: 'center' }}>
                            {entry.action}
                          </StatusChip>
                        </TableCell>
                        <TableCell>{entry.entity}</TableCell>
                        <TableCell>
                          {subject !== null ? (
                            <EntityChip entity={subject} size="sm" />
                          ) : (
                            <Typography variant="body2" sx={{ ...MUTED_SX, fontFamily: 'monospace', fontSize: 11 }}>
                              {entry.entityId?.slice(0, 8)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={MUTED_SX}>
                            {entry.notes || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {/* Expanded JSON diff */}
                      {expandedRow === entry.id && hasDiff && (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ p: 0 }}>
                            <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                              <Grid container spacing={2}>
                                {before !== null && (
                                  <Grid size={{ xs: 12, sm: 6 }}>
                                    <Typography variant="overline" sx={{ color: TONE_CSS.red.fg }}>Před</Typography>
                                    <Paper sx={{ p: 1, mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
                                      <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                        {JSON.stringify(before, null, 2)}
                                      </pre>
                                    </Paper>
                                  </Grid>
                                )}
                                {after !== null && (
                                  <Grid size={{ xs: 12, sm: 6 }}>
                                    <Typography variant="overline" sx={{ color: TONE_CSS.green.fg }}>Po</Typography>
                                    <Paper sx={{ p: 1, mt: 0.5, maxHeight: 200, overflow: 'auto' }}>
                                      <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                        {JSON.stringify(after, null, 2)}
                                      </pre>
                                    </Paper>
                                  </Grid>
                                )}
                              </Grid>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </StackTable>
        </Shelf>
      </Box>
    </SettingsScreen>
  );
}
