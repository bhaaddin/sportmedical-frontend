import React, { useState } from 'react';
import { Grid, Card, CardContent, Typography, TextField, Button, Box, Tabs, Tab, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { Download as DownloadIcon, Refresh as RefreshIcon, Dashboard as DashboardIcon, TrendingUp as TrendingUpIcon, People as PeopleIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { useDashboardMetrics, useAnalyticsReport, analyticsApi } from '../services/analyticsApi';
import { KPICards } from '../components/analytics/KPICards';
import { RevenueChart } from '../components/analytics/RevenueChart';
import { ServicesPieChart } from '../components/analytics/ServicesPieChart';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(value);

interface TabPanelProps { children?: React.ReactNode; index: number; value: number; }
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => value === index ? <Box>{children}</Box> : null;

const AnalyticsPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [dateFrom, setDateFrom] = useState<string>(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard } = useDashboardMetrics();
  const { data: report, isLoading: reportLoading, refetch: refetchReport } = useAnalyticsReport(dateFrom, dateTo);

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const blob = format === 'csv'
        ? await analyticsApi.exportCsv(dateFrom, dateTo)
        : await analyticsApi.exportExcel(dateFrom, dateTo);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics_${dateFrom}_${dateTo}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export dokončen');
    } catch {
      toast.error('Chyba při exportu');
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetchDashboard(), refetchReport()]);
    toast.success('Data aktualizována');
  };

  if (dashboardLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh"><CircularProgress /></Box>;
  }

  return (
    <Box maxWidth="xl" mx="auto">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Analytika</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <TextField type="date" label="Od" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} size="small" />
          <TextField type="date" label="Do" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} size="small" />
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExport('csv')}>CSV</Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExport('excel')}>Excel</Button>
          <Tooltip title="Obnovit data"><IconButton onClick={handleRefresh}><RefreshIcon /></IconButton></Tooltip>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab icon={<DashboardIcon />} label="Přehled" />
        <Tab icon={<TrendingUpIcon />} label="Tržby" />
        <Tab icon={<PeopleIcon />} label="Pacienti" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {dashboard && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}><KPICards metrics={dashboard} /></Grid>
            <Grid size={{ xs: 12, md: 8 }}>{report && <RevenueChart data={report.dailyTrend} />}</Grid>
            <Grid size={{ xs: 12, md: 4 }}><ServicesPieChart data={dashboard.topServices} /></Grid>
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Souhrn období</Typography>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography color="text.secondary">Celková tržba</Typography>
                      <Typography variant="h5">{formatCurrency(report?.totalRevenue || 0)}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography color="text.secondary">Celkem rezervací</Typography>
                      <Typography variant="h5">{report?.totalAppointments || 0}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography color="text.secondary">Noví pacienti</Typography>
                      <Typography variant="h5">{report?.totalNewPatients || 0}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                      <Typography color="text.secondary">Průměrná denní tržba</Typography>
                      <Typography variant="h5">{formatCurrency(report?.averageDailyRevenue || 0)}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>{report && <RevenueChart data={report.dailyTrend} showAppointments />}</Grid>
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Denní přehled</Typography>
                <Box overflow="auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8 }}>Datum</th>
                        <th style={{ textAlign: 'right', padding: 8 }}>Rezervace</th>
                        <th style={{ textAlign: 'right', padding: 8 }}>Dokončeno</th>
                        <th style={{ textAlign: 'right', padding: 8 }}>Zrušeno</th>
                        <th style={{ textAlign: 'right', padding: 8 }}>Tržba</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report?.dailyTrend.map((day) => (
                        <tr key={day.date}>
                          <td style={{ padding: 8 }}>{new Date(day.date).toLocaleDateString('cs-CZ')}</td>
                          <td style={{ textAlign: 'right', padding: 8 }}>{day.appointments}</td>
                          <td style={{ textAlign: 'right', padding: 8 }}>{day.completed}</td>
                          <td style={{ textAlign: 'right', padding: 8 }}>{day.cancelled}</td>
                          <td style={{ textAlign: 'right', padding: 8 }}>{formatCurrency(day.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Statistiky pacientů</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}><Typography color="text.secondary">Celkem pacientů</Typography><Typography variant="h4">{dashboard?.totalPatients}</Typography></Grid>
                  <Grid size={{ xs: 6 }}><Typography color="text.secondary">Noví dnes</Typography><Typography variant="h4">{dashboard?.newPatientsToday}</Typography></Grid>
                  <Grid size={{ xs: 6 }}><Typography color="text.secondary">Noví tento týden</Typography><Typography variant="h4">{dashboard?.newPatientsWeek}</Typography></Grid>
                  <Grid size={{ xs: 6 }}><Typography color="text.secondary">Noví tento měsíc</Typography><Typography variant="h4">{dashboard?.newPatientsMonth}</Typography></Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Kluby</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}><Typography color="text.secondary">Aktivní kluby</Typography><Typography variant="h4">{dashboard?.activeClubs}</Typography></Grid>
                  <Grid size={{ xs: 6 }}><Typography color="text.secondary">Tržba z klubů</Typography><Typography variant="h4">{formatCurrency(dashboard?.clubRevenue || 0)}</Typography></Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default AnalyticsPage;
