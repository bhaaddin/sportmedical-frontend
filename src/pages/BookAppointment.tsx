import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Card, CardContent, Button, TextField, Grid,
  Chip, Stepper, Step, StepLabel, Alert, Skeleton, IconButton,
  Checkbox, FormControlLabel, MenuItem,
} from '@mui/material';
import {
  CalendarMonth, AccessTime, CheckCircle, Event, Person,
  Email, Phone, Room, Paid, ArrowBack, ArrowForward,
  Description, HealthAndSafety, Policy, Edit,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { publicBookingApi } from '../api/publicBooking';
import type { PublicBookingEventType, BookingSlot, PublicBooking } from '../api/publicBooking';

function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

import {
  computeAge, emptyHealthAnswers, isHealthComplete, emptyGuardian, isGuardianComplete,
  HealthQuestionnaire, GuardianForm, SignaturePad, GDPR_SHORT,
  type HealthAnswers, type GuardianData,
} from '../components/booking/BookingDocuments';
import { formatRodneCislo, parseRodneCislo } from '../utils/rodneCislo';
import AddressPicker, { formatAddress, type AddressValue } from '../components/booking/AddressPicker';

const STEPS = ['Služba', 'Čas', 'Údaje', 'Dokumenty'];

export default function BookAppointment() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<PublicBookingEventType[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<PublicBookingEventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [form, setForm] = useState({ firstName: '', lastName: '', birthNumber: '', birthDate: '', sex: '', mobile: '', email: '', insurerCode: '', insuranceNumber: '', address: '', notes: '' });
  const [rcValid, setRcValid] = useState<boolean | null>(null);
  const [addressParts, setAddressParts] = useState<AddressValue>({ region: '', city: '', psc: '', street: '', number: '' });

  // Smart birth-number: slash auto-format + derive birth date + sex
  const handleBirthNumber = (raw: string) => {
    const formatted = formatRodneCislo(raw);
    const parsed = parseRodneCislo(formatted);
    setRcValid(raw.replace(/[^0-9]/g, '').length >= 9 ? parsed.valid : null);
    setForm(f => ({
      ...f,
      birthNumber: formatted,
      ...(parsed.valid ? { birthDate: parsed.dateOfBirth, sex: parsed.sex } : {}),
    }));
  };
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [error, setError] = useState('');

  // Documents state (real health questionnaire + GDPR + guardian + signature)
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthAnswers>(() => emptyHealthAnswers());
  const [guardian, setGuardian] = useState<GuardianData>(() => emptyGuardian());
  const [vypisConfirmed, setVypisConfirmed] = useState(false);
  const [gdprConsented, setGdprConsented] = useState(false);
  const [signature, setSignature] = useState('');
  const [checkingPatient, setCheckingPatient] = useState(false);

  const patientAge = computeAge(form.birthDate);
  const isMinor = patientAge >= 0 && patientAge < 18;

  const resetDocs = () => {
    setIsFirstVisit(null);
    setHealth(emptyHealthAnswers());
    setGuardian(emptyGuardian());
    setVypisConfirmed(false);
    setGdprConsented(false);
    setSignature('');
    setAddressParts({ region: '', city: '', psc: '', street: '', number: '' });
  };

  // Load event types
  useEffect(() => {
    setLoading(true);
    const load = slug
      ? publicBookingApi.getEventBySlug(slug).then(e => [e])
      : publicBookingApi.getEventTypes();
    load
      .then(setEvents)
      .catch(() => setError('Nepodařilo se načíst typy služeb.'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Load slots when event + date range changes
  useEffect(() => {
    if (!selectedEvent) return;
    setSlotsLoading(true);
    const weekDays = getWeekDays(new Date(Date.now() + weekOffset * 14 * 86400000));
    const from = weekDays[0].toISOString();
    const to = weekDays[weekDays.length - 1].toISOString();
    publicBookingApi.getSlots(selectedEvent.slug, from, to)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedEvent, weekOffset]);

  const dateSlots = useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter(s => {
      const d = new Date(s.start);
      return d.getDate() === selectedDate.getDate()
        && d.getMonth() === selectedDate.getMonth()
        && d.getFullYear() === selectedDate.getFullYear();
    });
  }, [slots, selectedDate]);

  const availableDates = useMemo(() => {
    const dates = new Map<string, Date>();
    slots.forEach(s => {
      const d = new Date(s.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!dates.has(key)) dates.set(key, d);
    });
    return [...dates.values()].sort((a, b) => a.getTime() - b.getTime());
  }, [slots]);

  const weekDays = useMemo(() => getWeekDays(new Date(Date.now() + weekOffset * 14 * 86400000)), [weekOffset]);

  // Group services by category (uncategorized go last under "Ostatní")
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, PublicBookingEventType[]>();
    events.forEach(e => {
      const key = (e.category || '').trim() || 'Ostatní';
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    });
    return [...groups.entries()].sort((a, b) =>
      a[0] === 'Ostatní' ? 1 : b[0] === 'Ostatní' ? -1 : a[0].localeCompare(b[0], 'cs-CZ'));
  }, [events]);

  const handleSelectEvent = (event: PublicBookingEventType) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setSelectedSlot(null);
    setStep(1);
  };

  const handleSelectSlot = (slot: BookingSlot) => {
    setSelectedSlot(slot);
    setIdempotencyKey(crypto.randomUUID());
    setStep(2);
  };

  // When moving from step 2 to step 3, check if first visit
  const handleProceedToDocuments = useCallback(async () => {
    if (!form.email) return;
    setStep(3);
    setCheckingPatient(true);
    try {
      const result = await publicBookingApi.checkPatient(form.email);
      setIsFirstVisit(result.isFirstVisit);
    } catch {
      // If check fails, assume first visit (safe default)
      setIsFirstVisit(true);
    } finally {
      setCheckingPatient(false);
    }
  }, [form.email]);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (form.firstName.trim().length < 2) missing.push('Jméno');
    if (form.lastName.trim().length < 2) missing.push('Příjmení');
    const digits = form.birthNumber.replace(/[^0-9]/g, '');
    if (digits.length !== 9 && digits.length !== 10) missing.push('Číslo pojištěnce (9–10 číslic)');
    if (form.birthDate === '') missing.push('Datum narození');
    if (form.sex === '') missing.push('Pohlaví');
    if (form.mobile.replace(/[^0-9+]/g, '').length < 9) missing.push('Mobil');
    if (!/.+@.+\..+/.test(form.email)) missing.push('Email');
    return missing;
  }, [form]);

  const formValid = missingFields.length === 0;

  const handleBooking = async () => {
    if (!selectedEvent || !selectedSlot || !formValid || !canSubmitDocuments) return;
    setSubmitting(true);
    setError('');
    try {
      const consentsJson = JSON.stringify({
        isFirstVisit,
        birthNumber: form.birthNumber.trim(),
        birthDate: form.birthDate,
        sex: form.sex,
        age: patientAge,
        mobile: form.mobile.trim(),
        insurerCode: form.insurerCode,
        insuranceNumber: form.insuranceNumber.trim() || form.birthNumber.trim(),
        address: formatAddress(addressParts),
        healthQuestionnaire: health,
        vypisConfirmed: isFirstVisit ? vypisConfirmed : null,
        gdprConsented,
        guardian: isMinor ? guardian : null,
        signature,
        signedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });
      const result = await publicBookingApi.createBooking({
        slug: selectedEvent.slug,
        inviteeName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        inviteeEmail: form.email,
        inviteePhone: form.mobile,
        startAt: selectedSlot.start,
        notes: form.notes,
        consentsJson,
        providerName: selectedSlot.providerName,
        idempotencyKey: idempotencyKey || undefined,
      });
      setBooking(result);
      setStep(4);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Nepodařilo se vytvořit rezervaci. Zkuste jiný čas.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitDocuments = useMemo(() => {
    if (isFirstVisit === null) return false;
    if (!isHealthComplete(health)) return false; // prohlášení must be checked
    if (isFirstVisit && !vypisConfirmed) return false;
    if (!gdprConsented) return false; // GDPR always required (real form text)
    if (isMinor && !isGuardianComplete(guardian)) return false;
    if (!signature) return false;
    return true;
  }, [isFirstVisit, health, vypisConfirmed, gdprConsented, guardian, signature, isMinor]);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#0D7377', mb: 1 }}>
            🏥 GreenLine Centrum
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Online Rezervace
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Vyberte si službu, zvolte termín a potvrďte rezervaci
          </Typography>
        </Box>
      </motion.div>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <AnimatePresence mode="wait">
        {/* Step 0: Choose Service */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
              <Event sx={{ mr: 1, verticalAlign: 'middle' }} />
              Vyberte službu
            </Typography>
            {groupedEvents.map(([category, items]) => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#0D7377' }}>
                  {category}
                </Typography>
                <Grid container spacing={2}>
                  {items.map(event => (
                <Grid size={{ xs: 12, sm: 6 }} key={event.id}>
                  <Card
                    onClick={() => handleSelectEvent(event)}
                    sx={{
                      cursor: 'pointer', borderRadius: 3, border: '2px solid transparent',
                      transition: 'all 0.2s', '&:hover': { borderColor: event.color, transform: 'translateY(-2px)', boxShadow: 3 },
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: event.color }} />
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{event.name}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {event.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip icon={<AccessTime />} label={`${event.durationMinutes} min`} size="small" />
                        <Chip icon={<Room />} label={event.room} size="small" />
                        {event.priceCzk > 0 && (
                          <Chip icon={<Paid />} label={`${event.priceCzk} CZK`} size="small" color="primary" />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </motion.div>
        )}

        {/* Step 1: Choose Time */}
        {step === 1 && selectedEvent && (
          <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Button startIcon={<ArrowBack />} onClick={() => setStep(0)}>Zpět</Button>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                <CalendarMonth sx={{ mr: 1, verticalAlign: 'middle' }} />
                Zvolte termín — {selectedEvent.name}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <IconButton onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0}>
                <ArrowBack />
              </IconButton>
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', flex: 1, py: 1 }}>
                {weekDays.map((day, i) => {
                  const hasSlots = availableDates.some(d =>
                    d.getDate() === day.getDate() && d.getMonth() === day.getMonth()
                  );
                  const isSelected = selectedDate?.getDate() === day.getDate()
                    && selectedDate?.getMonth() === day.getMonth();
                  return (
                    <Button
                      key={i}
                      variant={isSelected ? 'contained' : 'outlined'}
                      disabled={!hasSlots}
                      onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                      sx={{
                        minWidth: 80, borderRadius: 2, flexDirection: 'column',
                        bgcolor: isSelected ? '#0D7377' : undefined,
                        '&:hover': { bgcolor: isSelected ? '#095456' : undefined },
                      }}
                    >
                      <Typography variant="caption">{formatDate(day)}</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{day.getDate()}</Typography>
                    </Button>
                  );
                })}
              </Box>
              <IconButton onClick={() => setWeekOffset(w => w + 1)}>
                <ArrowForward />
              </IconButton>
            </Box>

            {slotsLoading ? (
              <Skeleton variant="rounded" height={100} />
            ) : selectedDate ? (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Dostupné časy pro {selectedDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Typography>
                {dateSlots.length > 0 ? (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(() => {
                      const groups = new Map<string, BookingSlot[]>();
                      dateSlots.forEach(s => {
                        const list = groups.get(s.start) ?? [];
                        list.push(s);
                        groups.set(s.start, list);
                      });
                      return [...groups.entries()].map(([start, options]) => {
                        const chosen = options.find(o => selectedSlot?.start === o.start && selectedSlot?.providerName === o.providerName);
                        if (options.length === 1) {
                          const slot = options[0];
                          const active = !!chosen;
                          return (
                            <Button
                              key={start}
                              variant={active ? 'contained' : 'outlined'}
                              onClick={() => handleSelectSlot(slot)}
                              sx={{ borderRadius: 2, px: 3, py: 1.5, bgcolor: active ? '#0D7377' : undefined }}
                            >
                              {formatTime(new Date(slot.start))}
                            </Button>
                          );
                        }
                        return (
                          <Paper key={start} variant="outlined" sx={{ borderRadius: 2, px: 1.5, py: 1, borderColor: chosen ? '#0D7377' : undefined, borderWidth: chosen ? 2 : 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, textAlign: 'center', color: '#0D7377' }}>
                              {formatTime(new Date(start))}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                              {options.map(o => (
                                <Chip
                                  key={o.providerName ?? ''}
                                  label={o.providerName}
                                  size="small"
                                  onClick={() => handleSelectSlot(o)}
                                  color={chosen?.providerName === o.providerName ? 'primary' : 'default'}
                                  variant={chosen?.providerName === o.providerName ? 'filled' : 'outlined'}
                                />
                              ))}
                            </Box>
                          </Paper>
                        );
                      });
                    })()}
                  </Box>
                ) : (
                  <Alert severity="info">Žádné dostupné časy pro tento den.</Alert>
                )}
              </Box>
            ) : (
              <Alert severity="info">Vyberte datum pro zobrazení dostupných termínů.</Alert>
            )}

            {selectedSlot && (
            <Box sx={{ mt: 3, textAlign: 'right' }}>
              {!formValid && missingFields.length > 0 && (
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  Chybí nebo je neplatné: {missingFields.join(', ')}
                </Typography>
              )}
              <Button
                  variant="contained" endIcon={<ArrowForward />}
                  onClick={() => setStep(2)}
                  sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}
                >
                  Pokračovat
                </Button>
              </Box>
            )}
          </motion.div>
        )}

        {/* Step 2: Enter Details */}
        {step === 2 && selectedEvent && selectedSlot && (
          <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Button startIcon={<ArrowBack />} onClick={() => setStep(1)}>Zpět</Button>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                Vaše údaje
              </Typography>
            </Box>

            <Paper sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: '#f8f9fa' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Shrnutí rezervace</Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip icon={<Event />} label={selectedEvent.name} />
                <Chip icon={<AccessTime />} label={`${formatDate(new Date(selectedSlot.start))} ${formatTime(new Date(selectedSlot.start))}`} />
                <Chip icon={<Room />} label={selectedEvent.room} />
                <Chip icon={<Person />} label={selectedSlot.providerName || selectedEvent.providerName} />
                {selectedEvent.priceCzk > 0 && <Chip icon={<Paid />} label={`${selectedEvent.priceCzk} CZK`} color="primary" />}
              </Box>
            </Paper>

            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Osobní údaje
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Prosím vyplňte následující údaje.
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required label="Jméno" placeholder="Jan"
                  value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  InputProps={{ startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required label="Příjmení" placeholder="Novák"
                  value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  InputProps={{ startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required label="Číslo pojištěnce / rodné číslo" placeholder="900101/1234"
                  value={form.birthNumber} onChange={e => handleBirthNumber(e.target.value)}
                  helperText={rcValid === false ? 'Neplatné číslo' : rcValid === true ? '✓ Datum a pohlaví doplněny' : '9–10 číslic, lomítko se doplní samo'}
                  error={rcValid === false}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required label="Datum narození" type="date"
                  value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required select label="Pohlaví" value={form.sex}
                  onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                >
                  <MenuItem value="Male">Muž</MenuItem>
                  <MenuItem value="Female">Žena</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required label="Mobil" placeholder="+420 123 456 789"
                  value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
                  InputProps={{ startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth required label="Email" type="email" placeholder="jan@novak.cz"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  InputProps={{ startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} /> }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="ZP — pojišťovna" select value={form.insurerCode}
                  onChange={e => setForm(f => ({ ...f, insurerCode: e.target.value }))}
                >
                  <MenuItem value="">— nevybráno —</MenuItem>
                  <MenuItem value="111">111 — Všeobecná zdravotní pojišťovna</MenuItem>
                  <MenuItem value="201">201 — Vojenská zdravotní pojišťovna</MenuItem>
                  <MenuItem value="205">205 — Česká průmyslová ZP</MenuItem>
                  <MenuItem value="207">207 — Oborová ZP</MenuItem>
                  <MenuItem value="209">209 — Zaměstnanecká pojišťovna Škoda</MenuItem>
                  <MenuItem value="211">211 — ZP ministerstva vnitra</MenuItem>
                  <MenuItem value="213">213 — Revírní bratrská pokladna</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="Číslo pojištěnce (nepovinné = RČ)" placeholder="Není-li vyplněno, použije se rodné číslo"
                  value={form.insuranceNumber} onChange={e => setForm(f => ({ ...f, insuranceNumber: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Adresa bydliště (nepovinné)
                </Typography>
                <AddressPicker compact value={addressParts} onChange={setAddressParts} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth multiline rows={3} label="Poznámky (nepovinné)"
                  placeholder="Speciální požadavky..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, textAlign: 'right' }}>
              <Button
                variant="contained"
                onClick={handleProceedToDocuments}
                disabled={!formValid}
                sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}
              >
                Pokračovat na dokumenty
              </Button>
            </Box>
          </motion.div>
        )}

        {/* Step 3: Povinné dokumenty */}
        {step === 3 && selectedEvent && selectedSlot && (
          <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Button startIcon={<ArrowBack />} onClick={() => setStep(2)}>Zpět</Button>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                <Description sx={{ mr: 1, verticalAlign: 'middle' }} />
                Povinné dokumenty
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              Před potvrzením rezervace je nutné vyplnit a potvrdit povinné dokumenty.
            </Alert>

            {checkingPatient ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
                <Skeleton variant="rounded" height={60} />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {isMinor && (
                  <Alert severity="warning">
                    Pacientovi je {patientAge} let — formulář vyplňuje rodič / zákonný zástupce.
                  </Alert>
                )}

                {/* ── 1. Zdravotní dotazník (fast ano/ne) ── */}
                <Paper sx={{ borderRadius: 3, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <HealthAndSafety color="primary" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Zdravotní dotazník ke sportovní prohlídce
                    </Typography>
                    <Chip label="povinné" size="small" color="primary" variant="outlined" />
                  </Box>
                  <HealthQuestionnaire answers={health} onChange={setHealth} showGyn={form.sex === 'Female'} />
                </Paper>

                {/* ── 2. Zákonný zástupce (under 18 only) ── */}
                {isMinor && (
                  <GuardianForm
                    value={guardian} onChange={setGuardian}
                    childName={`${form.firstName} ${form.lastName}`.trim()}
                    childBirth={form.birthDate}
                  />
                )}
                {/* ── 3. Výpis (first visit only) ── */}
                {isFirstVisit && (
                  <Paper sx={{ borderRadius: 3, p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Description color={vypisConfirmed ? 'success' : 'warning'} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Výpis ze zdravotní dokumentace
                      </Typography>
                      <Chip label="Pouze 1. návštěva" size="small" color="warning" variant="outlined" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Pro první návštěvu je vyžadován výpis od předchozího lékaře — přineste jej osobně.
                    </Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={vypisConfirmed}
                          onChange={e => setVypisConfirmed(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Beru na vědomí, že výpis předložím při návštěvě kliniky"
                    />
                  </Paper>
                )}

                {/* ── 4. GDPR souhlas (real clinic text) ── */}
                {/* ── 4. GDPR souhlas (real clinic text) ── */}
                <Paper sx={{ borderRadius: 3, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Policy color={gdprConsented ? 'success' : 'warning'} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      GDPR souhlas se zpracováním osobních údajů
                    </Typography>
                    <Chip label="povinné" size="small" color="primary" variant="outlined" />
                  </Box>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2, maxHeight: 220, overflow: 'auto', bgcolor: '#fafafa' }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                      {GDPR_SHORT}
                    </Typography>
                  </Paper>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={gdprConsented}
                        onChange={e => setGdprConsented(e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Souhlasím se zpracováním osobních údajů pro účely sportovní lékařské prohlídky"
                  />
                </Paper>

                {/* ── 5. Podpis ── */}
                <Paper sx={{ borderRadius: 3, p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Edit color={signature ? 'success' : 'warning'} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Podpis {isMinor ? 'zákonného zástupce' : 'pacienta'}
                    </Typography>
                    <Chip label="povinné" size="small" color="primary" variant="outlined" />
                  </Box>
                  <SignaturePad value={signature} onChange={setSignature} />
                  <Typography variant="caption" color="text.secondary">
                    Elektronický podpis s časovým razítkem, uložen k rezervaci.
                  </Typography>
                </Paper>

                {/* ── Info for returning patients ── */}
                {isFirstVisit === false && (
                  <Alert severity="success">
                    Vracíte se k nám — výpis máme z minula, dotazník, GDPR a podpis prosím znovu.
                  </Alert>
                )}
              </Box>
            )}

            <Box sx={{ mt: 3, textAlign: 'right' }}>
              <Button
                variant="contained"
                onClick={handleBooking}
                disabled={!canSubmitDocuments || submitting || checkingPatient}
                sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}
              >
                {submitting ? 'Vytvářím rezervaci...' : 'Potvrdit rezervaci'}
              </Button>
            </Box>
          </motion.div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && booking && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
              <CheckCircle sx={{ fontSize: 80, color: '#2E7D32', mb: 2 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#2E7D32', mb: 1 }}>
                Rezervace potvrzena!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Potvrzení bylo odesláno na {booking.inviteeEmail}
              </Typography>

              <Paper sx={{ p: 3, maxWidth: 400, mx: 'auto', borderRadius: 2, bgcolor: '#f8f9fa' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>{booking.eventName}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarMonth color="primary" />
                    <Typography>{new Date(booking.startUtc).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTime color="primary" />
                    <Typography>{formatTime(new Date(booking.startUtc))} — {formatTime(new Date(booking.endUtc))}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Room color="primary" />
                    <Typography>{booking.room}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person color="primary" />
                    <Typography>{booking.providerName}</Typography>
                  </Box>
                </Box>
              </Paper>

              {isFirstVisit && (
                <Alert severity="warning" sx={{ mt: 3, textAlign: 'left' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Nezapomeňte přinést:</Typography>
                  Výpis ze zdravotní dokumentace od předchozího lékaře
                </Alert>
              )}

              <Button
                variant="outlined" sx={{ mt: 3, borderRadius: 2 }}
                onClick={() => { setStep(0); setSelectedEvent(null); setSelectedSlot(null); setBooking(null); resetDocs(); }}
              >
                Vytvořit další rezervaci
              </Button>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
