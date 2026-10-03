import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Grid, TextField, MenuItem, Stack, Alert, Checkbox, FormControlLabel,
} from '@mui/material';
import { Add, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { concussionApi, type ConcussionRecord } from '../api/concussion';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { PageHeader, SectionLabel, SoftCard, StatusChip } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { ListSkeleton, LoadError } from './sports/LoadStates';
import { useTouchSx } from './sports/touch';
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

const dateOf = (record: ConcussionRecord): string => new Date(record.injuryDate).toLocaleDateString('cs-CZ');

export default function Concussion() {
  const touch = useTouchSx();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<ConcussionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ConcussionRecord | null>(null);
  const [form, setForm] = useState({
    patientId: '', mechanism: '', symptomScore: 0,
    lossOfConsciousness: false, practitioner: '', severityGrade: 1,
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const loadHistory = useCallback(async () => {
    if (!form.patientId) return;
    setHistoryLoading(true);
    setHistoryFailed(false);
    try {
      const recs = await concussionApi.getByPatient(form.patientId);
      setRecords(recs);
    } catch {
      setHistoryFailed(true);
    } finally {
      setHistoryLoading(false);
    }
  }, [form.patientId]);

  useEffect(() => {
    if (form.patientId) loadHistory();
    else setRecords([]);
  }, [form.patientId, loadHistory]);

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

  const statusChip = (record: ConcussionRecord) => (
    <StatusChip tone={record.status === 'Cleared' ? 'green' : 'beige'}>
      {statusLabels[record.status] || record.status}
    </StatusChip>
  );

  const columns: DataColumn<ConcussionRecord>[] = [
    { key: 'date', header: 'Datum', tablet: true, cell: (r) => <Box sx={{ whiteSpace: 'nowrap' }}>{dateOf(r)}</Box> },
    { key: 'practitioner', header: 'Ošetřující', tablet: true, cell: (r) => r.practitioner || '—' },
    { key: 'mechanism', header: 'Mechanismus', cell: (r) => r.mechanism || '—' },
    {
      key: 'score', header: 'Skóre', align: 'right',
      cell: (r) => `${r.symptomScore}/132`,
    },
    {
      key: 'grade', header: 'Závažnost',
      cell: (r) => (
        <>
          {r.severityGrade}
          {r.lossOfConsciousness && <StatusChip tone="red" size="sm" sx={{ ml: 1 }}>Ztráta vědomí</StatusChip>}
        </>
      ),
    },
    { key: 'status', header: 'Stav', tablet: true, cell: statusChip },
  ];

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
          <Grid size={{ xs: 12, md: 6 }}>
            <PatientPicker
              value={patient}
              onChange={(next) => {
                setPatient(next);
                update('patientId', next?.id ?? '');
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Ošetřující" value={form.practitioner} onChange={e => update('practitioner', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth label="Mechanismus" value={form.mechanism} onChange={e => update('mechanism', e.target.value)}
            placeholder="např. přímý kontakt hlavou při fotbale" /></Grid>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}><TextField fullWidth type="number" label="Symptom Score (SCAT 0–132)" value={form.symptomScore} onChange={e => update('symptomScore', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 12, md: 6, lg: 4 }}>
            <TextField fullWidth select label="Závažnost" value={form.severityGrade} onChange={e => update('severityGrade', parseInt(e.target.value))}>
              <MenuItem value={1}>1 — Mírný</MenuItem>
              <MenuItem value={2}>2 — Střední</MenuItem>
              <MenuItem value={3}>3 — Těžký</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              sx={{ minHeight: 44, m: 0 }}
              control={
                <Checkbox
                  checked={form.lossOfConsciousness}
                  onChange={e => update('lossOfConsciousness', e.target.checked)}
                />
              }
              label="Ztráta vědomí"
            />
          </Grid>
        </Grid>
      </SoftCard>

      <PinnedActionBar label="Vytvořit záznam">
        <Button variant="contained" startIcon={<Add />} onClick={handleSubmit} sx={touch}>
          Vytvořit záznam
        </Button>
      </PinnedActionBar>

      {/* History */}
      {patient !== null && (
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Historie otřesů</SectionLabel>
          {historyLoading ? (
            <ListSkeleton rows={3} height={64} />
          ) : historyFailed ? (
            <LoadError what="Historii otřesů" onRetry={() => void loadHistory()} />
          ) : (
            <ResponsiveDataList
              ariaLabel="Historie otřesů"
              rows={records}
              rowKey={(r) => r.id}
              columns={columns}
              onRowClick={setSelectedRecord}
              empty="U tohoto pacienta zatím není žádný záznam otřesu."
              renderCard={(r) => (
                <Stack spacing={0.75}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                      {dateOf(r)}{r.practitioner ? ` — ${r.practitioner}` : ''}
                    </Typography>
                    {statusChip(r)}
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Mechanismus: {r.mechanism || '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Skóre: {r.symptomScore}/132 · Závažnost: {r.severityGrade}
                    {r.lossOfConsciousness && ' · Ztráta vědomí'}
                  </Typography>
                </Stack>
              )}
            />
          )}
        </Box>
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
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
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
          <Stack direction="row" spacing={1} sx={{ mt: 3, '& .MuiButton-root': { ...touch, flex: { xs: 1, md: 'none' } } }}>
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
