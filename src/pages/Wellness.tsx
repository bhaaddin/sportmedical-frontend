import { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Slider, TextField, Button, Paper,
  LinearProgress, Avatar,
} from '@mui/material';
import { FitnessCenter, Send, CheckCircle, Nightlight, Mood, LocalFireDepartment, Opacity } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { wellnessApi } from '../api/wellness';
import toast from 'react-hot-toast';

const metricConfig = [
  { key: 'sleepQuality', label: 'Kvalita spánku', icon: <Nightlight />, min: 1, max: 10, color: '#5C6BC0', desc: '1 = hrozný, 10 = skvělý' },
  { key: 'mood', label: 'Nálada', icon: <Mood />, min: 1, max: 10, color: '#26A69A', desc: '1 = depka, 10 = skvělá' },
  { key: 'stress', label: 'Stres', icon: <LocalFireDepartment />, min: 1, max: 10, color: '#EF5350', desc: '1 = žádný, 10 = extrémní', invert: true },
  { key: 'soreness', label: 'Svalová bolest', icon: <FitnessCenter />, min: 1, max: 10, color: '#FF7043', desc: '1 = žádná, 10 = hrozná', invert: true },
  { key: 'fatigue', label: 'Únava', icon: <FitnessCenter />, min: 1, max: 10, color: '#AB47BC', desc: '1 = odpočatý, 10 = vyčerpaný', invert: true },
  { key: 'readiness', label: 'Připravenost trénovat', icon: <CheckCircle />, min: 1, max: 10, color: '#66BB6A', desc: '1 = vůbec ne, 10 = maximální' },
];

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
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <FitnessCenter color="primary" /> Denní wellness dotazník
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Vyplňte svůj denní stav pro optimální tréninkové zatížení
        </Typography>
      </motion.div>

      {/* Composite Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 6, bgcolor: isFlagged ? '#D32F2F' : '#2E7D32' }} />
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h2" sx={{ fontWeight: 800, color: isFlagged ? '#D32F2F' : '#2E7D32' }}>
              {compositeScore}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              {isFlagged ? '⚠️ Nízká připravenost — doporučeno snížit zátěž' : '✅ Dobrá připravenost — můžete trénovat'}
            </Typography>
            <LinearProgress variant="determinate" value={parseFloat(compositeScore) * 10}
              sx={{ mt: 2, height: 8, borderRadius: 4, bgcolor: '#f0f0f0',
                '& .MuiLinearProgress-bar': { bgcolor: isFlagged ? '#D32F2F' : '#2E7D32' } }} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Patient ID */}
      <TextField fullWidth label="ID pacienta" value={form.patientId}
        onChange={e => update('patientId', e.target.value)}
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />

      {/* Metrics */}
      <Grid container spacing={3}>
        {metricConfig.map((metric, i) => (
          <Grid key={metric.key} size={{ xs: 12, sm: 6 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Avatar sx={{ bgcolor: `${metric.color}18`, color: metric.color, width: 36, height: 36 }}>
                      {metric.icon}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 600 }}>{metric.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{metric.desc}</Typography>
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: metric.color }}>
                      {(form as any)[metric.key]}
                    </Typography>
                  </Box>
                  <Slider
                    value={(form as any)[metric.key]}
                    onChange={(_, v) => update(metric.key, v as number)}
                    min={metric.min} max={metric.max} step={1}
                    sx={{ color: metric.color, '& .MuiSlider-thumb': { width: 18, height: 18 } }} />
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}

        {/* Sleep Hours */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Avatar sx={{ bgcolor: '#5C6BC018', color: '#5C6BC0', width: 36, height: 36 }}>
                    <Nightlight />
                  </Avatar>
                  <Typography sx={{ fontWeight: 600 }}>Délka spánku</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#5C6BC0', ml: 'auto' }}>
                    {form.sleepHours}h
                  </Typography>
                </Box>
                <Slider value={form.sleepHours} onChange={(_, v) => update('sleepHours', v as number)}
                  min={3} max={12} step={0.5} sx={{ color: '#5C6BC0' }} />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Hydration */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Avatar sx={{ bgcolor: '#29B6F618', color: '#29B6F6', width: 36, height: 36 }}>
                    <Opacity />
                  </Avatar>
                  <Typography sx={{ fontWeight: 600 }}>Hydratace</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#29B6F6', ml: 'auto' }}>
                    {form.hydration}
                  </Typography>
                </Box>
                <Slider value={form.hydration} onChange={(_, v) => update('hydration', v as number)}
                  min={1} max={10} step={1} sx={{ color: '#29B6F6' }} />
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Notes */}
      <TextField fullWidth multiline rows={3} label="Poznámky" value={form.notes}
        onChange={e => update('notes', e.target.value)}
        placeholder="např. Bolí mě koleno po včerejším tréninku..."
        sx={{ mt: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />

      {/* Submit */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <Button variant="contained" startIcon={<Send />} onClick={handleSubmit}
          fullWidth sx={{ mt: 3, py: 1.5, bgcolor: '#0D7377', borderRadius: 3, fontWeight: 600,
            boxShadow: '0 4px 16px rgba(13,115,119,0.3)', '&:hover': { bgcolor: '#095456' } }}>
          Odeslat denní wellness
        </Button>
      </motion.div>
    </Box>
  );
}
