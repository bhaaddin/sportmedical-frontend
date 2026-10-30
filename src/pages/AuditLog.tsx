/* ══════════════════════════════════════════════════════════════
   AUDIT LOG — PLAN-01 Feature A31-A40
   - The server searches and pages (GET /api/audit/search): free text, action, entity, user, from / to
   - "Přístupy k citlivým údajům" (GET /api/audit/sensitive-access) as its own tab
   - Export celého období (GET /api/audit/export), behind the same export permission as every other download
   - ?entity=Patient&entityId=ID shows one patient's records (linked from the patient's history)
   - Expandable rows for the value before and after

   Shelf look (Phase 2, S-5): "Nejčastější akce" (a figure per
   action), then "Události" - the search in its header, the table
   taking the height that is left (a stack of cards on a phone);
   an entry about a patient, an invoice, a club ... names it with a
   connected chip.
   ══════════════════════════════════════════════════════════════ */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Autocomplete, Box, Button, Tab, Tabs, Typography, Paper, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Grid, IconButton, InputAdornment, Stack,
} from '@mui/material';
import {
  Download as DownloadIcon, FilterList as FilterIcon, Refresh as RefreshIcon, Search as SearchIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { auditApi, auditSearchApi, type AuditEntry, type AuditPage } from '../api/audit';
import { download } from '../utils/download';
import { ExportGate } from '../components/ui/ExportGate';
import { StackTable } from '../components/ui/StackTable';
import { TONE_CSS, StatusChip, type ChipTone } from '../components/ui';
import { useIsPhone } from '../layout/useDevice';
import { EntityChip, MetricCard, MUTED_SX, Shelf, TARGET_SX } from '../ui/shelf';
import { SettingsScreen } from './settings/SettingsFrame';
import { auditRange, auditSubject, hasNextPage, pageCount, stateAfter, stateBefore, toneOfAction, topActions } from './auditLogModel';

/* ── Config: the board's soft tones, one per kind of action (auditLogModel.toneOfAction) ── */
const toneOf = (action: string): ChipTone => toneOfAction(action);

/* ══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 25;
type View = 'all' | 'sensitive';

/** A short pause after typing, so one request goes out per phrase, not per key. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

export default function AuditLog() {
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  /* One patient's records: set by the link on the patient's history (an id, never a name). */
  const entityId = params.get('entityId') ?? '';
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState(params.get('entity') ?? '');
  const [user, setUser] = useState('');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const text = useDebounced(search.trim(), 350);
  const typedAction = useDebounced(action.trim(), 350);
  const typedEntity = useDebounced(entity.trim(), 350);
  const typedUser = useDebounced(user.trim(), 350);
  const range = useMemo(() => auditRange(fromDay, toDay), [fromDay, toDay]);
  const forOne = entityId !== '' && view === 'all';

  /* Back to the first page whenever the question changes. */
  useEffect(() => { setPage(1); }, [view, text, typedAction, typedEntity, typedUser, fromDay, toDay, entityId]);

  const filters = useQuery({ queryKey: ['audit', 'catalogue'], queryFn: auditSearchApi.catalogue, retry: false, staleTime: 5 * 60 * 1000 });
  const catalogue = filters.data;

  const events = useQuery<AuditPage>({
    queryKey: ['audit', view, forOne ? entityId : '', entityId === '' ? [text, typedAction, typedEntity, typedUser, range.from, range.to, page] : [entity, page]],
    queryFn: async () => {
      if (forOne) {
        /* The server answers this route in full (one person's records are few); it is paged here. */
        const all = await auditApi.listByEntity(typedEntity !== '' ? typedEntity : 'Patient', entityId);
        const start = (page - 1) * PAGE_SIZE;
        return { items: all.slice(start, start + PAGE_SIZE), totalCount: all.length, page, pageSize: PAGE_SIZE };
      }
      if (view === 'sensitive') return auditSearchApi.sensitiveAccess({ ...range, page, pageSize: PAGE_SIZE });
      return auditSearchApi.search({ user: typedUser, action: typedAction, entity: typedEntity, search: text, ...range, page, pageSize: PAGE_SIZE });
    },
    retry: false,
    placeholderData: (previous) => previous,
  });

  const loading = events.isPending;
  const loadError = events.isError;
  const filteredEntries: AuditEntry[] = events.data?.items ?? [];
  const totalCount = events.data?.totalCount ?? null;
  const pages = pageCount(totalCount, PAGE_SIZE);
  const nextOk = hasNextPage(totalCount, page, PAGE_SIZE, filteredEntries.length);
  const reload = () => { void events.refetch(); };
  const top = topActions(filteredEntries);
  const filtered = text !== '' || typedAction !== '' || typedEntity !== '' || typedUser !== '' || fromDay !== '' || toDay !== '';
  const clearFilters = () => { setSearch(''); setAction(''); setEntity(''); setUser(''); setFromDay(''); setToDay(''); };
  const clearPatient = () => { const next = new URLSearchParams(params); next.delete('entityId'); next.delete('entity'); setParams(next, { replace: true }); setEntity(''); };

  const exportCsv = () => download(
    { kind: 'audit-csv', fileName: 'audit-export.csv', failureMessage: 'Export se nepodařil. Zúžte období a zkuste to znovu.' },
    { kind: 'fetch', fetch: () => auditSearchApi.exportCsv(range) },
  );

  const filterBox = (
    value: string, set: (value: string) => void, label: string, options: string[] | undefined,
  ) => (
    <Autocomplete
      freeSolo
      size="small"
      options={options ?? []}
      inputValue={value}
      onInputChange={(_, next) => set(next)}
      disabled={entityId !== '' && view === 'all' && label !== 'Entita'}
      renderInput={(inputParams) => <TextField {...inputParams} label={label} slotProps={{ ...inputParams.slotProps, htmlInput: { ...inputParams.slotProps.htmlInput, 'aria-label': label } }} />}
      sx={{ minWidth: phone ? '100%' : 170, flex: phone ? '1 1 100%' : '1 1 170px', maxWidth: phone ? undefined : 260, '& .MuiInputBase-root': { minHeight: phone ? 44 : 36 } }}
    />
  );

  /* The text search stays in view; the four narrower filters sit behind one "Filtry" button (calm by default). */
  const activeFilters = [typedUser, typedAction, typedEntity, fromDay, toDay].filter((v) => v !== '').length;
  const searchField = (
    <Stack spacing={1.5} sx={{ width: '100%' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Hledat v auditním logu — poznámky a zaznamenané hodnoty"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={view === 'sensitive' || forOne}
          slotProps={{
            htmlInput: { 'aria-label': 'Hledat v auditním logu' },
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={MUTED_SX} /></InputAdornment> },
          }}
          sx={{ flex: '1 1 auto', maxWidth: 560, '& .MuiInputBase-root': { minHeight: phone ? 44 : 36 } }}
        />
        {!forOne && (
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<FilterIcon />}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
            sx={{ ...TARGET_SX, minHeight: 44, borderColor: 'divider', flexShrink: 0 }}
          >
            Filtry{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
        )}
      </Stack>
      {filtersOpen && !forOne && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {view === 'all' && filterBox(user, setUser, 'Uživatel', catalogue?.users)}
          {view === 'all' && filterBox(action, setAction, 'Akce', catalogue?.actions)}
          {view === 'all' && filterBox(entity, setEntity, 'Entita', catalogue?.entities)}
          <TextField
            size="small" type="date" label="Od" value={fromDay} onChange={(e) => setFromDay(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'Od data' } }}
            sx={{ minWidth: phone ? 'calc(50% - 4px)' : 150, '& .MuiInputBase-root': { minHeight: phone ? 44 : 36 } }}
          />
          <TextField
            size="small" type="date" label="Do" value={toDay} onChange={(e) => setToDay(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': 'Do data' } }}
            sx={{ minWidth: phone ? 'calc(50% - 4px)' : 150, '& .MuiInputBase-root': { minHeight: phone ? 44 : 36 } }}
          />
          {filtered && <Button onClick={clearFilters} sx={{ ...TARGET_SX, minHeight: 44 }}>Zrušit filtry</Button>}
        </Stack>
      )}
    </Stack>
  );

  return (
    <SettingsScreen
      title="Auditní log"
      subtitle="Kdo co změnil a kdy — včetně přístupů k citlivým údajům"
      aside={false}
      related={false}
      scope={false}
      actions={
        <>
          {view === 'all' && !forOne && (
          <ExportGate>
            {(blocked) => (
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<DownloadIcon />}
                onClick={() => void exportCsv()}
                disabled={blocked || loading || loadError}
                sx={{ ...TARGET_SX, minHeight: 44, borderColor: 'divider' }}
              >
                Export celého období
              </Button>
            )}
          </ExportGate>
          )}
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
        </>
      }
    >
      {/* The section fills its column: "Události" takes what is left and scrolls inside (tablet, desktop). */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, ...(phone ? {} : { height: '100%', minHeight: 0 }) }}>
        <Tabs value={view} onChange={(_, next: View) => setView(next)} aria-label="Pohled na záznamy" variant={phone ? 'fullWidth' : 'standard'} sx={{ minHeight: 44, flexShrink: 0 }}>
          <Tab value="all" label="Všechny události" sx={{ minHeight: 44 }} />
          <Tab value="sensitive" label="Přístupy k citlivým údajům" sx={{ minHeight: 44 }} />
        </Tabs>
        {forOne && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            <Typography variant="body2" sx={MUTED_SX}>Záznamy o pacientovi:</Typography>
            <EntityChip entity={{ kind: 'patient', id: entityId, label: entityId.slice(0, 8) }} size="sm" />
            <Button onClick={clearPatient} sx={{ ...TARGET_SX, minHeight: 44 }}>Zobrazit vše</Button>
          </Stack>
        )}
        {!loadError && !phone && (loading || top.length > 0) && (
          <Shelf id="audit-top" title="Nejčastější akce" hint="Na této stránce" layout="grid" minCardWidth={170} cardHeight={96} skeletons={4} loading={loading} stagger={false}>
            {top.map(({ action, count }) => (
              <MetricCard key={action} label={action} value={count} tone={toneOf(action) === 'red' ? 'red' : 'grey'} />
            ))}
          </Shelf>
        )}

        <Shelf
          id="audit-events"
          title="Události"
          count={loading || loadError ? undefined : totalCount ?? filteredEntries.length}
          layout="free"
          grow
          controls={searchField}
          loading={loading}
          error={loadError ? 'Auditní log se nepodařilo načíst.' : false}
          onRetry={reload}
          empty={filteredEntries.length === 0}
          emptyState={
            filtered && !forOne
              ? { text: 'Žádné záznamy', action: { label: 'Zrušit hledání', onClick: clearFilters } }
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
                            {entry.userEmail || 'System'}
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
          {(page > 1 || nextOk) && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', pt: 1.5 }}>
              <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || events.isFetching} sx={{ ...TARGET_SX, minHeight: 44 }}>Předchozí</Button>
              <Typography variant="body2" sx={MUTED_SX} aria-live="polite">
                Strana {page}{pages !== null ? ` z ${pages}` : ''}
              </Typography>
              <Button onClick={() => setPage((p) => p + 1)} disabled={!nextOk || events.isFetching} sx={{ ...TARGET_SX, minHeight: 44 }}>Další</Button>
            </Stack>
          )}
        </Shelf>
      </Box>
    </SettingsScreen>
  );
}
