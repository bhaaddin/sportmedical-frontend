/* ══════════════════════════════════════════════════════════════
   DATA EXPORT — PLAN-01 Feature A56-A60
   - Export patients, appointments, billing to CSV/PDF
   - Date range filter
   - Custom field selection
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, Checkbox, FormControlLabel,
  FormGroup, Alert, Snackbar, CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon, Description as FileIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

type ExportType = 'patients' | 'appointments' | 'billing' | 'diagnoses';
type ExportFormat = 'csv' | 'json';

const EXPORT_OPTIONS: Record<ExportType, { label: string; fields: string[] }> = {
  patients: {
    label: 'Pacienti',
    fields: ['Jméno', 'Příjmení', 'Email', 'Telefon', 'Datum narození', 'Pojišťovna', 'Datum registrace'],
  },
  appointments: {
    label: 'Termíny',
    fields: ['Pacient', 'Datum', 'Čas', 'Služba', 'Lékař', 'Sál', 'Stav'],
  },
  billing: {
    label: 'Fakturace',
    fields: ['Číslo faktury', 'Pacient', 'Datum', 'Částka', 'Stav', 'Pojišťovna'],
  },
  diagnoses: {
    label: 'Diagnózy',
    fields: ['Pacient', 'ICD-10 kód', 'Název', 'Datum', 'Stav'],
  },
};

export default function DataExport() {
  const [exportType, setExportType] = useState<ExportType>('patients');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>(EXPORT_OPTIONS.patients.fields);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleExportTypeChange = (type: ExportType) => {
    setExportType(type);
    setSelectedFields(EXPORT_OPTIONS[type].fields);
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await client.post('/api/export', {
        type: exportType,
        format: exportFormat,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        fields: selectedFields,
      }, { responseType: 'blob' });

      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${exportType}-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);

      setSnackbar({ open: true, message: 'Export dokončen', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Chyba při exportu', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <DownloadIcon color="primary" /> Export dat
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Export pacientů, termínů, faktur a diagnóz
          </Typography>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* Export Type */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Typ exportu</Typography>
              <FormControl fullWidth>
                <InputLabel>Typ dat</InputLabel>
                <Select value={exportType} onChange={(e) => handleExportTypeChange(e.target.value as ExportType)} label="Typ dat">
                  {Object.entries(EXPORT_OPTIONS).map(([key, opt]) => (
                    <MenuItem key={key} value={key}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Formát</InputLabel>
                <Select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} label="Formát">
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* Date Range */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Časové období</Typography>
              <TextField fullWidth type="date" label="Od" value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
              <TextField fullWidth type="date" label="Do" value={dateTo}
                onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </CardContent>
          </Card>
        </Grid>

        {/* Fields */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Vyberte pole</Typography>
              <FormGroup row>
                {EXPORT_OPTIONS[exportType].fields.map((field) => (
                  <FormControlLabel key={field} control={
                    <Checkbox checked={selectedFields.includes(field)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedFields([...selectedFields, field]);
                        else setSelectedFields(selectedFields.filter(f => f !== field));
                      }} />
                  } label={field} />
                ))}
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Export Button */}
        <Grid size={{ xs: 12 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
              onClick={handleExport} disabled={loading || selectedFields.length === 0}
              sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' }, px: 4 }}>
              Exportovat
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
