/* ══════════════════════════════════════════════════════════════
   ANALYTICS DASHBOARD
   KPI cards, charts (Recharts), audit trail table, live feed
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Tabs, Tab,
  Avatar, Badge, LinearProgress,
  List, ListItem, ListItemText,
} from '@mui/material';
import {
  TrendingUp, People, Receipt, Event, AccessTime, Warning,
  LocalHospital, FitnessCenter, BarChart as BarChartIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

/* ── Sample data (will connect to backend) ── */
const monthlyData = [
  { month: 'Led', appointments: 120, revenue: 180000, patients: 45 },
  { month: 'Úno', appointments: 135, revenue: 210000, patients: 52 },
  { month: 'Bře', appointments: 110, revenue: 165000, patients: 38 },
  { month: 'Dub', appointments: 145, revenue: 230000, patients: 55 },
  { month: 'Kvě', appointments: 160, revenue: 250000, patients: 61 },
  { month: 'Čvn', appointments: 155, revenue: 245000, patients: 58 },
];

const insuranceData = [
  { name: 'VZP', value: 45, color: '#1565C0' },
  { name: 'VOZP', value: 20, color: '#C62828' },
  { name: 'ČPZP', value: 15, color: '#F57F17' },
  { name: 'OZP', value: 12, color: '#2E7D32' },
  { name: 'Ostatní', value: 8, color: '#757575' },
];

const doctorPerformance = [
  { name: 'Dr. Novák', appointments: 85, hours: 120 },
  { name: 'Dr. Svobodová', appointments: 72, hours: 105 },
  { name: 'Dr. Dvořák', appointments: 65, hours: 95 },
  { name: 'Dr. Procházka', appointments: 58, hours: 80 },
];

const auditEntries = [
  { id: '1', time: '14:32', actor: 'Dr. Novák', action: 'Vytvořil termín', target: 'Jan Novotný', type: 'create' },
  { id: '2', time: '14:28', actor: 'Recepce', action: 'Změnila termín', target: 'Marie Horáková', type: 'update' },
  { id: '3', time: '14:15', actor: 'Admin', action: 'Vynutil přepsání', target: 'Blok 7h', type: 'override' },
  { id: '4', time: '13:50', actor: 'Dr. Svobodová', action: 'Vytvořila diagnostiku', target: 'Petr Černý', type: 'create' },
  { id: '5', time: '13:22', actor: 'Systém', action: 'Odeslána faktura', target: 'INV-2026-042', type: 'system' },
];

const typeColors: Record<string, string> = {
  create: '#16A34A', update: '#0288D1', override: '#ED6C02', system: '#7C3AED',
};

export default function AnalyticsDashboard() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Analytika & Přehled</Typography>

      {/* ── KPI Cards ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Termíny dnes', value: '12', change: '+3', icon: <Event />, color: '#0D7377' },
          { label: 'Pacienti (měsíc)', value: '58', change: '+8', icon: <People />, color: '#2E7D32' },
          { label: 'Příjem (měsíc)', value: '245 000 Kč', change: '+12%', icon: <Receipt />, color: '#ED6C02' },
          { label: 'Čekající faktury', value: '7', change: '-2', icon: <AccessTime />, color: '#D32F2F' },
        ].map((kpi, i) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">{kpi.label}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, color: kpi.color, mt: 0.5 }}>{kpi.value}</Typography>
                      <Chip label={kpi.change} size="small"
                        sx={{ mt: 0.5, height: 20, fontSize: 11, bgcolor: '#16A34A14', color: '#16A34A' }} />
                    </Box>
                    <Box sx={{ bgcolor: `${kpi.color}14`, color: kpi.color, p: 1.5, borderRadius: 2 }}>
                      {kpi.icon}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTab-root': { fontWeight: 600, textTransform: 'none' } }}>
        <Tab label="Přehled" />
        <Tab label="Audit Trail" />
        <Tab label="Živý feed" />
      </Tabs>

      {/* ── Overview Charts ── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Měsíční přehled</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="appointments" fill="#0D7377" name="Termíny" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="patients" fill="#14A3A8" name="Pacienti" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Pojišťovny</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={insuranceData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                      paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} ${value}%`}>
                      {insuranceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Výkon lékařů</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={doctorPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="appointments" fill="#0D7377" name="Termíny" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="hours" fill="#7C3AED" name="Hodiny" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Audit Trail ── */}
      {tab === 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Uživatel</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Akce</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Cíl</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Typ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditEntries.map((entry, i) => (
                  <motion.tr key={entry.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{entry.time}</Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#0D7377' }}>
                          {entry.actor[0]}
                        </Avatar>
                        {entry.actor}
                      </Box>
                    </TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.target}</TableCell>
                    <TableCell>
                      <Chip label={entry.type} size="small"
                        sx={{ bgcolor: `${typeColors[entry.type]}14`, color: typeColors[entry.type], fontWeight: 600, textTransform: 'capitalize' }} />
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      )}

      {/* ── Live Feed ── */}
      {tab === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Badge variant="dot" color="success">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#16A34A' }} />
                </Badge>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Živý feed</Typography>
              </Box>
              <List sx={{ p: 0 }}>
                {auditEntries.map((entry, i) => (
                  <motion.div key={entry.id}
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}>
                    <ListItem sx={{ px: 1, py: 1, mb: 0.5, borderRadius: 2, '&:hover': { bgcolor: 'var(--color-bg-hover)' } }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={entry.time} size="small" sx={{ fontFamily: 'monospace', height: 20, fontSize: 10 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{entry.actor}</Typography>
                            <Typography variant="body2" color="text.secondary">{entry.action}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{entry.target}</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  </motion.div>
                ))}
              </List>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </Box>
  );
}
