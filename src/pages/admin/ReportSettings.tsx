import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Chip, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton } from '@mui/material';
import { Save, Assessment, TrendingUp, Schedule, Delete } from '@mui/icons-material';

interface AutoReport {
  id: string;
  name: string;
  type: string;
  frequency: string;
  recipients: string[];
  enabled: boolean;
}

const defaultReports: AutoReport[] = [
  { id: '1', name: 'Týdenní přehled', type: 'weekly_summary', frequency: 'weekly', recipients: ['admin@medistar.cz'], enabled: true },
  { id: '2', name: 'Měsíční fakturace', type: 'monthly_billing', frequency: 'monthly', recipients: ['ucty@medistar.cz'], enabled: true },
  { id: '3', name: 'Měsíční výkonnost', type: 'staff_performance', frequency: 'monthly', recipients: ['vedouci@medistar.cz'], enabled: false },
];

export default function ReportSettings() {
  const [reports, setReports] = useState<AutoReport[]>(defaultReports);
  const [settings, setSettings] = useState({
    defaultReportFormat: 'pdf',
    defaultChartType: 'bar',
    includeCharts: true,
    includeTables: true,
    includePatientNames: true,
    anonymizeData: false,
    fiscalYearStart: 1,
    reportLanguage: 'cs',
    exportFormats: ['pdf', 'xlsx', 'csv'],
    maxRowsPerReport: 10000,
  });
  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const toggleReport = (id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Nastavení reportů</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Default report settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Assessment color="primary" />
          <Typography variant="h6">Výchozí nastavení reportů</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Formát</InputLabel>
              <Select label="Formát" value={settings.defaultReportFormat} onChange={(e) => update('defaultReportFormat', e.target.value)}>
                <MenuItem value="pdf">PDF</MenuItem>
                <MenuItem value="xlsx">Excel</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Typ grafu</InputLabel>
              <Select label="Typ grafu" value={settings.defaultChartType} onChange={(e) => update('defaultChartType', e.target.value)}>
                <MenuItem value="bar">Sloupcový</MenuItem>
                <MenuItem value="line">Liniový</MenuItem>
                <MenuItem value="pie">Koláčový</MenuItem>
                <MenuItem value="area">Plošný</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Jazyk</InputLabel>
              <Select label="Jazyk" value={settings.reportLanguage} onChange={(e) => update('reportLanguage', e.target.value)}>
                <MenuItem value="cs">Čeština</MenuItem>
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="de">Deutsch</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Max řádků" value={settings.maxRowsPerReport} onChange={(e) => update('maxRowsPerReport', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel control={<Switch checked={settings.includeCharts} onChange={(e) => update('includeCharts', e.target.checked)} />} label="Zahrnout grafy" />
            <FormControlLabel control={<Switch checked={settings.includeTables} onChange={(e) => update('includeTables', e.target.checked)} />} label="Zahrnout tabulky" />
            <FormControlLabel control={<Switch checked={settings.includePatientNames} onChange={(e) => update('includePatientNames', e.target.checked)} />} label="Jména pacientů" />
            <FormControlLabel control={<Switch checked={settings.anonymizeData} onChange={(e) => update('anonymizeData', e.target.checked)} />} label="Anonymizovat data" />
          </Grid>
        </Grid>
      </Paper>

      {/* Auto Reports */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Schedule color="primary" />
          <Typography variant="h6">Automatické reporty</Typography>
        </Box>
        <List>
          {reports.map(report => (
            <ListItem key={report.id} divider>
              <ListItemText
                primary={report.name}
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Chip label={report.type} size="small" />
                    <Chip label={report.frequency} size="small" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      → {report.recipients.join(', ')}
                    </Typography>
                  </Box>
                }
              />
              <ListItemSecondaryAction>
                <Switch edge="end" checked={report.enabled} onChange={() => toggleReport(report.id)} />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
        <Button startIcon={<Save />} sx={{ mt: 1 }}>Přidat automatický report</Button>
      </Paper>

      {/* Export Formats */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Exportní formáty</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 4 }}><FormControlLabel control={<Switch checked={settings.exportFormats.includes('pdf')} onChange={(e) => {
            const formats = e.target.checked ? [...settings.exportFormats, 'pdf'] : settings.exportFormats.filter(f => f !== 'pdf');
            update('exportFormats', formats);
          }} />} label="PDF" /></Grid>
          <Grid size={{ xs: 4 }}><FormControlLabel control={<Switch checked={settings.exportFormats.includes('xlsx')} onChange={(e) => {
            const formats = e.target.checked ? [...settings.exportFormats, 'xlsx'] : settings.exportFormats.filter(f => f !== 'xlsx');
            update('exportFormats', formats);
          }} />} label="Excel" /></Grid>
          <Grid size={{ xs: 4 }}><FormControlLabel control={<Switch checked={settings.exportFormats.includes('csv')} onChange={(e) => {
            const formats = e.target.checked ? [...settings.exportFormats, 'csv'] : settings.exportFormats.filter(f => f !== 'csv');
            update('exportFormats', formats);
          }} />} label="CSV" /></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
