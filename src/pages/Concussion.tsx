import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Grid, TextField, MenuItem, Stack, Alert,
} from '@mui/material';
import { Add, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { concussionApi, type ConcussionRecord } from '../api/concussion';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { PageHeader, SectionLabel, SoftCard, StatusChip } from '../components/ui';
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
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<ConcussionRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<ConcussionRecord | null>(null);
  const [form, setForm] = useState({
    patientId: '', mechanism: '', symptomScore: 0,
    lossOfConsciousness: false, practitioner: '', severityGrade: 1,
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

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

  const activeStepOf = (record: ConcussionRecord) => rtpSteps.indexOf(statusLabels[record.status] || '');

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title="Protokol otřesu mozku"
        subtitle="Sledování návratu po otřesu mozku dle 5. konsenzu (Zurich 2016)"
      />

      {/* New Record Form */}
      <SoftCard sx={{ mb: 2.5 }}>
        <SectionLabel>Nový záznam</SectionLabel>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <PatientPicker
              value={patient}
              onChange={(next) => {
                setPatient(next);
                update('patientId', next?.id ?? '');
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Ošetřující" value={form.practitioner} onChange={e => update('practitioner', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth label="Mechanismus" value={form.mechanism} onChange={e => update('mechanism', e.target.value)}
            placeholder="např. přímý kontakt hlavou při fotbale" /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth type="number" label="Symptom Score (SCAT 0–132)" value={form.symptomScore} onChange={e => update('symptomScore', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField fullWidth select label="Závažnost" value={form.severityGrade} onChange={e => update('severityGrade', parseInt(e.target.value))}>
              <MenuItem value={1}>1 — Mírný</MenuItem>
              <MenuItem value={2}>2 — Střední</MenuItem>
              <MenuItem value={3}>3 — Těžký</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            {form.lossOfConsciousness && <StatusChip tone="red" dot>Ztráta vědomí</StatusChip>}
          </Grid>
        </Grid>
        <Button variant="contained" startIcon={<Add />} onClick={handleSubmit} sx={{ mt: 2.5 }}>
          Vytvořit záznam
        </Button>
      </SoftCard>

      {/* History */}
      {records.length > 0 && (
        <SoftCard sx={{ mb: 2.5, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
            <SectionLabel sx={{ mb: 0 }}>Historie otřesů</SectionLabel>
          </Box>
          {records.map((record) => (
            <Box
              key={record.id}
              onClick={() => setSelectedRecord(record)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, cursor: 'pointer',
                borderTop: '1px solid', borderColor: 'divider',
                bgcolor: selectedRecord?.id === record.id ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                  {new Date(record.injuryDate).toLocaleDateString('cs-CZ')} — {record.practitioner}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  Mechanismus: {record.mechanism} · Score: {record.symptomScore}/132 · Závažnost: {record.severityGrade}
                  {record.lossOfConsciousness && ' · Ztráta vědomí'}
                </Typography>
              </Box>
              <StatusChip tone={record.status === 'Cleared' ? 'green' : 'beige'}>
                {statusLabels[record.status] || record.status}
              </StatusChip>
            </Box>
          ))}
        </SoftCard>
      )}

      {/* RTP Protocol Detail */}
      {selectedRecord && (
        <SoftCard>
          <SectionLabel>Protokol návratu do hry</SectionLabel>
          <Alert severity="info" sx={{ mb: 2 }}>
            Každý krok vyžaduje minimálně 24 hodin bez příznaků.
          </Alert>
          <Stack spacing={0}>
            {rtpSteps.map((step, i) => {
              const active = activeStepOf(selectedRecord);
              const done = i < active;
              const current = i === active;
              return (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                  {done
                    ? <CheckCircle sx={{ fontSize: 20, color: 'primary.main' }} />
                    : <RadioButtonUnchecked sx={{ fontSize: 20, color: current ? 'primary.main' : 'text.disabled' }} />}
                  <Typography variant="body2" sx={{ fontWeight: current ? 700 : 500, color: done ? 'text.secondary' : 'text.primary' }}>
                    {step}
                  </Typography>
                  {current && <StatusChip tone="primary" size="sm" sx={{ ml: 'auto' }}>Aktuální krok</StatusChip>}
                </Box>
              );
            })}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button variant="contained" onClick={() => handleAdvanceStep(selectedRecord)}
              disabled={selectedRecord.status === 'Cleared'}>
              {selectedRecord.status === 'Cleared' ? 'Dokončeno' : 'Další krok'}
            </Button>
            <Button variant="outlined" onClick={() => setSelectedRecord(null)}>Zavřít</Button>
          </Stack>
        </SoftCard>
      )}
    </Box>
  );
}
