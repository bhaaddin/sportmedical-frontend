import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, ButtonGroup, Paper, Skeleton } from '@mui/material';
import { Assessment, Science, People, TrendingUp, Download, CalendarToday, FitnessCenter, Warning } from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { patientsApi, type Patient } from '../api/patients';
import { injuriesApi, type Injury } from '../api/injuries';

// Colors
const COLORS = ['#0D7377', '#2E7D32', '#ED6C02', '#0288D1', '#9C27B0', '#D32F2F', '#FF5722'];

export default function Reports() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1m' | '3m' | '6m' | '1y'>('6m');

  useEffect(() => {
    Promise.all([
      patientsApi.getAll().catch(() => []),
      injuriesApi.getAll().catch(() => []),
    ]).then(([pats, injs]) => {
      setPatients(pats);
      setInjuries(injs);
    }).finally(() => setLoading(false));
  }, []);

  // --- Computed data from real APIs ---

  // Patient age distribution
  const getAgeGroup = (dob: string): string => {
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) return '< 18';
    if (age < 26) return '18-25';
    if (age < 36) return '26-35';
    if (age < 46) return '36-45';
    if (age < 56) return '46-55';
    if (age < 66) return '56-65';
    return '65+';
  };

  const ageDistribution = [
    { age: '< 18', count: 0 }, { age: '18-25', count: 0 }, { age: '26-35', count: 0 },
    { age: '36-45', count: 0 }, { age: '46-55', count: 0 }, { age: '56-65', count: 0 }, { age: '65+', count: 0 },
  ];
  patients.forEach(p => {
    const group = getAgeGroup(p.dateOfBirth);
    const bucket = ageDistribution.find(a => a.age === group);
    if (bucket) bucket.count++;
  });

  // Sex distribution
  const sexDistribution = [
    { name: 'Muži', value: patients.filter(p => p.sex === 'Male').length },
    { name: 'Ženy', value: patients.filter(p => p.sex === 'Female').length },
    { name: 'Neuvedeno', value: patients.filter(p => p.sex !== 'Male' && p.sex !== 'Female').length },
  ].filter(s => s.value > 0);

  // Injury body region distribution
  const injuryByRegion: Record<string, number> = {};
  injuries.forEach(i => { injuryByRegion[i.bodyRegion] = (injuryByRegion[i.bodyRegion] || 0) + 1; });
  const injuryRegionData = Object.entries(injuryByRegion)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Injury severity distribution
  const severityData = [
    { name: 'Mírné (1)', value: injuries.filter(i => i.severity === 1).length, color: '#2E7D32' },
    { name: 'Střední (2)', value: injuries.filter(i => i.severity === 2).length, color: '#ED6C02' },
    { name: 'Vážné (3)', value: injuries.filter(i => i.severity === 3).length, color: '#D32F2F' },
    { name: 'Kritické (4)', value: injuries.filter(i => i.severity === 4).length, color: '#B71C1C' },
  ].filter(s => s.value > 0);

  // Injury status distribution
  const statusData = [
    { name: 'Akutní', value: injuries.filter(i => i.status === 'Acute').length, color: '#D32F2F' },
    { name: 'Rehabilitace', value: injuries.filter(i => i.status === 'Rehabilitating').length, color: '#ED6C02' },
    { name: 'Návrat do hry', value: injuries.filter(i => i.status === 'ReturningToPlay').length, color: '#0288D1' },
    { name: 'Vyléčeno', value: injuries.filter(i => i.status === 'Cleared').length, color: '#2E7D32' },
    { name: 'Chronické', value: injuries.filter(i => i.status === 'Chronic').length, color: '#9C27B0' },
  ].filter(s => s.value > 0);

  // Average days out
  const clearedInjuries = injuries.filter(i => i.actualDaysOut);
  const avgDaysOut = clearedInjuries.length > 0
    ? Math.round(clearedInjuries.reduce((a, i) => a + (i.actualDaysOut || 0), 0) / clearedInjuries.length)
    : 0;

  // Injury side distribution
  const sideData = [
    { name: 'Levá', value: injuries.filter(i => i.side === 'Left').length },
    { name: 'Pravá', value: injuries.filter(i => i.side === 'Right').length },
    { name: 'Centrální', value: injuries.filter(i => i.side === 'Central').length },
    { name: 'Obě', value: injuries.filter(i => i.side === 'Bilateral').length },
  ].filter(s => s.value > 0);

  // Fitness radar (placeholder based on data availability)
  const radarData = [
    { subject: 'Počet pacientů', A: Math.min(patients.length * 5, 100), fullMark: 100 },
    { subject: 'Poranění', A: Math.min(injuries.length * 10, 100), fullMark: 100 },
    { subject: 'Vyléčení', A: injuries.length > 0 ? Math.round(injuries.filter(i => i.status === 'Cleared').length / injuries.length * 100) : 0, fullMark: 100 },
    { subject: 'Aktivní', A: injuries.length > 0 ? Math.round(injuries.filter(i => i.status !== 'Cleared').length / injuries.length * 100) : 0, fullMark: 100 },
    { subject: 'Recidiva', A: injuries.length > 0 ? Math.round(injuries.filter(i => i.isRecurrence).length / injuries.length * 100) : 0, fullMark: 100 },
  ];

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => <Grid key={i} size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} /></Grid>)}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assessment color="primary" /> Přehledy a analytika
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {patients.length} pacientů · {injuries.length} poranění · Data z reálného provozu
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<Download />} sx={{ borderRadius: 2, px: 3 }}>
            Exportovat PDF
          </Button>
        </Box>
      </motion.div>

      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Pacienti celkem', value: patients.length, color: '#0D7377', icon: <People /> },
          { label: 'Poranění celkem', value: injuries.length, color: '#D32F2F', icon: <Warning /> },
          { label: 'Aktivní poranění', value: injuries.filter(i => i.status !== 'Cleared').length, color: '#ED6C02', icon: <Science /> },
          { label: 'Průměr dnů mimo', value: avgDaysOut, color: '#2E7D32', icon: <FitnessCenter /> },
        ].map((stat, i) => (
          <Grid key={stat.label} size={{ xs: 6, md: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: stat.color }}>{stat.value}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Charts Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Patient Age Distribution */}
        <Grid size={{ xs: 12, md: 8 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Věkové rozložení pacientů</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Registrovaní pacienti dle věkové skupiny</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="age" tick={{ fontSize: 12 }} stroke="#999" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#999" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#0D7377" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Grid>

        {/* Sex Distribution */}
        <Grid size={{ xs: 12, md: 4 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Rozložení pohlaví</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Podle pohlaví</Typography>
              {sexDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={sexDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                      paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {sexDistribution.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <People sx={{ fontSize: 48, opacity: 0.3 }} />
                  <Typography>Žádná data</Typography>
                </Box>
              )}
            </Card>
          </motion.div>
        </Grid>

        {/* Injury by Body Region */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Poranění dle oblasti</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Nejčastěji zasažené oblasti těla</Typography>
              {injuryRegionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={injuryRegionData} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#999" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#999" width={100} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {injuryRegionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <Warning sx={{ fontSize: 48, opacity: 0.3 }} />
                  <Typography>Žádná poranění</Typography>
                </Box>
              )}
            </Card>
          </motion.div>
        </Grid>

        {/* Injury Severity */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Závažnost poranění</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Rozložení dle stupně závažnosti</Typography>
              {severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={severityData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                      paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {severityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <Warning sx={{ fontSize: 48, opacity: 0.3 }} />
                  <Typography>Žádná data</Typography>
                </Box>
              )}
            </Card>
          </motion.div>
        </Grid>

        {/* Injury Status */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Stav poranění</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Aktuální distribuce stavů</Typography>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                      paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <Warning sx={{ fontSize: 48, opacity: 0.3 }} />
                  <Typography>Žádná data</Typography>
                </Box>
              )}
            </Card>
          </motion.div>
        </Grid>

        {/* Fitness Radar */}
        <Grid size={{ xs: 12, md: 6 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Přehled aktivity</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Souhrnné metriky ordinace</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e0e0e0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} stroke="#666" />
                  <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="#ccc" domain={[0, 100]} />
                  <Radar name="Hodnota" dataKey="A" stroke="#0D7377" fill="#0D7377" fillOpacity={0.25} strokeWidth={2} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}
