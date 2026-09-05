import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Box, Typography, Paper, TextField, Button, Grid, MenuItem, Alert, CircularProgress,
  IconButton, Chip, Stepper, Step, StepLabel,
} from '@mui/material';
import { ArrowBack, Save, PersonAdd, Add, Delete, ArrowForward } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { patientsApi } from '../api/patients';
import client from '../api/client';
import toast from 'react-hot-toast';
import { formatRodneCislo, parseRodneCislo } from '../utils/rodneCislo';
import AddressPicker, { formatAddress, type AddressValue } from '../components/booking/AddressPicker';

interface RegOption { code: string; displayValue: string; }
interface ContactRow { channel: string; value: string; note: string; }

const INSURERS = [
  { code: '111', label: '111 — Všeobecná zdravotní pojišťovna' },
  { code: '201', label: '201 — Vojenská zdravotní pojišťovna' },
  { code: '205', label: '205 — Česká průmyslová zdravotní pojišťovna' },
  { code: '207', label: '207 — Oborová zdravotní pojišťovna' },
  { code: '209', label: '209 — Zaměstnanecká pojišťovna Škoda' },
  { code: '211', label: '211 — Zdravotní pojišťovna ministerstva vnitra' },
  { code: '213', label: '213 — Revírní bratrská pokladna' },
];

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

export default function PatientForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const isEdit = !!editId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState<any>(null);
  const lastCheckedKey = useRef('');
  const [step, setStep] = useState(0);

  const FORM_STEPS = ['Osobní údaje', 'Pojištění', 'Adresa', 'Kontakty', 'Zaměstnání'];
  const [titlesBefore, setTitlesBefore] = useState<RegOption[]>([]);
  const [titlesAfter, setTitlesAfter] = useState<RegOption[]>([]);

  const [form, setForm] = useState({
    lastName: '', firstName: '', titleBefore: '', titleAfter: '',
    birthNumber: '', dateOfBirth: '', sex: 'Male', citizenship: 'Česko',
    insuranceNumber: '', insurerCode: '', insuredFrom: '', insuranceType: '',
    treatingDoctors: '', address: '', city: '',
    occupation: '', employer: '', employmentType: '', notes: '',
  });
  const [contacts, setContacts] = useState<ContactRow[]>([
    { channel: 'phone', value: '', note: '' },
    { channel: 'email', value: '', note: '' },
  ]);
  const [addressParts, setAddressParts] = useState<AddressValue>({
    region: '', city: '', psc: '', street: '', number: '',
  });
  const step0Valid = form.firstName.trim().length >= 1 && form.lastName.trim().length >= 1 && form.dateOfBirth !== '';

  const [vitals, setVitals] = useState({
    heartRate: 72,
    bloodPressure: '120',
    bloodPressureDiastolic: '80',
    temperature: 36.6,
    heartRateTrend: 'stable',
    bloodPressureTrend: 'stable',
    temperatureTrend: 'stable',
    trendDirection: 'stable' as 'up' | 'down' | 'stable',
    lastUpdate: '--:--',
  });
  const [alerts, setAlerts] = useState<Array<{title: string; message: string; severity: 'info' | 'warning' | 'error' }>>([]);

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  // ── Simulated real-time CGM vital signs monitoring ────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setVitals(prev => {
        const randomChange = (Math.random() - 0.5) * 5;
        const newHr = Math.max(60, Math.min(100, prev.heartRate + Math.round(randomChange)));
        const newBpSystolic = Math.max(90, Math.min(140, parseInt(prev.bloodPressure) + Math.round(randomChange * 0.4)));
        const newTemp = Math.max(36.0, Math.min(37.5, parseFloat(prev.temperature) + Math.round(randomChange * 0.2)));
        const directions = ['up', 'down', 'stable'] as const;
        const getRandomDir = () => directions[Math.floor(Math.random() * directions.length)];
        const trendDirection =
          (newHr > prev.heartRate ? 'up' : newHr < prev.heartRate ? 'down' : 'stable');
        return {
          heartRate: newHr,
          bloodPressure: newBpSystolic.toString(),
          bloodPressureDiastolic: parseInt(prev.bloodPressureDiastolic) + Math.round(randomChange * 0.2).toString(),
          temperature: parseFloat(prev.temperature).toFixed(1),
          heartRateTrend: getRandomDir(),
          bloodPressureTrend: getRandomDir(),
          temperatureTrend: getRandomDir(),
          trendDirection,
          lastUpdate: new Date().toLocaleTimeString([], { minute: '2-digit', hour: '2-digit' }),
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Simulated alerts generation based on vitals ─────────────────────
  useEffect(() => {
    const newAlerts: AlertData[] = [];
    if (vitals.heartRate > 90) {
      newAlerts.push({
        title: 'Srdeční frekvence',
        message: ` ${vitals.heartRate} bpm - mírně zvýšená`,
        severity: 'warning',
      });
    }
    if (vitals.heartRate < 50) {
      newAlerts.push({
        title: 'Srdeční frekvence',
        message: ` ${vitals.heartRate} bpm - snížená, pozor`,
        severity: 'error',
      });
    }
    if (vitals.temperature > 37.2) {
      newAlerts.push({
        title: 'Teplota',
        message: ` ${vitals.temperature} °C - horečka`,
        severity: 'warning',
      });
    }
    if (vitals.temperature < 36.0) {
      newAlerts.push({
        title: 'Teplota',
        message: ` ${vitals.temperature} °C - hypotermie`,
        severity: 'error',
      });
    }
    setAlerts(newAlerts);
  }, [vitals]);

  // Smart birth-number: auto-format + derive birth date + sex
  const [rcValid, setRcValid] = useState<boolean | null>(null);
  const handleBirthNumber = (raw: string) => {
    const formatted = formatRodneCislo(raw);
    const parsed = parseRodneCislo(formatted);
    setRcValid(raw.replace(/[^0-9]/g, '').length >= 9 ? parsed.valid : null);
    setForm(prev => ({
      ...prev,
      birthNumber: formatted,
      ...(parsed.valid ? { dateOfBirth: parsed.dateOfBirth, sex: parsed.sex } : {}),
    }));
  };

  useEffect(() => {
    client.get('/api/v1/patient-registration/options')
      .then(r => {
        const d = r.data?.value ?? r.data ?? {};
        setTitlesBefore(d.titlesBeforeName ?? []);
        setTitlesAfter(d.titlesAfterName ?? []);
      })
      .catch(() => {});
  }, []);

  // Edit mode: load patient + profile
  useEffect(() => {
    if (!editId) return;
    Promise.all([
      patientsApi.getById(editId).catch(() => null),
      patientsApi.getProfile(editId).catch(() => null),
    ]).then(([p, prof]: any[]) => {
      if (p) {
        setForm(f => ({
          ...f,
          lastName: p.lastName ?? '', firstName: p.firstName ?? '',
          dateOfBirth: (p.dateOfBirth ?? '').slice(0, 10), sex: p.sex ?? 'Male',
        }));
      }
      if (prof) {
        const contacts = (() => { try { return JSON.parse(prof.contactsJson ?? '[]'); } catch { return []; } })();
        // Split saved "street number, city, psc" back into steps
        const addrParts = String(prof.address ?? '').split(',').map((s: string) => s.trim());
        if (addrParts.length >= 2) {
          const streetNum = addrParts[0].match(/^(.*)\s+(\S+)$/);
          setAddressParts({
            region: '',
            city: addrParts[1] ?? '',
            psc: addrParts[2] ?? '',
            street: streetNum ? streetNum[1] : addrParts[0],
            number: streetNum ? streetNum[2] : '',
          });
        }
        setForm(f => ({
          ...f,
          titleBefore: prof.titlesBeforeName ?? '', titleAfter: prof.titlesAfterName ?? '',
          birthNumber: prof.birthNumber ?? '', insuranceNumber: prof.insuranceNumber ?? '',
          insurerCode: prof.healthInsurerCode ?? '', insuredFrom: (prof.insuredFrom ?? '').slice(0, 10),
          insuranceType: prof.insuranceType ?? '', treatingDoctors: prof.treatingDoctors ?? '',
          address: prof.address ?? '', occupation: prof.occupation ?? '', employer: prof.employer ?? '',
          employmentType: prof.employmentType ?? '', notes: prof.notes ?? '',
        }));
        const rows = contacts.length > 0 ? contacts : [{ channel: 'phone', value: '', note: '' }, { channel: 'email', value: '', note: '' }];
        setContacts(rows.map((c: any) => ({ channel: c.channel ?? 'phone', value: c.value ?? '', note: c.note ?? '' })));
      }
    });
  }, [editId]);

  const email = contacts.find(c => c.channel === 'email')?.value ?? '';
  const phone = contacts.find(c => c.channel === 'phone')?.value ?? '';

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.dateOfBirth) {
      setError('Vyplňte povinné údaje (Jméno, Příjmení, Datum narození)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Duplicate check (create mode): same name + birth date already exists?
      // Second submit with unchanged data proceeds anyway (confirmed different person).
      if (!isEdit) {
        try {
          const found = await patientsApi.search(form.lastName);
          const dup = (found ?? []).find((p: any) =>
            (p.firstName ?? '').toLowerCase() === form.firstName.trim().toLowerCase() &&
            String(p.dateOfBirth ?? '').slice(0, 10) === form.dateOfBirth);
          const dupKey = dup ? `${dup.id}` : '';
          const formKey = `${form.firstName.trim().toLowerCase()}|${form.lastName.trim().toLowerCase()}|${form.dateOfBirth}`;
          if (dup && duplicate?.id !== dup.id && lastCheckedKey.current !== formKey + dup.id) {
            setDuplicate(dup);
            lastCheckedKey.current = formKey + dup.id;
            setLoading(false);
            return;
          }
        } catch { /* search failed — continue with create */ }
      }
      const email = contacts.find(c => c.channel === 'email')?.value ?? '';
      const phone = contacts.find(c => c.channel === 'phone')?.value ?? '';
      let patientId = editId;
      if (isEdit && editId) {
        await patientsApi.update(editId, {
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
        });
        patientId = editId;
      } else {
        const patient = await patientsApi.create({
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          sex: form.sex,
          preferredName: undefined,
          email: email || undefined,
          phone: phone || undefined,
          registrationBusinessDate: new Date().toISOString().split('T')[0],
        });
        patientId = patient.id;
      }
      await client.put(`/api/patients/${patientId}/profile`, {
        titlesBeforeName: form.titleBefore,
        titlesAfterName: form.titleAfter,
        birthNumber: form.birthNumber,
        insuranceNumber: form.insuranceNumber || form.birthNumber,
        healthInsurerCode: form.insurerCode,
        insuredFrom: form.insuredFrom,
        insuranceType: form.insuranceType,
        citizenship: form.citizenship,
        address: formatAddress(addressParts) || form.address,
        treatingDoctors: form.treatingDoctors,
        occupation: form.occupation,
        employer: form.employer,
        employmentType: form.employmentType,
        notes: form.notes,
        contactsJson: JSON.stringify(contacts.filter(c => c.value.trim() !== '')),
      });
      toast.success(isEdit ? 'Pacient upraven!' : 'Pacient úspěšně vytvořen!');
      navigate(`/patients/${patientId}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Neznámá chyba — zkontrolujte připojení k backendu';
      setError(msg);
      toast.error(`Chyba při ukládání pacienta: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const setContact = (i: number, patch: Partial<ContactRow>) =>
    setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* CGM MONITORING BANNER - Inspirované CGM MEDISTAR */}
      <Box sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: '#F0F9FF', border: '1px solid #0D7377' }}>
        <Typography variant="body1" color="#0D7377">
          <strong>Reálný čas monitorování (CGM Inspirované):</strong> 
          Srdeční: {vitals.heartRate} bpm, Krevní: {vitals.bloodPressure}/{vitals.bloodPressureDiastolic} mmHg, Teplota: {vitals.temperature} °C
        </Typography>
      </Box>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/patients')}
          sx={{ mb: 2, borderRadius: 2 }}>
          Zpět na pacienty
        </Button>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAdd color="primary" /> {isEdit ? 'Upravit pacienta' : 'Nový pacient'}
        </Typography>
      </motion.div>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {duplicate && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Podobný pacient již existuje: <strong>{duplicate.firstName} {duplicate.lastName}</strong>
          {' '}({String(duplicate.dateOfBirth ?? '').slice(0, 10)}).
          {' '}<Link to={`/patients/${duplicate.id}`}>Otevřít záznam</Link>
          {' '}— nebo pokračujte v uložení, pokud jde o jinou osobu.
        </Alert>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Stepper activeStep={step} sx={{ mb: 3 }}>
            {FORM_STEPS.map(label => (
              <Step key={label} completed={step > FORM_STEPS.indexOf(label)}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <AnimatePresence mode="wait">
          {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {/* ── Identity ── */}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Osobní údaje</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Příjmení" value={form.lastName}
                onChange={e => update('lastName', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Jméno" value={form.firstName}
                onChange={e => update('firstName', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth select label="Titul před" value={form.titleBefore}
                onChange={e => update('titleBefore', e.target.value)} sx={fieldSx}>
                <MenuItem value="">—</MenuItem>
                {titlesBefore.map(t => <MenuItem key={t.code} value={t.displayValue}>{t.displayValue}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth select label="Titul za" value={form.titleAfter}
                onChange={e => update('titleAfter', e.target.value)} sx={fieldSx}>
                <MenuItem value="">—</MenuItem>
                {titlesAfter.map(t => <MenuItem key={t.code} value={t.displayValue}>{t.displayValue}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Rodné číslo" value={form.birthNumber}
                onChange={e => handleBirthNumber(e.target.value)} placeholder="900101/1234" sx={fieldSx}
                helperText={rcValid === false ? 'Neplatné rodné číslo' : rcValid === true ? '✓ Datum narození a pohlaví doplněny' : 'Lomítko se doplní samo'}
                error={rcValid === false} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Datum narození" type="date"
                value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)}
                InputLabelProps={{ shrink: true }} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth select label="Pohlaví" value={form.sex}
                onChange={e => update('sex', e.target.value)} sx={fieldSx}>
                <MenuItem value="Male">Muž</MenuItem>
                <MenuItem value="Female">Žena</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth label="Státní příslušnost" value={form.citizenship}
                onChange={e => update('citizenship', e.target.value)} sx={fieldSx} />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => setStep(1)}
              disabled={!step0Valid}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}>
              Pokračovat
            </Button>
          </Box>
          {!step0Valid && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', mt: 1 }}>
              Vyplňte Jméno, Příjmení a Datum narození
            </Typography>
          )}
          </motion.div>
          )}

          {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {/* ── Insurance ── */}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Pojištění</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Číslo pojištěnce" value={form.insuranceNumber}
                onChange={e => update('insuranceNumber', e.target.value)}
                placeholder="Není-li vyplněno, použije se rodné číslo" sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="ZP — zdravotní pojišťovna" value={form.insurerCode}
                onChange={e => update('insurerCode', e.target.value)} sx={fieldSx}>
                <MenuItem value="">—</MenuItem>
                {INSURERS.map(i => <MenuItem key={i.code} value={i.code}>{i.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Pojištěn od" type="date" value={form.insuredFrom}
                onChange={e => update('insuredFrom', e.target.value)}
                InputLabelProps={{ shrink: true }} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Druh pojištění" value={form.insuranceType}
                onChange={e => update('insuranceType', e.target.value)}
                placeholder="např. veřejné, komerční..." sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Registrující / ošetřující lékaři" value={form.treatingDoctors}
                onChange={e => update('treatingDoctors', e.target.value)}
                placeholder="Jména oddělená čárkou" sx={fieldSx} />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button startIcon={<ArrowBack />} onClick={() => setStep(0)}>Zpět</Button>
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => setStep(2)}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}>
              Pokračovat
            </Button>
          </Box>
          </motion.div>
          )}

          {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {/* ── Address (stepped: kraj → město → ulice → PSČ) ── */}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Adresa</Typography>
          <Box sx={{ mb: 1 }}>
            <AddressPicker value={addressParts} onChange={setAddressParts} />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button startIcon={<ArrowBack />} onClick={() => setStep(1)}>Zpět</Button>
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => setStep(3)}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}>
              Pokračovat
            </Button>
          </Box>
          </motion.div>
          )}

          {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {/* ── Contacts ── */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Kontakty</Typography>
            <Button size="small" startIcon={<Add />}
              onClick={() => setContacts(prev => [...prev, { channel: 'phone', value: '', note: '' }])}>
              Přidat kontakt
            </Button>
          </Box>
          {contacts.map((c, i) => (
            <Grid container spacing={2} sx={{ mb: 1.5 }} key={i}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth size="small" label={i < 2 ? (c.channel === 'phone' ? 'Mobil / pevná linka' : 'Email') : 'Kontakt'}
                  value={c.value} onChange={e => setContact(i, { value: e.target.value })} sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <TextField fullWidth size="small" select label="Druh kontaktu" value={c.channel}
                  onChange={e => setContact(i, { channel: e.target.value })} sx={fieldSx}>
                  <MenuItem value="phone">Telefon</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="other">Jiný</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 10, sm: 4 }}>
                <TextField fullWidth size="small" label="Poznámka" value={c.note}
                  onChange={e => setContact(i, { note: e.target.value })} sx={fieldSx} />
              </Grid>
              <Grid size={{ xs: 2, sm: 1 }} sx={{ display: 'flex', alignItems: 'center' }}>
                {contacts.length > 1 && (
                  <IconButton size="small" color="error"
                    onClick={() => setContacts(prev => prev.filter((_, idx) => idx !== i))}>
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Grid>
            </Grid>
          ))}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button startIcon={<ArrowBack />} onClick={() => setStep(2)}>Zpět</Button>
            <Button variant="contained" endIcon={<ArrowForward />} onClick={() => setStep(4)}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}>
              Pokračovat
            </Button>
          </Box>
          </motion.div>
          )}

          {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          {/* ── Work ── */}
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Zaměstnání</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Povolání" value={form.occupation}
                onChange={e => update('occupation', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Zaměstnavatel" value={form.employer}
                onChange={e => update('employer', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Druh zaměstnání" value={form.employmentType}
                onChange={e => update('employmentType', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} label="Poznámka" value={form.notes}
                onChange={e => update('notes', e.target.value)} sx={fieldSx} />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button startIcon={<ArrowBack />} onClick={() => setStep(3)}>Zpět</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" onClick={() => navigate('/patients')}
              sx={{ borderRadius: 2, px: 3 }}>
              Zrušit
            </Button>
            <Button variant="contained" startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              onClick={handleSubmit} disabled={loading}
              sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600,
                boxShadow: '0 4px 16px rgba(13,115,119,0.3)',
                '&:hover': { bgcolor: '#095456' } }}>
              {loading ? 'Ukládání...' : (isEdit ? 'Uložit změny' : 'Uložit pacienta')}
            </Button>
          </Box>
          </motion.div>
          )}
          </AnimatePresence>
        </Paper>
      </motion.div>
    </Box>
  );
}
