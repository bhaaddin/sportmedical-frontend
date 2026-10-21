import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Avatar, Box, Button, CircularProgress, InputAdornment, List, ListItemButton, TextField, Typography,
} from '@mui/material';
import { ArrowForward, PersonAdd, Search } from '@mui/icons-material';
import { useQueries, useQuery } from '@tanstack/react-query';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { usePermission } from '../auth/usePermission';
import { appointmentsApi } from '../api/appointments';
import { activitiesApi } from '../api/activities';
import type { DayAppointment } from '../api/bookingContracts';
import { statusName, statusTally } from '../api/bookingContracts';
import { formatCzk, shownPrice, sumPrices } from '../components/booking/grid/appointmentPrice';
import DayOverviewPage from './booking/DayOverviewPage';
import { toDateOnly, formatPragueTime } from '../utils/time';
import { StatusChip } from '../components/ui';
import { useDevice } from '../layout/useDevice';
import {
  EntityCard, EntityLink, MetricCard, PageFrame, RecentAndPinned, Shelf, TARGET_SX, entityTarget,
} from '../ui/shelf';
import { AttentionShelf, useAttention } from '../ui/shelf/AttentionShelf';
import { APPOINTMENT_STATUS_WORD } from '../ui/shelf/words';
import { SoftCard } from '../components/ui/SoftCard';

/*
 * Přehled (the plocha): the owner's and the desk's home, built as shelves (docs/ui-shelf-system.md).
 *
 *   header      the greeting, the date and the size of the register; "Otevřít kalendář" is the one primary action
 *   Dnes        five figures, each a link to where it is worked on (they count up once)
 *   Vyžaduje pozornost   what needs a person today - every case a link to the place that fixes it (ui/shelf/attention.ts)
 *   Najít pacienta       the quick lookup of the register; Ctrl/Cmd+K reaches everything else
 *   Objednaní, Čekárna   today's work: the time, the patient (a connected chip with a peek), the činnost and its price
 *   Připnuté a nedávné   the person's own shortcuts; Nově v kartotéce   the last patients registered
 *
 * Same data and the same rules as before: today means today (a one-day range), a cancellation and a no-show are not the
 * day's work, the waiting room is CheckedIn only, a name rather than an id, nothing about patients without the permission.
 */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dobré ráno';
  if (h < 17) return 'Dobrý den';
  return 'Dobrý večer';
}

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

const avatarLead = (p: Patient) => (
  <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>
    {(p.firstName[0] ?? '') + (p.lastName[0] ?? '')}
  </Avatar>
);

/* ── One row of today's work: the time, who, what, where it stands, and the way into the booking ── */
function TodayRow({ appt, name, patientId, subtitle }: { appt: DayAppointment; name: string; patientId: string; subtitle: string }) {
  const status = statusName(appt.status) ?? '';
  const word = APPOINTMENT_STATUS_WORD[status] ?? { label: `stav ${appt.status}`, tone: 'grey' as const };
  const target = entityTarget({ kind: 'appointment', id: appt.id, calendarId: appt.calendarId ?? undefined });
  return (
    <Box
      role="listitem"
      data-row="appointment"
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.25, py: 0.5, minHeight: 56, borderRadius: 1.5, '&:hover': { bgcolor: 'action.hover' } }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 700, minWidth: 46, fontVariantNumeric: 'tabular-nums' }}>{formatPragueTime(appt.startUtc)}</Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="div" sx={{ fontSize: 15, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {patientId !== '' ? <EntityLink entity={{ kind: 'patient', id: patientId, label: name }} /> : name}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary', overflowWrap: 'anywhere' }}>{subtitle}</Typography>
      </Box>
      <StatusChip tone={word.tone} size="sm">{word.label}</StatusChip>
      <Button
        component={RouterLink}
        to={target.to}
        aria-label={`Otevřít termín: ${name}, ${formatPragueTime(appt.startUtc)}`}
        sx={{ ...TARGET_SX, minWidth: 44, px: 0.5, flexShrink: 0 }}
      >
        <ArrowForward sx={{ fontSize: 18 }} />
      </Button>
    </Box>
  );
}

function OwnerDashboard() {
  const navigate = useNavigate();
  const device = useDevice();
  const phone = device === 'phone';
  const canSeePatients = usePermission('patients.view');
  const canRegister = usePermission('patients.register');
  const canBill = usePermission('billing.manage');
  const [patientTotal, setPatientTotal] = useState<number | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<DayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  let user: { firstName?: string } = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    /* a plocha without a name is still a plocha */
  }

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

  /* ── Nově v kartotéce: the most recent register entries ── */
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
  const nameOf = (a: DayAppointment): string => patientNames[a.patientId] ?? a.patientName ?? a.patientId.slice(0, 8);

  /* Etapa 12, "ceny všude": agreed, else the row's list price, else the
     činnost's catalogue price - the one cached list, asked only when some row
     carries no price of its own. */
  const needsCatalogue = todayAppointments.some((a) => a.agreedPriceCzk == null && a.listPriceCzk == null);
  const activities = useQuery({
    queryKey: ['activities'],
    queryFn: () => activitiesApi.list(),
    enabled: needsCatalogue,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const priceOf = (a: DayAppointment) =>
    shownPrice(a, activities.data?.activities.find((x) => x.id === a.activityId)?.priceCzk ?? null);
  /* The day's money: every visit that still stands or has happened, never a cancellation or a no-show. */
  const todayCzk = useMemo(
    () => sumPrices(
      todayAppointments
        .filter((a) => { const tally = statusTally(a.status); return tally !== 'cancelled' && tally !== 'noShow'; })
        .map((a) => shownPrice(a, activities.data?.activities.find((x) => x.id === a.activityId)?.priceCzk ?? null)),
    ),
    [todayAppointments, activities.data],
  );

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

  /* What needs a person: the rules read today's day and the lists the application already holds. */
  const attention = useAttention(loading ? null : todayAppointments, patientNames);
  const missingPaperwork = attention.groups.find((g) => g.id === 'paperworkToday')?.count ?? 0;

  const today = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const row = (a: DayAppointment) => {
    const price = priceOf(a);
    return (
      <TodayRow
        key={a.id}
        appt={a}
        name={nameOf(a)}
        patientId={canSeePatients && patientNames[a.patientId] !== undefined ? a.patientId : ''}
        /* The činnost and what it costs, on one line: "Kontrola · 1 600 Kč". */
        subtitle={[a.activityName, price.adjusted ? `${price.text} (upraveno)` : price.text].filter((part) => part !== '').join(' · ')}
      />
    );
  };

  const recentPatients = canSeePatients ? (recent.data?.items ?? []) : [];

  return (
    <PageFrame
      title={`${getGreeting()}, ${user.firstName || 'Doktore'}`}
      purpose={`${today.charAt(0).toUpperCase()}${today.slice(1)}${patientTotal !== null ? ` · ${patientTotal} pacientů v registru` : ''}`}
      primaryAction={{ label: 'Otevřít kalendář', to: '/planovani' }}
      actions={canRegister ? (
        <Button component={RouterLink} to="/patients/register" variant="outlined" startIcon={<PersonAdd />} sx={{ ...TARGET_SX, minHeight: phone ? 44 : undefined }}>Nový pacient</Button>
      ) : undefined}
    >
      {/* ── Dnes: the five figures, each a link to where it is worked on ── */}
      <Shelf id="today-figures" title="Dnes" layout="row" fill minCardWidth={168} phoneWidth="156px" cardHeight={116} skeletons={5} loading={loading}>
        <MetricCard label="Dnes objednáno" value={booked.length} hint="termínů, které ještě stojí" to="/dnes" />
        <MetricCard label="V čekárně" value={waiting.length} hint="přišli a čekají" tone={waiting.length > 0 ? 'green' : 'grey'} to="/dnes" />
        <MetricCard label="Chybí podklady" value={missingPaperwork} hint="dnešních termínů bez dotazníku" tone={missingPaperwork > 0 ? 'red' : 'grey'} to="/dnes" />
        {/* Etapa 12: the day's money - today's visits that stand or happened, at their agreed prices. */}
        <MetricCard label="Dnes" value={todayCzk} format={formatCzk} hint="za dnešní nezrušené termíny" to={canBill ? '/billing' : undefined} />
        <MetricCard
          label="Kartotéka"
          value={patientTotal}
          hint={patientTotal !== null ? 'registrovaných pacientů' : 'bez oprávnění'}
          to={canSeePatients ? '/patients' : undefined}
        />
      </Shelf>

      {/* ── What needs a person, and - from a landscape tablet - the lookup of the register beside it ── */}
      <Box data-shelf-pair="" sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
      <AttentionShelf state={attention} />

      {/* ── Najít pacienta ── */}
      <Shelf id="find-patient" title="Najít pacienta" hint="Ctrl/Cmd + K hledá všechno" layout="board">
        <Box sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Jméno, příjmení, telefon nebo e-mail"
              autoComplete="off"
              disabled={!canSeePatients}
              slotProps={{
                htmlInput: { 'aria-label': 'Vyhledání pacienta' },
                input: {
                  sx: { minHeight: 44 },
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
          </Box>
          {canSeePatients && query.length >= 2 && (
            <SoftCard tone="muted" sx={{ mt: 1.5, p: 0, maxHeight: 320, overflowY: 'auto' }}>
              {searchResults.isLoading ? (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: 14 }}>Hledám…</Typography>
              ) : (searchResults.data ?? []).length === 0 ? (
                <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: 14 }}>Nikdo takový v registru není.</Typography>
              ) : (
                <List disablePadding>
                  {(searchResults.data ?? []).map((p) => (
                    <ListItemButton key={p.id} onClick={() => navigate(`/patients/${p.id}`)} sx={{ gap: 1.5, minHeight: 44 }}>
                      {avatarLead(p)}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{p.lastName} {p.firstName}</Typography>
                        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>nar. {czechDob(p.dateOfBirth)}</Typography>
                      </Box>
                      <ArrowForward sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </SoftCard>
          )}
          {!canSeePatients && (
            <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary' }}>Bez oprávnění zobrazit pacienty.</Typography>
          )}
        </Box>
      </Shelf>
      </Box>

      {/* ── Dnešní práce: who is booked and who is waiting, side by side from a landscape tablet ── */}
      <Box data-shelf-pair="" sx={{ display: 'grid', gap: { xs: 3, md: 3.5 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <Shelf
          id="booked"
          title="Objednaní"
          hint="Dnešní termíny, které ještě stojí"
          count={booked.length}
          layout="list"
          maxHeight="min(46dvh, 440px)"
          loading={loading}
          empty={booked.length === 0}
          emptyState={{ text: 'Na dnešek nikdo objednaný.', action: { label: 'Objednat termín', to: '/planovani', state: { newAppointment: Date.now() } } }}
          viewAll={{ to: '/dnes', label: 'Dnešní přehled' }}
        >
          {booked.map(row)}
        </Shelf>
        <Shelf
          id="waiting"
          title="Čekárna"
          hint="Přišli a čekají"
          count={waiting.length}
          countTone="green"
          layout="list"
          maxHeight="min(46dvh, 440px)"
          loading={loading}
          empty={waiting.length === 0}
          emptyState={{ text: 'Čekárna je prázdná.' }}
          viewAll={{ to: '/dnes', label: 'Dnešní přehled' }}
        >
          {waiting.map(row)}
        </Shelf>
      </Box>

      <RecentAndPinned emptyAction={canSeePatients ? { label: 'Všichni pacienti', to: '/patients' } : undefined} />

      {canSeePatients && (
        <Shelf
          id="new-patients"
          title="Nově v kartotéce"
          hint="Poslední zapsaní pacienti"
          count={patientTotal ?? undefined}
          layout="row"
          loading={recent.isLoading}
          error={recent.isError}
          onRetry={() => void recent.refetch()}
          empty={recentPatients.length === 0}
          emptyState={{ text: 'Zatím žádní pacienti.', action: canRegister ? { label: 'Nový pacient', to: '/patients/register' } : undefined }}
          viewAll={{ to: '/patients', label: 'Všichni pacienti' }}
        >
          {recentPatients.map((p) => (
            <EntityCard
              key={p.id}
              entity={{ kind: 'patient', id: p.id, label: `${p.lastName} ${p.firstName}` }}
              subtitle={`nar. ${czechDob(p.dateOfBirth)}`}
            />
          ))}
        </Shelf>
      )}
    </PageFrame>
  );
}
