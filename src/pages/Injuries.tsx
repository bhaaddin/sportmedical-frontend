import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, Autocomplete,
} from '@mui/material';
import { Add, Warning, CheckCircle, Healing, FitnessCenter } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { injuriesApi } from '../api/injuries';
import { patientsApi, type Patient } from '../api/patients';
import toast from 'react-hot-toast';

interface Injury {
  id: string;
  patientId: string;
  patientName?: string;
  injuryDate: string;
  bodyRegion: string;
  specificLocation: string;
  side: string;
  type: string;
  severity: number;
  status: string;
  mechanism: string;
  diagnosis: string;
  practitioner: string;
  estimatedDaysOut?: number;
  actualDaysOut?: number;
  isRecurrence: boolean;
  clearedAt?: string;
}

const bodyRegions = [
  { value: 'Head', label: 'Hlava' }, { value: 'Neck', label: 'Krk' },
  { value: 'Shoulder', label: 'Rameno' }, { value: 'UpperArm', label: 'Horní paže' },
  { value: 'Elbow', label: 'Loket' }, { value: 'Forearm', label: 'Předloktí' },
  { value: 'Wrist', label: 'Zápěstí' }, { value: 'Hand', label: 'Ruka' },
  { value: 'UpperBack', label: 'Horní záda' }, { value: 'LowerBack', label: 'Dolní záda' },
  { value: 'Hip', label: 'Kyčel' }, { value: 'Thigh', label: 'Stehno' },
  { value: 'Knee', label: 'Koleno' }, { value: 'Shin', label: 'Lýtko' },
  { value: 'Ankle', label: 'Hlezno' }, { value: 'Foot', label: 'Chodidlo' },
];
const severityLabels = ['', 'Mírné', 'Střední', 'Vážné', 'Kritické'];
const severityColors = ['', '#2E7D32', '#ED6C02', '#D32F2F', '#B71C1C'];
const statusLabels: Record<string, string> = {
  Acute: 'Akutní', Rehabilitating: 'Rehabilitace', ReturningToPlay: 'Návrat do hry',
  Cleared: 'Vyléčeno', Chronic: 'Chronické',
};
const statusColors: Record<string, string> = {
  Acute: '#D32F2F', Rehabilitating: '#ED6C02', ReturningToPlay: '#0288D1',
  Cleared: '#2E7D32', Chronic: '#9C27B0',
};

export default function Injuries() {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => {
    injuriesApi.getAll().then(setInjuries).catch(() => {});
    patientsApi.getAll().then(setPatients).catch(() => {});
  }, []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    patientId: '', bodyRegion: '', specificLocation: '', side: 'Left',
    type: 'Acute', severity: 1, mechanism: '', diagnosis: '', practitioner: '',
    injuryDate: new Date().toISOString().slice(0, 10), notes: '', isRecurrence: false,
    estimatedDaysOut: '',
  });
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.patientId || !form.bodyRegion) {
      toast.error('Vyplňte pacienta a tělesnou oblast');
      return;
    }
    try {
      const estimatedDays = form.estimatedDaysOut ? parseInt(form.estimatedDaysOut, 10) : undefined;
      const newInjury = await injuriesApi.create({
        patientId: form.patientId,
        bodyRegion: form.bodyRegion,
        specificLocation: form.specificLocation,
        side: form.side,
        type: form.type,
        severity: form.severity,
        mechanism: form.mechanism,
        diagnosis: form.diagnosis,
        practitioner: form.practitioner,
        injuryDate: form.injuryDate,
        notes: form.notes,
        isRecurrence: form.isRecurrence,
        estimatedDaysOut: estimatedDays,
      });
      setInjuries(prev => [newInjury, ...prev]);
      setOpen(false);
      toast.success('Záznam poranění vytvořen');
      setSelectedPatient(null);
      setForm({ patientId: '', bodyRegion: '', specificLocation: '', side: 'Left',
        type: 'Acute', severity: 1, mechanism: '', diagnosis: '', practitioner: '',
        injuryDate: new Date().toISOString().slice(0, 10), notes: '', isRecurrence: false,
        estimatedDaysOut: '' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Neznámá chyba — zkontrolujte připojení k backendu';
      toast.error(`Chyba při ukládání: ${msg}`);
    }
  };

  const activeInjuries = injuries.filter(i => i.status !== 'Cleared');
  const clearedInjuries = injuries.filter(i => i.status === 'Cleared');
  const avgDaysOut = clearedInjuries.length > 0
    ? Math.round(clearedInjuries.reduce((a, i) => a + (i.actualDaysOut || 0), 0) / clearedInjuries.length)
    : 0;

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning color="primary" /> Poranění
            </Typography>
            <Typography variant="body2" color="text.secondary">Evidence a sledování poranění sportovců</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3 }}>
            Nové poranění
          </Button>
        </Box>
      </motion.div>

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Aktivní poranění', value: activeInjuries.length, color: '#D32F2F', icon: <Warning /> },
          { label: 'Vyléčeno', value: clearedInjuries.length, color: '#2E7D32', icon: <CheckCircle /> },
          { label: 'Průměr dnů mimo', value: avgDaysOut, color: '#ED6C02', icon: <FitnessCenter /> },
        ].map((stat, i) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 4 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
              <Card>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
                  <Box sx={{ color: stat.color }}>{stat.icon}</Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color }}>{stat.value}</Typography>
                    <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Injury Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell sx={{ fontWeight: 700 }}>Datum</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Oblast</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Strana</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Závažnost</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Diagnóza</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Dny mimo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {injuries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    <Healing sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography>Žádná poranění zatím neevidována</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                injuries.map(injury => (
                  <TableRow key={injury.id} hover>
                    <TableCell>{new Date(injury.injuryDate).toLocaleDateString('cs-CZ')}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>{bodyRegions.find(r => r.value === injury.bodyRegion)?.label || injury.bodyRegion}</Typography>
                        {injury.specificLocation && (
                          <Typography variant="caption" color="text.secondary">{injury.specificLocation}</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{injury.side === 'Left' ? 'Levá' : injury.side === 'Right' ? 'Pravá' : 'Obě'}</TableCell>
                    <TableCell>
                      <Chip label={severityLabels[injury.severity]} size="small"
                        sx={{ bgcolor: `${severityColors[injury.severity]}18`, color: severityColors[injury.severity], fontWeight: 500 }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={statusLabels[injury.status] || injury.status} size="small"
                        sx={{ bgcolor: `${statusColors[injury.status] || '#666'}18`, color: statusColors[injury.status] || '#666', fontWeight: 500 }} />
                    </TableCell>
                    <TableCell>{injury.diagnosis || '—'}</TableCell>
                    <TableCell>{injury.actualDaysOut ?? injury.estimatedDaysOut ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </motion.div>

      {/* Add Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Nové záznam poranění</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                options={patients}
                getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.id.slice(0, 8)}…)`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedPatient}
                onChange={(_, newValue) => {
                  setSelectedPatient(newValue);
                  update('patientId', newValue?.id || '');
                }}
                renderInput={(params) => (
                  <TextField {...params} fullWidth required label="Pacient" placeholder="Hledejte pacienta..." />
                )}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Tělesná oblast" value={form.bodyRegion}
                onChange={e => update('bodyRegion', e.target.value)}>
                {bodyRegions.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Strana" value={form.side}
                onChange={e => update('side', e.target.value)}>
                <MenuItem value="Left">Levá</MenuItem>
                <MenuItem value="Right">Pravá</MenuItem>
                <MenuItem value="Bilateral">Obě</MenuItem>
                <MenuItem value="Central">Centrální</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Specifické místo" value={form.specificLocation}
                onChange={e => update('specificLocation', e.target.value)}
                placeholder="např. mediální kolaterální vaz" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Typ" value={form.type}
                onChange={e => update('type', e.target.value)}>
                <MenuItem value="Acute">Akutní</MenuItem>
                <MenuItem value="Overuse">Přetížení</MenuItem>
                <MenuItem value="Recurrence">Recidiva</MenuItem>
                <MenuItem value="FirstOccurrence">První výskyt</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Závažnost" value={form.severity}
                onChange={e => update('severity', parseInt(e.target.value))}>
                <MenuItem value={1}>1 — Mírné</MenuItem>
                <MenuItem value={2}>2 — Střední</MenuItem>
                <MenuItem value={3}>3 — Vážné</MenuItem>
                <MenuItem value={4}>4 — Kritické</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Mechanismus poranění" value={form.mechanism}
                onChange={e => update('mechanism', e.target.value)}
                placeholder="např.kontakt s protihráčem při sprintu" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Diagnóza" value={form.diagnosis}
                onChange={e => update('diagnosis', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Ošetřující praktik" value={form.practitioner}
                onChange={e => update('practitioner', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Poznámky" value={form.notes}
                onChange={e => update('notes', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="number" label="Odhad dnů mimo" value={form.estimatedDaysOut}
                onChange={e => update('estimatedDaysOut', e.target.value)} />
            </Grid>

          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleSubmit}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Vytvořit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
