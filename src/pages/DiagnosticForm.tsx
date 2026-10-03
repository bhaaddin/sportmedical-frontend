import { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Alert, CircularProgress, Divider,
  InputAdornment, Stack, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Send, ArrowBack, ArrowForward, Check } from '@mui/icons-material';
import { diagnosticsApi } from '../api/diagnostics';
import type { CreateSessionRequest, DiagnosticSession } from '../api/diagnostics';
import { DiagnosticFormSkeleton } from '../components/SkeletonLoader';
import { DESIGN, PageHeader, SectionLabel, SoftCard, StatusChip, type ChipTone } from '../components/ui';
import toast from 'react-hot-toast';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useIsPhone } from '../layout/useDevice';
import ManualResultsForm from './patients/ManualResultsForm';

type VitalKey =
  | 'restingHeartRateBpm'
  | 'maxHeartRateBpm'
  | 'vo2MaxMlMinKg'
  | 'anaerobicThresholdBpm'
  | 'systolicBloodPressure'
  | 'diastolicBloodPressure'
  | 'bodyFatPercentage'
  | 'muscleMassKg';

/**
 * Every measured value starts empty and has to be typed in. The form used to
 * open with plausible numbers already set (65 bpm, 120/78 mmHg, ...), and an
 * untouched step saved them as if they had been measured.
 */
interface SessionDraft {
  patientId: string;
  practitionerName: string;
  vitals: Record<VitalKey, number | null>;
  rawPractitionerNotes: string;
}

const CARDIO_VITALS: VitalKey[] = ['restingHeartRateBpm', 'maxHeartRateBpm', 'anaerobicThresholdBpm', 'vo2MaxMlMinKg'];
const BODY_VITALS: VitalKey[] = ['systolicBloodPressure', 'diastolicBloodPressure', 'bodyFatPercentage', 'muscleMassKg'];

const emptyDraft = (): SessionDraft => ({
  patientId: '',
  practitionerName: '',
  vitals: {
    restingHeartRateBpm: null,
    maxHeartRateBpm: null,
    vo2MaxMlMinKg: null,
    anaerobicThresholdBpm: null,
    systolicBloodPressure: null,
    diastolicBloodPressure: null,
    bodyFatPercentage: null,
    muscleMassKg: null,
  },
  rawPractitionerNotes: '',
});

const allFilled = (draft: SessionDraft, keys: VitalKey[]) =>
  keys.every((k) => draft.vitals[k] !== null);

/** The request, or null while any measured value is still missing. */
function toRequest(draft: SessionDraft): CreateSessionRequest | null {
  const v = draft.vitals;
  if (
    v.restingHeartRateBpm === null || v.maxHeartRateBpm === null ||
    v.vo2MaxMlMinKg === null || v.anaerobicThresholdBpm === null ||
    v.systolicBloodPressure === null || v.diastolicBloodPressure === null ||
    v.bodyFatPercentage === null || v.muscleMassKg === null
  ) {
    return null;
  }
  return {
    patientId: draft.patientId,
    practitionerName: draft.practitionerName,
    restingHeartRateBpm: v.restingHeartRateBpm,
    maxHeartRateBpm: v.maxHeartRateBpm,
    vo2MaxMlMinKg: v.vo2MaxMlMinKg,
    anaerobicThresholdBpm: v.anaerobicThresholdBpm,
    systolicBloodPressure: v.systolicBloodPressure,
    diastolicBloodPressure: v.diastolicBloodPressure,
    bodyFatPercentage: v.bodyFatPercentage,
    muscleMassKg: v.muscleMassKg,
    rawPractitionerNotes: draft.rawPractitionerNotes,
  };
}

const shown = (value: number | null, unit: string) => (value === null ? '—' : `${value} ${unit}`);

const steps = [
  { label: 'Pacient a lékař' },
  { label: 'Kardiovaskulární' },
  { label: 'Složení těla' },
  { label: 'Poznámky a odeslání' },
];

/* A reference range: which tone its chip takes, drawn from the board's tones. */
type Zone = { from: number; to: number; tone: ChipTone; label: string };

/* ── Measured value: typed in, never pre-filled ── */
function MetricField({ label, value, onChange, min, max, unit, zones }: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  min: number; max: number; unit: string;
  zones?: Zone[];
}) {
  const currentZone = value === null ? undefined : zones?.find(z => value >= z.from && value <= z.to);

  return (
    <Box sx={{ mb: 2.5 }}>
      <TextField
        fullWidth required type="number" label={label}
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value;
          const n = Number(raw);
          onChange(raw === '' || !Number.isFinite(n) ? null : n);
        }}
        helperText={value === null ? 'Zadejte naměřenou hodnotu.' : undefined}
        slotProps={{
          htmlInput: { min, max, step: 0.1 },
          input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
        }}
      />
      {currentZone && (
        <Box sx={{ mt: 0.75 }}>
          <StatusChip tone={currentZone.tone} size="sm">{currentZone.label}</StatusChip>
        </Box>
      )}
      {zones && value !== null && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
          {zones.map(z => {
            const active = value >= z.from && value <= z.to;
            const tone = z.tone === 'primary' ? DESIGN.tone.grey : DESIGN.tone[z.tone];
            return (
              <Box key={z.label} sx={{ flex: 1, height: 3, borderRadius: 1, bgcolor: active ? tone.fg : tone.bg }} />
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/* ── The step strip: numbered circles joined by a line, the board's calm version of a stepper ── */
function StepStrip({ active }: { active: number }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center' }}>
      {steps.map((step, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <Box key={step.label} sx={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none', minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Box
                aria-current={current ? 'step' : undefined}
                sx={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  bgcolor: done || current ? 'primary.main' : 'background.paper',
                  color: done || current ? 'primary.contrastText' : 'text.secondary',
                  border: '1px solid', borderColor: done || current ? 'primary.main' : 'divider',
                }}
              >
                {done ? <Check sx={{ fontSize: 16 }} /> : i + 1}
              </Box>
              <Typography
                sx={{
                  fontSize: 13, fontWeight: current ? 700 : 500, whiteSpace: 'nowrap',
                  color: current ? 'text.primary' : 'text.secondary',
                  display: { xs: current ? 'block' : 'none', sm: 'block' },
                }}
              >
                {step.label}
              </Typography>
            </Stack>
            {i < steps.length - 1 && (
              <Box sx={{ flex: 1, height: 1, mx: 1.5, bgcolor: done ? 'primary.main' : 'divider' }} />
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

/* ── Main Component ── */
export default function DiagnosticForm() {
  const phone = useIsPhone();
  /* Two ways to record a measurement: the guided steps, or one page typed by
     hand from a printout (manual entry, Etapa 2). */
  const [mode, setMode] = useState<'wizard' | 'manual'>('wizard');
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<SessionDraft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patientId');
    if (pid) setForm(prev => ({ ...prev, patientId: pid }));
  }, []);

  const update = (field: 'patientId' | 'practitionerName' | 'rawPractitionerNotes', value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const updateVital = (field: VitalKey, value: number | null) =>
    setForm(prev => ({ ...prev, vitals: { ...prev.vitals, [field]: value } }));

  const request = toRequest(form);

  const handleSubmit = async () => {
    if (request === null) return;
    setLoading(true);
    setError('');
    try {
      const session = await diagnosticsApi.create(request);
      setResult(session);
      toast.success('Diagnostická relace vytvořena!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Nepodařilo se vytvořit relaci');
      toast.error('Nepodařilo se vytvořit relaci');
    } finally {
      setLoading(false);
    }
  };

  const parseAnomalies = (json?: string) => {
    if (!json || json === '[]') return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  const canNext = () => {
    if (activeStep === 0) return Boolean(form.patientId && form.practitionerName);
    if (activeStep === 1) return allFilled(form, CARDIO_VITALS);
    if (activeStep === 2) return allFilled(form, BODY_VITALS);
    return true;
  };

  if (loading) return <DiagnosticFormSkeleton />;

  /* ── Results View ── */
  if (result) {
    const anomalies = parseAnomalies(result.detectedAnomaliesJson);
    const metrics: Array<[string, string]> = [
      ['Klidový tep', `${result.restingHeartRateBpm} bpm`],
      ['Max tep', `${result.maxHeartRateBpm} bpm`],
      ['VO2 Max', `${result.vo2MaxMlMinKg} ml/kg/min`],
      ['Anaerobní práh', `${result.anaerobicThresholdBpm} bpm`],
      ['Krevní tlak', `${result.systolicBloodPressure}/${result.diastolicBloodPressure} mmHg`],
      ['Tělesný tuk', `${result.bodyFatPercentage} %`],
      ['Svalová hmota', `${result.muscleMassKg} kg`],
    ];
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <PageHeader
          title="Výsledky"
          subtitle="Diagnostika a měření · uložená relace"
          actions={
            <Button variant="outlined" onClick={() => { setResult(null); setForm(emptyDraft()); setActiveStep(0); }}>
              Vytvořit další relaci
            </Button>
          }
        />
        <SoftCard>
          <Alert severity={result.requiresDoctorReview ? 'warning' : 'success'} sx={{ mb: 3 }}>
            {result.requiresDoctorReview
              ? 'Tato relace vyžaduje přezkum lékařem'
              : 'Analýza dokončena — žádné kritické nálezy'}
          </Alert>

          {anomalies.length > 0 && (
            <>
              <SectionLabel>Zjištěné anomálie</SectionLabel>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                {anomalies.map((a: any, i: number) => (
                  <StatusChip
                    key={i}
                    tone={a.severity === 'Critical' ? 'red' : a.severity === 'Warning' ? 'beige' : 'blue'}
                    dot={Boolean(a.isCritical)}
                  >
                    {a.metric}: {a.description}
                  </StatusChip>
                ))}
              </Box>
              <Divider sx={{ my: 3 }} />
            </>
          )}

          <SectionLabel>Metriky relace</SectionLabel>
          <Grid container spacing={2}>
            {metrics.map(([label, value]) => (
              <Grid key={label} size={{ xs: 6, sm: 4 }}>
                <SoftCard tone="muted" sx={{ p: 2 }}>
                  <SectionLabel sx={{ mb: 0.5 }}>{label}</SectionLabel>
                  <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{value}</Typography>
                </SoftCard>
              </Grid>
            ))}
          </Grid>
        </SoftCard>
      </Box>
    );
  }

  const modeToggle = (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={mode}
      onChange={(_, next: 'wizard' | 'manual' | null) => { if (next !== null) setMode(next); }}
      aria-label="Způsob zadání"
      sx={{ '& .MuiToggleButton-root': { minHeight: 44, px: 2 } }}
    >
      <ToggleButton value="wizard">Průvodce</ToggleButton>
      <ToggleButton value="manual">Ruční zápis</ToggleButton>
    </ToggleButtonGroup>
  );

  /* ── Manual entry: one page, typed by the doctor ── */
  if (mode === 'manual') {
    const urlPatient = new URLSearchParams(window.location.search).get('patientId') ?? undefined;
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <PageHeader
          title="Výsledky"
          subtitle="Diagnostika a měření · ruční zápis naměřených hodnot"
          actions={modeToggle}
        />
        <ManualResultsForm
          patientId={urlPatient}
          onSaved={(session) => setResult(session)}
          onCancel={() => setMode('wizard')}
        />
      </Box>
    );
  }

  /* ── Wizard View ── */
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title="Výsledky"
        subtitle={`Diagnostika a měření · krok ${activeStep + 1} ze ${steps.length} — ${steps[activeStep].label}`}
        actions={modeToggle}
      />

      <SoftCard sx={{ mb: 2, py: 2 }}>
        <StepStrip active={activeStep} />
      </SoftCard>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <SoftCard>
        {/* Step 0: Patient Info */}
        {activeStep === 0 && (
          <Box>
            <SectionLabel>Pacient a lékař</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>Zadejte údaje pacienta a vyšetřujícího.</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth required label="ID pacienta" value={form.patientId}
                  onChange={e => update('patientId', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth required label="Jméno praktika" value={form.practitionerName}
                  onChange={e => update('practitionerName', e.target.value)} />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 1: Cardiovascular */}
        {activeStep === 1 && (
          <Box>
            <SectionLabel>Kardiovaskulární metriky</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
              Zadejte naměřené hodnoty. Štítek pod polem říká, do jakého rozsahu hodnota spadá.
            </Typography>
            <MetricField label="Klidová srdeční frekvence" value={form.vitals.restingHeartRateBpm}
              onChange={v => updateVital('restingHeartRateBpm', v)} min={30} max={150} unit="bpm"
              zones={[
                { from: 30, to: 50, tone: 'blue', label: 'Sportovec — velmi nízký klidový tep' },
                { from: 50, to: 70, tone: 'green', label: 'Normální — zdravý rozsah' },
                { from: 70, to: 90, tone: 'beige', label: 'Zvýšený — zvažte vyšetření' },
                { from: 90, to: 150, tone: 'red', label: 'Vysoký — lékařská péče' },
              ]} />
            <MetricField label="Maximální srdeční frekvence" value={form.vitals.maxHeartRateBpm}
              onChange={v => updateVital('maxHeartRateBpm', v)} min={100} max={250} unit="bpm"
              zones={[
                { from: 100, to: 150, tone: 'beige', label: 'Pod očekáváním' },
                { from: 150, to: 200, tone: 'green', label: 'Normální rozsah' },
                { from: 200, to: 250, tone: 'red', label: 'Nad očekáváním' },
              ]} />
            <MetricField label="Anaerobní práh" value={form.vitals.anaerobicThresholdBpm}
              onChange={v => updateVital('anaerobicThresholdBpm', v)} min={80} max={220} unit="bpm"
              zones={[
                { from: 80, to: 130, tone: 'beige', label: 'Pod průměrem' },
                { from: 130, to: 170, tone: 'green', label: 'Zdravý rozsah' },
                { from: 170, to: 220, tone: 'blue', label: 'Sportovní úroveň' },
              ]} />
            <MetricField label="VO2 Max" value={form.vitals.vo2MaxMlMinKg}
              onChange={v => updateVital('vo2MaxMlMinKg', v)} min={15} max={80} unit="ml/kg/min"
              zones={[
                { from: 15, to: 30, tone: 'red', label: 'Špatné — je třeba zlepšit' },
                { from: 30, to: 40, tone: 'beige', label: 'Pod průměrem' },
                { from: 40, to: 55, tone: 'green', label: 'Dobré — zdravá kondice' },
                { from: 55, to: 80, tone: 'blue', label: 'Výborné — sportovní úroveň' },
              ]} />
          </Box>
        )}

        {/* Step 2: Body Composition */}
        {activeStep === 2 && (
          <Box>
            <SectionLabel>Složení těla</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
              Zadejte krevní tlak a metriky složení těla.
            </Typography>
            <MetricField label="Systolický krevní tlak" value={form.vitals.systolicBloodPressure}
              onChange={v => updateVital('systolicBloodPressure', v)} min={60} max={200} unit="mmHg"
              zones={[
                { from: 60, to: 90, tone: 'blue', label: 'Nízký — hypotenze' },
                { from: 90, to: 130, tone: 'green', label: 'Normální' },
                { from: 130, to: 160, tone: 'beige', label: 'Zvýšený — prehypertenze' },
                { from: 160, to: 200, tone: 'red', label: 'Vysoký — hypertenze' },
              ]} />
            <MetricField label="Diastolický krevní tlak" value={form.vitals.diastolicBloodPressure}
              onChange={v => updateVital('diastolicBloodPressure', v)} min={30} max={130} unit="mmHg"
              zones={[
                { from: 30, to: 60, tone: 'blue', label: 'Nízký' },
                { from: 60, to: 85, tone: 'green', label: 'Normální' },
                { from: 85, to: 100, tone: 'beige', label: 'Zvýšený' },
                { from: 100, to: 130, tone: 'red', label: 'Vysoký' },
              ]} />
            <MetricField label="Podíl tělesného tuku" value={form.vitals.bodyFatPercentage}
              onChange={v => updateVital('bodyFatPercentage', v)} min={3} max={50} unit="%"
              zones={[
                { from: 3, to: 10, tone: 'blue', label: 'Sportovec — velmi štíhlý' },
                { from: 10, to: 20, tone: 'green', label: 'Fitness — zdravý rozsah' },
                { from: 20, to: 30, tone: 'beige', label: 'Průměrný — zvažte životní styl' },
                { from: 30, to: 50, tone: 'red', label: 'Nad průměrem — lékařská kontrola' },
              ]} />
            <MetricField label="Svalová hmota" value={form.vitals.muscleMassKg}
              onChange={v => updateVital('muscleMassKg', v)} min={10} max={80} unit="kg"
              zones={[
                { from: 10, to: 25, tone: 'beige', label: 'Nízká — doporučen silový trénink' },
                { from: 25, to: 50, tone: 'green', label: 'Průměrná — zdravý rozsah' },
                { from: 50, to: 80, tone: 'blue', label: 'Nad průměrem — sportovní postava' },
              ]} />
          </Box>
        )}

        {/* Step 3: Notes & Submit */}
        {activeStep === 3 && (
          <Box>
            <SectionLabel>Poznámky a kontrola</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
              Přidejte klinické poznámky a relaci odešlete.
            </Typography>
            <TextField fullWidth multiline rows={4} label="Poznámky praktika"
              value={form.rawPractitionerNotes}
              onChange={e => update('rawPractitionerNotes', e.target.value)}
              placeholder="např. Pacient hlásí bolest na hrudi při cvičení, rodinná anamnéza srdečních chorob..."
              sx={{ mb: 3 }} />

            <Divider sx={{ my: 3 }} />
            <SectionLabel>Shrnutí</SectionLabel>
            <Grid container spacing={2}>
              {[
                ['Pacient', form.patientId || '—'],
                ['Praktik', form.practitionerName || '—'],
                ['Klidový tep', shown(form.vitals.restingHeartRateBpm, 'bpm')],
                ['Max tep', shown(form.vitals.maxHeartRateBpm, 'bpm')],
                ['VO2 Max', shown(form.vitals.vo2MaxMlMinKg, 'ml/kg/min')],
                ['Krevní tlak', form.vitals.systolicBloodPressure === null || form.vitals.diastolicBloodPressure === null
                  ? '—'
                  : `${form.vitals.systolicBloodPressure}/${form.vitals.diastolicBloodPressure} mmHg`],
              ].map(([label, value]) => (
                <Grid key={label} size={{ xs: 6, sm: 4 }}>
                  <SoftCard tone="muted" sx={{ p: 2 }}>
                    <SectionLabel sx={{ mb: 0.5 }}>{label}</SectionLabel>
                    <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
                  </SoftCard>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </SoftCard>

      {/* ── Navigation Buttons ── pinned at the bottom on a phone ── */}
      {(() => {
        const back = (
          <Button variant="outlined" startIcon={<ArrowBack />} disabled={activeStep === 0}
            onClick={() => setActiveStep(s => s - 1)} sx={{ minHeight: 44 }}>
            Zpět
          </Button>
        );
        const forward = activeStep < steps.length - 1 ? (
          <Button variant="contained" endIcon={<ArrowForward />} disabled={!canNext()}
            onClick={() => setActiveStep(s => s + 1)} sx={{ minHeight: 44 }}>
            Další
          </Button>
        ) : (
          <Button variant="contained" endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Send />}
            onClick={handleSubmit} disabled={loading || request === null} sx={{ minHeight: 44 }}>
            {loading ? 'Odesílám...' : 'Odeslat relaci'}
          </Button>
        );
        return phone ? (
          <PinnedActionBar label="Další krok">{back}{forward}</PinnedActionBar>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>{back}{forward}</Box>
        );
      })()}
    </Box>
  );
}
