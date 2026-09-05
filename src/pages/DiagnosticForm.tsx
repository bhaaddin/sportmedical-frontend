import { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Grid, Chip,
  Alert, CircularProgress, Divider, Card, CardContent, LinearProgress,
  Slider, Stepper, Step, StepLabel, StepConnector, stepConnectorClasses,
  Avatar,
} from '@mui/material';
import { Science, Send, Warning, ArrowBack, ArrowForward, Check, Person, Favorite, FitnessCenter, Notes } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { diagnosticsApi } from '../api/diagnostics';
import type { CreateSessionRequest, DiagnosticSession } from '../api/diagnostics';
import { DiagnosticFormSkeleton } from '../components/SkeletonLoader';
import toast from 'react-hot-toast';

const defaultValues: CreateSessionRequest = {
  patientId: '',
  practitionerName: '',
  restingHeartRateBpm: 65,
  maxHeartRateBpm: 185,
  vo2MaxMlMinKg: 45,
  anaerobicThresholdBpm: 155,
  systolicBloodPressure: 120,
  diastolicBloodPressure: 78,
  bodyFatPercentage: 15,
  muscleMassKg: 40,
  rawPractitionerNotes: '',
};

/* ── Custom Step Connector ── */
const ColorConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: { top: 12 },
  [`&.${stepConnectorClasses.active}`]: { [`& .${stepConnectorClasses.line}`]: { background: '#0D7377' } },
  [`&.${stepConnectorClasses.completed}`]: { [`& .${stepConnectorClasses.line}`]: { background: '#0D7377' } },
  [`& .${stepConnectorClasses.line}`]: { height: 3, border: 0, backgroundColor: '#e0e0e0', borderRadius: 1 },
}));

const steps = [
  { label: 'Informace o pacientovi', icon: <Person /> },
  { label: 'Kardiovaskulární', icon: <Favorite /> },
  { label: 'Složení těla', icon: <FitnessCenter /> },
  { label: 'Poznámky a odeslání', icon: <Notes /> },
];

/* ── Metric Slider ── */
function MetricSlider({ label, value, onChange, min, max, unit, zones }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; unit: string;
  zones?: { from: number; to: number; color: string; label: string }[];
}) {
  const currentZone = zones?.find(z => value >= z.from && value <= z.to);

  const getSliderColor = () => {
    if (!currentZone) return '#0D7377';
    return currentZone.color;
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: getSliderColor() }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">{unit}</Typography>
        </Box>
      </Box>
      <Slider
        value={value} onChange={(_, v) => onChange(v as number)}
        min={min} max={max} step={0.1}
        sx={{
          color: getSliderColor(),
          '& .MuiSlider-thumb': { width: 20, height: 20, '&:hover': { boxShadow: `0 0 0 8px ${getSliderColor()}20` } },
          '& .MuiSlider-track': { border: 'none' },
        }}
      />
      {currentZone && (
        <Chip label={currentZone.label} size="small"
          sx={{ bgcolor: `${currentZone.color}18`, color: currentZone.color, fontWeight: 500, mt: 0.5 }} />
      )}
      {zones && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          {zones.map(z => (
            <Box key={z.label} sx={{ flex: 1, height: 3, borderRadius: 1, bgcolor: value >= z.from && value <= z.to ? z.color : `${z.color}30`, transition: 'all 0.3s' }} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/* ── Main Component ── */
export default function DiagnosticForm() {
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<CreateSessionRequest>(defaultValues);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticSession | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('patientId');
    if (pid) setForm(prev => ({ ...prev, patientId: pid }));
  }, []);

  const update = (field: keyof CreateSessionRequest, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const session = await diagnosticsApi.create(form);
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
    if (activeStep === 0) return form.patientId && form.practitionerName;
    return true;
  };

  if (loading) return <DiagnosticFormSkeleton />;

  /* ── Results View ── */
  if (result) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Paper sx={{ p: 4 }}>
            <Alert severity={result.requiresDoctorReview ? 'warning' : 'success'} sx={{ mb: 3, borderRadius: 2 }}>
              {result.requiresDoctorReview
                ? '⚠️ Tato relace vyžaduje přezkum lékařem'
                : '✅ Analýza dokončena — žádné kritické nálezy'}
            </Alert>

            <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>AI Klinický souhrn</Typography>
            <Paper variant="outlined" sx={{ p: 3, mb: 3, bgcolor: '#F8FFFE', borderRadius: 2, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {result.agentGeneratedSummary}
            </Paper>

            {parseAnomalies(result.detectedAnomaliesJson).length > 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>Zjištěné anomálie</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                  {parseAnomalies(result.detectedAnomaliesJson).map((a: any, i: number) => (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}>
                      <Chip
                        icon={a.isCritical ? <Warning /> : undefined}
                        label={`${a.metric}: ${a.description}`}
                        color={a.severity === 'Critical' ? 'error' : a.severity === 'Warning' ? 'warning' : 'info'}
                        variant="outlined" sx={{ fontWeight: 500 }}
                      />
                    </motion.div>
                  ))}
                </Box>
              </>
            )}

            <Divider sx={{ my: 3 }} />
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, mb: 2 }}>Metriky relace</Typography>
            <Grid container spacing={2}>
              {[
                ['Klidový tep', `${result.restingHeartRateBpm} bpm`, '#0D7377'],
                ['Max tep', `${result.maxHeartRateBpm} bpm`, '#D32F2F'],
                ['VO2 Max', `${result.vo2MaxMlMinKg} ml/kg/min`, '#2E7D32'],
                ['Anaerobní práh', `${result.anaerobicThresholdBpm} bpm`, '#ED6C02'],
                ['Krevní tlak', `${result.systolicBloodPressure}/${result.diastolicBloodPressure} mmHg`, '#0288D1'],
                ['Tělesný tuk', `${result.bodyFatPercentage}%`, '#9C27B0'],
                ['Svalová hmota', `${result.muscleMassKg} kg`, '#FF5722'],
              ].map(([label, value, color], i) => (
                <Grid key={label} size={{ xs: 6, sm: 4 }}>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                    <Card variant="outlined" sx={{ borderColor: `${color}30` }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>

            <Button variant="outlined" sx={{ mt: 3, borderRadius: 2, px: 4 }}
              onClick={() => { setResult(null); setForm(defaultValues); setActiveStep(0); }}>
              Vytvořit další relaci
            </Button>
          </Paper>
        </motion.div>
      </Box>
    );
  }

  /* ── Wizard View ── */
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Science color="primary" /> Nová diagnostická relace
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Krok {activeStep + 1} z {steps.length} — {steps[activeStep].label}
        </Typography>
      </motion.div>

      {/* ── Stepper ── */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel connector={<ColorConnector />}>
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel
                StepIconComponent={({ active, completed }) => (
                  <motion.div animate={{ scale: active ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
                    <Avatar sx={{
                      width: 32, height: 32, fontSize: 16,
                      bgcolor: completed ? '#0D7377' : active ? '#14A3A8' : '#e0e0e0',
                      color: completed || active ? '#fff' : '#999',
                      transition: 'all 0.3s',
                    }}>
                      {completed ? <Check sx={{ fontSize: 18 }} /> : step.icon}
                    </Avatar>
                  </motion.div>
                )}
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
        <LinearProgress variant="determinate" value={((activeStep + 1) / steps.length) * 100}
          sx={{ mt: 2, borderRadius: 1, height: 4, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#0D7377' } }} />
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* ── Step Content ── */}
      <AnimatePresence mode="wait">
        <motion.div key={activeStep} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            {/* Step 0: Patient Info */}
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Informace o pacientovi</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Zadejte údaje pacienta a praktika</Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth required label="ID pacienta" value={form.patientId}
                      onChange={e => update('patientId', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField fullWidth required label="Jméno praktika" value={form.practitionerName}
                      onChange={e => update('practitionerName', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* Step 1: Cardiovascular */}
            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Kardiovaskulární metriky</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Nastavte posuvníkem jednotlivé metriky. Barevné zóny označují normální rozsahy.
                </Typography>
                <MetricSlider label="Klidová srdeční frekvence" value={form.restingHeartRateBpm}
                  onChange={v => update('restingHeartRateBpm', v)} min={30} max={150} unit="bpm"
                  zones={[
                    { from: 30, to: 50, color: '#0288D1', label: 'Sportovec — velmi nízký klidový tep' },
                    { from: 50, to: 70, color: '#2E7D32', label: 'Normální — zdravý rozsah' },
                    { from: 70, to: 90, color: '#ED6C02', label: 'Zvýšený — zvažte vyšetření' },
                    { from: 90, to: 150, color: '#D32F2F', label: 'Vysoký — lékařská péče' },
                  ]} />
                <MetricSlider label="Maximální srdeční frekvence" value={form.maxHeartRateBpm}
                  onChange={v => update('maxHeartRateBpm', v)} min={100} max={250} unit="bpm"
                  zones={[
                    { from: 100, to: 150, color: '#ED6C02', label: 'Pod očekáváním' },
                    { from: 150, to: 200, color: '#2E7D32', label: 'Normální rozsah' },
                    { from: 200, to: 250, color: '#D32F2F', label: 'Nad očekáváním' },
                  ]} />
                <MetricSlider label="Anaerobní práh" value={form.anaerobicThresholdBpm}
                  onChange={v => update('anaerobicThresholdBpm', v)} min={80} max={220} unit="bpm"
                  zones={[
                    { from: 80, to: 130, color: '#ED6C02', label: 'Pod průměrem' },
                    { from: 130, to: 170, color: '#2E7D32', label: 'Zdravý rozsah' },
                    { from: 170, to: 220, color: '#0288D1', label: 'Sportovní úroveň' },
                  ]} />
                <MetricSlider label="VO2 Max" value={form.vo2MaxMlMinKg}
                  onChange={v => update('vo2MaxMlMinKg', v)} min={15} max={80} unit="ml/kg/min"
                  zones={[
                    { from: 15, to: 30, color: '#D32F2F', label: 'Špatné — je třeba zlepšit' },
                    { from: 30, to: 40, color: '#ED6C02', label: 'Pod průměrem' },
                    { from: 40, to: 55, color: '#2E7D32', label: 'Dobré — zdravá kondice' },
                    { from: 55, to: 80, color: '#0288D1', label: 'Výborné — sportovní úroveň' },
                  ]} />
              </Box>
            )}

            {/* Step 2: Body Composition */}
            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Složení těla</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Zadejte krevní tlak a metriky složení těla.
                </Typography>
                <MetricSlider label="Systolický krevní tlak" value={form.systolicBloodPressure}
                  onChange={v => update('systolicBloodPressure', v)} min={60} max={200} unit="mmHg"
                  zones={[
                    { from: 60, to: 90, color: '#0288D1', label: 'Nízký — hypotenze' },
                    { from: 90, to: 130, color: '#2E7D32', label: 'Normální' },
                    { from: 130, to: 160, color: '#ED6C02', label: 'Zvýšený — prehypertenze' },
                    { from: 160, to: 200, color: '#D32F2F', label: 'Vysoký — hypertenze' },
                  ]} />
                <MetricSlider label="Diastolický krevní tlak" value={form.diastolicBloodPressure}
                  onChange={v => update('diastolicBloodPressure', v)} min={30} max={130} unit="mmHg"
                  zones={[
                    { from: 30, to: 60, color: '#0288D1', label: 'Nízký' },
                    { from: 60, to: 85, color: '#2E7D32', label: 'Normální' },
                    { from: 85, to: 100, color: '#ED6C02', label: 'Zvýšený' },
                    { from: 100, to: 130, color: '#D32F2F', label: 'Vysoký' },
                  ]} />
                <MetricSlider label="Podíl tělesného tuku" value={form.bodyFatPercentage}
                  onChange={v => update('bodyFatPercentage', v)} min={3} max={50} unit="%"
                  zones={[
                    { from: 3, to: 10, color: '#0288D1', label: 'Sportovec — velmi štíhlý' },
                    { from: 10, to: 20, color: '#2E7D32', label: 'Fitness — zdravý rozsah' },
                    { from: 20, to: 30, color: '#ED6C02', label: 'Průměrný — zvažte životní styl' },
                    { from: 30, to: 50, color: '#D32F2F', label: 'Nad průměrem — lékařská kontrola' },
                  ]} />
                <MetricSlider label="Svalová hmota" value={form.muscleMassKg}
                  onChange={v => update('muscleMassKg', v)} min={10} max={80} unit="kg"
                  zones={[
                    { from: 10, to: 25, color: '#ED6C02', label: 'Nízká — doporučen silový trénink' },
                    { from: 25, to: 50, color: '#2E7D32', label: 'Průměrná — zdravý rozsah' },
                    { from: 50, to: 80, color: '#0288D1', label: 'Nad průměrem — sportovní postava' },
                  ]} />
              </Box>
            )}

            {/* Step 3: Notes & Submit */}
            {activeStep === 3 && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Poznámky a kontrola</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Přidejte klinické poznámky a odešlete k AI analýze.
                </Typography>
                <TextField fullWidth multiline rows={4} label="Poznámky praktika"
                  value={form.rawPractitionerNotes}
                  onChange={e => update('rawPractitionerNotes', e.target.value)}
                  placeholder="např. Pacient hlásí bolest na hrudi při cvičení, rodinná anamnéza srdečních chorob..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 }, mb: 3 }} />

                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Shrnutí</Typography>
                <Grid container spacing={2}>
                  {[
                    ['Pacient', form.patientId || '—'],
                    ['Praktik', form.practitionerName || '—'],
                    ['Klidový tep', `${form.restingHeartRateBpm} bpm`],
                    ['Max tep', `${form.maxHeartRateBpm} bpm`],
                    ['VO2 Max', `${form.vo2MaxMlMinKg} ml/kg/min`],
                    ['Krevní tlak', `${form.systolicBloodPressure}/${form.diastolicBloodPressure} mmHg`],
                  ].map(([label, value]) => (
                    <Grid key={label} size={{ xs: 6, sm: 4 }}>
                      <Card variant="outlined" sx={{ borderColor: '#e0e0e0' }}>
                        <CardContent sx={{ py: 1.5, px: 2 }}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography sx={{ fontWeight: 600 }}>{value}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Paper>
        </motion.div>
      </AnimatePresence>

      {/* ── Navigation Buttons ── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button startIcon={<ArrowBack />} disabled={activeStep === 0}
          onClick={() => setActiveStep(s => s - 1)}
          sx={{ borderRadius: 2, px: 3 }}>
          Zpět
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" endIcon={<ArrowForward />} disabled={!canNext()}
            onClick={() => setActiveStep(s => s + 1)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(13,115,119,0.3)',
              '&:hover': { bgcolor: '#095456', boxShadow: '0 6px 20px rgba(13,115,119,0.4)' } }}>
            Další
          </Button>
        ) : (
          <Button variant="contained" endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Send />}
            onClick={handleSubmit} disabled={loading}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(13,115,119,0.3)',
              '&:hover': { bgcolor: '#095456' } }}>
            {loading ? 'Analyzuji...' : 'Odeslat a spustit AI analýzu'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
