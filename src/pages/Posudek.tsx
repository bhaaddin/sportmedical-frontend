import { useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, TextField, Button, MenuItem, FormControlLabel, Checkbox } from '@mui/material';
import { Description, Download } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { posudekApi } from '../api/posudek';
import toast from 'react-hot-toast';

export default function Posudek() {
  const [form, setForm] = useState({
    patientId: '', type: 'ZakladniProhlidka', practitioner: '', practitionerTitle: 'MUDr.',
    patientName: '', patientBirthNumber: '', patientSport: '', patientClub: '',
    clinicalFindings: '', investigationResults: '', diagnosis: '',
    isCleared: true, clearanceConditions: '', validUntil: '',
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const typeLabels: Record<string, string> = {
    ZakladniProhlidka: 'Základní prohlídka',
    KomplexniProhlidka: 'Komplexní prohlídka',
    Predsezonni: 'Předsezónní screening',
    Pooporavu: 'Poúrazový posudek',
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Description color="primary" /> Posudek o zdravotní způsobilosti
        </Typography>
      </motion.div>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Údaje o sportovci</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="ID pacienta" value={form.patientId} onChange={e => update('patientId', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Typ posudku" value={form.type} onChange={e => update('type', e.target.value)}>
                {Object.entries(typeLabels).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Jméno sportovce" value={form.patientName} onChange={e => update('patientName', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Rodné číslo" value={form.patientBirthNumber} onChange={e => update('patientBirthNumber', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Sport" value={form.patientSport} onChange={e => update('patientSport', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Klub" value={form.patientClub} onChange={e => update('patientClub', e.target.value)} /></Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Nález</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Praktik" value={form.practitioner} onChange={e => update('practitioner', e.target.value)} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Titul" value={form.practitionerTitle} onChange={e => update('practitionerTitle', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={3} label="Klinický nález" value={form.clinicalFindings} onChange={e => update('clinicalFindings', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} label="Výsledky vyšetření" value={form.investigationResults} onChange={e => update('investigationResults', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Diagnóza" value={form.diagnosis} onChange={e => update('diagnosis', e.target.value)} /></Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Klasifikace</Typography>
          <FormControlLabel control={<Checkbox checked={form.isCleared} onChange={e => update('isCleared', e.target.checked)} />}
            label="Způsobilý ke sportu" />
          {!form.isCleared && <TextField fullWidth label="Omezení" value={form.clearanceConditions} onChange={e => update('clearanceConditions', e.target.value)} sx={{ mt: 1 }} />}
          <TextField fullWidth type="date" label="Platnost do" value={form.validUntil} onChange={e => update('validUntil', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ mt: 2 }} />
        </CardContent>
      </Card>

      <Button variant="contained" startIcon={<Download />} fullWidth
        onClick={async () => {
          if (!form.patientId || !form.patientName) { toast.error('Vyplňte pacienta a jméno'); return; }
          try {
            await posudekApi.create({
              patientId: form.patientId,
              type: form.type,
              practitioner: form.practitioner,
              practitionerTitle: form.practitionerTitle,
              patientName: form.patientName,
              patientBirthNumber: form.patientBirthNumber,
              patientSport: form.patientSport,
              patientClub: form.patientClub,
              clinicalFindings: form.clinicalFindings,
              investigationResults: form.investigationResults,
              diagnosis: form.diagnosis,
              isCleared: form.isCleared,
              clearanceConditions: form.clearanceConditions,
              validUntil: form.validUntil,
            });
            toast.success('Posudek uložen a PDF vygenerován');
          } catch {
            toast.error('Chyba při ukládání posudku');
          }
        }}
        sx={{ py: 1.5, bgcolor: '#0D7377', borderRadius: 3, fontWeight: 600 }}>
        Generovat PDF posudek
      </Button>
    </Box>
  );
}
