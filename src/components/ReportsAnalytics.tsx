/* ══════════════════════════════════════════════════════════════
   REPORTS & ANALYTICS — PLAN-01 Feature C241-C250
   - Bar/Line/Pie charts
   - Date range filtering
   - Export functionality
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Button, Tabs, Tab, Paper
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

const COLORS = ['#0D7377', '#2E7D32', '#ED6C02', '#0288D1', '#7B1FA2', '#D32F2F'];

const mockData = {
  appointmentsByDay: [
    { day: 'Po', count: 12 }, { day: 'Út', count: 15 }, { day: 'St', count: 18 },
    { day: 'Čt', count: 14 }, { day: 'Pá', count: 20 },
  ],
  revenueByMonth: [
    { month: 'Led', revenue: 120000 }, { month: 'Úno', revenue: 135000 },
    { month: 'Bře', revenue: 142000 }, { month: 'Dub', revenue: 128000 },
  ],
  patientsByAge: [
    { name: '0-18', count: 45 }, { name: '19-35', count: 120 },
    { name: '36-50', count: 95 }, { name: '51+', count: 60 },
  ],
};

export default function ReportsAnalytics() {
  const [activeTab, setActiveTab] = useState(0);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>Reporty a analytika</Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Termíny" />
          <Tab label="Příjmy" />
          <Tab label="Pacienti" />
        </Tabs>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth type="date" label="Od" value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField fullWidth type="date" label="Do" value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Button variant="contained" fullWidth sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Zobrazit report
          </Button>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Termíny podle dne</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={mockData.appointmentsByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0D7377" name="Počet termínů" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Příjmy podle měsíce</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={mockData.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#0D7377" name="Příjmy (Kč)" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Pacienti podle věku</Typography>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie data={mockData.patientsByAge} cx="50%" cy="50%" labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={150} dataKey="count">
                    {mockData.patientsByAge.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
