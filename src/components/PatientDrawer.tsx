/* ══════════════════════════════════════════════════════════════
   PATIENT DRAWER (Slide-Over Panel)
   Non-modal, 480px wide, slides from right.
   Tabs: Diagnoses (with ICD-10 search), Prescriptions (with form),
   Procedures (checklist), Billing, Appointments.
   Session storage persists unsaved data on refresh.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Avatar, IconButton, Tabs, Tab, Chip, Button, Divider,
  List, ListItem, ListItemText, TextField, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, CircularProgress, MenuItem,
} from '@mui/material';
import {
  Close, Phone, Sms, Description, Science, Add, CheckCircle,
  AccessTime, LocalHospital, FitnessCenter, Search,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import toast from 'react-hot-toast';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { calendarApi } from '../api/calendar';
import type { Appointment } from '../api/calendar';
import { diagnosticsApi } from '../api/diagnostics';
import type { DiagnosticSession } from '../api/diagnostics';
import { getCachedICDCodes, searchICDCodesLocally, type ICDCode } from '../services/cacheService';

/* ── Types ── */
interface Diagnosis {
  id: string;
  code: string;
  description: string;
  status: 'Active' | 'Resolved';
  addedDate: string;
}

interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: 'Active' | 'Completed';
}

interface Procedure {
  id: string;
  name: string;
  date: string;
  result: string;
}

/* ── Sample data ── */
const sampleDiagnoses: Diagnosis[] = [
  { id: '1', code: 'M54.5', description: 'Bolesti dolní části zad', status: 'Active', addedDate: '2026-08-15' },
  { id: '2', code: 'S83.5', description: 'Vrtnutí kolenního kloubu', status: 'Resolved', addedDate: '2026-07-20' },
];

const sampleProcedures: Procedure[] = [
  { id: '1', name: 'RTG kolene', date: '2026-08-20', result: 'Negativní nález' },
  { id: '2', name: 'Krevní obraz', date: '2026-08-22', result: 'V normě' },
];

const INSURANCE_PROVIDERS = [
  { code: '111', name: 'VZP' },
  { code: '201', name: 'VOZP' },
  { code: '205', name: 'ČPZP' },
  { code: '207', name: 'OZP' },
];

const FREQUENCY_OPTIONS = ['1-0-0', '0-1-0', '0-0-1', '1-0-1', '1-1-1', '1-1-0', '2-0-2', '1-0-0 (večer)'];

/* ── Session storage helpers ── */
function saveDrawerSession(data: Record<string, unknown>) {
  try { sessionStorage.setItem('patient-drawer-session', JSON.stringify(data)); } catch {}
}
function loadDrawerSession(): Record<string, unknown> | null {
  try {
    const raw = sessionStorage.getItem('patient-drawer-session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearDrawerSession() {
  try { sessionStorage.removeItem('patient-drawer-session'); } catch {}
}

/* ══════════════════════════════════════════════════════════════ */
export default function PatientDrawer() {
  const { drawerOpen, drawerPatientId, closeDrawer, clearPendingDiagnosis } = useAppStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [tab, setTab] = useState(0);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(sampleDiagnoses);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [procedures] = useState<Procedure[]>(sampleProcedures);

  /* ── Diagnosis search dialog state ── */
  const [diagSearchOpen, setDiagSearchOpen] = useState(false);
  const [diagQuery, setDiagQuery] = useState('');
  const [diagResults, setDiagResults] = useState<ICDCode[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const icdCache = useRef<ICDCode[]>([]);

  /* ── Prescription form state ── */
  const [rxFormOpen, setRxFormOpen] = useState(false);
  const [rxForm, setRxForm] = useState({ medication: '', dosage: '', frequency: '1-0-1', duration: '' });

  /* ── Load ICD cache on mount ── */
  useEffect(() => {
    getCachedICDCodes().then(codes => {
      if (codes) icdCache.current = codes;
    });
  }, []);

  /* ── Load patient data when drawer opens ── */
  useEffect(() => {
    if (!drawerOpen || !drawerPatientId) return;
    setTab(0);

    patientsApi.getById(drawerPatientId).then(setPatient).catch(() => {});
    calendarApi.getAppointments().then(appts => {
      setAppointments(appts.filter(a => a.patientId === drawerPatientId).slice(0, 5));
    }).catch(() => {});
    diagnosticsApi.getByPatient(drawerPatientId).then(setSessions).catch(() => {});

    /* Restore session data if available */
    const session = loadDrawerSession();
    if (session?.patientId === drawerPatientId) {
      if (session.diagnoses) setDiagnoses(session.diagnoses as Diagnosis[]);
      if (session.prescriptions) setPrescriptions(session.prescriptions as Prescription[]);
    } else {
      setDiagnoses(sampleDiagnoses);
      setPrescriptions([]);
    }

    /* Check pending diagnosis from Codebook */
    const pd = useAppStore.getState().pendingDiagnosis;
    if (pd) {
      const newDiag: Diagnosis = {
        id: `diag-${Date.now()}`,
        code: pd.code,
        description: pd.description,
        status: 'Active',
        addedDate: new Date().toISOString().split('T')[0],
      };
      setDiagnoses(prev => [newDiag, ...prev]);
      setTab(0);
      clearPendingDiagnosis();
      toast.success(`Diagnóza ${pd.code} přidána do decursu`);
    }
  }, [drawerOpen, drawerPatientId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Persist session data on changes ── */
  useEffect(() => {
    if (drawerOpen && drawerPatientId) {
      saveDrawerSession({ patientId: drawerPatientId, diagnoses, prescriptions });
    }
  }, [diagnoses, prescriptions, drawerOpen, drawerPatientId]);

  /* ── Close handler — clear session if drawer closes ── */
  const handleClose = useCallback(() => {
    clearDrawerSession();
    closeDrawer();
  }, [closeDrawer]);

  /* ── Diagnosis search ── */
  const handleDiagSearch = useCallback(async (query: string) => {
    setDiagQuery(query);
    if (query.length < 2) { setDiagResults([]); return; }
    setDiagLoading(true);
    try {
      /* Try local cache first */
      if (icdCache.current.length > 0) {
        setDiagResults(searchICDCodesLocally(icdCache.current, query).slice(0, 20));
      } else {
        /* Fallback: load from cache service */
        const codes = await getCachedICDCodes();
        if (codes) {
          icdCache.current = codes;
          setDiagResults(searchICDCodesLocally(codes, query).slice(0, 20));
        }
      }
    } finally {
      setDiagLoading(false);
    }
  }, []);

  const handleAddDiagnosis = (code: ICDCode) => {
    const newDiag: Diagnosis = {
      id: `diag-${Date.now()}`,
      code: code.code,
      description: code.description,
      status: 'Active',
      addedDate: new Date().toISOString().split('T')[0],
    };
    setDiagnoses(prev => [newDiag, ...prev]);
    setDiagSearchOpen(false);
    setDiagQuery('');
    setDiagResults([]);
    toast.success(`Diagnóza ${code.code} přidána`);
  };

  const handleToggleDiagStatus = (id: string) => {
    setDiagnoses(prev => prev.map(d =>
      d.id === id ? { ...d, status: d.status === 'Active' ? 'Resolved' : 'Active' } : d
    ));
  };

  /* ── Prescription form submit ── */
  const handleAddPrescription = () => {
    if (!rxForm.medication || !rxForm.dosage) return;
    const newRx: Prescription = {
      id: `rx-${Date.now()}`,
      medication: rxForm.medication,
      dosage: rxForm.dosage,
      frequency: rxForm.frequency,
      duration: rxForm.duration || '—',
      status: 'Active',
    };
    setPrescriptions(prev => [newRx, ...prev]);
    setRxFormOpen(false);
    setRxForm({ medication: '', dosage: '', frequency: '1-0-1', duration: '' });
    toast.success('Lék předepsán');
  };

  if (!drawerOpen) return null;

  const age = patient
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000)
    : 0;

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 399,
              background: 'rgba(0,0,0,0.2)',
            }}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 480, maxWidth: '95vw',
              background: 'var(--color-bg-paper)',
              boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
              zIndex: 400,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* ── Header ── */}
            <Box sx={{ p: 3, borderBottom: '1px solid var(--color-border)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Avatar sx={{
                    bgcolor: '#0D7377', width: 48, height: 48,
                    fontSize: 18, fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(13,115,119,0.3)',
                  }}>
                    {patient?.firstName?.[0]}{patient?.lastName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {patient ? `${patient.firstName} ${patient.lastName}` : 'Načítání...'}
                    </Typography>
                    {patient && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                        <Chip label={`Věk ${age}`} size="small" sx={{ height: 20, fontSize: 11 }} />
                        <Chip
                          label={patient.status === 'Active' ? 'Aktivní' : patient.status || 'Aktivní'}
                          size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 600, bgcolor: '#16A34A14', color: '#16A34A' }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
                <IconButton onClick={handleClose} size="small" aria-label="Zavřít panel">
                  <Close fontSize="small" />
                </IconButton>
              </Box>

              {/* Quick Actions */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Tooltip title="Zavolat pacientovi"><IconButton size="small" sx={{ border: '1px solid var(--color-border)', borderRadius: 2 }}><Phone fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Poslat SMS"><IconButton size="small" sx={{ border: '1px solid var(--color-border)', borderRadius: 2 }}><Sms fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Nový předpis" onClick={() => setRxFormOpen(true)}><IconButton size="small" sx={{ border: '1px solid var(--color-border)', borderRadius: 2 }}><Description fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Nová diagnostika"><IconButton size="small" sx={{ border: '1px solid var(--color-border)', borderRadius: 2 }}><Science fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Laboratoř"><IconButton size="small" sx={{ border: '1px solid var(--color-border)', borderRadius: 2 }}><LocalHospital fontSize="small" /></IconButton></Tooltip>
              </Box>
            </Box>

            {/* ── Tabs ── */}
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid var(--color-border)', minHeight: 40 }}>
              <Tab label={`Diagnózy (${diagnoses.filter(d => d.status === 'Active').length})`} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
              <Tab label={`Léky (${prescriptions.filter(p => p.status === 'Active').length})`} sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
              <Tab label="Výkony" sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
              <Tab label="Termíny" sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }} />
            </Tabs>

            {/* ── Tab Content ── */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {/* Tab 0: Diagnoses */}
              {tab === 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Aktivní diagnózy
                      <Chip label={diagnoses.filter(d => d.status === 'Active').length} size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />
                    </Typography>
                    <Button size="small" startIcon={<Add />} onClick={() => setDiagSearchOpen(true)} sx={{ textTransform: 'none' }}>
                      Přidat
                    </Button>
                  </Box>
                  <List sx={{ p: 0 }}>
                    {diagnoses.map(d => (
                      <ListItem key={d.id} sx={{
                        px: 1, py: 1, mb: 0.5, borderRadius: 2,
                        border: '1px solid var(--color-border)',
                        '&:hover': { bgcolor: 'var(--color-bg-hover)' },
                      }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={d.code} size="small" sx={{
                                fontWeight: 700, fontFamily: 'monospace',
                                bgcolor: d.status === 'Active' ? '#0D737714' : '#94A3B814',
                                color: d.status === 'Active' ? '#0D7377' : '#64748B',
                              }} />
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.description}</Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary">{d.addedDate}</Typography>
                              <Chip
                                icon={d.status === 'Active' ? <AccessTime sx={{ fontSize: 12 }} /> : <CheckCircle sx={{ fontSize: 12 }} />}
                                label={d.status === 'Active' ? 'Aktivní' : 'Vyřešeno'}
                                size="small"
                                sx={{ height: 18, fontSize: 10, cursor: 'pointer' }}
                                color={d.status === 'Active' ? 'warning' : 'success'}
                                onClick={() => handleToggleDiagStatus(d.id)}
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                    {diagnoses.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <Typography variant="body2">Žádné diagnózy</Typography>
                      </Box>
                    )}
                  </List>
                </motion.div>
              )}

              {/* Tab 1: Prescriptions */}
              {tab === 1 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Aktivní léky
                      <Chip label={prescriptions.filter(p => p.status === 'Active').length} size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />
                    </Typography>
                    <Button size="small" startIcon={<Add />} onClick={() => setRxFormOpen(true)} sx={{ textTransform: 'none' }}>
                      Předepsat
                    </Button>
                  </Box>
                  <List sx={{ p: 0 }}>
                    {prescriptions.map(p => (
                      <ListItem key={p.id} sx={{
                        px: 1, py: 1, mb: 0.5, borderRadius: 2,
                        border: '1px solid var(--color-border)',
                        '&:hover': { bgcolor: 'var(--color-bg-hover)' },
                      }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <FitnessCenter sx={{ fontSize: 16, color: '#7C3AED' }} />
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.medication}</Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                              <Chip label={`${p.dosage} · ${p.frequency}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                              <Chip label={p.duration} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                              <Chip
                                label={p.status === 'Active' ? 'Aktivní' : 'Ukončeno'}
                                size="small"
                                color={p.status === 'Active' ? 'primary' : 'default'}
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                    {prescriptions.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        <Typography variant="body2">Žádné předpisy</Typography>
                      </Box>
                    )}
                  </List>
                </motion.div>
              )}

              {/* Tab 2: Procedures / Lab */}
              {tab === 2 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Vyšetření a výkony</Typography>
                    <Button size="small" startIcon={<Add />} sx={{ textTransform: 'none' }}>Přidat výkon</Button>
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 3 }}>
                    {['Krevní obraz', 'RTG', 'EKG', 'Spirometrie', 'Ultrazvuk', 'MRI'].map(name => (
                      <Chip key={name} label={name} size="small" variant="outlined" clickable
                        sx={{ justifyContent: 'flex-start', borderRadius: 2, '&:hover': { bgcolor: '#E0F2F1' } }} />
                    ))}
                  </Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Historie výkonů</Typography>
                  <List sx={{ p: 0 }}>
                    {procedures.map(p => (
                      <ListItem key={p.id} sx={{ px: 1, py: 1, mb: 0.5, borderRadius: 2, border: '1px solid var(--color-border)' }}>
                        <ListItemText
                          primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{p.name}</Typography>}
                          secondary={
                            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{p.date}</Typography>
                              <Chip label={p.result} size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#16A34A14', color: '#16A34A' }} />
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </motion.div>
              )}

              {/* Tab 3: Appointments */}
              {tab === 3 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>Nadcházející termíny</Typography>
                  {appointments.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <AccessTime sx={{ fontSize: 40, color: '#ddd', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">Žádné nadcházející termíny</Typography>
                    </Box>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {appointments.map(a => {
                        const start = new Date(a.startTime);
                        const end = new Date(a.endTime);
                        const dur = (end.getTime() - start.getTime()) / 60000;
                        return (
                          <ListItem key={a.id} sx={{ px: 1, py: 1, mb: 0.5, borderRadius: 2, border: '1px solid var(--color-border)', borderLeft: '3px solid #0D7377' }}>
                            <ListItemText
                              primary={
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {start.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'long' })}
                                  {' · '}
                                  {start.getHours().toString().padStart(2, '0')}:{start.getMinutes().toString().padStart(2, '0')}
                                  {' — '}
                                  {end.getHours().toString().padStart(2, '0')}:{end.getMinutes().toString().padStart(2, '0')}
                                </Typography>
                              }
                              secondary={
                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                                  <Chip label={a.serviceType} size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#0D737714' }} />
                                  <Chip label={`${dur} min`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                                  <Chip label={a.room} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                                </Box>
                              }
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Pojištění</Typography>
                  <TextField select fullWidth size="small" defaultValue="111" sx={{ mb: 1 }}>
                    {INSURANCE_PROVIDERS.map(ip => (
                      <MenuItem key={ip.code} value={ip.code}>{ip.code} — {ip.name}</MenuItem>
                    ))}
                  </TextField>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ fontSize: 16, color: '#16A34A' }} />
                    <Typography variant="caption" color="text.secondary">Poslední vyúčtování: v pořádku</Typography>
                  </Box>
                </motion.div>
              )}
            </Box>

            {/* ── Footer: Diagnostics summary ── */}
            {sessions.length > 0 && (
              <Box sx={{ p: 2, borderTop: '1px solid var(--color-border)', bgcolor: 'var(--color-bg)' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Poslední diagnostika: {new Date(sessions[0].sessionDate).toLocaleDateString('cs-CZ')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={`VO₂: ${sessions[0].vo2MaxMlMinKg}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                  <Chip label={`TK: ${sessions[0].systolicBloodPressure}/${sessions[0].diastolicBloodPressure}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                  <Chip label={`TF: ${sessions[0].restingHeartRateBpm}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                </Box>
              </Box>
            )}
          </motion.div>

          {/* ═══════════════════════════════════════════════════════
              DIAGNOSIS SEARCH DIALOG
              ═══════════════════════════════════════════════════════ */}
          <Dialog open={diagSearchOpen} onClose={() => setDiagSearchOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Vyhledat diagnózu (ICD-10)</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                placeholder="Hledat podle kódu nebo názvu..."
                value={diagQuery}
                onChange={(e) => handleDiagSearch(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  endAdornment: diagLoading ? <CircularProgress size={20} /> : null,
                }}
                sx={{ mb: 2, mt: 1 }}
              />
              <List sx={{ maxHeight: 300, overflow: 'auto', p: 0 }}>
                {diagResults.map(code => (
                  <ListItem key={code.id} onClick={() => handleAddDiagnosis(code)}
                    sx={{ px: 1, py: 1, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'var(--color-bg-hover)' } }}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={code.code} size="small" sx={{ fontWeight: 700, fontFamily: 'monospace', bgcolor: '#0D737714', color: '#0D7377' }} />
                          <Typography variant="body2">{code.description}</Typography>
                        </Box>
                      }
                      secondary={<Typography variant="caption" color="text.secondary">{code.category}</Typography>}
                    />
                  </ListItem>
                ))}
                {diagQuery.length >= 2 && diagResults.length === 0 && !diagLoading && (
                  <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    <Typography variant="body2">Žádné výsledky pro "{diagQuery}"</Typography>
                  </Box>
                )}
                {diagQuery.length < 2 && (
                  <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                    <Typography variant="body2">Zadejte alespoň 2 znaky pro vyhledávání</Typography>
                  </Box>
                )}
              </List>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDiagSearchOpen(false)}>Zavřít</Button>
            </DialogActions>
          </Dialog>

          {/* ═══════════════════════════════════════════════════════
              PRESCRIPTION FORM DIALOG
              ═══════════════════════════════════════════════════════ */}
          <Dialog open={rxFormOpen} onClose={() => setRxFormOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 700 }}>Nový předpis</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                <TextField label="Název léku" value={rxForm.medication}
                  onChange={e => setRxForm(p => ({ ...p, medication: e.target.value }))} fullWidth />
                <TextField label="Dávka (mg)" value={rxForm.dosage}
                  onChange={e => setRxForm(p => ({ ...p, dosage: e.target.value }))} fullWidth />
                <TextField select label="Frekvence" value={rxForm.frequency}
                  onChange={e => setRxForm(p => ({ ...p, frequency: e.target.value }))} fullWidth>
                  {FREQUENCY_OPTIONS.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                </TextField>
                <TextField label="Doba užívání (např. 7 dní)" value={rxForm.duration}
                  onChange={e => setRxForm(p => ({ ...p, duration: e.target.value }))} fullWidth />
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button onClick={() => setRxFormOpen(false)}>Zrušit</Button>
              <Button variant="contained" onClick={handleAddPrescription}
                disabled={!rxForm.medication || !rxForm.dosage}
                sx={{ bgcolor: '#0D7377' }}>
                Předepsat
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </AnimatePresence>
  );
}
