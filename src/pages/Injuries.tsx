import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, MenuItem, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { injuriesApi } from '../api/injuries';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import { KpiCard, PageHeader, StatusChip, type ChipTone } from '../components/ui';
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
const severityTones: ChipTone[] = ['grey', 'green', 'beige', 'red', 'red'];
const statusLabels: Record<string, string> = {
  Acute: 'Akutní', Rehabilitating: 'Rehabilitace', ReturningToPlay: 'Návrat do hry',
  Cleared: 'Vyléčeno', Chronic: 'Chronické',
};
const statusTones: Record<string, ChipTone> = {
  Acute: 'red', Rehabilitating: 'beige', ReturningToPlay: 'blue',
  Cleared: 'green', Chronic: 'grey',
};

export default function Injuries() {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  useEffect(() => {
    injuriesApi.getAll().then(setInjuries).catch(() => {});
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
      <PageHeader
        title="Poranění"
        subtitle={`Evidence a sledování poranění sportovců · ${injuries.length} záznamů`}
        actions={
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
            Nové poranění
          </Button>
        }
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard label="Aktivní poranění" value={activeInjuries.length} hint="v léčbě nebo rehabilitaci" tone={activeInjuries.length > 0 ? 'red' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard label="Vyléčeno" value={clearedInjuries.length} hint="uzavřených záznamů" tone="green" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiCard label="Průměr dnů mimo" value={avgDaysOut} hint="u vyléčených poranění" />
        </Grid>
      </Grid>

      {/* Injury Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Datum</TableCell>
              <TableCell>Oblast</TableCell>
              <TableCell>Strana</TableCell>
              <TableCell>Závažnost</TableCell>
              <TableCell>Stav</TableCell>
              <TableCell>Diagnóza</TableCell>
              <TableCell align="right">Dny mimo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {injuries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  <Typography variant="body2">Žádná poranění zatím neevidována</Typography>
                </TableCell>
              </TableRow>
            ) : (
              injuries.map(injury => (
                <TableRow key={injury.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(injury.injuryDate).toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{bodyRegions.find(r => r.value === injury.bodyRegion)?.label || injury.bodyRegion}</Typography>
                    {injury.specificLocation && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{injury.specificLocation}</Typography>
                    )}
                  </TableCell>
                  <TableCell>{injury.side === 'Left' ? 'Levá' : injury.side === 'Right' ? 'Pravá' : 'Obě'}</TableCell>
                  <TableCell>
                    <StatusChip tone={severityTones[injury.severity] ?? 'grey'}>{severityLabels[injury.severity]}</StatusChip>
                  </TableCell>
                  <TableCell>
                    <StatusChip tone={statusTones[injury.status] ?? 'grey'}>{statusLabels[injury.status] || injury.status}</StatusChip>
                  </TableCell>
                  <TableCell>{injury.diagnosis || '—'}</TableCell>
                  <TableCell align="right">{injury.actualDaysOut ?? injury.estimatedDaysOut ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nový záznam poranění</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <PatientPicker
                required
                value={selectedPatient}
                onChange={(patient) => {
                  setSelectedPatient(patient);
                  update('patientId', patient?.id || '');
                }}
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
                placeholder="např. kontakt s protihráčem při sprintu" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Diagnóza" value={form.diagnosis}
                onChange={e => update('diagnosis', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Ošetřující praktik" value={form.practitioner}
                onChange={e => update('practitioner', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="number" label="Odhad dnů mimo" value={form.estimatedDaysOut}
                onChange={e => update('estimatedDaysOut', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Poznámky" value={form.notes}
                onChange={e => update('notes', e.target.value)} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Vytvořit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
