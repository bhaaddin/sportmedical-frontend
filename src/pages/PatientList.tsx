/*
 * Pacienti - the whole register, a page at a time, drawn the way the board
 * draws it (design-14): a header with the count, one search box, four filter
 * chips, and a table whose last column says in one word where each patient
 * stands.
 *
 * `GET /api/patients` pages: twenty rows unless asked for more, a hundred at
 * most, plus `totalCount`. This screen used to take the first page, call it
 * the register, count it ("20 registrovaných pacientů") and search inside it,
 * so the twenty-first surname could not be found here at all. It shows the
 * server's count, pages through the rest, and sends the search to the server,
 * which matches first and last names over every row, diacritics ignored.
 *
 * The last three columns - POSLEDNÍ NÁVŠTĚVA, PŘÍŠTÍ TERMÍN, STAV - are not on
 * the patient row at all. They are read off the clinic's appointment list and
 * the booking window, joined here by patient id (see `appointmentsSource`).
 * The filter chips work on the same join, so they filter THE PAGE ON SCREEN:
 * the route has no `filter` parameter yet, and that is reported rather than
 * hidden behind a second request per row.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert, Box, Button, InputAdornment, Link, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { PatientListSkeleton } from '../components/SkeletonLoader';
import { usePermission } from '../auth/usePermission';
import { SENSITIVE_IDENTITY, shownFields, usePatientFields } from '../api/displaySettings';
import { FilterChips, PageHeader, SoftCard, StatusChip } from '../components/ui';
import type { FilterOption } from '../components/ui';
import {
  ALL_APPOINTMENTS_KEY, UPCOMING_WINDOW_KEY, fetchAllAppointments, fetchUpcomingWindow,
} from '../components/patients/appointmentsSource';
import {
  patientStanding, questionnaireMissing, shortDayTime, summariseVisits,
} from '../components/patients/patientActivity';
import type { VisitSummary } from '../components/patients/patientActivity';
import { formatDateOnly, formatPragueDate } from '../utils/time';

const sexLabel = (s: string) => (s === 'Male' ? 'Muž' : s === 'Female' ? 'Žena' : 'Jiné');

/*
 * The optional columns the clinic may switch on (Nastavení -> Údaje o
 * pacientovi) beyond the board's fixed ones. `recordId` is drawn under the
 * name rather than as a column of its own; `dateOfBirth` is the board's
 * NAROZENÍ column and is hidden only when the clinic switched it off.
 */
const EXTRA_COLUMN_CELLS: Record<string, { head: string; cell: (p: Patient) => ReactNode }> = {
  sex: { head: 'Pohlaví', cell: (p) => sexLabel(p.sex) },
  registeredAt: { head: 'Registrován', cell: (p) => formatDateOnly(p.createdAtUtc?.slice(0, 10)) },
};

type Filter = 'all' | 'booked' | 'questionnaire' | 'noShow';

const FILTERS: FilterOption<Filter>[] = [
  { key: 'all', label: 'Všichni' },
  { key: 'booked', label: 'S termínem' },
  { key: 'questionnaire', label: 'Chybí dotazník' },
  { key: 'noShow', label: 'Nepřišli' },
];

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

/** Everything the three joined columns need about one row. */
interface RowActivity {
  summary: VisitSummary;
  questionnaireIsMissing: boolean;
}

export default function PatientList() {
  const navigate = useNavigate();
  const mayRegister = usePermission('patients.register');
  const maySeeSensitive = usePermission(SENSITIVE_IDENTITY);
  const fieldVisibility = usePatientFields();
  const listFields = shownFields(fieldVisibility.data, 'list', maySeeSensitive);
  const shows = (key: string) => listFields === null || listFields.some((field) => field.key === key);
  const showRecordId = listFields !== null && listFields.some((field) => field.key === 'recordId');
  const extraColumns = (listFields ?? []).filter((field) => EXTRA_COLUMN_CELLS[field.key] !== undefined);

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');

  /* One request per pause in typing, and a new search starts on its first
     page. Only a search that changed resets the page: the timer used to run on
     mount too, and a click on the next page in the first moments after the
     list appeared was undone when it fired. */
  useEffect(() => {
    const next = search.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      setQuery(next);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, query]);

  const patientsQuery = useQuery({
    queryKey: ['patients', 'register', query, page, PAGE_SIZE],
    queryFn: () => patientsApi.list({ query, page: page + 1, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  /* The joined columns. Neither request blocks the list: a row is drawn with
     "—" until its visits are known, and a failure leaves the dash rather than
     taking the register down. */
  const appointmentsQuery = useQuery({
    queryKey: ALL_APPOINTMENTS_KEY,
    queryFn: fetchAllAppointments,
    staleTime: 60_000,
  });
  const windowQuery = useQuery({
    queryKey: UPCOMING_WINDOW_KEY,
    queryFn: () => fetchUpcomingWindow(),
    staleTime: 60_000,
  });

  const patients = useMemo(() => patientsQuery.data?.items ?? [], [patientsQuery.data]);

  const activity = useMemo(() => {
    const byId = new Map<string, RowActivity>();
    if (appointmentsQuery.data === undefined) return byId;
    const now = new Date();
    const window = windowQuery.data ?? [];
    for (const p of patients) {
      byId.set(p.id, {
        summary: summariseVisits(p.id, appointmentsQuery.data, now),
        questionnaireIsMissing: questionnaireMissing(p.id, window),
      });
    }
    return byId;
  }, [patients, appointmentsQuery.data, windowQuery.data]);

  const visible = useMemo(() => {
    if (filter === 'all') return patients;
    return patients.filter((p) => {
      const row = activity.get(p.id);
      if (row === undefined) return false;
      switch (filter) {
        case 'booked': return row.summary.nextAppointment !== null;
        case 'questionnaire': return row.questionnaireIsMissing;
        case 'noShow': return row.summary.noShows > 0;
        default: return true;
      }
    });
  }, [patients, activity, filter]);

  if (patientsQuery.isPending) return <PatientListSkeleton />;

  if (patientsQuery.isError) {
    const status = (patientsQuery.error as { response?: { status?: number } })?.response?.status;
    return (
      <Alert
        severity="error"
        action={status === 403 ? undefined : (
          <Button color="inherit" size="small" onClick={() => void patientsQuery.refetch()}>
            Zkusit znovu
          </Button>
        )}
      >
        {status === 403
          ? 'Nemáte oprávnění vidět pacienty.'
          : 'Seznam pacientů se nepodařilo načíst.'}
      </Alert>
    );
  }

  const total = patientsQuery.data.totalCount;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const emptyText = patients.length === 0
    ? (query === '' ? 'Zatím žádní pacienti.' : 'Nikdo takový v registru není.')
    : 'Na této stránce nikdo filtru neodpovídá.';
  const activityKnown = appointmentsQuery.data !== undefined;

  const columnCount = 5 + (shows('dateOfBirth') ? 1 : 0) + extraColumns.length;

  return (
    <Box>
      <PageHeader
        title="Pacienti"
        subtitle={query === '' ? `Kartotéka kliniky · ${total} záznamů` : `Nalezeno: ${total}`}
        actions={mayRegister ? (
          /* One way in. The thinner "Nový pacient" form wrote to a different
             endpoint and skipped the address, birth number and insurer, so
             which button the operator pressed decided how complete the record
             was. Editing an existing patient still uses that form. */
          <Button variant="contained" onClick={() => navigate('/patients/register')}>
            Nový pacient
          </Button>
        ) : undefined}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' } }}>
        <TextField
          fullWidth
          placeholder="Jméno, příjmení, telefon nebo e-mail"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filtr pacientů" />
      </Stack>

      <SoftCard sx={{ p: 0, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Pacient</TableCell>
                {shows('dateOfBirth') && <TableCell>Narození</TableCell>}
                {extraColumns.map((field) => (
                  <TableCell key={field.key}>{EXTRA_COLUMN_CELLS[field.key].head}</TableCell>
                ))}
                <TableCell>Telefon</TableCell>
                <TableCell>Poslední návštěva</TableCell>
                <TableCell>Příští termín</TableCell>
                <TableCell>Stav</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((p) => {
                const row = activity.get(p.id);
                const standing = row === undefined
                  ? null
                  : patientStanding(p, row.summary, row.questionnaireIsMissing);
                return (
                  <TableRow
                    key={p.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/patients/${p.id}`}
                        underline="hover"
                        onClick={(e) => e.stopPropagation()}
                        sx={{ fontWeight: 600, color: 'primary.main' }}
                      >
                        {p.firstName} {p.lastName}
                      </Link>
                      {p.email && p.email.trim() !== '' && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                          {p.email}
                        </Typography>
                      )}
                      {showRecordId && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                          {p.id.slice(0, 8)}…
                        </Typography>
                      )}
                    </TableCell>
                    {shows('dateOfBirth') && (
                      <TableCell>{formatDateOnly(p.dateOfBirth?.slice(0, 10)) || '—'}</TableCell>
                    )}
                    {extraColumns.map((field) => (
                      <TableCell key={field.key}>{EXTRA_COLUMN_CELLS[field.key].cell(p)}</TableCell>
                    ))}
                    {/* The register's row carries `phone` and `email` (null
                        when the patient left none); the e-mail is the second
                        line under the name. */}
                    <TableCell>{p.phone && p.phone.trim() !== '' ? p.phone : '—'}</TableCell>
                    <TableCell>
                      {row?.summary.lastVisit ? formatPragueDate(row.summary.lastVisit.startTime) : '—'}
                    </TableCell>
                    <TableCell>
                      {row?.summary.nextAppointment ? shortDayTime(row.summary.nextAppointment.startTime) : '—'}
                    </TableCell>
                    <TableCell>
                      {standing === null
                        ? <Typography variant="caption" sx={{ color: 'text.disabled' }}>{activityKnown ? '—' : '…'}</Typography>
                        : <StatusChip tone={standing.tone}>{standing.label}</StatusChip>}
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} align="center" sx={{ py: 6 }}>
                    <Typography sx={{ color: 'text.secondary' }}>{emptyText}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </SoftCard>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mt: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {`Zobrazeno ${visible.length} z ${total} pacientů`}
          {pageCount > 1 ? ` · strana ${page + 1} z ${pageCount}` : ''}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Předchozí
          </Button>
          <Button
            variant="outlined"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Další
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
