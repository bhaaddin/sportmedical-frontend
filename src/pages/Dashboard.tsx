import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Card, Avatar, Button, Chip, TextField,
  InputAdornment, List, ListItemButton, Divider, CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Search, PersonAdd, EventAvailable, MeetingRoom, History as HistoryIcon,
  NotificationsNone, ArrowForward, CalendarMonth,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
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


/* ── Animated counter (kept: a number that cannot animate must still show) ── */
function AnimatedNumber({ value, duration = 1 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    const settle = setTimeout(() => setDisplay(value), duration * 1000 + 50);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      clearTimeout(settle);
    };
  }, [value, duration]);

  return <>{display}</>;
}

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

/* ── One panel of the plocha ── */
function Panel({
  title, icon, count, accent, action, children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  accent?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  const theme = useTheme();
  /* A panel with no accent of its own is the clinic's own colour, so the plocha
     follows the owner's chosen theme. The tiles that pass a colour (waiting,
     history, …) keep their own — those say what kind of panel it is. */
  const accentColor = accent ?? theme.palette.primary.main;
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 1.75, borderBottom: '1px solid #EEF1F1' }}>
        <Avatar sx={{ bgcolor: alpha(accentColor, 0.08), color: accentColor, width: 34, height: 34 }}>{icon}</Avatar>
        <Typography sx={{ fontWeight: 800, flex: 1 }}>{title}</Typography>
        {count !== undefined && (
          <Chip
            label={<AnimatedNumber value={count} />}
            size="small"
            sx={{ fontWeight: 800, bgcolor: alpha(accentColor, 0.08), color: accentColor }}
          />
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, py: 1 }}>{children}</Box>
      {action && (
        <Button
          onClick={action.onClick}
          endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
          sx={{ justifyContent: 'space-between', px: 2.5, py: 1.25, color: accentColor, fontWeight: 700, borderTop: '1px solid #EEF1F1', borderRadius: 0 }}
        >
          {action.label}
        </Button>
      )}
    </Card>
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
  const theme = useTheme();
  const navigate = useNavigate();
  const canSeePatients = usePermission('patients.view');
  const canRegister = usePermission('patients.register');
  const [patientTotal, setPatientTotal] = useState<number | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<DayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  /* ── Patient search: the centre of the plocha ── */
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

  const appointmentRow = (appt: DayAppointment) => (
    <ListItemButton
      key={appt.id}
      onClick={() => navigate('/planovani')}
      sx={{ borderRadius: 2, mb: 0.5, gap: 1.5, alignItems: 'center' }}
    >
      <Typography variant="caption" sx={{ fontWeight: 800, color: theme.palette.primary.main, minWidth: 44 }}>
        {formatPragueTime(appt.startUtc)}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {patientName(appt.patientId)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {appt.activityName}
        </Typography>
      </Box>
      <Chip
        label={STATUS_LABELS[statusName(appt.status) ?? ''] ?? `stav ${appt.status}`}
        size="small"
        sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main, fontWeight: 600 }}
      />
    </ListItemButton>
  );

  return (
    <Box>
      {/* ── Greeting ── */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#14202B' }}>
          {getGreeting()}, {user.firstName || 'Doktore'}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.25 }}>
          {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {patientTotal !== null ? ` · ${patientTotal} pacientů v registru` : ''}
        </Typography>
      </Box>

      {/* ── Vyhledání pacienta — the centre of the plocha ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card
          sx={{
            p: { xs: 2.5, md: 3.5 },
            mb: 3,
            borderRadius: 4,
            color: '#fff',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: '0 12px 30px rgba(13,115,119,0.28)',
            position: 'relative',
          }}
        >
          <Typography sx={{ fontWeight: 700, opacity: 0.9, mb: 1.5, letterSpacing: 0.2 }}>
            Vyhledání pacienta
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
            <TextField
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Jméno, příjmení nebo číslo pojištěnce"
              autoComplete="off"
              disabled={!canSeePatients}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: '#fff' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchResults.isFetching ? (
                    <InputAdornment position="end"><CircularProgress size={18} sx={{ color: '#fff' }} /></InputAdornment>
                  ) : undefined,
                  sx: {
                    bgcolor: 'rgba(255,255,255,0.16)',
                    borderRadius: 2.5,
                    color: '#fff',
                    '& input::placeholder': { color: 'rgba(255,255,255,0.75)', opacity: 1 },
                    '& fieldset': { border: 'none' },
                  },
                },
              }}
            />
            {canRegister && (
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={() => navigate('/patients/register')}
                sx={{
                  bgcolor: '#fff', color: theme.palette.primary.main, fontWeight: 800, borderRadius: 2.5,
                  px: 3, whiteSpace: 'nowrap', flexShrink: 0,
                  '&:hover': { bgcolor: '#F2FBFB' },
                }}
              >
                Nový pacient
              </Button>
            )}
          </Box>

          {/* Live results, over the hero. */}
          {canSeePatients && query.length >= 2 && (
            <Card sx={{ mt: 1.5, borderRadius: 2.5, color: 'text.primary', maxHeight: 320, overflowY: 'auto' }}>
              {searchResults.isLoading ? (
                <EmptyRow text="Hledám…" />
              ) : (searchResults.data ?? []).length === 0 ? (
                <EmptyRow text="Nikdo takový v registru není." />
              ) : (
                <List disablePadding>
                  {(searchResults.data ?? []).map((p) => (
                    <ListItemButton key={p.id} onClick={() => navigate(`/patients/${p.id}`)} sx={{ gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main, width: 34, height: 34, fontSize: 14, fontWeight: 700 }}>
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
            </Card>
          )}
        </Card>
      </motion.div>

      {/* ── Panels ── */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel
            title="Objednaní"
            icon={<CalendarMonth sx={{ fontSize: 20 }} />}
            count={booked.length}
            action={{ label: 'Otevřít kalendář', onClick: () => navigate('/planovani') }}
          >
            {booked.length === 0 ? <EmptyRow text="Na dnešek nikdo objednaný." /> : booked.map(appointmentRow)}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel
            title="Čekárna"
            icon={<MeetingRoom sx={{ fontSize: 20 }} />}
            count={waiting.length}
            accent="#2E7D32"
            action={{ label: 'Dnešní přehled', onClick: () => navigate('/dnes') }}
          >
            {waiting.length === 0 ? <EmptyRow text="Čekárna je prázdná." /> : waiting.map(appointmentRow)}
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Panel
            title="Historie"
            icon={<HistoryIcon sx={{ fontSize: 20 }} />}
            accent="#5B4B8A"
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
                      <Avatar sx={{ bgcolor: '#5B4B8A14', color: '#5B4B8A', width: 32, height: 32, fontSize: 13, fontWeight: 700 }}>
                        {(p.firstName[0] ?? '') + (p.lastName[0] ?? '')}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <Panel
            title="Notifikace"
            icon={<NotificationsNone sx={{ fontSize: 20 }} />}
            count={alerts.length}
            accent="#ED6C02"
          >
            {alerts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <EventAvailable sx={{ fontSize: 40, color: '#2E7D3255', mb: 0.5 }} />
                <Typography variant="body2">Vše vyřízeno — žádné notifikace.</Typography>
              </Box>
            ) : (
              <List disablePadding>
                {alerts.map((a) => (
                  <ListItemButton key={a.id} onClick={() => navigate('/planovani')} sx={{ borderRadius: 2, mb: 0.5, gap: 1.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ED6C02', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {patientName(a.patientId)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Chybí podklady — {a.activityName}
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
                      {formatPragueTime(a.startUtc)}
                    </Typography>
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
