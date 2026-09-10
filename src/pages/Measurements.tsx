import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Card, CardContent, Button, Grid, Chip, Alert, Skeleton,
  TextField, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
} from '@mui/material';
import {
  MonitorHeart, FitnessCenter, Speed, Upload, CloudUpload, TrendingUp,
  MonitorWeight, FavoriteBorder, AccessibilityNew,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { measurementsApi } from '../api/measurements';
import type { Measurement } from '../api/measurements';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import toast from 'react-hot-toast';

function getPatientName(patientId: string, patients: Patient[]): string {
  const p = patients.find(pat => pat.id === patientId);
  return p ? `${p.firstName} ${p.lastName}` : patientId.slice(0, 8);
}

const deviceConfig: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  InBody770: { label: 'InBody 770', color: '#9C27B0', icon: <MonitorWeight /> },
  ForceDecks: { label: 'ForceDecks', color: '#0D7377', icon: <Speed /> },
  HumanTrak: { label: 'HumanTrak', color: '#2E7D32', icon: <FitnessCenter /> },
  VO2max: { label: 'VO2max', color: '#ED6C02', icon: <MonitorHeart /> },
};

function MetricCard({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return (
    <Card variant="outlined" sx={{ borderColor: `${color}30` }}>
      <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{unit}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Measurements() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [importDialog, setImportDialog] = useState<{ open: boolean; device: string }>({ open: false, device: '' });
  const [selectedMeasurement, setSelectedMeasurement] = useState<Measurement | null>(null);

  useEffect(() => {
    Promise.all([
      measurementsApi.getAll().catch(() => []),
      patientsApi.getAll().catch(() => []),
    ]).then(([m, p]) => {
      setMeasurements(m);
      setPatients(p);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = selectedPatient
    ? measurements.filter(m => m.patientId === selectedPatient)
    : measurements;

  const handleImport = async (file: File) => {
    if (!selectedPatient || !importDialog.device) return;
    try {
      switch (importDialog.device) {
        case 'InBody770':
          await measurementsApi.importInBody(selectedPatient, file);
          break;
        case 'ForceDecks':
          await measurementsApi.importForceDecks(selectedPatient, file);
          break;
        case 'HumanTrak':
          await measurementsApi.importHumanTrak(selectedPatient, file);
          break;
        case 'VO2max':
          await measurementsApi.importVO2max(selectedPatient, file);
          break;
      }
      toast.success('Data importována');
      setImportDialog({ open: false, device: '' });
      measurementsApi.getAll().then(setMeasurements).catch(() => {});
    } catch {
      toast.error('Chyba při importu');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
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
              <MonitorHeart color="primary" /> Měření
            </Typography>
            <Typography variant="body2" color="text.secondary">Výsledky z přístrojů a měření</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {Object.entries(deviceConfig).map(([key, cfg]) => (
              <Button key={key} variant="outlined" startIcon={<Upload />}
                onClick={() => setImportDialog({ open: true, device: key })}
                sx={{ borderColor: cfg.color, color: cfg.color, borderRadius: 2, fontWeight: 600, fontSize: 12 }}>
                Import {cfg.label}
              </Button>
            ))}
          </Box>
        </Box>
      </motion.div>

      {/* Patient Filter */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 3 }}>
        <TextField
          select fullWidth size="small" label="Filtrovat podle pacienta" value={selectedPatient}
          onChange={e => setSelectedPatient(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        >
          <MenuItem value="">Všichni pacienti</MenuItem>
          {patients.map(p => (
            <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* Device Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(deviceConfig).map(([key, cfg], i) => {
          const count = filtered.filter(m => m.deviceType === key).length;
          return (
            <Grid key={key} size={{ xs: 6, md: 3 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { boxShadow: `0 4px 16px ${cfg.color}25` } }}
                  onClick={() => setTab(Object.keys(deviceConfig).indexOf(key))}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ bgcolor: `${cfg.color}14`, color: cfg.color, p: 1.5, borderRadius: 2 }}>{cfg.icon}</Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">{cfg.label}</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>{count}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          );
        })}
      </Grid>

      {/* Tabs */}
      <Paper sx={{ borderRadius: 3, mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          {Object.values(deviceConfig).map(d => <Tab key={d.label} label={d.label} />)}
        </Tabs>
      </Paper>

      {/* Measurements Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Pacient</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Datum</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Přístroj</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Hlavní metriky</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.filter(m => m.deviceType === Object.keys(deviceConfig)[tab]).map((m, i) => {
              const device = deviceConfig[m.deviceType] || deviceConfig.InBody770;
              return (
                <motion.tr key={m.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedMeasurement(m)}>
                  <TableCell>
                    <Typography sx={{ fontWeight: 500 }}>{getPatientName(m.patientId, patients)}</Typography>
                  </TableCell>
                  <TableCell>{new Date(m.takenAtUtc).toLocaleDateString('cs-CZ')}</TableCell>
                  <TableCell>
                    <Chip icon={device.icon} label={device.label} size="small"
                      sx={{ bgcolor: `${device.color}14`, color: device.color, fontWeight: 500 }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {m.readings.slice(0, 3).map((r) => (
                        <Chip key={r.code} label={`${r.name}: ${r.value}${r.unit ? ' ' + r.unit : ''}`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" sx={{ color: '#0D7377', fontWeight: 600 }}>Detail</Button>
                  </TableCell>
                </motion.tr>
              );
            })}              {filtered.filter(m => m.deviceType === Object.keys(deviceConfig)[tab]).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <MonitorHeart sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                  <Typography color="text.secondary">Žádná měření</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Detail Dialog */}
      <Dialog open={!!selectedMeasurement} onClose={() => setSelectedMeasurement(null)} maxWidth="md" fullWidth>
        {selectedMeasurement && (
          <>
            <DialogTitle>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {getPatientName(selectedMeasurement.patientId, patients)} — {deviceConfig[selectedMeasurement.deviceType]?.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {new Date(selectedMeasurement.takenAtUtc).toLocaleDateString('cs-CZ')}
              </Typography>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                {selectedMeasurement.readings.map((r) => (
                  <Grid key={r.code} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="caption" color="text.secondary">
                          {r.name}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0D7377' }}>{r.value} {r.unit}</Typography>
                        {r.flag && r.flag !== 'Normal' && (
                          <Chip label={r.flag} size="small" sx={{ mt: 0.5, bgcolor: '#FFF3E0', color: '#ED6C02' }} />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setSelectedMeasurement(null)} sx={{ borderRadius: 2 }}>Zavřít</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialog.open} onClose={() => setImportDialog({ open: false, device: '' })}>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Import {deviceConfig[importDialog.device]?.label}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Nahrajte CSV/Data soubor z přístroje
          </Alert>
          <Button variant="outlined" component="label" startIcon={<CloudUpload />}
            sx={{ width: '100%', py: 3, borderRadius: 2, borderStyle: 'dashed', borderWidth: 2 }}>
            Vybrat soubor
            <input type="file" hidden accept=".csv,.json,.xlsx" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
            }} />
          </Button>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setImportDialog({ open: false, device: '' })} sx={{ borderRadius: 2 }}>Zrušit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
