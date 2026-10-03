/*
 * Historie změn - who changed which setting, when, from what to what.
 *
 * GET /api/v1/audit/changes?scope=&from=&to=&user=&take=&skip= (contract C5).
 * Filters: area (scope), a date range and a user; paged. Secrets arrive masked
 * from the server, and any field whose name says it is a secret is masked here
 * again, so a value that slipped through unmasked still never reaches the screen.
 * On a phone the table becomes cards.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { SettingsScreen } from './SettingsFrame';
import { SETTINGS_SECTIONS, scopeOf } from './catalogue';
import { useIsPhone } from '../../layout/useDevice';
import { TYPE, settingsGrey, settingsLine } from '../../components/settings/settingsStyle';
import {
  fetchAuditChanges, formatChangeTime, formatChangeValue, type ChangeEntry, type ChangePage,
} from '../../components/settings/changesApi';

const PAGE_SIZE = 25;

interface Filters {
  scope: string;
  from: string;
  to: string;
  user: string;
}

const NO_FILTERS: Filters = { scope: '', from: '', to: '', user: '' };

/** A field whose name says secret: its values are never printed, whatever the server sent. */
const SECRET_LABEL = /heslo|password|secret|tajn|klíč|klic|token|apikey/i;

/** "před" or "po" as it reads in the table. */
export function shownValue(entry: ChangeEntry, side: 'before' | 'after'): string {
  const value = side === 'before' ? entry.before : entry.after;
  if (SECRET_LABEL.test(entry.label) || SECRET_LABEL.test(entry.scope)) {
    return value === null || value === undefined || value === '' ? '—' : '••••••';
  }
  return formatChangeValue(value);
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <Typography component="label" htmlFor={htmlFor} sx={[TYPE.label, { display: 'block', mb: 0.75 }]}>
      {children}
    </Typography>
  );
}

export default function ChangeHistoryPage() {
  const phone = useIsPhone();
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ChangePage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      setResult(await fetchAuditChanges({
        scope: applied.scope,
        from: applied.from,
        to: applied.to,
        user: applied.user.trim(),
        take: PAGE_SIZE,
        skip: page * PAGE_SIZE,
      }));
    } catch {
      setError('Historii změn se nepodařilo načíst.');
    }
  }, [applied, page]);

  useEffect(() => { void load(); }, [load]);

  const apply = () => { setPage(0); setApplied(draft); };
  const reset = () => { setDraft(NO_FILTERS); setPage(0); setApplied(NO_FILTERS); };

  const total = result?.total ?? 0;
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <SettingsScreen
      title="Historie změn"
      subtitle="Kdo kdy změnil které nastavení — z jaké hodnoty na jakou. Hesla a klíče se nikdy neukazují."
      aside={false}
      related={false}
      scope={false}
      actions={
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<RefreshIcon />}
          onClick={() => { void load(); }}
          sx={{ minHeight: 44, color: 'text.primary', borderColor: settingsLine }}
        >
          Obnovit
        </Button>
      }
    >
      {/* Filters */}
      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); apply(); }}
        aria-label="Filtr historie změn"
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr)) auto' },
          alignItems: 'end',
          mb: 3,
          p: 2.5,
          border: '1px solid',
          borderColor: settingsLine,
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        <Box>
          <FieldLabel htmlFor="history-scope">Oblast</FieldLabel>
          <TextField
            select
            fullWidth
            id="history-scope"
            value={draft.scope}
            onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
            slotProps={{ htmlInput: { 'aria-label': 'Oblast' }, select: { displayEmpty: true } }}
          >
            <MenuItem value="">Všechno</MenuItem>
            {SETTINGS_SECTIONS.flatMap((section) => section.items.map((item) => (
              <MenuItem key={item.id} value={scopeOf(item)}>{section.label} — {item.label}</MenuItem>
            )))}
          </TextField>
        </Box>
        <Box>
          <FieldLabel htmlFor="history-from">Od data</FieldLabel>
          <TextField
            fullWidth
            id="history-from"
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            slotProps={{ htmlInput: { 'aria-label': 'Od data' } }}
          />
        </Box>
        <Box>
          <FieldLabel htmlFor="history-to">Do data</FieldLabel>
          <TextField
            fullWidth
            id="history-to"
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            slotProps={{ htmlInput: { 'aria-label': 'Do data' } }}
          />
        </Box>
        <Box>
          <FieldLabel htmlFor="history-user">Uživatel</FieldLabel>
          <TextField
            fullWidth
            id="history-user"
            value={draft.user}
            onChange={(e) => setDraft({ ...draft, user: e.target.value })}
            placeholder="jméno nebo e-mail"
            slotProps={{ htmlInput: { 'aria-label': 'Uživatel' } }}
          />
        </Box>
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" sx={{ minHeight: 44, fontWeight: 700 }}>Filtrovat</Button>
          <Button type="button" variant="outlined" color="inherit" onClick={reset} sx={{ minHeight: 44, color: 'text.primary', borderColor: settingsLine }}>
            Zrušit filtr
          </Button>
        </Stack>
      </Box>

      {error !== null ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => { void load(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}
        >
          {error}
        </Alert>
      ) : result === null ? (
        <Box aria-busy="true" aria-label="Načítám historii změn">
          <Skeleton variant="rounded" height={52} sx={{ borderRadius: 2, mb: 1 }} />
          <Skeleton variant="rounded" height={52} sx={{ borderRadius: 2, mb: 1 }} />
          <Skeleton variant="rounded" height={52} sx={{ borderRadius: 2 }} />
        </Box>
      ) : result.items.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: settingsLine, borderRadius: 3 }}>
          <Typography sx={TYPE.itemName}>Žádné změny</Typography>
          <Typography sx={TYPE.caption}>Pro tenhle filtr se nic nezměnilo. Zkuste širší období nebo všechny oblasti.</Typography>
        </Box>
      ) : (
        <>
          {phone ? (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
              {result.items.map((entry, index) => (
                <Box
                  key={`${entry.at}-${index}`}
                  component="li"
                  sx={{ p: 2, border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper' }}
                >
                  <Typography sx={TYPE.itemName}>{entry.label}</Typography>
                  <Typography sx={TYPE.caption}>{entry.user || 'Systém'} · {formatChangeTime(entry.at)}</Typography>
                  <Typography sx={{ mt: 1, fontSize: 14, color: 'text.primary', wordBreak: 'break-word' }}>
                    {shownValue(entry, 'before')} → {shownValue(entry, 'after')}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <TableContainer sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper' }}>
              <Table aria-label="Historie změn">
                <TableHead>
                  <TableRow>
                    {['Kdy', 'Kdo', 'Oblast', 'Pole', 'Před', 'Po'].map((head) => (
                      <TableCell
                        key={head}
                        sx={[TYPE.label, { color: 'text.primary', bgcolor: (t) => (t.palette.mode === 'light' ? '#EEF1F4' : '#1C222A'), borderBottom: '2px solid', borderColor: settingsLine, py: 1.5 }]}
                      >
                        {head}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.items.map((entry, index) => (
                    <TableRow key={`${entry.at}-${index}`} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.primary' }}>{formatChangeTime(entry.at)}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>{entry.user || 'Systém'}</TableCell>
                      <TableCell sx={{ color: settingsGrey }}>{entry.scope || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>{entry.label}</TableCell>
                      <TableCell sx={{ color: 'text.primary', wordBreak: 'break-word' }}>{shownValue(entry, 'before')}</TableCell>
                      <TableCell sx={{ color: 'text.primary', wordBreak: 'break-word', fontWeight: 600 }}>{shownValue(entry, 'after')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
            <Typography sx={TYPE.caption} aria-live="polite">{first}–{last} z {total}</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                sx={{ minHeight: 44, color: 'text.primary', borderColor: settingsLine }}
              >
                Předchozí
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage(page + 1)}
                sx={{ minHeight: 44, color: 'text.primary', borderColor: settingsLine }}
              >
                Další
              </Button>
            </Stack>
          </Stack>
        </>
      )}
    </SettingsScreen>
  );
}
