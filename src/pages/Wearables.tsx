import { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Grid, TextField, Button, Chip, MenuItem, Skeleton, Divider, Alert } from '@mui/material';
import { Watch, Add, TrendingUp, LocalFireDepartment, Nightlight, FitnessCenter } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { wearablesApi, type WearableData, type WearableSummary } from '../api/wearables';
import toast from 'react-hot-toast';

export default function Wearables() {
  const [history, setHistory] = useState<WearableData[]>([]);
  const [summary, setSummary] = useState<WearableSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    patientId: '', provider: 'Whoop', restingHR: 0, hrv: 0, sleepHours: 0,
    recoveryScore: 0, strainScore: 0, calories: 0, steps: 0,
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const loadData = async () => {
    if (!form.patientId) return;
    setLoading(true);
    try {
      const [hist, sum] = await Promise.all([
        wearablesApi.getByPatient(form.patientId, 30).catch(() => []),
        wearablesApi.getSummary(form.patientId, 7).catch(() => null),
      ]);
      setHistory(hist);
      setSummary(sum);
    } catch {}
    setLoading(false);
  };

  const handleImport = async () => {
    if (!form.patientId) { toast.error('Zadejte ID pacienta'); return; }
    try {
      await wearablesApi.import({
        patientId: form.patientId,
        provider: form.provider,
        restingHR: form.restingHR || undefined,
        hrv: form.hrv || undefined,
        sleepHours: form.sleepHours || undefined,
        recoveryScore: form.recoveryScore || undefined,
        strainScore: form.strainScore || undefined,
        caloriesBurned: form.calories || undefined,
        steps: form.steps || undefined,
      });
      toast.success('Data z wearables importována');
      loadData();
    } catch { toast.error('Chyba při importu'); }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Watch color="primary" /> Wearable Data Import
        </Typography>
      </motion.div>

      {/* Import Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Import dat z wearables</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="ID pacienta" value={form.patientId} onChange={e => update('patientId', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Zařízení" value={form.provider} onChange={e => update('provider', e.target.value)}>
                <MenuItem value="Whoop">WHOOP</MenuItem>
                <MenuItem value="Garmin">Garmin</MenuItem>
                <MenuItem value="Polar">Polar</MenuItem>
                <MenuItem value="Oura">Oura Ring</MenuItem>
                <MenuItem value="Apple">Apple Watch</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Klidový TF" value={form.restingHR || ''} onChange={e => update('restingHR', parseInt(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="HRV (ms)" value={form.hrv || ''} onChange={e => update('hrv', parseFloat(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Spánek (h)" value={form.sleepHours || ''} onChange={e => update('sleepHours', parseFloat(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Recovery %" value={form.recoveryScore || ''} onChange={e => update('recoveryScore', parseInt(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Strain" value={form.strainScore || ''} onChange={e => update('strainScore', parseInt(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Kalorie" value={form.calories || ''} onChange={e => update('calories', parseInt(e.target.value) || 0)} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth type="number" label="Kroky" value={form.steps || ''} onChange={e => update('steps', parseInt(e.target.value) || 0)} /></Grid>
          </Grid>
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button variant="contained" startIcon={<Add />} onClick={handleImport}
              sx={{ bgcolor: '#0D7377' }}>
              Importovat data
            </Button>
            <Button variant="outlined" onClick={loadData} disabled={!form.patientId}
              sx={{ borderColor: '#0D7377', color: '#0D7377' }}>
              Načíst historii
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && summary.dataPoints > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Souhrn (7 dní)</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Prům. Recovery', value: `${Math.round(summary.avgRecovery)}%`, icon: <FitnessCenter />, color: '#2E7D32' },
              { label: 'Prům. HRV', value: `${Math.round(summary.avgHRV)} ms`, icon: <TrendingUp />, color: '#0288D1' },
              { label: 'Prům. Klidový TF', value: `${Math.round(summary.avgRestingHR)} bpm`, icon: <LocalFireDepartment />, color: '#D32F2F' },
              { label: 'Prům. Spánek', value: `${summary.avgSleepHours.toFixed(1)} h`, icon: <Nightlight />, color: '#5C6BC0' },
            ].map((item, i) => (
              <Grid key={item.label} size={{ xs: 6, md: 3 }}>
                <Card>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ color: item.color }}>{item.icon}</Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: item.color }}>{item.value}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            {summary.dataPoints} záznamů za posledních 7 dní
          </Alert>
        </motion.div>
      )}

      {/* History */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Historie importů</Typography>
          {history.map((entry, i) => (
            <Card key={entry.id} sx={{ mb: 1 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 500 }}>{entry.provider}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(entry.dataDate).toLocaleDateString('cs-CZ')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {entry.recoveryScore && <Chip label={`Rec: ${entry.recoveryScore}%`} size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32' }} />}
                  {entry.hrv && <Chip label={`HRV: ${entry.hrv}ms`} size="small" />}
                  {entry.sleepHours && <Chip label={`Spánek: ${entry.sleepHours}h`} size="small" />}
                  {entry.strainScore && <Chip label={`Strain: ${entry.strainScore}`} size="small" sx={{ bgcolor: '#FFF3E0', color: '#ED6C02' }} />}
                </Box>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Supported Devices */}
      <Typography variant="h6" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>Podporovaná zařízení</Typography>
      <Grid container spacing={2}>
        {['WHOOP', 'Garmin', 'Polar', 'Oura Ring', 'Apple Watch'].map(name => (
          <Grid key={name} size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card><CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Watch sx={{ fontSize: 40, color: '#0D7377', mb: 1 }} />
              <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
              <Chip label="Podporováno" size="small" sx={{ mt: 1, bgcolor: '#E8F5E9', color: '#2E7D32' }} />
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
