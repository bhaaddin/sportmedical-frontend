/* ══════════════════════════════════════════════════════════════
   REPORT SCHEDULING — PLAN-01 Feature A86-A90
   - Schedule automated report generation
   - Daily/weekly/monthly reports
   - Email delivery
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Chip
} from '@mui/material';
import {
  Schedule as ScheduleIcon, Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  frequency: string;
  recipients: string;
  enabled: boolean;
  lastRun: string;
}

export default function ReportScheduling() {
  const [reports, setReports] = useState<ScheduledReport[]>([
    { id: '1', name: 'Týdenní přehled', type: 'appointments', frequency: 'weekly', recipients: 'admin@clinic.cz', enabled: true, lastRun: '2026-09-01' },
    { id: '2', name: 'Měsíční fakturace', type: 'billing', frequency: 'monthly', recipients: 'finance@clinic.cz', enabled: true, lastRun: '2026-08-01' },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledReport | null>(null);
  const [formData, setFormData] = useState<Partial<ScheduledReport>>({ name: '', type: 'appointments', frequency: 'weekly', recipients: '', enabled: true });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleSave = () => {
    if (!formData.name) return;
    if (editing) {
      setReports(reports.map(r => r.id === editing.id ? { ...r, ...formData } as ScheduledReport : r));
    } else {
      setReports([...reports, { ...formData, id: Date.now().toString(), lastRun: '' } as ScheduledReport]);
    }
    setDialogOpen(false);
    setSnackbar({ open: true, message: 'Plán uložen', severity: 'success' });
  };

  const FREQ_LABELS: Record<string, string> = { daily: 'Denně', weekly: 'Týdně', monthly: 'Měsíčně' };
  const TYPE_LABELS: Record<string, string> = { appointments: 'Termíny', billing: 'Fakturace', patients: 'Pacienti', audit: 'Audit' };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon color="primary" /> Plánování reportů
            </Typography>
            <Typography variant="body2" color="text.secondary">Automatické generování a odesílání reportů</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormData({ name: '', type: 'appointments', frequency: 'weekly', recipients: '', enabled: true }); setDialogOpen(true); }}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Nový plán
          </Button>
        </Box>
      </motion.div>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Typ</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Frekvence</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Příjemci</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Poslední spuštění</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Aktivní</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{report.name}</TableCell>
                <TableCell><Chip label={TYPE_LABELS[report.type]} size="small" /></TableCell>
                <TableCell>{FREQ_LABELS[report.frequency]}</TableCell>
                <TableCell>{report.recipients}</TableCell>
                <TableCell>{report.lastRun ? new Date(report.lastRun).toLocaleDateString('cs-CZ') : '—'}</TableCell>
                <TableCell><Switch checked={report.enabled} size="small" /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => { setEditing(report); setFormData(report); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => setReports(reports.filter(r => r.id !== report.id))} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Upravit plán' : 'Nový plán'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Název" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Typ reportu</InputLabel>
                <Select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} label="Typ reportu">
                  <MenuItem value="appointments">Termíny</MenuItem>
                  <MenuItem value="billing">Fakturace</MenuItem>
                  <MenuItem value="patients">Pacienti</MenuItem>
                  <MenuItem value="audit">Audit</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Frekvence</InputLabel>
                <Select value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} label="Frekvence">
                  <MenuItem value="daily">Denně</MenuItem>
                  <MenuItem value="weekly">Týdně</MenuItem>
                  <MenuItem value="monthly">Měsíčně</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Příjemci (email)" value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Uložit</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
