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
  Alert, Box, Button, InputAdornment, Link, Stack, TextField, Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { PatientListSkeleton } from '../components/SkeletonLoader';
import { usePermission } from '../auth/usePermission';
import { SENSITIVE_IDENTITY, shownFields, usePatientFields } from '../api/displaySettings';
import { FilterChips, PageHeader, StatusChip } from '../components/ui';
import type { FilterOption } from '../components/ui';
import { ResponsiveDataList } from '../components/ui/ResponsiveDataList';
import type { DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useIsPhone } from '../layout/useDevice';
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
  const phone = useIsPhone();
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

  const standingOf = (p: Patient) => {
    const row = activity.get(p.id);
    return row === undefined ? null : patientStanding(p, row.summary, row.questionnaireIsMissing);
  };
  const standingNode = (p: Patient) => {
    const standing = standingOf(p);
    return standing === null
      ? <Typography variant="caption" sx={{ color: 'text.disabled' }}>{activityKnown ? '—' : '…'}</Typography>
      : <StatusChip tone={standing.tone}>{standing.label}</StatusChip>;
  };
  const nextText = (p: Patient) => {
    const next = activity.get(p.id)?.summary.nextAppointment;
    return next ? shortDayTime(next.startTime) : '—';
  };
  const phoneText = (p: Patient) => (p.phone && p.phone.trim() !== '' ? p.phone : '—');

  const nameCell = (p: Patient) => (
    <>
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
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {p.email}
        </Typography>
      )}
      {showRecordId && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {p.id.slice(0, 8)}…
        </Typography>
      )}
    </>
  );

  /* The board's columns. The tablet keeps three - who, when next, where they
     stand - and the desktop all of them. */
  const columns: DataColumn<Patient>[] = [
    { key: 'name', header: 'Pacient', cell: nameCell, tablet: true },
    ...(shows('dateOfBirth')
      ? [{ key: 'dob', header: 'Narození', cell: (p: Patient) => formatDateOnly(p.dateOfBirth?.slice(0, 10)) || '—' }]
      : []),
    ...extraColumns.map((field) => ({
      key: field.key,
      header: EXTRA_COLUMN_CELLS[field.key].head,
      cell: EXTRA_COLUMN_CELLS[field.key].cell,
    })),
    { key: 'phone', header: 'Telefon', cell: phoneText },
    {
      key: 'last',
      header: 'Poslední návštěva',
      cell: (p) => {
        const last = activity.get(p.id)?.summary.lastVisit;
        return last ? formatPragueDate(last.startTime) : '—';
      },
    },
    { key: 'next', header: 'Příští termín', cell: nextText, tablet: true },
    { key: 'standing', header: 'Stav', cell: standingNode, tablet: true },
  ];

  /* The phone's card: name, next appointment, status chips - what a thumb
     needs to pick the right person, nothing else. */
  const renderCard = (p: Patient) => (
    <Stack spacing={0.75}>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'primary.main' }}>
        {p.firstName} {p.lastName}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {nextText(p) === '—' ? 'Bez objednaného termínu' : `Příští termín: ${nextText(p)}`}
      </Typography>
      {p.phone && p.phone.trim() !== '' && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{p.phone}</Typography>
      )}
      <Box>{standingNode(p)}</Box>
    </Stack>
  );

  return (
    <Box>
      <PageHeader
        title="Pacienti"
        subtitle={query === '' ? `Kartotéka kliniky · ${total} záznamů` : `Nalezeno: ${total}`}
        actions={mayRegister && !phone ? (
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
              sx: { minHeight: 44 },
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
        />
        {/* On a phone the chips run in one row that scrolls sideways, so they
            never push the list off the screen. */}
        <Box
          data-filters={phone ? 'scroll' : 'wrap'}
          sx={phone ? { overflowX: 'auto', mx: -2, px: 2, pb: 0.5, '& [role="group"]': { flexWrap: 'nowrap' }, '& button': { flexShrink: 0, minHeight: 44 } } : undefined}
        >
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} ariaLabel="Filtr pacientů" />
        </Box>
      </Stack>

      <ResponsiveDataList
        rows={visible}
        rowKey={(p) => p.id}
        columns={columns}
        renderCard={renderCard}
        onRowClick={(p) => navigate(`/patients/${p.id}`)}
        empty={emptyText}
        ariaLabel="Pacienti"
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mt: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {`Zobrazeno ${visible.length} z ${total} pacientů`}
          {pageCount > 1 ? ` · strana ${page + 1} z ${pageCount}` : ''}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ '& .MuiButton-root': { minHeight: 44 }, '& > *': { flex: { xs: 1, sm: 'none' } } }}>
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

      {/* The screen's one main action, pinned at the bottom on a phone. */}
      {mayRegister && phone && (
        <PinnedActionBar label="Nový pacient">
          <Button variant="contained" onClick={() => navigate('/patients/register')}>
            Nový pacient
          </Button>
        </PinnedActionBar>
      )}
    </Box>
  );
}
