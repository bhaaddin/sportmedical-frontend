import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Paper, Typography, Card, CardContent, Avatar,
  List, ListItem, ListItemAvatar, ListItemText, Divider, Button, Chip, Skeleton,
} from '@mui/material';
import {
  People, Science, TrendingUp, Warning, PersonAdd, Assessment,
  LocalHospital, AccessTime, CalendarMonth, Receipt, Inventory2,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { calendarApi } from '../api/calendar';
import type { Appointment } from '../api/calendar';
import { DashboardSkeleton } from '../components/SkeletonLoader';

/* ── Animated counter ── */
function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
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

const SERVICE_COLORS: Record<string, string> = {
  'Základní prohlídka': '#0D7377',
  'Komplexní prohlídka': '#095456',
  'Spiroergometrie': '#2E7D32',
  'Základní diagnostika': '#0288D1',
  'Komplexní diagnostika': '#1565C0',
  'VO2max': '#ED6C02',
  'InBody770': '#9C27B0',
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

/* ── Dashboard ── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    Promise.all([
      patientsApi.getAll().catch(() => []),
      calendarApi.getAppointments(todayStr, tomorrow.toISOString()).catch(() => []),
    ]).then(([pats, appts]) => {
      setPatients(pats);
      /* The legacy read hands back cancelled appointments too, with status
         "Cancelled" - 8 of 13 rows on the day this was measured. Counting the
         rows made "Dnes v kalendari" report them as booked today. Dropped
         once, here, so the three tiles and the list below cannot disagree. */
      setTodayAppointments(appts.filter((a) => a.status !== 'Cancelled'));
    }).finally(() => setLoading(false));
  }, []);

  const quickActions = [
    { label: 'Nová diagnostika', icon: <Science />, path: '/diagnostics/new', color: '#0D7377', gradient: 'linear-gradient(135deg, #0D7377 0%, #14A3A8 100%)' },
    { label: 'Plánování', icon: <CalendarMonth />, path: '/planovani', color: '#2E7D32', gradient: 'linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%)' },
    { label: 'Registrace pacienta', icon: <PersonAdd />, path: '/patients/register', color: '#0288D1', gradient: 'linear-gradient(135deg, #0288D1 0%, #039BE5 100%)' },
    { label: 'Fakturace', icon: <Receipt />, path: '/billing', color: '#ED6C02', gradient: 'linear-gradient(135deg, #ED6C02 0%, #FF9800 100%)' },
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
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Pacienti" value={patients.length} icon={<People />} color="#0D7377" subtitle="Celkem registrovaných" delay={0} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Dnes v kalendáři" value={todayAppointments.length} icon={<CalendarMonth />} color="#2E7D32" subtitle="Schůzek dnes" delay={0.1} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Diagnostika" value={todayAppointments.filter(a => a.serviceType?.includes('diagnostika') || a.serviceType?.includes('Diagnostika')).length} icon={<Science />} color="#0288D1" subtitle="Dnes" delay={0.2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Čekající" value={todayAppointments.filter(a => a.status === 'Scheduled').length} icon={<Warning />} color="#ED6C02" subtitle="Ke zpracování" delay={0.3} />
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 8 }}>
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
                  {todayAppointments
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map((appt, i) => {
                      const color = SERVICE_COLORS[appt.serviceType] || '#0D7377';
                      const start = new Date(appt.startTime);
                      const end = new Date(appt.endTime);
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
                                {start.getHours().toString().padStart(2, '0')}:{start.getMinutes().toString().padStart(2, '0')} — {end.getHours().toString().padStart(2, '0')}:{end.getMinutes().toString().padStart(2, '0')}
                              </Typography>
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontWeight: 500 }}>{appt.patientName}</Typography>
                              <Typography variant="caption" color="text.secondary">{appt.serviceType} • {appt.room}</Typography>
                            </Box>
                            <Chip label={appt.status === 'Scheduled' ? 'Naplánováno' : appt.status === 'Completed' ? 'Hotovo' : appt.status}
                              size="small" sx={{
                                bgcolor: appt.status === 'Completed' ? '#2E7D3214' : '#0D737714',
                                color: appt.status === 'Completed' ? '#2E7D32' : '#0D7377',
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

        {/* Recent Patients */}
        <Grid size={{ xs: 12, md: 4 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Naposledy pacienti</Typography>
              {patients.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocalHospital sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
                  <Typography color="text.secondary">Zatím žádní pacienti</Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {patients.slice(0, 5).map((p) => (
                    <motion.div key={p.id} whileHover={{ x: 4, backgroundColor: '#f8f9fa' }} transition={{ duration: 0.15 }}>
                      <ListItem sx={{ px: 1, borderRadius: 2, mb: 0.5, cursor: 'pointer' }} onClick={() => navigate(`/patients/${p.id}`)}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#0D7377', width: 40, height: 40, fontSize: 14 }}>
                            {p.firstName[0]}{p.lastName[0]}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography sx={{ fontWeight: 500, fontSize: 14 }}>{p.firstName} {p.lastName}</Typography>}
                          secondary={new Date(p.createdAtUtc).toLocaleDateString('cs-CZ')}
                        />
                      </ListItem>
                    </motion.div>
                  ))}
                </List>
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
