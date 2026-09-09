import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Grid, Card, CardContent, Avatar, Button, Divider, Chip,
  List, ListItem, ListItemText, Skeleton, Alert, IconButton, Tooltip,
  Paper, LinearProgress, Collapse,
} from '@mui/material';
import {
  ArrowBack, Science, TrendingUp, TrendingDown, CalendarToday, Description,
  Warning, CheckCircle, Error, MonitorHeart, FitnessCenter, Bloodtype,
  Download, Add, ExpandMore, ExpandLess, Person, Phone, Email, Cake,
  Shield, LocalHospital, Spa,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { diagnosticsApi } from '../api/diagnostics';
import type { DiagnosticSession } from '../api/diagnostics';
import { documentsApi } from '../api/documents';
import type { PatientDocument } from '../api/documents';
import { ConsentManager } from '../components/ConsentManager';

/* ── Helpers ── */
function trendIcon(current: number, previous: number, higherIsBetter: boolean) {
  if (!previous) return null;
  const up = current > previous;
  const good = higherIsBetter ? up : !up;
  return up
    ? <TrendingUp sx={{ fontSize: 18, color: good ? '#2E7D32' : '#D32F2F' }} />
    : <TrendingDown sx={{ fontSize: 18, color: good ? '#2E7D32' : '#D32F2F' }} />;
}

function trendPct(current: number, previous: number) {
  if (!previous) return null;
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function getVo2Color(vo2: number) {
  if (vo2 >= 50) return '#2E7D32';
  if (vo2 >= 40) return '#0D7377';
  if (vo2 >= 30) return '#ED6C02';
  return '#D32F2F';
}

function getBpLabel(sys: number, dia: number) {
  if (sys < 120 && dia < 80) return { text: 'Optimální', color: '#2E7D32' };
  if (sys < 130 && dia < 85) return { text: 'Normální', color: '#0D7377' };
  if (sys < 140 && dia < 90) return { text: 'Zvýšené', color: '#ED6C02' };
  return { text: 'Vysoké', color: '#D32F2F' };
}

const requiredDocs = [
  { type: 'Vypis', label: 'Výpis ze zdravotní dokumentace', firstVisitOnly: true },
  { type: 'Dotaznik', label: 'Dotazník před prohlídkou', firstVisitOnly: false },
  { type: 'GDPR', label: 'GDPR souhlas', firstVisitOnly: true },
];

/* ── Metric Card ── */
function MetricCard({ icon, label, value, unit, color, prevValue, higherIsBetter = true, delay = 0 }: {
  icon: React.ReactNode; label: string; value: number | string; unit: string; color: string;
  prevValue?: number; higherIsBetter?: boolean; delay?: number;
}) {
  const numVal = typeof value === 'number' ? value : parseFloat(value as string);
  const numPrev = prevValue;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: color }} />
        <CardContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ color, opacity: 0.8 }}>{icon}</Box>
            {numPrev ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {trendIcon(numVal, numPrev, higherIsBetter)}
                <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
                  {trendPct(numVal, numPrev)}
                </Typography>
              </Box>
            ) : null}
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color, lineHeight: 1.2 }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{unit}</Typography>
          <Typography variant="caption" sx={{ color: '#999', mt: 1, display: 'block' }}>{label}</Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── Main Page ── */
export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<DiagnosticSession[]>([]);
  const [docs, setDocs] = useState<PatientDocument[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (id) {
      patientsApi.getById(id).then(setPatient).catch(() => {});
      diagnosticsApi.getByPatient(id).then(setSessions).catch(() => {});
      documentsApi.getPatientDocuments(id).then(setDocs).catch(() => {});
      patientsApi.getProfile(id).then(setProfile).catch(() => {});
    }
  }, [id]);

  if (!patient) {
    return (
      <Box>
        <Skeleton variant="rounded" width={120} height={36} sx={{ mb: 2, borderRadius: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Box><Skeleton variant="rounded" width={200} height={32} sx={{ mb: 0.5 }} /><Skeleton variant="rounded" width={150} height={20} /></Box>
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}><Skeleton variant="rounded" height={140} sx={{ borderRadius: 3 }} /></Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  const age = Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000);
  const birthInfo = (() => {
    const b = new Date(patient.dateOfBirth);
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    const next = thisYear.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      ? thisYear
      : new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    const days = Math.ceil((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
    const isToday = days === 0;
    const months = Math.floor(days / 30);
    return { next, days, isToday, months, isMinor: age < 18 };
  })();
  const profileContacts: { channel: string; value: string; note: string }[] = (() => {
    try {
      const list = JSON.parse(profile?.contactsJson ?? '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  })();
  const displayEmail = patient.email || profileContacts.find(c => c.channel === 'email')?.value || '';
  const displayPhone = patient.phone || profileContacts.find(c => c.channel === 'phone')?.value || '';
  const latest = sessions[0];
  const previous = sessions[1];
  const hasRequiredDoc = (docType: string) => docs.some(d => d.status === 'Signed' || d.status === 'Active');
  const missingDocs = requiredDocs.filter(rd => !hasRequiredDoc(rd.type));
  const bp = latest ? getBpLabel(latest.systolicBloodPressure, latest.diastolicBloodPressure) : null;

  const handleDownloadPdf = async (sessionId: string) => {
    setLoadingPdf(sessionId);
    try { await diagnosticsApi.downloadPdf(sessionId); } catch {}
    setLoadingPdf(null);
  };

  return (
    <Box>
      {/* Back button */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/patients')}
          sx={{ mb: 2, borderRadius: 2, fontWeight: 500 }}>
          Zpět na pacienty
        </Button>
      </motion.div>

      {/* Missing docs warning */}
      {missingDocs.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} icon={<Warning />}>
          Chybí: {missingDocs.map(d => d.label).join(', ')}
        </Alert>
      )}

      {/* ── Patient Header ── */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 80, background: 'linear-gradient(135deg, #0D7377 0%, #14A3A8 50%, #1A1A2E 100%)' }} />
          <CardContent sx={{ pt: 0, mt: -4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                <Avatar sx={{
                  bgcolor: '#0D7377', width: 72, height: 72, fontSize: 28, fontWeight: 700,
                  border: '4px solid white', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}>
                  {patient.firstName[0]}{patient.lastName[0]}
                </Avatar>
                <Box sx={{ pb: 0.5 }}>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>{patient.firstName} {patient.lastName}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip size="small" label={`Věk ${age}`} />
                    {birthInfo.isToday ? (
                      <Chip size="small" label="🎂 Dnes má narozeniny!" color="success" sx={{ fontWeight: 700 }} />
                    ) : (
                      <Chip size="small" label={`Narozeniny za ${birthInfo.days} ${birthInfo.days === 1 ? 'den' : birthInfo.days < 5 ? 'dny' : 'dní'} (${birthInfo.next.toLocaleDateString('cs-CZ')})`} variant="outlined" />
                    )}
                    {birthInfo.isMinor && (
                      <Chip size="small" label="Nezletilý — nutný zákonný zástupce" color="warning" />
                    )}
                    <Chip size="small" label={patient.sex === 'Male' ? 'Muž' : 'Žena'}
                      sx={{ bgcolor: '#0D737714', color: '#0D7377' }} />
                    <Chip size="small" label={`${sessions.length} sezení`} variant="outlined" />
                    {displayEmail && (
                      <Chip size="small" icon={<Email sx={{ fontSize: 14 }} />} label={displayEmail} variant="outlined" />
                    )}
                    {displayPhone && (
                      <Chip size="small" icon={<Phone sx={{ fontSize: 14 }} />} label={displayPhone} variant="outlined" />
                    )}
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" startIcon={<Description />}
                  onClick={() => navigate(`/patients/${patient.id}/edit`)}
                  sx={{ borderColor: '#0D7377', color: '#0D7377', borderRadius: 2 }}>
                  Upravit
                </Button>
                <Button variant="outlined" startIcon={<Description />}
                  onClick={() => navigate('/documents')}
                  sx={{ borderColor: '#0D7377', color: '#0D7377', borderRadius: 2 }}>
                  Dokumenty
                </Button>
                <Button variant="contained" startIcon={<Science />}
                  onClick={() => navigate(`/diagnostics/new?patientId=${patient.id}`)}
                  sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600, boxShadow: '0 4px 16px rgba(13,115,119,0.3)', '&:hover': { bgcolor: '#095456' } }}>
                  Nová diagnostika
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Extended profile (registration data) ── */}
      {profile && (profile.birthNumber || profile.healthInsurerCode || profile.address) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                Registrační údaje
              </Typography>
              <Grid container spacing={2}>
                {[
                  ['Rodné číslo', profile.birthNumber],
                  ['Číslo pojištěnce', profile.insuranceNumber],
                  ['ZP', profile.healthInsurerCode],
                  ['Pojištěn od', profile.insuredFrom],
                  ['Druh pojištění', profile.insuranceType],
                  ['Státní příslušnost', profile.citizenship],
                  ['Adresa', profile.address],
                  ['Lékaři', profile.treatingDoctors],
                  ['Povolání', profile.occupation],
                  ['Zaměstnavatel', profile.employer],
                  ['Druh zaměstnání', profile.employmentType],
                  ['Poznámka', profile.notes],
                ].filter(([, v]) => v).map(([label, v]) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
                    <Typography variant="body2">{v}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Consent lifecycle (grant / revoke / export) ── */}
      {id && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent>
              <ConsentManager patientId={id} />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Metrics Cards (latest session) ── */}
      {latest && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <MetricCard icon={<MonitorHeart />} label="VO2 Max" value={latest.vo2MaxMlMinKg}
              unit="ml/min/kg" color={getVo2Color(latest.vo2MaxMlMinKg)}
              prevValue={previous?.vo2MaxMlMinKg} higherIsBetter={true} delay={0.05} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <MetricCard icon={<FitnessCenter />} label="Klidový tep" value={latest.restingHeartRateBpm}
              unit="úderů/min" color="#0D7377"
              prevValue={previous?.restingHeartRateBpm} higherIsBetter={false} delay={0.1} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <MetricCard icon={<Bloodtype />} label="Krevní tlak" value={`${latest.systolicBloodPressure}/${latest.diastolicBloodPressure}`}
              unit={bp?.text || ''} color={bp?.color || '#666'} delay={0.15} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <MetricCard icon={<Spa />} label="Tělesný tuk" value={latest.bodyFatPercentage}
              unit={`% · Svaly ${latest.muscleMassKg} kg`} color="#7B1FA2"
              prevValue={previous?.bodyFatPercentage} higherIsBetter={false} delay={0.2} />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* ── Left Column: Info + Documents ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Patient Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Person sx={{ color: '#0D7377', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Osobní údaje</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {[
                  ['ID', patient.id.slice(0, 8) + '…'],
                  ['Datum narození', new Date(patient.dateOfBirth).toLocaleDateString('cs-CZ')],
                  ['Pohlaví', patient.sex === 'Male' ? 'Muž' : 'Žena'],
                  ['Email', patient.email || '—'],
                  ['Telefon', patient.phone || '—'],
                  ['Registrace', new Date(patient.createdAtUtc).toLocaleDateString('cs-CZ')],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f5f5f5' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Document Status */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Shield sx={{ color: '#0D7377', fontSize: 20 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Povinné dokumenty</Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                {requiredDocs.map(rd => {
                  const hasDoc = hasRequiredDoc(rd.type);
                  return (
                    <Box key={rd.type} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f5f5f5' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{rd.label}</Typography>
                        {rd.firstVisitOnly && (
                          <Typography variant="caption" color="text.secondary">Pouze 1. návštěva</Typography>
                        )}
                      </Box>
                      {hasDoc ? (
                        <Chip icon={<CheckCircle />} label="Hotovo" size="small"
                          sx={{ bgcolor: '#2E7D3214', color: '#2E7D32', fontWeight: 500 }} />
                      ) : (
                        <Chip icon={<Error />} label="Chybí" size="small"
                          sx={{ bgcolor: '#D32F2F14', color: '#D32F2F', fontWeight: 500 }} />
                      )}
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* ── Right Column: Diagnostic Sessions ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp sx={{ color: '#0D7377', fontSize: 20 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Diagnostická sezení</Typography>
                  </Box>
                  <Button size="small" startIcon={<Add />} onClick={() => navigate(`/diagnostics/new?patientId=${patient.id}`)}
                    sx={{ color: '#0D7377' }}>
                    Nové
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {sessions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Science sx={{ fontSize: 56, color: '#ddd', mb: 1 }} />
                    <Typography color="text.secondary" sx={{ mb: 1 }}>Zatím žádná sezení</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Vytvořte první diagnostické sezení pro {patient.firstName}.
                    </Typography>
                  </Box>
                ) : (
                  <List sx={{ p: 0 }}>
                    {sessions.map((s, i) => {
                      const isExpanded = expandedSession === s.id;
                      const sPrev = sessions[i + 1];
                      return (
                        <motion.div key={s.id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 + i * 0.04 }}>
                          <Paper variant="outlined" sx={{ mb: 1.5, borderRadius: 2, overflow: 'hidden' }}>
                            {/* Session header */}
                            <Box sx={{ p: 2, cursor: 'pointer', '&:hover': { bgcolor: '#f8f9fa' } }}
                              onClick={() => setExpandedSession(isExpanded ? null : s.id)}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Box sx={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    bgcolor: s.requiresDoctorReview ? '#ED6C02' : '#2E7D32',
                                  }} />
                                  <Box>
                                    <Typography sx={{ fontWeight: 600 }}>
                                      {new Date(s.sessionDate).toLocaleDateString('cs-CZ', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {s.practitionerName} · {new Date(s.createdAtUtc).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {s.requiresDoctorReview && (
                                    <Chip label="K posouzení" size="small" color="warning" sx={{ fontWeight: 500 }} />
                                  )}
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDownloadPdf(s.id); }}
                                    title="Stáhnout PDF">
                                    {loadingPdf === s.id ? <LinearProgress sx={{ width: 20 }} /> : <Download sx={{ fontSize: 18 }} />}
                                  </IconButton>
                                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                </Box>
                              </Box>

                              {/* Mini metrics row */}
                              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                                {[
                                  { label: 'VO₂', val: s.vo2MaxMlMinKg, unit: 'ml', color: getVo2Color(s.vo2MaxMlMinKg), prev: sPrev?.vo2MaxMlMinKg, hi: true },
                                  { label: 'Klid', val: s.restingHeartRateBpm, unit: 'bpm', color: '#0D7377', prev: sPrev?.restingHeartRateBpm, hi: false },
                                  { label: 'TK', val: `${s.systolicBloodPressure}/${s.diastolicBloodPressure}`, unit: '', color: '#666' },
                                  { label: 'Tuk', val: s.bodyFatPercentage, unit: '%', color: '#7B1FA2', prev: sPrev?.bodyFatPercentage, hi: false },
                                  { label: 'Svaly', val: s.muscleMassKg, unit: 'kg', color: '#2E7D32', prev: sPrev?.muscleMassKg, hi: true },
                                ].map(m => (
                                  <Chip key={m.label}
                                    icon={typeof m.val === 'number' && m.prev ? trendIcon(m.val, m.prev, m.hi ?? true) as React.ReactElement : undefined}
                                    label={`${m.label}: ${m.val}${m.unit ? ' ' + m.unit : ''}`}
                                    size="small" variant="outlined"
                                    sx={{ fontWeight: 500, fontSize: 11, borderColor: m.color + '40', color: m.color }}
                                  />
                                ))}
                              </Box>
                            </Box>

                            {/* Expanded details */}
                            <Collapse in={isExpanded}>
                              <Divider />
                              <Box sx={{ p: 2, bgcolor: '#fafbfc' }}>
                                <Grid container spacing={2}>
                                  <Grid size={{ xs: 6, sm: 3 }}>
                                    <Typography variant="caption" color="text.secondary">Max tep</Typography>
                                    <Typography sx={{ fontWeight: 600 }}>{s.maxHeartRateBpm} bpm</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, sm: 3 }}>
                                    <Typography variant="caption" color="text.secondary">Anaerobní práh</Typography>
                                    <Typography sx={{ fontWeight: 600 }}>{s.anaerobicThresholdBpm} bpm</Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, sm: 3 }}>
                                    <Typography variant="caption" color="text.secondary">VO₂ Max</Typography>
                                    <Typography sx={{ fontWeight: 600, color: getVo2Color(s.vo2MaxMlMinKg) }}>
                                      {s.vo2MaxMlMinKg} ml/min/kg
                                    </Typography>
                                  </Grid>
                                  <Grid size={{ xs: 6, sm: 3 }}>
                                    <Typography variant="caption" color="text.secondary">Tělesný tuk</Typography>
                                    <Typography sx={{ fontWeight: 600 }}>{s.bodyFatPercentage}%</Typography>
                                  </Grid>
                                </Grid>

                                {s.rawPractitionerNotes && (
                                  <Box sx={{ mt: 2, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Poznámky</Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{s.rawPractitionerNotes}</Typography>
                                  </Box>
                                )}

                                {s.agentGeneratedSummary && (
                                  <Box sx={{ mt: 2, p: 2, bgcolor: '#0D737708', borderRadius: 2, border: '1px solid #0D737720' }}>
                                    <Typography variant="caption" sx={{ color: '#0D7377', fontWeight: 600 }}>🤖 AI Analýza</Typography>
                                    <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>{s.agentGeneratedSummary}</Typography>
                                  </Box>
                                )}

                                {s.detectedAnomaliesJson && (
                                  <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 600 }}>Detekované anomálie</Typography>
                                    <Typography variant="body2">{s.detectedAnomaliesJson}</Typography>
                                  </Alert>
                                )}

                                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                                  <Button size="small" variant="outlined" startIcon={<Science />}
                                    onClick={() => navigate(`/diagnostics/new?patientId=${patient.id}&sessionId=${s.id}`)}
                                    sx={{ borderColor: '#0D7377', color: '#0D7377' }}>
                                    Regenerovat analýzu
                                  </Button>
                                  <Button size="small" variant="outlined" startIcon={<Download />}
                                    onClick={() => handleDownloadPdf(s.id)}
                                    sx={{ borderColor: '#0D7377', color: '#0D7377' }}>
                                    PDF Report
                                  </Button>
                                </Box>
                              </Box>
                            </Collapse>
                          </Paper>
                        </motion.div>
                      );
                    })}
                  </List>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}
