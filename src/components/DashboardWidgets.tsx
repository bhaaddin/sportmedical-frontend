/* ══════════════════════════════════════════════════════════════
   DASHBOARD WIDGETS — PLAN-01 Feature C201-C210
   - KPI cards with trends
   - Upcoming appointments list
   - Quick stats
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Avatar, List, ListItem,
  ListItemAvatar, ListItemText, Divider, IconButton, Tooltip, Skeleton
} from '@mui/material';
import {
  People as PeopleIcon, Event as EventIcon, AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon, Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

interface DashboardStats {
  totalPatients: number;
  activePatients: number;
  todaySessions: number;
  totalSessions: number;
  activeInjuries: number;
  pendingReview: number;
}

interface UpcomingAppointment {
  id: string;
  patientName: string;
  service: string;
  time: string;
  provider: string;
}

export default function DashboardWidgets() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, upcomingRes] = await Promise.allSettled([
        client.get('/api/dashboard/stats'),
        client.get('/api/dashboard/upcoming'),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (upcomingRes.status === 'fulfilled') setUpcoming(upcomingRes.value.data?.value ?? upcomingRes.value.data ?? []);
    } catch { /* use defaults */ }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <Grid container spacing={3}>
        {[1, 2, 3, 4].map(i => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" height={120} />
          </Grid>
        ))}
      </Grid>
    );
  }

  const kpis = [
    { label: 'Pacienti', value: stats?.totalPatients ?? 0, trend: 0, icon: <PeopleIcon />, color: '#0D7377' },
    { label: 'Dnešní termíny', value: stats?.todaySessions ?? 0, trend: 0, icon: <EventIcon />, color: '#2E7D32' },
    { label: 'Aktivní zranění', value: stats?.activeInjuries ?? 0, trend: 0, icon: <MoneyIcon />, color: '#ED6C02' },
    { label: 'Ke kontrole', value: stats?.pendingReview ?? 0, trend: 0, icon: <TrendingUpIcon />, color: '#0288D1' },
  ];

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {kpis.map((kpi, i) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>{kpi.label}</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>{kpi.value}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: kpi.color }}>{kpi.icon}</Avatar>
                  </Box>
                  {kpi.trend !== 0 && (
                    <Box display="flex" alignItems="center" mt={1}>
                      {kpi.trend >= 0 ? <ArrowUpIcon color="success" fontSize="small" /> : <ArrowDownIcon color="error" fontSize="small" />}
                      <Typography variant="body2" color={kpi.trend >= 0 ? 'success.main' : 'error.main'} sx={{ ml: 0.5 }}>
                        {Math.abs(kpi.trend)}%
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {upcoming.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Nadcházející termíny</Typography>
            <List>
              {upcoming.map((apt, i) => (
                <Box key={apt.id}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#0D7377' }}>
                        {apt.patientName.split(' ').map(n => n[0]).join('')}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={apt.patientName} secondary={`${apt.service} • ${apt.time} • ${apt.provider}`} />
                  </ListItem>
                  {i < upcoming.length - 1 && <Divider />}
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
