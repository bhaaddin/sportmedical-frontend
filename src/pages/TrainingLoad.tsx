import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Button, TextField, MenuItem, Slider, Alert, Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add } from '@mui/icons-material';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Legend,
} from 'recharts';
import { trainingApi, type TrainingSession, type AcwrData } from '../api/training';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { DESIGN, KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip, type ChipTone } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useDevice } from '../layout/useDevice';
import { ListSkeleton, LoadError } from './sports/LoadStates';
import { min } from './sports/format';
import { useTouchSx } from './sports/touch';
import toast from 'react-hot-toast';

const sessionTypes = [
  { value: 'Training', label: 'Trénink' },
  { value: 'Match', label: 'Zápas' },
  { value: 'Recovery', label: 'Regenerace' },
  { value: 'Gym', label: 'Posilovna' },
  { value: 'Cardio', label: 'Kardio' },
  { value: 'Rehabilitation', label: 'Rehabilitace' },
  { value: 'Test', label: 'Testování' },
];

const rpeLabels: Record<number, string> = {
  1: 'Odpočinek', 2: 'Velmi lehké', 3: 'Lehké', 4: 'Lehce těžké',
  5: 'Těžké', 6: 'Velmi těžké', 7: 'Extrémně těžké',
  8: 'Maximální', 9: 'Maximální', 10: 'Maximální',
};

/* What the ACWR number means, in the board's tones. */
function acwrBand(value: number): { tone: ChipTone; label: string } {
  if (value < 0.8) return { tone: 'beige', label: 'Nízká' };
  if (value <= 1.3) return { tone: 'green', label: 'Optimální' };
  if (value <= 1.5) return { tone: 'beige', label: 'Zvýšená' };
  return { tone: 'red', label: 'Nebezpečná' };
}

function AcwrGauge({ value }: { value: number }) {
  const band = acwrBand(value);
  const bandTone = DESIGN.tone[band.tone === 'primary' ? 'grey' : band.tone];
  return (
    <SoftCard sx={{ height: '100%' }}>
      <SectionLabel>Poměr ACWR</SectionLabel>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
        <Typography sx={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: bandTone.fg }}>
          {value > 0 ? value.toFixed(2) : '—'}
        </Typography>
        <StatusChip tone={band.tone}>{band.label}</StatusChip>
      </Stack>
      <Box sx={{ mt: 2, position: 'relative', height: 8, bgcolor: 'divider', borderRadius: 999, overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', left: '40%', width: '25%', height: '100%', bgcolor: DESIGN.tone.green.bg }} />
        <Box sx={{ position: 'absolute', left: 0, height: '100%', width: `${Math.min(value / 2 * 100, 100)}%`, bgcolor: bandTone.fg, borderRadius: 999 }} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>0,0</Typography>
        <Typography variant="caption" sx={{ color: DESIGN.tone.green.fg, fontWeight: 600 }}>0,8 — 1,3</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>2,0</Typography>
      </Box>
    </SoftCard>
  );
}

export default function TrainingLoad() {
  const theme = useTheme();
  const device = useDevice();
  const touch = useTouchSx();
  const [patient, setPatient] = useState<Patient | null>(null);
  const selectedPatient = patient?.id ?? '';
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [acwr, setAcwr] = useState<AcwrData | null>(null);
  const [loadTrend, setLoadTrend] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataFailed, setDataFailed] = useState(false);
  const [form, setForm] = useState({
    type: 'Training', description: '', durationMinutes: 60, rpe: 5,
    avgHeartRate: 0, maxHeartRate: 0, coach: '', notes: '',
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const loadPatientData = async (patientId: string, silent = false) => {
    if (!patientId) { setSessions([]); setAcwr(null); setLoadTrend([]); setDataFailed(false); return; }
    if (!silent) setDataLoading(true);
    setDataFailed(false);
    try {
      /* The sessions are the screen's content: if they cannot be read the page
         says so and offers a retry. ACWR and the trend are derived figures that
         legitimately do not exist for a new athlete, so those stay soft. */
      const [sess, acwrData, trend] = await Promise.all([
        trainingApi.getByPatient(patientId, 30),
        trainingApi.getAcwr(patientId).catch(() => null),
        trainingApi.getLoadTrend(patientId, 8).catch(() => []),
      ]);
      setSessions(sess);
      setAcwr(acwrData);
      setLoadTrend(trend);
    } catch {
      setDataFailed(true);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatient) loadPatientData(selectedPatient);
  }, [selectedPatient]);

  const handleCreateSession = async () => {
    if (!selectedPatient) { toast.error('Vyberte pacienta'); return; }
    try {
      await trainingApi.create({
        patientId: selectedPatient,
        type: form.type,
        description: form.description,
        durationMinutes: form.durationMinutes,
        rpe: form.rpe,
        avgHeartRate: form.avgHeartRate || undefined,
        maxHeartRate: form.maxHeartRate || undefined,
        coach: form.coach,
        notes: form.notes,
      });
      toast.success('Tréninková jednotka zaznamenána');
      void loadPatientData(selectedPatient, true);
      setForm(prev => ({ ...prev, description: '', notes: '' }));
    } catch { toast.error('Chyba při ukládání'); }
  };

  const weeklyLoad = sessions.reduce((sum, s) => sum + s.sessionRPE, 0);
  const typeLabel = (s: TrainingSession) => sessionTypes.find(t => t.value === s.type)?.label || s.type;
  const dateOf = (s: TrainingSession) => new Date(s.sessionDate).toLocaleDateString('cs-CZ');

  /* Tablet keeps date, type and load; the desktop table adds the rest. */
  const sessionColumns: DataColumn<TrainingSession>[] = [
    { key: 'date', header: 'Datum', tablet: true, cell: (s) => <Box sx={{ whiteSpace: 'nowrap' }}>{dateOf(s)}</Box> },
    { key: 'type', header: 'Typ', tablet: true, cell: (s) => <StatusChip tone="grey" size="sm">{typeLabel(s)}</StatusChip> },
    { key: 'description', header: 'Popis', cell: (s) => s.description || '—' },
    { key: 'duration', header: 'Trvání', align: 'right', cell: (s) => min(s.durationMinutes) },
    { key: 'rpe', header: 'sRPE', align: 'right', cell: (s) => s.rpe },
    {
      key: 'load', header: 'Zátěž', align: 'right', tablet: true,
      cell: (s) => <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>{s.sessionRPE}</Box>,
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Tréninkové zatížení"
        subtitle="sRPE, ACWR a trend zátěže"
      />

      {/* Patient Selection */}
      <SoftCard sx={{ mb: 2.5 }}>
        <SectionLabel>Sportovec</SectionLabel>
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <PatientPicker label="Sportovec / pacient" value={patient} onChange={setPatient} />
          </Grid>
          {selectedPatient && !dataLoading && !dataFailed && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zátěž za 30 dní:</Typography>
                <StatusChip tone="green">{weeklyLoad} sRPE · {sessions.length} tréninků</StatusChip>
              </Stack>
            </Grid>
          )}
        </Grid>
      </SoftCard>

      {!selectedPatient && (
        <SoftCard data-state="empty" sx={{ py: 5, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 600 }}>Vyberte sportovce</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            Po výběru se zobrazí jeho zátěž, poměr ACWR a poslední tréninky.
          </Typography>
        </SoftCard>
      )}

      {selectedPatient && dataLoading && <ListSkeleton rows={3} height={120} />}

      {selectedPatient && !dataLoading && dataFailed && (
        <LoadError what="Tréninková data" onRetry={() => void loadPatientData(selectedPatient)} />
      )}

      {selectedPatient && !dataLoading && !dataFailed && (
        <>
          {/* ACWR & Stats Row */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <AcwrGauge value={acwr?.acwrValue ?? 0} />
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <SoftCard sx={{ height: '100%' }}>
                <SectionLabel>Podrobnosti ACWR</SectionLabel>
                {acwr ? (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <KpiCard label="Akutní zátěž (7 dní)" value={acwr.acuteLoad} hint={`${acwr.acuteSessions} tréninků`} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <KpiCard label="Chronická zátěž (28 dní)" value={acwr.chronicLoad} hint={`${acwr.chronicSessions} tréninků`} />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Alert severity={acwr.riskLevel === 'optimal' ? 'success' : acwr.riskLevel === 'danger' ? 'error' : 'warning'}>
                        {acwr.riskDescription}
                      </Alert>
                    </Grid>
                  </Grid>
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím žádná data pro výpočet ACWR</Typography>
                )}
              </SoftCard>
            </Grid>
          </Grid>

          {/* Load Trend Chart */}
          {loadTrend.length > 0 && (
            <SoftCard sx={{ mb: 2.5 }}>
              <SectionLabel>Trend zátěže</SectionLabel>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>Celková týdenní zátěž (sRPE)</Typography>
              <ResponsiveContainer width="100%" height={device === 'phone' ? 220 : 280}>
                <BarChart data={loadTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} stroke={theme.palette.divider} />
                  <YAxis tick={{ fontSize: 12, fill: theme.palette.text.secondary }} stroke={theme.palette.divider} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none', fontFamily: DESIGN.font }} />
                  <Legend />
                  <ReferenceLine y={acwr?.chronicLoad ?? 0} stroke={theme.palette.text.secondary} strokeDasharray="5 5" label={{ value: 'Chronický průměr', position: 'right', fontSize: 11, fill: theme.palette.text.secondary }} />
                  <Bar dataKey="totalLoad" name="Celková zátěž" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SoftCard>
          )}

          {/* Create Session Form */}
          <SoftCard sx={{ mb: 2.5 }}>
            <SectionLabel>Zaznamenat trénink</SectionLabel>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                <TextField fullWidth select label="Typ" value={form.type} onChange={e => update('type', e.target.value)}>
                  {sessionTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6, lg: 4 }}><TextField fullWidth label="Popis" value={form.description} onChange={e => update('description', e.target.value)}
                placeholder="např. Intervaly 4×4 min, posilovna horní polovina" /></Grid>
              <Grid size={{ xs: 12, md: 6, lg: 2 }}><TextField fullWidth type="number" label="Trvání (min)" value={form.durationMinutes} onChange={e => update('durationMinutes', parseInt(e.target.value) || 0)} /></Grid>
              <Grid size={{ xs: 12, md: 6, lg: 2 }}><TextField fullWidth label="Trenér" value={form.coach} onChange={e => update('coach', e.target.value)} /></Grid>
            </Grid>

            {/* RPE Slider */}
            <Box sx={{ mt: 3, mb: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>sRPE — jak těžký byl trénink?</Typography>
                <StatusChip tone="primary">{form.rpe} — {rpeLabels[form.rpe]}</StatusChip>
              </Stack>
              <Slider value={form.rpe} onChange={(_, v) => update('rpe', v as number)}
                min={1} max={10} step={1} marks
                aria-label="sRPE"
                sx={{ py: '20px', '& .MuiSlider-thumb': { width: 22, height: 22 }, '& .MuiSlider-markLabel': { fontSize: 10 } }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>1 — Odpočinek</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>10 — Maximální</Typography>
              </Box>
            </Box>

            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
              Tréninková zátěž = sRPE × trvání = <Box component="strong" sx={{ color: 'text.primary' }}>{form.rpe * form.durationMinutes}</Box>
            </Typography>
          </SoftCard>

          <PinnedActionBar label="Zaznamenat trénink">
            <Button variant="contained" startIcon={<Add />} onClick={handleCreateSession} sx={touch}>
              Zaznamenat
            </Button>
          </PinnedActionBar>

          {/* Recent Sessions */}
          <Box sx={{ mt: 2.5 }}>
            <SectionLabel>Poslední tréninky</SectionLabel>
            <ResponsiveDataList
              ariaLabel="Poslední tréninky"
              rows={sessions.slice(0, 10)}
              rowKey={(s) => s.id}
              columns={sessionColumns}
              empty="Zatím žádné tréninky. Zaznamenejte první formulářem výše."
              renderCard={(s) => (
                <Stack spacing={1}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusChip tone="grey" size="sm">{typeLabel(s)}</StatusChip>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{dateOf(s)}</Typography>
                  </Stack>
                  {s.description && <Typography variant="body2">{s.description}</Typography>}
                  <Stack direction="row" spacing={2}>
                    <Box>
                      <SectionLabel sx={{ mb: 0 }}>Trvání</SectionLabel>
                      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{min(s.durationMinutes)}</Typography>
                    </Box>
                    <Box>
                      <SectionLabel sx={{ mb: 0 }}>sRPE</SectionLabel>
                      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{s.rpe}</Typography>
                    </Box>
                    <Box>
                      <SectionLabel sx={{ mb: 0 }}>Zátěž</SectionLabel>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'primary.main' }}>{s.sessionRPE}</Typography>
                    </Box>
                  </Stack>
                </Stack>
              )}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
