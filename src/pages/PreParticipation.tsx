import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField, Checkbox, FormControlLabel,
  Chip, Skeleton, MenuItem, List, ListItem, ListItemText, Divider, Alert,
} from '@mui/material';
import { MedicalServices, Add, History } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { ppeApi, type PreParticipationExam } from '../api/ppe';
import { patientsApi, type Patient } from '../api/patients';
import toast from 'react-hot-toast';

export default function PreParticipation() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [history, setHistory] = useState<PreParticipationExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    patientId: '', practitioner: '',
    hasCardiacHistory: false, cardiacDetails: '',
    hasConcussionHistory: false,
    hasMusculoskeletalHistory: false, musculoskeletalDetails: '',
    bpSystolic: 120, bpDiastolic: 80, heartRate: 70, height: 175, weight: 75,
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    patientsApi.getAll()
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = async () => {
    if (!form.patientId) return;
    try {
      const exams = await ppeApi.getByPatient(form.patientId);
      setHistory(exams);
    } catch {}
  };

  useEffect(() => {
    if (form.patientId) loadHistory();
  }, [form.patientId]);

  const bmi = (form.weight / ((form.height / 100) ** 2)).toFixed(1);

  const handleSubmit = async () => {
    if (!form.patientId) { toast.error('Vyberte pacienta'); return; }
    try {
      await ppeApi.create({
        patientId: form.patientId,
        practitioner: form.practitioner,
        hasCardiacHistory: form.hasCardiacHistory,
        hasConcussionHistory: form.hasConcussionHistory,
        hasMusculoskeletalHistory: form.hasMusculoskeletalHistory,
        bloodPressureSystolic: form.bpSystolic,
        bloodPressureDiastolic: form.bpDiastolic,
        heartRate: form.heartRate,
        heightCm: form.height,
        weightKg: form.weight,
      });
      toast.success('PPE uloženo');
      loadHistory();
    } catch { toast.error('Chyba při ukládání'); }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <MedicalServices color="primary" /> Vstupní prohlídka sportovce (PPE)
        </Typography>
      </motion.div>

      {/* Patient Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Základní údaje</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Pacient" value={form.patientId} onChange={e => update('patientId', e.target.value)}>
                <MenuItem value="">— Vyberte pacienta —</MenuItem>
                {patients.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Ošetřující praktik" value={form.practitioner} onChange={e => update('practitioner', e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Anamnesis */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Anamnéza</Typography>
          <FormControlLabel control={<Checkbox checked={form.hasCardiacHistory} onChange={e => update('hasCardiacHistory', e.target.checked)} />} label="Kardiovaskulární anamnéza" />
          {form.hasCardiacHistory && <TextField fullWidth multiline rows={2} label="Detaily" value={form.cardiacDetails} onChange={e => update('cardiacDetails', e.target.value)} sx={{ mt: 1 }} />}
          <FormControlLabel control={<Checkbox checked={form.hasConcussionHistory} onChange={e => update('hasConcussionHistory', e.target.checked)} />} label="Anamnéza otřesu mozku" />
          <FormControlLabel control={<Checkbox checked={form.hasMusculoskeletalHistory} onChange={e => update('hasMusculoskeletalHistory', e.target.checked)} />} label="Pohybová anamnéza" />
          {form.hasMusculoskeletalHistory && <TextField fullWidth multiline rows={2} label="Detaily" value={form.musculoskeletalDetails} onChange={e => update('musculoskeletalDetails', e.target.value)} sx={{ mt: 1 }} />}
        </CardContent>
      </Card>

      {/* Vital Signs */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Vitalní funkce</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="TK systolický" value={form.bpSystolic} onChange={e => update('bpSystolic', parseInt(e.target.value))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="TK diastolický" value={form.bpDiastolic} onChange={e => update('bpDiastolic', parseInt(e.target.value))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="TF (bpm)" value={form.heartRate} onChange={e => update('heartRate', parseInt(e.target.value))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Výška (cm)" value={form.height} onChange={e => update('height', parseFloat(e.target.value))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Váha (kg)" value={form.weight} onChange={e => update('weight', parseFloat(e.target.value))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip label={`BMI: ${bmi}`} sx={{ mt: 1 }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Button variant="contained" startIcon={<Add />} fullWidth onClick={handleSubmit}
        sx={{ py: 1.5, bgcolor: '#0D7377', borderRadius: 3, fontWeight: 600 }}>
        Uložit vstupní prohlídku
      </Button>

      {/* History */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <History sx={{ color: '#0D7377' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Historie prohlídek</Typography>
              </Box>
              <List>
                {history.map((exam, i) => (
                  <div key={exam.id}>
                    <ListItem>
                      <ListItemText
                        primary={`${new Date(exam.examDate).toLocaleDateString('cs-CZ')} — ${exam.practitioner}`}
                        secondary={
                          <Box component="span">
                            TK: {exam.bpSystolic}/{exam.bpDiastolic} • TF: {exam.heartRate} • BMI: {(exam.weightKg / ((exam.heightCm / 100) ** 2)).toFixed(1)}
                            {exam.hasCardiacHistory && ' • ⚠️ Kardio anamnéza'}
                            {exam.hasConcussionHistory && ' • ⚠️ Otřes mozku'}
                          </Box>
                        }
                      />
                      <Chip
                        label={exam.isCleared ? 'Způsobilý' : 'Nezpůsobilý'}
                        size="small"
                        sx={{ bgcolor: exam.isCleared ? '#E8F5E9' : '#FFEBEE', color: exam.isCleared ? '#2E7D32' : '#D32F2F' }}
                      />
                    </ListItem>
                    {i < history.length - 1 && <Divider />}
                  </div>
                ))}
              </List>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </Box>
  );
}
