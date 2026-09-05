import { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField, Chip, Stepper, Step, StepLabel,
  Skeleton, MenuItem, List, ListItem, ListItemText, Divider, Alert,
} from '@mui/material';
import { Psychology, Warning, History, Add } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { concussionApi, type ConcussionRecord } from '../api/concussion';
import { patientsApi, type Patient } from '../api/patients';
import toast from 'react-hot-toast';

const rtpSteps = [
  'Symptomatic → Bez příznaků',
  'Návrat do výuky/práce',
  'Lehká fyzická aktivita',
  'Sport-specifické cvičení',
  'Plný trénink bez kontaktu',
  'Plný trénink s kontaktem',
  'Návrat do hry',
];

const statusLabels: Record<string, string> = {
  Acute: 'Akutní', Stage1: 'Krok 1 — Odpočinek', Stage2: 'Krok 2 — Lehká aktivita',
  Stage3: 'Krok 3 — Sport-specifické', Stage4: 'Krok 4 — Plný trénink',
  Stage5: 'Krok 5 — Návrat do hry', Cleared: 'Vyléčeno',
};

export default function Concussion() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<ConcussionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState<ConcussionRecord | null>(null);
  const [form, setForm] = useState({
    patientId: '', mechanism: '', symptomScore: 0,
    lossOfConsciousness: false, practitioner: '', severityGrade: 1,
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
      const recs = await concussionApi.getByPatient(form.patientId);
      setRecords(recs);
    } catch {}
  };

  useEffect(() => {
    if (form.patientId) loadHistory();
  }, [form.patientId]);

  const handleSubmit = async () => {
    if (!form.patientId) { toast.error('Vyberte pacienta'); return; }
    try {
      await concussionApi.create({
        patientId: form.patientId,
        mechanism: form.mechanism,
        severityGrade: form.severityGrade,
        practitioner: form.practitioner,
        lossOfConsciousness: form.lossOfConsciousness,
        symptomScore: form.symptomScore,
      });
      toast.success('Záznam otřesu vytvořen');
      loadHistory();
    } catch { toast.error('Chyba při vytváření'); }
  };

  const handleAdvanceStep = async (record: ConcussionRecord) => {
    const statuses = ['Stage1', 'Stage2', 'Stage3', 'Stage4', 'Stage5', 'Cleared'];
    const currentIdx = statuses.indexOf(record.status);
    if (currentIdx < 0 || currentIdx >= statuses.length) return;
    const nextStatus = statuses[Math.min(currentIdx + 1, statuses.length - 1)];
    try {
      await concussionApi.updateStatus(record.id, nextStatus);
      toast.success('Protokol pokročil');
      loadHistory();
      setSelectedRecord(null);
    } catch { toast.error('Chyba'); }
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
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Psychology color="primary" /> Protokol otřesu mozku
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Sledování návratu po otřesu mozku dle konsenzu 5. konsenzu (Zurich 2016)
        </Typography>
      </motion.div>

      {/* New Record Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Nový záznam</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Pacient" value={form.patientId} onChange={e => update('patientId', e.target.value)}>
                <MenuItem value="">— Vyberte pacienta —</MenuItem>
                {patients.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Ošetřující" value={form.practitioner} onChange={e => update('practitioner', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Mechanismus" value={form.mechanism} onChange={e => update('mechanism', e.target.value)}
              placeholder="např. přímý kontakt hlavou při fotbale" /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth type="number" label="Symptom Score (SCAT 0-132)" value={form.symptomScore} onChange={e => update('symptomScore', parseInt(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth select label="Závažnost" value={form.severityGrade} onChange={e => update('severityGrade', parseInt(e.target.value))}>
                <MenuItem value={1}>1 — Mírný</MenuItem>
                <MenuItem value={2}>2 — Střední</MenuItem>
                <MenuItem value={3}>3 — Těžký</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              {form.lossOfConsciousness && <Chip icon={<Warning />} label="Ztráta vědomí" color="error" sx={{ mt: 1 }} />}
            </Grid>
          </Grid>
          <Button variant="contained" startIcon={<Add />} onClick={handleSubmit}
            sx={{ mt: 3, bgcolor: '#0D7377', borderRadius: 2, px: 3 }}>
            Vytvořit záznam
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      {records.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <History /> Historie otřesů
          </Typography>
          <List>
            {records.map((record, i) => (
              <div key={record.id}>
                <ListItem sx={{ cursor: 'pointer', borderRadius: 2, '&:hover': { bgcolor: '#f5f5f5' } }}
                  onClick={() => setSelectedRecord(record)}>
                  <ListItemText
                    primary={`${new Date(record.injuryDate).toLocaleDateString('cs-CZ')} — ${record.practitioner}`}
                    secondary={
                      <Box component="span">
                        Mechanismus: {record.mechanism} • Score: {record.symptomScore}/132 • Závažnost: {record.severityGrade}
                        {record.lossOfConsciousness && ' • ⚠️ Ztráta vědomí'}
                      </Box>
                    }
                  />
                  <Chip label={statusLabels[record.status] || record.status} size="small"
                    sx={{ bgcolor: record.status === 'Cleared' ? '#E8F5E9' : '#FFF3E0', color: record.status === 'Cleared' ? '#2E7D32' : '#ED6C02' }} />
                </ListItem>
                {i < records.length - 1 && <Divider />}
              </div>
            ))}
          </List>
        </motion.div>
      )}

      {/* RTP Protocol Detail */}
      {selectedRecord && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Protokol návratu do hry</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Každý krok vyžaduje minimálně 24 hodin bez příznaků
              </Typography>
              <Stepper activeStep={rtpSteps.indexOf(statusLabels[selectedRecord.status] || '')} orientation="vertical">
                {rtpSteps.map((step, i) => (
                  <Step key={i} completed={i < rtpSteps.indexOf(statusLabels[selectedRecord.status] || '')}>
                    <StepLabel>{step}</StepLabel>
                  </Step>
                ))}
              </Stepper>
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button variant="contained" onClick={() => handleAdvanceStep(selectedRecord)}
                  disabled={selectedRecord.status === 'Cleared'}
                  sx={{ bgcolor: '#0D7377' }}>
                  {selectedRecord.status === 'Cleared' ? 'Dokončeno' : 'Další krok'}
                </Button>
                <Button onClick={() => setSelectedRecord(null)}>Zavřít</Button>
              </Box>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </Box>
  );
}

