import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, Chip, InputAdornment, Grid, Card, CardContent, IconButton, Tooltip, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { Search, PersonAdd, People, ViewList, ViewModule, LocalHospital } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { PatientListSkeleton } from '../components/SkeletonLoader';

const sexLabel = (s: string) => s === 'Male' ? 'Muž' : s === 'Female' ? 'Žena' : 'Jiné';
const sexColor = (s: string) => s === 'Male' ? '#0D7377' : s === 'Female' ? '#9C27B0' : '#666';
const getStatus = (p: Patient) => {
  const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / 31557600000);
  if (age < 18) return { label: 'Mladý', color: '#0288D1' };
  if (age > 60) return { label: 'Senior', color: '#ED6C02' };
  return { label: 'Aktivní', color: '#2E7D32' };
};

export default function PatientList() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientsApi.getAll().then(setPatients).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PatientListSkeleton />;

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <People color="primary" /> Pacienti
            </Typography>
            <Typography variant="body2" color="text.secondary">{patients.length} registrovaných pacientů</Typography>
          </Box>
          <Button variant="contained" startIcon={<PersonAdd />} onClick={() => navigate('/patients/new')}
            sx={{ bgcolor: '#0D7377', borderRadius: 3, px: 3, py: 1.2, fontWeight: 600, boxShadow: '0 4px 16px rgba(13,115,119,0.3)',
              '&:hover': { bgcolor: '#095456', boxShadow: '0 6px 20px rgba(13,115,119,0.4)' } }}>
            Nový pacient
          </Button>
        </Box>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Paper sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 3 }}>
          <TextField fullWidth size="small" placeholder="Hledat pacienta podle jména..." value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
          <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
            <ToggleButton value="list"><ViewList /></ToggleButton>
            <ToggleButton value="grid"><ViewModule /></ToggleButton>
          </ToggleButtonGroup>
        </Paper>
      </motion.div>

      {view === 'list' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <TableContainer component={Paper} sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Pacient</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Datum narození</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Pohlaví</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Registrace</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((p, i) => {
                  const status = getStatus(p);
                  return (
                    <motion.tr key={p.id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.3 }}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/patients/${p.id}`)}
                      className="patient-row">
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: '#0D7377', width: 40, height: 40, fontSize: 14, fontWeight: 600 }}>
                            {p.firstName[0]}{p.lastName[0]}
                          </Avatar>
                          <Box>
                            <Typography sx={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</Typography>
                            <Typography variant="caption" color="text.secondary">{p.id.slice(0, 8)}...</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{new Date(p.dateOfBirth).toLocaleDateString('cs-CZ')}</TableCell>
                      <TableCell>
                        <Chip label={sexLabel(p.sex)} size="small" sx={{ bgcolor: `${sexColor(p.sex)}14`, color: sexColor(p.sex), fontWeight: 500 }} />
                      </TableCell>
                      <TableCell>{new Date(p.createdAtUtc).toLocaleDateString('cs-CZ')}</TableCell>
                      <TableCell>
                        <Chip label={status.label} size="small" sx={{ bgcolor: `${status.color}14`, color: status.color, fontWeight: 500 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Nová diagnostika">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/diagnostics/new?patientId=${p.id}`); }}
                            sx={{ color: '#0D7377' }}>
                            <People fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </motion.tr>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <LocalHospital sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                      <Typography color="text.secondary">{patients.length === 0 ? 'Zatím žádní pacienti.' : 'Žádné výsledky.'}</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </motion.div>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((p, i) => {
            const status = getStatus(p);
            return (
              <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#0D7377' } }}
                    onClick={() => navigate(`/patients/${p.id}`)}>
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      <Avatar sx={{ bgcolor: '#0D7377', width: 56, height: 56, fontSize: 20, mx: 'auto', mb: 1.5, fontWeight: 600,
                        boxShadow: '0 4px 14px rgba(13,115,119,0.3)' }}>
                        {p.firstName[0]}{p.lastName[0]}
                      </Avatar>
                      <Typography sx={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {sexLabel(p.sex)} • {new Date(p.dateOfBirth).toLocaleDateString('cs-CZ')}
                      </Typography>
                      <Chip label={status.label} size="small" sx={{ mt: 1.5, bgcolor: `${status.color}14`, color: status.color, fontWeight: 500 }} />
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            );
          })}
          {filtered.length === 0 && (
            <Grid size={{ xs: 12 }}>
              <Card sx={{ textAlign: 'center', py: 6 }}>
                <LocalHospital sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                <Typography color="text.secondary">{patients.length === 0 ? 'Zatím žádní pacienti.' : 'Žádné výsledky.'}</Typography>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
