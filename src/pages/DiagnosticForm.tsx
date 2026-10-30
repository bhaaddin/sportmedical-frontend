import { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Alert, CircularProgress,
  InputAdornment, Stack, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Send, ArrowBack, ArrowForward, Check, Download, PersonOutlined, Science } from '@mui/icons-material';
import { diagnosticsApi } from '../api/diagnostics';
import type { CreateSessionRequest, DiagnosticSession } from '../api/diagnostics';
import { DiagnosticFormSkeleton } from '../components/SkeletonLoader';
import { TONE_CSS, StatusChip, type ChipTone } from '../components/ui';
import { ActionCard, MetricCard, PageFrame, Shelf, TARGET_SX, entityTarget, safeLabel, type EntityRef } from '../ui/shelf';
import { ExportGate } from '../components/ui/ExportGate';
import { patientsApi } from '../api/patients';
import toast from 'react-hot-toast';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useIsPhone } from '../layout/useDevice';
import ManualResultsForm from './patients/ManualResultsForm';
import PatientPicker from '../components/patients/PatientPicker';
import type { Patient } from '../api/patients';

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

/** The shelf each step stands on: its heading and the one line under it. */
const STEP_SHELF = [
  { id: 'patient', title: 'Pacient a lékař', hint: 'Údaje pacienta a vyšetřujícího' },
  { id: 'cardio', title: 'Kardiovaskulární metriky', hint: 'Štítek pod polem říká, do jakého rozsahu hodnota spadá' },
  { id: 'body', title: 'Složení těla', hint: 'Krevní tlak a složení těla' },
  { id: 'notes', title: 'Poznámky', hint: 'Klinické poznámky, pak relaci odešlete' },
];

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
            const tone = z.tone === 'primary' ? TONE_CSS.grey : TONE_CSS[z.tone];
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
                  fontSize: 13, fontWeight: current ? 700 : 500, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
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

  /* The patient this was opened for (the card's "Nové vyšetření" sends `?patientId=`): their name for the chip in the header. */
  const [patient, setPatient] = useState<Patient | null>(null);
  const [urlPatient, setUrlPatient] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patientId');
    if (!pid) return undefined;
    setForm(prev => ({ ...prev, patientId: pid }));
    let live = true;
    Promise.resolve().then(() => patientsApi.getById(pid))
      .then((p) => {
        if (live && p) setPatient(p);
        const name = safeLabel(p ? `${p.firstName} ${p.lastName}` : '', 'patient');
        if (live && name !== '') setUrlPatient({ id: pid, name });
      })
      .catch(() => { /* no chip: the form still works with the id */ });
    return () => { live = false; };
  }, []);

  /* The chip in the header: only for the patient whose name is known, and only while the form is still about them. */
  const patientChip = (id: string): EntityRef[] =>
    urlPatient !== null && urlPatient.id === id ? [{ kind: 'patient', id, label: urlPatient.name }] : [];

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
    const card = entityTarget({ kind: 'patient', id: result.patientId }).to;
    return (
      <PageFrame
        title="Výsledky vyšetření"
        purpose="Diagnostika a měření · uložená relace"
        entities={patientChip(result.patientId)}
        actions={
          <Button variant="outlined" onClick={() => { setResult(null); setForm({ ...emptyDraft(), patientId: form.patientId }); setActiveStep(0); }} sx={TARGET_SX}>
            Vytvořit další relaci
          </Button>
        }
      >
        <Alert
          severity={result.requiresDoctorReview ? 'warning' : 'success'}
          action={(
            <ExportGate>
              {(blocked) => (
                <Button color="inherit" size="small" startIcon={<Download />} disabled={blocked} onClick={() => void diagnosticsApi.downloadPdf(result.id)} sx={TARGET_SX}>
                  PDF report
                </Button>
              )}
            </ExportGate>
          )}
        >
          {result.requiresDoctorReview
            ? 'Tato relace vyžaduje přezkum lékařem'
            : 'Analýza dokončena — žádné kritické nálezy'}
        </Alert>

        {anomalies.length > 0 && (
          <Shelf id="anomalies" title="Zjištěné anomálie" count={anomalies.length} countTone="red" layout="board" stagger={false}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 2 }}>
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
          </Shelf>
        )}

        <Shelf id="metrics" title="Metriky relace" layout="grid" minCardWidth={180} stagger={false}>
          {metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}
        </Shelf>

        {/* ── Po uložení: where this measurement now lives ── */}
        <Shelf id="after" title="Po uložení" layout="row" fill minCardWidth={220} stagger={false}>
          <ActionCard primary title="Výsledky pacienta" icon={<Science fontSize="small" />} to={`${card}/vysledky`} />
          <ActionCard title="Karta pacienta" icon={<PersonOutlined fontSize="small" />} to={card} />
        </Shelf>
      </PageFrame>
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
    const fromUrl = new URLSearchParams(window.location.search).get('patientId') ?? undefined;
    return (
      <PageFrame
        title="Nové vyšetření"
        purpose="Diagnostika a měření · ruční zápis naměřených hodnot"
        entities={fromUrl === undefined ? [] : patientChip(fromUrl)}
        actions={modeToggle}
      >
        <Shelf id="manual" title="Naměřené hodnoty" hint="Opsané z protokolu přístroje" layout="free" stagger={false}>
          <ManualResultsForm
            patientId={fromUrl}
            onSaved={(session) => setResult(session)}
            onCancel={() => setMode('wizard')}
          />
        </Shelf>
      </PageFrame>
    );
  }

  /* ── Wizard View ── */
  return (
    <PageFrame
      title="Nové vyšetření"
      purpose={`Diagnostika a měření · krok ${activeStep + 1} ze ${steps.length} — ${steps[activeStep].label}`}
      entities={patientChip(form.patientId)}
      actions={modeToggle}
    >
      <Box sx={{ px: { xs: 0, sm: 0.5 } }}>
        <StepStrip active={activeStep} />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Shelf id={STEP_SHELF[activeStep].id} title={STEP_SHELF[activeStep].title} hint={STEP_SHELF[activeStep].hint} layout="board" stagger={false}>
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        {/* Step 0: Patient Info */}
        {activeStep === 0 && (
          <Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <PatientPicker
                  value={patient}
                  onChange={(p) => { setPatient(p); update('patientId', p?.id ?? ''); }}
                  label="Pacient"
                  required
                />
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
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
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
          </Box>
        )}

        {/* Step 2: Body Composition */}
        {activeStep === 2 && (
          <Box>
            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
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
          </Box>
        )}

        {/* Step 3: Notes & Submit */}
        {activeStep === 3 && (
          <Box>
            <TextField fullWidth multiline rows={4} label="Poznámky praktika"
              value={form.rawPractitionerNotes}
              onChange={e => update('rawPractitionerNotes', e.target.value)}
              placeholder="např. Pacient hlásí bolest na hrudi při cvičení, rodinná anamnéza srdečních chorob..."
              />
          </Box>
        )}
      </Box>
      </Shelf>

      {activeStep === 3 && (
        <Shelf id="summary" title="Shrnutí" hint="Co se odešle" layout="grid" minCardWidth={180} stagger={false}>
              {[
                ['Pacient', form.patientId || '—'],
                ['Praktik', form.practitionerName || '—'],
                ['Klidový tep', shown(form.vitals.restingHeartRateBpm, 'bpm')],
                ['Max tep', shown(form.vitals.maxHeartRateBpm, 'bpm')],
                ['VO2 Max', shown(form.vitals.vo2MaxMlMinKg, 'ml/kg/min')],
                ['Krevní tlak', form.vitals.systolicBloodPressure === null || form.vitals.diastolicBloodPressure === null
                  ? '—'
                  : `${form.vitals.systolicBloodPressure}/${form.vitals.diastolicBloodPressure} mmHg`],
              ].map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}
        </Shelf>
      )}

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>{back}{forward}</Box>
        );
      })()}
    </PageFrame>
  );
}
