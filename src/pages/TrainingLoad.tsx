import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, TextField, MenuItem, Slider,
  Skeleton, Alert, Chip, Divider, Paper,
} from '@mui/material';
import { FitnessCenter, Add, TrendingUp, Warning, CheckCircle, Speed } from '@mui/icons-material';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Legend,
} from 'recharts';
import { trainingApi, type TrainingSession, type AcwrData } from '../api/training';
import { patientsApi, type Patient } from '../api/patients';
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

function AcwrGauge({ value }: { value: number }) {
  const color = value < 0.8 ? '#ED6C02' : value <= 1.3 ? '#2E7D32' : value <= 1.5 ? '#ED6C02' : '#D32F2F';
  const label = value < 0.8 ? 'Nízká' : value <= 1.3 ? 'Optimální' : value <= 1.5 ? 'Zvýšená' : 'Nebezpečná';
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>ACWR Poměr</Typography>
        <Typography variant="h1" sx={{ fontWeight: 800, color, mb: 1 }}>
          {value > 0 ? value.toFixed(2) : '—'}
        </Typography>
        <Chip label={label} sx={{ bgcolor: `${color}18`, color, fontWeight: 600 }} />
        <Box sx={{ mt: 2, position: 'relative', height: 12, bgcolor: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', left: '40%', width: '12%', height: '100%', bgcolor: '#2E7D3240', borderRadius: 6 }} />
          <Box sx={{ position: 'absolute', left: 0, height: '100%', width: `${Math.min(value / 2 * 100, 100)}%`, bgcolor: color, borderRadius: 6, transition: 'width 0.5s' }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">0.0</Typography>
          <Typography variant="caption" sx={{ color: '#2E7D32', fontWeight: 600 }}>0.8 — 1.3</Typography>
          <Typography variant="caption" color="text.secondary">2.0</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function TrainingLoad() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [acwr, setAcwr] = useState<AcwrData | null>(null);
  const [loadTrend, setLoadTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    type: 'Training', description: '', durationMinutes: 60, rpe: 5,
    avgHeartRate: 0, maxHeartRate: 0, coach: '', notes: '',
  });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    patientsApi.getAll()
      .then(setPatients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadPatientData = async (patientId: string) => {
    if (!patientId) { setSessions([]); setAcwr(null); setLoadTrend([]); return; }
    try {
      const [sess, acwrData, trend] = await Promise.all([
        trainingApi.getByPatient(patientId, 30).catch(() => []),
        trainingApi.getAcwr(patientId).catch(() => null),
        trainingApi.getLoadTrend(patientId, 8).catch(() => []),
      ]);
      setSessions(sess);
      setAcwr(acwrData);
      setLoadTrend(trend);
    } catch {}
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
      loadPatientData(selectedPatient);
      setForm(prev => ({ ...prev, description: '', notes: '' }));
    } catch { toast.error('Chyba při ukládání'); }
  };

  const weeklyLoad = sessions.reduce((sum, s) => sum + s.sessionRPE, 0);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FitnessCenter color="primary" /> Tréninkové zatížení
            </Typography>
            <Typography variant="body2" color="text.secondary">sRPE, ACWR a trendové analytiky</Typography>
          </Box>
        </Box>
      </motion.div>

      {/* Patient Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth select label="Sportovec / pacient" value={selectedPatient}
                onChange={e => setSelectedPatient(e.target.value)}>
                <MenuItem value="">— Vyberte pacienta —</MenuItem>
                {patients.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
                ))}
              </TextField>
            </Grid>
            {selectedPatient && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Týdenní zátěž:</Typography>
                  <Chip label={`${weeklyLoad} sRPE · ${sessions.length} tréninků`} sx={{ bgcolor: '#E0F2F1', color: '#0D7377', fontWeight: 600 }} />
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {selectedPatient && (
        <>
          {/* ACWR & Stats Row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <AcwrGauge value={acwr?.acwrValue ?? 0} />
              </motion.div>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>ACWR Podrobnosti</Typography>
                    {acwr ? (
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2" color="text.secondary">Akutní zátěž (7 dní)</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0288D1' }}>{acwr.acuteLoad}</Typography>
                          <Typography variant="caption" color="text.secondary">{acwr.acuteSessions} tréninků</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2" color="text.secondary">Chronická zátěž (28 dní)</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0D7377' }}>{acwr.chronicLoad}</Typography>
                          <Typography variant="caption" color="text.secondary">{acwr.chronicSessions} tréninků</Typography>
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Alert severity={acwr.riskLevel === 'optimal' ? 'success' : acwr.riskLevel === 'danger' ? 'error' : 'warning'} sx={{ borderRadius: 2 }}>
                            {acwr.riskDescription}
                          </Alert>
                        </Grid>
                      </Grid>
                    ) : (
                      <Typography color="text.secondary">Zatím žádná data pro výpočet ACWR</Typography>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          </Grid>

          {/* Load Trend Chart */}
          {loadTrend.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Trend zátěže</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Celková týdenní zátěž (sRPE)</Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={loadTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#999" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#999" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                      <Legend />
                      <ReferenceLine y={acwr?.chronicLoad ?? 0} stroke="#0D7377" strokeDasharray="5 5" label={{ value: 'Chronický průměr', position: 'right' }} />
                      <Bar dataKey="totalLoad" name="Celková zátěž" fill="#0D7377" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Create Session Form */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Zaznamenat trénink</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField fullWidth select label="Typ" value={form.type} onChange={e => update('type', e.target.value)}>
                      {sessionTypes.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth label="Popis" value={form.description} onChange={e => update('description', e.target.value)}
                    placeholder="např. Intervaly 4×4 min, posilovna horní polovina" /></Grid>
                  <Grid size={{ xs: 6, sm: 2 }}><TextField fullWidth type="number" label="Trvání (min)" value={form.durationMinutes} onChange={e => update('durationMinutes', parseInt(e.target.value) || 0)} /></Grid>
                  <Grid size={{ xs: 6, sm: 2 }}><TextField fullWidth label="Trenér" value={form.coach} onChange={e => update('coach', e.target.value)} /></Grid>
                </Grid>

                {/* RPE Slider */}
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>sRPE (Jak těžký byl trénink?)</Typography>
                    <Chip label={`${form.rpe} — ${rpeLabels[form.rpe]}`} sx={{ bgcolor: '#E0F2F1', color: '#0D7377', fontWeight: 600 }} />
                  </Box>
                  <Slider value={form.rpe} onChange={(_, v) => update('rpe', v as number)}
                    min={1} max={10} step={1} marks
                    sx={{ color: '#0D7377', '& .MuiSlider-markLabel': { fontSize: 10 } }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">1 — Odpočinek</Typography>
                    <Typography variant="caption" color="text.secondary">10 — Maximální</Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tréninková zátěž = sRPE × Trvání = <strong>{form.rpe * form.durationMinutes}</strong>
                  </Typography>
                  <Button variant="contained" startIcon={<Add />} onClick={handleCreateSession}
                    sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
                    Zaznamenat
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Sessions */}
          {sessions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Poslední tréninky</Typography>
              <Grid container spacing={2}>
                {sessions.slice(0, 10).map((session, i) => (
                  <Grid key={session.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Chip label={sessionTypes.find(t => t.value === session.type)?.label || session.type} size="small"
                            sx={{ bgcolor: '#E0F2F1', color: '#0D7377' }} />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(session.sessionDate).toLocaleDateString('cs-CZ')}
                          </Typography>
                        </Box>
                        {session.description && (
                          <Typography variant="body2" sx={{ mb: 1 }}>{session.description}</Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip label={`${session.durationMinutes} min`} size="small" variant="outlined" />
                          <Chip label={`sRPE: ${session.rpe}`} size="small" variant="outlined" />
                          <Chip label={`Zátěž: ${session.sessionRPE}`} size="small"
                            sx={{ bgcolor: '#0D737718', color: '#0D7377', fontWeight: 600 }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          )}
        </>
      )}
    </Box>
  );
}
