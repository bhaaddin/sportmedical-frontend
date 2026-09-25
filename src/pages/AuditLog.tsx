/* ══════════════════════════════════════════════════════════════
   AUDITNÍ LOG - who did what, to what, and when

   Filters (who, what happened, what kind of thing, from-to, free text) go to
   the server; the page and the total come back from it. Every row opens to
   the values before and after, as the trail recorded them - allowlisted on
   the way in, masked on the way out. The screen used to fetch a hundred rows
   and filter them in the browser, so the hundred-and-first change could not
   be found from here.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Collapse, Grid, IconButton, MenuItem, Paper, Skeleton, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Tooltip, Typography,
} from '@mui/material';
import {
  ExpandLess as CollapseIcon, ExpandMore as ExpandIcon, History as HistoryIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  actionLabel, auditApi, entityLabel, parseValues, type AuditEntry, type AuditFilter,
} from '../api/audit';

const PAGE_SIZES = [25, 50, 100];

const EMPTY: AuditFilter = { user: '', action: '', entity: '', from: '', to: '', search: '' };

function ValueTable({ title, json }: { title: string; json: string | null }) {
  const rows = parseValues(json);
  if (rows.length === 0) return null;
  return (
    <Box sx={{ minWidth: 220 }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Table size="small" sx={{ mt: 0.5 }}>
        <TableBody>
          {rows.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: 'text.secondary', border: 0, py: 0.25 }}>{key}</TableCell>
              <TableCell sx={{ border: 0, py: 0.25, wordBreak: 'break-all' }}>{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const hasDetail = entry.oldValue !== null || entry.newValue !== null || entry.ipAddress !== null;
  return (
    <>
      <TableRow hover>
        <TableCell sx={{ width: 40, p: 0.5 }}>
          {hasDetail ? (
            <IconButton size="small" aria-label={open ? 'Skrýt podrobnosti' : 'Zobrazit podrobnosti'} onClick={() => setOpen(!open)}>
              {open ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          ) : null}
        </TableCell>
        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          <Typography variant="body2">{new Date(entry.timestamp).toLocaleString('cs-CZ')}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.userEmail ?? 'systém'}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{actionLabel(entry.action)}</Typography>
          {actionLabel(entry.action) !== entry.action && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{entry.action}</Typography>
          )}
        </TableCell>
        <TableCell>
          <Chip size="small" label={entityLabel(entry.entity)} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">{entry.notes ?? '—'}</Typography>
        </TableCell>
      </TableRow>
      {hasDetail && (
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
            <Collapse in={open} unmountOnExit>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', px: 3, py: 2, bgcolor: 'action.hover' }}>
                <ValueTable title="PŘED" json={entry.oldValue} />
                <ValueTable title="PO" json={entry.newValue} />
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>ZÁZNAM</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    id objektu: {entry.entityId}
                  </Typography>
                  {entry.ipAddress && (
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      adresa: {entry.ipAddress}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AuditLog() {
  const [draft, setDraft] = useState<AuditFilter>(EMPTY);
  const [filter, setFilter] = useState<AuditFilter>(EMPTY);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const catalogue = useQuery({ queryKey: ['audit', 'catalogue'], queryFn: auditApi.catalogue, staleTime: 60_000 });
  const entries = useQuery({
    queryKey: ['audit', 'search', filter, page, pageSize],
    queryFn: () => auditApi.search(filter, page + 1, pageSize),
  });

  /* A filter that changed puts the reader back on the first page. */
  useEffect(() => { setPage(0); }, [filter]);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter({ ...draft });
  };

  const clear = () => {
    setDraft(EMPTY);
    setFilter(EMPTY);
  };

  const set = (key: keyof AuditFilter) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [key]: e.target.value });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon color="primary" /> Auditní log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Kdo co změnil a kdy: přihlášení, účty, pacienti, rezervace, platby, dokumenty a nastavení.
            Rodná čísla, čísla pojištěnců, hesla ani klíče se do záznamu nikdy nezapisují.
          </Typography>
        </Box>
        <Tooltip title="Obnovit">
          <IconButton aria-label="Obnovit" onClick={() => { void entries.refetch(); void catalogue.refetch(); }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper component="form" onSubmit={apply} sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField select fullWidth size="small" label="Kdo" value={draft.user ?? ''} onChange={set('user')}
              helperText="Zaměstnanec, který změnu provedl">
              <MenuItem value="">Kdokoli</MenuItem>
              {(catalogue.data?.users ?? []).map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField select fullWidth size="small" label="Co se stalo" value={draft.action ?? ''} onChange={set('action')}
              helperText="Druh akce">
              <MenuItem value="">Cokoli</MenuItem>
              {(catalogue.data?.actions ?? []).map((a) => <MenuItem key={a} value={a}>{actionLabel(a)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField select fullWidth size="small" label="Čeho se to týká" value={draft.entity ?? ''} onChange={set('entity')}
              helperText="Pacient, rezervace, účet…">
              <MenuItem value="">Čehokoli</MenuItem>
              {(catalogue.data?.entities ?? []).map((e) => <MenuItem key={e} value={e}>{entityLabel(e)}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Od" value={draft.from ?? ''} onChange={set('from')}
              slotProps={{ inputLabel: { shrink: true } }} helperText="Včetně tohoto dne" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2 }}>
            <TextField fullWidth size="small" type="date" label="Do" value={draft.to ?? ''} onChange={set('to')}
              slotProps={{ inputLabel: { shrink: true } }} helperText="Včetně tohoto dne" />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth size="small" label="Hledat v záznamech" value={draft.search ?? ''} onChange={set('search')}
              helperText="Text v důvodu změny nebo v zaznamenaných hodnotách, např. příjmení nebo klíč nastavení" />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Button type="submit" variant="contained" sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>Filtrovat</Button>
            <Button onClick={clear}>Zrušit filtry</Button>
          </Grid>
        </Grid>
      </Paper>

      {entries.isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => void entries.refetch()}>Zkusit znovu</Button>}>
          Auditní záznamy se nepodařilo načíst.
        </Alert>
      )}

      {entries.isPending ? (
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      ) : entries.data ? (
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell />
                <TableCell sx={{ fontWeight: 700 }}>Kdy</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Kdo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Co se stalo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Čeho se to týká</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Důvod / poznámka</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <HistoryIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary">Filtru neodpovídá žádný záznam.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.data.items.map((entry) => <Row key={entry.id} entry={entry} />)
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={entries.data.totalCount}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={pageSize}
            rowsPerPageOptions={PAGE_SIZES}
            onRowsPerPageChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            labelRowsPerPage="Na stránku:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} z ${count}`}
          />
        </TableContainer>
      ) : null}
    </Box>
  );
}
