import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Typography, Card, CardContent, Avatar, Button, Chip,
} from '@mui/material';
import {
  People, Science, Warning, PersonAdd, CalendarMonth, Receipt,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useQueries } from '@tanstack/react-query';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { usePermission } from '../auth/usePermission';
import { appointmentsApi } from '../api/appointments';
import type { DayAppointment } from '../api/bookingContracts';
import { statusName, statusTally } from '../api/bookingContracts';
import { toDateOnly, formatPragueTime } from '../utils/time';
import { DashboardSkeleton } from '../components/SkeletonLoader';

/* ── Animated counter ── */
/**
 * Counts up to `value` - and shows `value` even when it cannot count.
 *
 * The animation runs on `requestAnimationFrame`, which a browser does not fire
 * for a document it is not painting: a backgrounded tab, a restored session, a
 * headless run. The display began at 0 and only ever moved inside the frame
 * callback, so in those cases every tile on this screen sat at zero
 * indefinitely - the first numbers anyone sees, all reading nothing, on a
 * screen whose data had loaded perfectly well.
 *
 * Caught twice before it was fixed: once as "all four tiles show 0 while the
 * lists below them have data", and again the next day as "the tile says 0 and
 * the timeline under it shows two appointments". Both times the data was right
 * and the counter was lying about it.
 *
 * So the frame loop is now an embellishment with a deadline: if the animation
 * has not arrived at the value by the time it was supposed to, the value is
 * simply shown. A number that cannot animate must still be correct.
 */
function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
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

    /* The guarantee. Fires a little after the animation should have finished;
       if frames did arrive this sets what is already there. */
    const settle = setTimeout(() => setDisplay(value), duration * 1000 + 50);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      clearTimeout(settle);
    };
  }, [value, duration]);

  return <>{display}</>;
}

/* ── Time-based greeting ── */
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

/* ── Stat Card ── */
function StatCard({ title, value, icon, color, subtitle, delay = 0 }: {
  title: string; value: string | number; icon: React.ReactNode;
  color: string; subtitle?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
      style={{ height: '100%' }}
    >
      <Card sx={{ height: '100%', overflow: 'visible' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{title}</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: color }}>
                {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
              </Typography>
              {subtitle && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{subtitle}</Typography>}
            </Box>
            <Avatar sx={{ bgcolor: `${color}18`, color, width: 52, height: 52, boxShadow: `0 4px 14px ${color}30` }}>
              {icon}
            </Avatar>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* Name by patient id, from whichever lookups have come back. */
function namesOf(results: { data?: Patient }[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const r of results) {
    if (r.data) names[r.data.id] = `${r.data.firstName} ${r.data.lastName}`;
  }
  return names;
}

/* ── Dashboard ── */
export default function Dashboard() {
  const navigate = useNavigate();
  const canSeePatients = usePermission('patients.view');
  const canRegister = usePermission('patients.register');
  const canBill = usePermission('billing.manage');
  /* `totalCount` from the register, not the length of its first page. */
  const [patientTotal, setPatientTotal] = useState<number | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<DayAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  /*
   * "Dnes v kalendari" now asks the booking API, and it asks for today.
   *
   * It used to read `/api/scheduling/appointments?fromUtc=&toUtc=`, and that
   * endpoint ignores its own date range. Measured with a control: asking for
   * the year 2020 returns the same four appointments from September 2026. So
   * the tile labelled "Schuzek dnes" was a count of every appointment that has
   * ever existed - on 11. 9. 2026 it showed 2 for a day with none, and the two
   * it counted were eleven and thirteen days away.
   *
   * The booking endpoint honours the range, which is the reason to move rather
   * than to filter here: a client-side date filter would paper over a read that
   * cannot be trusted for anything else either.
   *
   * It carries no patient name, only `patientId`; the names are looked up
   * below, once per patient.
   */
  useEffect(() => {
    const today = toDateOnly(new Date());

    Promise.all([
      canSeePatients
        ? patientsApi.list({ pageSize: 1 }).then((page) => page.totalCount).catch(() => null)
        : Promise.resolve(null),
      appointmentsApi.range(today, today).catch(() => []),
    ]).then(([total, appts]) => {
      setPatientTotal(total);
      /*
       * Cancelled and no-show rows are not today's work; kept and completed
       * ones are. `statusTally` owns that mapping - the day overview counts by
       * the same function, so the two screens cannot drift.
       *
       * Not `isTerminalStatus`, which was tried first and is a different
       * question: it answers "can this still change?". Completed is terminal
       * and would have vanished from the tile, while NoShow is not terminal -
       * it can be undone - and would have been counted as work still to do.
       * Exactly inverted, and the tests caught it.
       */
      const standing = appts.filter((a) => {
        const tally = statusTally(a.status);
        return tally === 'booked' || tally === 'arrived';
      });
      setTodayAppointments(standing);
    }).finally(() => setLoading(false));
  }, [canSeePatients]);

  /*
   * Each of today's patients by id - the register's first page held only the
   * first twenty surnames and left everybody after them as an id. There is no
   * "these ids" read on the server, so it is one request per patient, but
   * through the query cache under the same key the day overview and the
   * appointment detail use: coming back to this screen, or opening it after
   * either of those, asks again only for what is more than five minutes old.
   */
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

  /*
   * A copy, because `.sort()` reorders in place and this array is React state.
   * Sorting it directly during render mutated the very value the component was
   * rendering from - it works until something else reads that state expecting
   * the order it was given, and then the bug surfaces somewhere unrelated.
   */
  const sortedAppointments = useMemo(
    () =>
      [...todayAppointments].sort(
        (a, b) => a.startUtc.localeCompare(b.startUtc),
      ),
    [todayAppointments],
  );

  /* The day rows carry `patientId` only; the names are fetched above. A
     patient that cannot be fetched still shows as an id rather than as an
     empty row - a nameless appointment is still one somebody has to keep. */
  const patientName = (patientId: string): string =>
    patientNames[patientId] ?? patientId.slice(0, 8);

  const quickActions = [
    { label: 'Nová diagnostika', icon: <Science />, path: '/diagnostics/new', color: '#0D7377', gradient: 'linear-gradient(135deg, #0D7377 0%, #14A3A8 100%)' },
    { label: 'Plánování', icon: <CalendarMonth />, path: '/planovani', color: '#2E7D32', gradient: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)' },
    ...(canRegister
      ? [{ label: 'Registrace pacienta', icon: <PersonAdd />, path: '/patients/register', color: '#0288D1', gradient: 'linear-gradient(135deg, #0288D1 0%, #039BE5 100%)' }]
      : []),
    ...(canBill
      ? [{ label: 'Fakturace', icon: <Receipt />, path: '/billing', color: '#ED6C02', gradient: 'linear-gradient(135deg, #ED6C02 0%, #FF9800 100%)' }]
      : []),
  ];

  if (loading) return <DashboardSkeleton />;

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#1A1A2E' }}>
            {getGreeting()}, {user.firstName || 'Doctor'} 👋
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 16 }}>
            Přehled ordinace — {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Typography>
        </Box>
      </motion.div>

      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {canSeePatients && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard title="Pacienti" value={patientTotal ?? '—'} icon={<People />} color="#0D7377" subtitle="Celkem registrovaných" delay={0} />
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard title="Dnes v kalendáři" value={todayAppointments.length} icon={<CalendarMonth />} color="#2E7D32" subtitle="Schůzek dnes" delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard title="Čekající" value={todayAppointments.filter(a => statusName(a.status) === 'Scheduled').length} icon={<Warning />} color="#ED6C02" subtitle="Ke zpracování" delay={0.2} />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
            <Card sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Dnešní harmonogram</Typography>
                  <Typography variant="body2" color="text.secondary">Časová osa dnešních schůzek</Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/planovani')} sx={{ color: '#0D7377', fontWeight: 600 }}>
                  Zobrazit kalendář →
                </Button>
              </Box>
              {todayAppointments.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                  <CalendarMonth sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                  <Typography color="text.secondary">Žádné schůzky na dnešek</Typography>
                  <Button variant="contained" size="small" onClick={() => navigate('/planovani')}
                    sx={{ mt: 1, bgcolor: '#0D7377', borderRadius: 2 }}>
                    Otevřít kalendář
                  </Button>
                </Box>
              ) : (
                <Box>
                  {sortedAppointments
                    .map((appt, i) => {
                      const color = '#0D7377';
                      return (
                        <motion.div key={appt.id}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.08 }}
                          whileHover={{ x: 4, backgroundColor: '#f8f9fa' }}
                          style={{ borderRadius: 8, padding: '8px 12px', marginBottom: 4, cursor: 'pointer' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ width: 4, height: 40, borderRadius: 2, bgcolor: color }} />
                            <Box sx={{ minWidth: 100 }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: color }}>
                                {/* 3.3: UTC on the wire, Prague on the screen. `getHours()`
                                    read the runner's own zone, which is only the same
                                    thing while everybody sits in Prague. */}
                                {formatPragueTime(appt.startUtc)} — {formatPragueTime(appt.endUtc)}
                              </Typography>
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontWeight: 500 }}>{patientName(appt.patientId)}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {appt.activityName}
                                {appt.paperwork && !appt.paperwork.ready ? ' • chybí podklady' : ''}
                              </Typography>
                            </Box>
                            {/* An unknown code is shown as the code, not folded into
                                a familiar-looking label. */}
                            <Chip label={STATUS_LABELS[statusName(appt.status) ?? ''] ?? `stav ${appt.status}`}
                              size="small" sx={{
                                bgcolor: statusName(appt.status) === 'Completed' ? '#2E7D3214' : '#0D737714',
                                color: statusName(appt.status) === 'Completed' ? '#2E7D32' : '#0D7377',
                                fontWeight: 500,
                              }} />
                          </Box>
                        </motion.div>
                      );
                    })}
                </Box>
              )}
            </Card>
          </motion.div>
        </Grid>

      </Grid>

      {/* Quick Actions */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Rychlé akce</Typography>
      <Grid container spacing={2}>
        {quickActions.map((action, i) => (
          <Grid key={action.path} size={{ xs: 6, md: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
              whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                fullWidth variant="contained" startIcon={action.icon}
                onClick={() => navigate(action.path)}
                sx={{
                  py: 2.5, borderRadius: 3, fontSize: 14, fontWeight: 600, textTransform: 'none',
                  background: action.gradient,
                  boxShadow: `0 4px 16px ${action.color}35`,
                  '&:hover': { background: action.gradient, boxShadow: `0 6px 24px ${action.color}45`, transform: 'translateY(-2px)' },
                  transition: 'all 0.2s ease',
                }}>
                {action.label}
              </Button>
            </motion.div>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
