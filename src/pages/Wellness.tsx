import { useState } from 'react';
import {
  Box, Typography, Grid, Slider, TextField, Button, LinearProgress, Stack,
} from '@mui/material';
import { Send } from '@mui/icons-material';
import { wellnessApi } from '../api/wellness';
import { DESIGN, KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip } from '../components/ui';
import toast from 'react-hot-toast';

const metricConfig = [
  { key: 'sleepQuality', label: 'Kvalita spánku', min: 1, max: 10, desc: '1 = hrozný, 10 = skvělý' },
  { key: 'mood', label: 'Nálada', min: 1, max: 10, desc: '1 = depka, 10 = skvělá' },
  { key: 'stress', label: 'Stres', min: 1, max: 10, desc: '1 = žádný, 10 = extrémní', invert: true },
  { key: 'soreness', label: 'Svalová bolest', min: 1, max: 10, desc: '1 = žádná, 10 = hrozná', invert: true },
  { key: 'fatigue', label: 'Únava', min: 1, max: 10, desc: '1 = odpočatý, 10 = vyčerpaný', invert: true },
  { key: 'readiness', label: 'Připravenost trénovat', min: 1, max: 10, desc: '1 = vůbec ne, 10 = maximální' },
];

/* One slider in a bordered card: label, hint, the value on the right. */
function MetricCard({ label, desc, value, min, max, step = 1, format, onChange }: {
  label: string; desc?: string; value: number; min: number; max: number; step?: number;
  format?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <SoftCard sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', mb: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{label}</Typography>
          {desc && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{desc}</Typography>}
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {format ? format(value) : value}
        </Typography>
      </Stack>
      <Slider
        value={value}
        onChange={(_, v) => onChange(v as number)}
        min={min} max={max} step={step}
        aria-label={label}
        sx={{ '& .MuiSlider-thumb': { width: 18, height: 18 } }} />
    </SoftCard>
  );
}

export default function Wellness() {
  const [form, setForm] = useState({
    patientId: '',
    sleepQuality: 7,
    sleepHours: 8,
    mood: 7,
    stress: 3,
    soreness: 3,
    fatigue: 3,
    readiness: 7,
    hydration: 7,
    notes: '',
  });

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const compositeScore = (
    (form.sleepQuality + form.mood + (10 - form.stress) + (10 - form.soreness) + (10 - form.fatigue) + form.readiness) / 6
  ).toFixed(1);

  const isFlagged = parseFloat(compositeScore) < 5;

  const handleSubmit = async () => {
    if (!form.patientId) {
      toast.error('Zadejte ID pacienta');
      return;
    }
    try {
      await wellnessApi.create(form);
      toast.success('Dotazník wellness odeslán!');
      setForm(prev => ({ ...prev, patientId: '', notes: '' }));
    } catch {
      toast.error('Chyba při odesílání');
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title="Denní wellness dotazník"
        subtitle="Vyplňte denní stav pro optimální tréninkové zatížení"
      />

      {/* Composite Score */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard
            label="Celkové skóre"
            value={compositeScore}
            hint="průměr ze šesti ukazatelů"
            tone={isFlagged ? 'red' : 'green'}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <SoftCard sx={{ height: '100%' }}>
            <SectionLabel>Připravenost</SectionLabel>
            <StatusChip tone={isFlagged ? 'red' : 'green'} dot>
              {isFlagged ? 'Nízká připravenost — doporučeno snížit zátěž' : 'Dobrá připravenost — můžete trénovat'}
            </StatusChip>
            <LinearProgress
              variant="determinate"
              value={parseFloat(compositeScore) * 10}
              sx={{ mt: 2, '& .MuiLinearProgress-bar': { bgcolor: isFlagged ? DESIGN.tone.red.fg : DESIGN.tone.green.fg } }}
            />
          </SoftCard>
        </Grid>
      </Grid>

      {/* Patient ID */}
      <SoftCard sx={{ mb: 2.5 }}>
        <SectionLabel>Pacient</SectionLabel>
        <TextField fullWidth label="ID pacienta" value={form.patientId}
          onChange={e => update('patientId', e.target.value)} />
      </SoftCard>

      {/* Metrics */}
      <SectionLabel>Jak se dnes cítíte</SectionLabel>
      <Grid container spacing={2}>
        {metricConfig.map((metric) => (
          <Grid key={metric.key} size={{ xs: 12, sm: 6 }}>
            <MetricCard
              label={metric.label}
              desc={metric.desc}
              value={(form as any)[metric.key]}
              min={metric.min}
              max={metric.max}
              onChange={(v) => update(metric.key, v)}
            />
          </Grid>
        ))}

        {/* Sleep Hours */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <MetricCard
            label="Délka spánku"
            desc="hodin"
            value={form.sleepHours}
            min={3} max={12} step={0.5}
            format={(v) => `${v} h`}
            onChange={(v) => update('sleepHours', v)}
          />
        </Grid>

        {/* Hydration */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <MetricCard
            label="Hydratace"
            desc="1 = málo, 10 = dostatek"
            value={form.hydration}
            min={1} max={10}
            onChange={(v) => update('hydration', v)}
          />
        </Grid>
      </Grid>

      {/* Notes */}
      <SoftCard sx={{ mt: 2.5 }}>
        <SectionLabel>Poznámka</SectionLabel>
        <TextField fullWidth multiline rows={3} label="Poznámky" value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="např. Bolí mě koleno po včerejším tréninku..." />
        <Button variant="contained" startIcon={<Send />} onClick={handleSubmit} sx={{ mt: 2 }}>
          Odeslat denní wellness
        </Button>
      </SoftCard>
    </Box>
  );
}
