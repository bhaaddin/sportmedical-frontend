import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Avatar, Button, TextField,
  InputAdornment, List, ListItemButton, CircularProgress, Stack,
} from '@mui/material';
import { Search, PersonAdd, ArrowForward } from '@mui/icons-material';
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
import { DashboardSkeleton } from '../components/SkeletonLoader';
import { KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip, type ChipTone } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useDevice } from '../layout/useDevice';

/*
 * The plocha (owner/admin home), in the board's look: a greeting, the day's
 * facts as KPI cards, the patient search, and the four lists as bordered
 * cards. Same data and the same actions as before; no gradients, no shadows,
 * no counters that count up.
 *
 * Three layouts (Etapa 2, rule 3):
 *   desktop  four compact panels across, the primary action in the header
 *   tablet   panels as tables of three columns - two across when the screen
 *            is wide enough (landscape), one when it is not (portrait)
 *   phone    every row its own card with a 44px target, KPI cards two-up,
 *            and the primary action ("Otevřít kalendář") pinned at the bottom
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

/* ── One row of a panel, said once and drawn three ways ── */
interface PanelRow {
  id: string;
  onClick: () => void;
  /** A time, an avatar or a chip: what the eye finds first. */
  lead: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

const rowTitleSx = { fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;
const rowSubtitleSx = { fontSize: 14, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;

function MainCell({ row }: { row: PanelRow }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={rowTitleSx}>{row.title}</Typography>
      {row.subtitle !== undefined && <Typography sx={rowSubtitleSx}>{row.subtitle}</Typography>}
    </Box>
  );
}

function PanelAction({ action, bordered = false }: { action: { label: string; onClick: () => void }; bordered?: boolean }) {
  return (
    <Button
      onClick={action.onClick}
      endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
      sx={{
        justifyContent: 'space-between',
        px: bordered ? 2.5 : 0.5,
        py: 1.25,
        minHeight: 44,
        width: '100%',
        color: 'primary.main',
        ...(bordered ? { borderTop: '1px solid', borderColor: 'divider', borderRadius: 0 } : {}),
      }}
    >
      {action.label}
    </Button>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Box sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: 14 }}>
      {text}
    </Box>
  );
}

/*
 * One panel of the plocha. Desktop: a bordered card with a compact list.
 * Tablet: the list becomes a table of three columns. Phone: every row is its
 * own card. The title, the count and the footer action are the same everywhere.
 */
function Panel({
  title, count, action, rows, headers, empty,
}: {
  title: string;
  count?: number;
  action?: { label: string; onClick: () => void };
  rows: PanelRow[];
  /** Column headings for the tablet's table: lead, main, trailing. */
  headers: [string, string, string?];
  empty: string;
}) {
  const device = useDevice();
  const desktop = device === 'desktop';
  const head = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: desktop ? 2.5 : 0.5, pt: desktop ? 2 : 0, pb: 1.25 }}>
      <SectionLabel sx={{ mb: 0, flex: 1 }}>{title}</SectionLabel>
      {count !== undefined && (
        <StatusChip tone={count > 0 ? 'green' : 'grey'} size="sm">{count}</StatusChip>
      )}
    </Box>
  );

  if (desktop) {
    return (
      <SoftCard data-panel={title} sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>
        {head}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, pb: 1 }}>
          {rows.length === 0 ? (
            <EmptyRow text={empty} />
          ) : (
            <List disablePadding>
              {rows.map((row) => (
                <ListItemButton key={row.id} onClick={row.onClick} sx={{ borderRadius: 2, mb: 0.25, gap: 1.5, alignItems: 'center' }}>
                  {row.lead}
                  <MainCell row={row} />
                  {row.trailing}
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
        {action && <PanelAction action={action} bordered />}
      </SoftCard>
    );
  }

  const hasTrailing = rows.some((r) => r.trailing !== undefined);
  const columns: DataColumn<PanelRow>[] = [
    { key: 'lead', header: headers[0], cell: (r) => r.lead, tablet: true, width: 96 },
    { key: 'main', header: headers[1], cell: (r) => <MainCell row={r} />, tablet: true },
    ...(hasTrailing
      ? [{ key: 'trailing', header: headers[2] ?? '', cell: (r: PanelRow) => r.trailing, tablet: true, align: 'right' as const }]
      : []),
  ];

  return (
    <Box data-panel={title} sx={{ minWidth: 0 }}>
      {head}
      <ResponsiveDataList
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        onRowClick={(r) => r.onClick()}
        empty={empty}
        ariaLabel={title}
        renderCard={(r) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {r.lead}
            <MainCell row={r} />
            {r.trailing}
          </Box>
        )}
      />
      {action && (
        <Box sx={{ mt: 0.5 }}>
          <PanelAction action={action} />
        </Box>
      )}
    </Box>
  );
}

const timeLead = (iso: string) => (
  <Typography sx={{ fontSize: 14, fontWeight: 700, minWidth: 44 }}>{formatPragueTime(iso)}</Typography>
);

const avatarLead = (p: Patient) => (
  <Avatar sx={{ width: 34, height: 34, fontSize: 13 }}>
    {(p.firstName[0] ?? '') + (p.lastName[0] ?? '')}
  </Avatar>
);

function OwnerDashboard() {
  const navigate = useNavigate();
  const device = useDevice();
  const phone = device === 'phone';
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
  /* Notifikace: today's appointments still missing their paperwork. */
  const alerts = useMemo(
    () => booked.concat(waiting).filter((a) => a.paperwork && !a.paperwork.ready),
    [booked, waiting],
  );

  if (loading) return <DashboardSkeleton />;

  const toCalendar = () => navigate('/planovani');

  const appointmentRow = (appt: DayAppointment): PanelRow => {
    const status = statusName(appt.status) ?? '';
    const price = priceOf(appt);
    return {
      id: appt.id,
      onClick: toCalendar,
      lead: timeLead(appt.startUtc),
      title: patientName(appt.patientId),
      /* The činnost and what it costs, on one line: "Kontrola · 1 600 Kč". */
      subtitle: [appt.activityName, price.adjusted ? `${price.text} (upraveno)` : price.text]
        .filter((part) => part !== '')
        .join(' · '),
      trailing: (
        <StatusChip tone={STATUS_TONES[status] ?? 'grey'} size="sm">
          {STATUS_LABELS[status] ?? `stav ${appt.status}`}
        </StatusChip>
      ),
    };
  };

  const alertRow = (a: DayAppointment): PanelRow => ({
    id: a.id,
    onClick: toCalendar,
    lead: <StatusChip tone="beige" size="sm">{formatPragueTime(a.startUtc)}</StatusChip>,
    title: patientName(a.patientId),
    subtitle: `Chybí podklady — ${a.activityName}`,
  });

  const historyRows: PanelRow[] = !canSeePatients
    ? []
    : (recent.data?.items ?? []).map((p) => ({
        id: p.id,
        onClick: () => navigate(`/patients/${p.id}`),
        lead: avatarLead(p),
        title: `${p.lastName} ${p.firstName}`,
        subtitle: `nar. ${czechDob(p.dateOfBirth)}`,
      }));
  const historyEmpty = !canSeePatients
    ? 'Bez oprávnění zobrazit pacienty.'
    : recent.isLoading
      ? 'Načítám…'
      : 'Zatím žádní pacienti.';

  const today = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const openCalendar = (
    <Button variant="contained" onClick={toCalendar} sx={{ minHeight: phone ? 44 : undefined }}>
      Otevřít kalendář
    </Button>
  );

  return (
    <Box data-device={device}>
      <PageHeader
        title={`${getGreeting()}, ${user.firstName || 'Doktore'}`}
        subtitle={`${today.charAt(0).toUpperCase()}${today.slice(1)}${patientTotal !== null ? ` · ${patientTotal} pacientů v registru` : ''}`}
        actions={phone ? undefined : openCalendar}
      />

      {/* ── The day's facts: two-up on a phone and a portrait tablet, four across when there is room ── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }} data-layout={phone ? 'kpi-2up' : 'kpi'}>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <KpiCard label="Dnes objednáno" value={booked.length} hint="termínů, které ještě stojí" />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <KpiCard label="V čekárně" value={waiting.length} hint="přišli a čekají" tone={waiting.length > 0 ? 'green' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          <KpiCard label="Chybí podklady" value={alerts.length} hint="dnešních termínů bez dotazníku" tone={alerts.length > 0 ? 'red' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          {/* Etapa 12: the day's money - today's visits that stand or happened, at their agreed prices. */}
          <KpiCard label="Dnes" value={formatCzk(todayCzk)} hint="za dnešní nezrušené termíny" />
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
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
                sx: phone ? { minHeight: 44 } : undefined,
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
              sx={{ whiteSpace: 'nowrap', flexShrink: 0, minHeight: phone ? 44 : undefined }}
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
                  <ListItemButton key={p.id} onClick={() => navigate(`/patients/${p.id}`)} sx={{ gap: 1.5, minHeight: 44 }}>
                    {avatarLead(p)}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{p.lastName} {p.firstName}</Typography>
                      <Typography sx={rowSubtitleSx}>nar. {czechDob(p.dateOfBirth)}</Typography>
                    </Box>
                    <ArrowForward sx={{ fontSize: 18, color: 'text.disabled' }} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </SoftCard>
        )}
      </SoftCard>

      {/* ── Panels: one column on a phone and a portrait tablet, two on a landscape tablet, four on a desktop ── */}
      <Box
        data-layout={phone ? 'stack' : device === 'tablet' ? 'tablet' : 'four'}
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: '1fr',
          '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))' },
          '@media (min-width: 1280px)': { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <Panel
          title="Objednaní"
          count={booked.length}
          action={{ label: 'Otevřít kalendář', onClick: toCalendar }}
          rows={booked.map(appointmentRow)}
          headers={['Čas', 'Pacient', 'Stav']}
          empty="Na dnešek nikdo objednaný."
        />
        <Panel
          title="Čekárna"
          count={waiting.length}
          action={{ label: 'Dnešní přehled', onClick: () => navigate('/dnes') }}
          rows={waiting.map(appointmentRow)}
          headers={['Čas', 'Pacient', 'Stav']}
          empty="Čekárna je prázdná."
        />
        <Panel
          title="Historie"
          action={{ label: 'Všichni pacienti', onClick: () => navigate('/patients') }}
          rows={historyRows}
          headers={['', 'Pacient']}
          empty={historyEmpty}
        />
        <Panel
          title="Notifikace"
          count={alerts.length}
          rows={alerts.map(alertRow)}
          headers={['Čas', 'Pacient']}
          empty="Vše vyřízeno — žádné notifikace."
        />
      </Box>

      {/* ── The main action of a phone screen is pinned at the bottom ── */}
      {phone && <PinnedActionBar label="Hlavní akce">{openCalendar}</PinnedActionBar>}
    </Box>
  );
}
