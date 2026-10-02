import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Avatar, Button, TextField,
  InputAdornment, List, ListItemButton, Divider, CircularProgress, Stack,
} from '@mui/material';
import { Search, PersonAdd, ArrowForward } from '@mui/icons-material';
import { useQueries, useQuery } from '@tanstack/react-query';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { usePermission } from '../auth/usePermission';
import { appointmentsApi } from '../api/appointments';
import type { DayAppointment } from '../api/bookingContracts';
import { statusName, statusTally } from '../api/bookingContracts';
import DayOverviewPage from './booking/DayOverviewPage';
import { toDateOnly, formatPragueTime } from '../utils/time';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip, type ChipTone } from '../components/ui';

/*
 * The plocha (owner/admin home), in the board's look: a greeting, the day's
 * facts as KPI cards, the patient search, and the four lists as bordered
 * cards. Same data and the same actions as before; no gradients, no shadows,
 * no counters that count up.
 */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dobré ráno';
  if (h < 17) return 'Dobrý den';
  return 'Dobrý večer';
}

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Naplánováno',
  Confirmed: 'Potvrzeno',
  CheckedIn: 'Přišel',
  Completed: 'Hotovo',
  Cancelled: 'Zrušeno',
  NoShow: 'Nepřišel',
};

const STATUS_TONES: Record<string, ChipTone> = {
  Scheduled: 'grey',
  Confirmed: 'green',
  CheckedIn: 'green',
  Completed: 'grey',
  Cancelled: 'red',
  NoShow: 'red',
};

const czechDob = (iso: string): string => {
  const [y, m, d] = (iso ?? '').split('-');
  return y && m && d ? `${Number(d)}. ${Number(m)}. ${y}` : '';
};

/* Name by patient id, from whichever lookups have come back. */
function namesOf(results: { data?: Patient }[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const r of results) {
    if (r.data) names[r.data.id] = `${r.data.firstName} ${r.data.lastName}`;
  }
  return names;
}

/* ── Dashboard: a doctor lands on their day; the owner/admin get the plocha. ── */
export default function Dashboard() {
  let role = '';
  try {
    role = JSON.parse(localStorage.getItem('user') || '{}').role || '';
  } catch {
    /* private mode / cleared storage — fall through to the full plocha */
  }
  if (role === 'Staff') return <DayOverviewPage />;
  return <OwnerDashboard />;
}

/* ── One panel of the plocha: a bordered card with a section label, a count and a footer action ── */
function Panel({
  title, count, action, children,
}: {
  title: string;
  count?: number;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <SoftCard sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pt: 2, pb: 1.25 }}>
        <SectionLabel sx={{ mb: 0, flex: 1 }}>{title}</SectionLabel>
        {count !== undefined && (
          <StatusChip tone={count > 0 ? 'green' : 'grey'} size="sm">{count}</StatusChip>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>{children}</Box>
      {action && (
        <Button
          onClick={action.onClick}
          endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
          sx={{ justifyContent: 'space-between', px: 2.5, py: 1.25, borderTop: '1px solid', borderColor: 'divider', borderRadius: 0, color: 'primary.main' }}
        >
          {action.label}
        </Button>
      )}
    </SoftCard>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: 14 }}>
      {text}
    </Box>
  );
}

function OwnerDashboard() {
  const navigate = useNavigate();
  const canSeePatients = usePermission('patients.view');
  const canRegister = usePermission('patients.register');
  const [patientTotal, setPatientTotal] = useState<number | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<DayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  /* ── Patient search ── */
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const searchResults = useQuery({
    queryKey: ['dashboard-patient-search', query],
    queryFn: () => patientsApi.search(query),
    enabled: canSeePatients && query.length >= 2,
    staleTime: 30_000,
    retry: false,
  });

  /* ── Historie: the most recent register entries ── */
  const recent = useQuery({
    queryKey: ['dashboard-recent-patients'],
    queryFn: () => patientsApi.list({ pageSize: 6 }),
    enabled: canSeePatients,
    staleTime: 60_000,
    retry: false,
  });

  /* Today's appointments (the booking API honours the range; see history). */
  useEffect(() => {
    const today = toDateOnly(new Date());
    let alive = true;
    Promise.all([
      canSeePatients
        ? patientsApi.list({ pageSize: 1 }).then((page) => page.totalCount).catch(() => null)
        : Promise.resolve(null),
      appointmentsApi.range(today, today).catch(() => []),
    ]).then(([total, appts]) => {
      if (!alive) return;
      setPatientTotal(total);
      setTodayAppointments(appts);
    }).finally(() => { if (alive) setLoading(false); });

    /* The plocha is a live board like the calendar: today's appointments refresh
       on their own so an arrival or a new booking shows without reloading. */
    const timer = window.setInterval(() => {
      void appointmentsApi.range(today, today)
        .then((appts) => { if (alive) setTodayAppointments(appts); })
        .catch(() => { /* keep the last good list */ });
    }, 60_000);

    return () => { alive = false; window.clearInterval(timer); };
  }, [canSeePatients]);

  const patientIds = useMemo(
    () => (canSeePatients ? [...new Set(todayAppointments.map((a) => a.patientId))] : []),
    [canSeePatients, todayAppointments],
  );
  const patientNames = useQueries({
    queries: patientIds.map((id) => ({
      queryKey: ['patient', id],
      queryFn: () => patientsApi.getById(id),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
    combine: namesOf,
  });
  const patientName = (patientId: string): string =>
    patientNames[patientId] ?? patientId.slice(0, 8);

  /* Split today's work the way the plocha does. */
  const booked = useMemo(
    () => todayAppointments
      .filter((a) => statusTally(a.status) === 'booked')
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    [todayAppointments],
  );
  /* The waiting room is who has arrived and is not yet done — CheckedIn only.
     statusTally lumps Completed in with arrived, which is right for a day count
     and wrong for a waiting room. */
  const waiting = useMemo(
    () => todayAppointments
      .filter((a) => statusName(a.status) === 'CheckedIn')
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc)),
    [todayAppointments],
  );
  /* Notifikace: today's appointments still missing their paperwork. */
  const alerts = useMemo(
    () => booked.concat(waiting).filter((a) => a.paperwork && !a.paperwork.ready),
    [booked, waiting],
  );

  if (loading) return <DashboardSkeleton />;

  const appointmentRow = (appt: DayAppointment) => {
    const status = statusName(appt.status) ?? '';
    return (
      <ListItemButton
        key={appt.id}
        onClick={() => navigate('/planovani')}
        sx={{ borderRadius: 2, mb: 0.25, gap: 1.5, alignItems: 'center' }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, minWidth: 44 }}>
          {formatPragueTime(appt.startUtc)}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {patientName(appt.patientId)}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {appt.activityName}
          </Typography>
        </Box>
        <StatusChip tone={STATUS_TONES[status] ?? 'grey'} size="sm">
          {STATUS_LABELS[status] ?? `stav ${appt.status}`}
        </StatusChip>
      </ListItemButton>
    );
  };

  const today = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Box>
      <PageHeader
        title={`${getGreeting()}, ${user.firstName || 'Doktore'}`}
        subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)}${patientTotal !== null ? ` · ${patientTotal} pacientů v registru` : ''}`}
        actions={
          <Button variant="contained" onClick={() => navigate('/planovani')}>
            Otevřít kalendář
          </Button>
        }
      />

      {/* ── The day's facts ── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Dnes objednáno" value={booked.length} hint="termínů, které ještě stojí" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="V čekárně" value={waiting.length} hint="přišli a čekají" tone={waiting.length > 0 ? 'green' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Chybí podklady" value={alerts.length} hint="dnešních termínů bez dotazníku" tone={alerts.length > 0 ? 'red' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard
            label="Kartotéka"
            value={patientTotal !== null ? patientTotal : '—'}
            hint={patientTotal !== null ? 'registrovaných pacientů' : 'bez oprávnění'}
          />
        </Grid>
      </Grid>

      {/* ── Vyhledání pacienta ── */}
      <SoftCard sx={{ mb: 2.5 }}>
        <SectionLabel>Vyhledání pacienta</SectionLabel>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Jméno, příjmení, telefon nebo e-mail"
            autoComplete="off"
            disabled={!canSeePatients}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchResults.isFetching ? (
                  <InputAdornment position="end"><CircularProgress size={18} /></InputAdornment>
                ) : undefined,
              },
            }}
          />
          {canRegister && (
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => navigate('/patients/register')}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Nový pacient
            </Button>
          )}
        </Stack>

        {canSeePatients && query.length >= 2 && (
          <SoftCard tone="muted" sx={{ mt: 1.5, p: 0, maxHeight: 320, overflowY: 'auto' }}>
            {searchResults.isLoading ? (
              <EmptyRow text="Hledám…" />
            ) : (searchResults.data ?? []).length === 0 ? (
              <EmptyRow text="Nikdo takový v registru není." />
            ) : (
              <List disablePadding>
                {(searchResults.data ?? []).map((p) => (
                  <ListItemButton key={p.id} onClick={() => navigate(`/patients/${p.id}`)} sx={{ gap: 1.5 }}>
                    <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>
                      {(p.firstName[0] ?? '') + (p.lastName[0] ?? '')}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }}>{p.lastName} {p.firstName}</Typography>
                      <Typography variant="caption" color="text.secondary">nar. {czechDob(p.dateOfBirth)}</Typography>
                    </Box>
                    <ArrowForward sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </SoftCard>
        )}
      </SoftCard>

      {/* ── Panels ── */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel
            title="Objednaní"
            count={booked.length}
            action={{ label: 'Otevřít kalendář', onClick: () => navigate('/planovani') }}
          >
            {booked.length === 0 ? <EmptyRow text="Na dnešek nikdo objednaný." /> : booked.map(appointmentRow)}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel
            title="Čekárna"
            count={waiting.length}
            action={{ label: 'Dnešní přehled', onClick: () => navigate('/dnes') }}
          >
            {waiting.length === 0 ? <EmptyRow text="Čekárna je prázdná." /> : waiting.map(appointmentRow)}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel
            title="Historie"
            action={{ label: 'Všichni pacienti', onClick: () => navigate('/patients') }}
          >
            {!canSeePatients ? (
              <EmptyRow text="Bez oprávnění zobrazit pacienty." />
            ) : recent.isLoading ? (
              <EmptyRow text="Načítám…" />
            ) : (recent.data?.items ?? []).length === 0 ? (
              <EmptyRow text="Zatím žádní pacienti." />
            ) : (
              <List disablePadding>
                {(recent.data?.items ?? []).map((p, i) => (
                  <Box key={p.id}>
                    {i > 0 && <Divider component="li" sx={{ mx: 1.5 }} />}
                    <ListItemButton onClick={() => navigate(`/patients/${p.id}`)} sx={{ borderRadius: 2, gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>
                        {(p.firstName[0] ?? '') + (p.lastName[0] ?? '')}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.lastName} {p.firstName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">nar. {czechDob(p.dateOfBirth)}</Typography>
                      </Box>
                    </ListItemButton>
                  </Box>
                ))}
              </List>
            )}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel title="Notifikace" count={alerts.length}>
            {alerts.length === 0 ? (
              <EmptyRow text="Vše vyřízeno — žádné notifikace." />
            ) : (
              <List disablePadding>
                {alerts.map((a) => (
                  <ListItemButton key={a.id} onClick={() => navigate('/planovani')} sx={{ borderRadius: 2, mb: 0.25, gap: 1.5 }}>
                    <StatusChip tone="beige" size="sm">{formatPragueTime(a.startUtc)}</StatusChip>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {patientName(a.patientId)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Chybí podklady — {a.activityName}
                      </Typography>
                    </Box>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
