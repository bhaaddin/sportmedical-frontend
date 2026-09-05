import { useState, useEffect } from 'react';
import {
  Box, Typography, Container, Paper, Stepper, Step, StepLabel,
  Button, Grid, Card, CardContent, TextField, Alert, CircularProgress,
  Checkbox, FormControlLabel, FormGroup, Divider, Chip, Avatar
} from '@mui/material';
import { motion } from 'framer-motion';
import { format, addDays, isWeekend, getDay, startOfWeek, addWeeks } from 'date-fns';
import { cs } from 'date-fns/locale';

const steps = ['Služba', 'Lékař', 'Datum & čas', 'Vaše údaje', 'Souhlasy (GDPR)', 'Potvrzení'];

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  requiresConsent: boolean;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  avatar: string;
  rating: number;
  availableDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

interface TimeSlot {
  time: string;
  available: boolean;
}

// Simulated data — in production this comes from API
const mockServices: Service[] = [
  { id: '1', name: 'Vstupní preventivní prohlídka', description: 'Komplexní vstupní prohlídka s hodnocením zdravotního stavu', duration: 30, price: 500, category: 'Preventivní', requiresConsent: true },
  { id: '2', name: 'Sportovní prohlídka', description: 'Sportovnělékařské vyšetření pro sportovce', duration: 45, price: 800, category: 'Sportovní', requiresConsent: true },
  { id: '3', name: 'Kontrolní prohlídka', description: 'Kontrolní vyšetření po předchozí prohlídce', duration: 15, price: 250, category: 'Preventivní', requiresConsent: false },
  { id: '4', name: 'Rehabilitace', description: 'Rehabilitační seance s fyzioterapeutem', duration: 60, price: 1200, category: 'Rehabilitace', requiresConsent: true },
];

const mockDoctors: Doctor[] = [
  { id: '1', name: 'MUDr. Jan Novák', specialization: 'Sportovní lékařství', avatar: '', rating: 4.8, availableDays: [1, 2, 3, 4, 5] },
  { id: '2', name: 'MUDr. Marie Svobodová', specialization: 'Fyzioterapie', avatar: '', rating: 4.9, availableDays: [1, 3, 4, 5] },
  { id: '3', name: 'MUDr. Pavel Dvořák', specialization: 'Preventivní medicína', avatar: '', rating: 4.7, availableDays: [1, 2, 4, 5] },
];

const generateTimeSlots = (date: string, doctorId: string): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 8; hour < 17; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      // Simulate some slots being taken
      const available = Math.random() > 0.3;
      slots.push({ time, available });
    }
  }
  return slots;
};

export default function PublicBooking() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }));

  // Patient data
  const [patientData, setPatientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    rodneCislo: '',
    dateOfBirth: '',
    insuranceCompany: '',
    insuranceNumber: '',
    address: '',
    city: '',
    postalCode: '',
    notes: '',
  });

  // GDPR consents
  const [consents, setConsents] = useState({
    dataProcessing: false,     // ZPRACOVÁNÍ OSOBNÍCH ÚDAJŮ (GDPR čl. 6)
    healthDataProcessing: false, // ZPRACOVÁNÍ ZDRAVOTNÍCH ÚDAJŮ (GDPR čl. 9)
    dataRetention: false,      // SOUHLAS S UCHOVÁNÍM DAT
    marketingConsent: false,   // MARKETING
    thirdPartySharing: false,  // SDÍLENÍ S TŘETÍMI STRANAMI
    cameraConsent: false,      // POŘIZOVÁNÍ ZÁZNAMŮ
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedServiceData = mockServices.find(s => s.id === selectedService);
  const selectedDoctorData = mockDoctors.find(d => d.id === selectedDoctor);

  // Check if date is available for selected doctor
  const isDateAvailable = (date: Date): boolean => {
    if (!selectedDoctorData) return false;
    const dayOfWeek = getDay(date);
    return selectedDoctorData.availableDays.includes(dayOfWeek);
  };

  // Generate available dates for 3 weeks
  const getAvailableDates = (): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < 21; i++) {
      const date = addDays(currentWeekStart, i);
      if (!isWeekend(date) && isDateAvailable(date)) {
        dates.push(date);
      }
    }
    return dates;
  };

  useEffect(() => {
    if (selectedDate && selectedDoctor) {
      setTimeSlots(generateTimeSlots(selectedDate, selectedDoctor));
    }
  }, [selectedDate, selectedDoctor]);

  // GDPR required checks
  const isGdprValid = () => {
    if (!selectedServiceData?.requiresConsent) return true;
    return consents.dataProcessing && consents.healthDataProcessing && consents.dataRetention;
  };

  const handleNext = () => {
    if (activeStep === 3) {
      // Validate patient data
      if (!patientData.firstName || !patientData.lastName || !patientData.email || !patientData.phone) {
        setError('Vyplňte prosím povinné údaje (jméno, příjmení, e-mail, telefon)');
        return;
      }
      setError(null);
    }
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!isGdprValid()) {
      setError('Musíte souhlasit se zpracováním osobních údajů');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService,
          doctorId: selectedDoctor,
          date: selectedDate,
          time: selectedTime,
          patient: patientData,
          consents: {
            ...consents,
            consentTimestamp: new Date().toISOString(),
            consentVersion: '2.1',
            ipAddress: 'collected-server-side',
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Rezervace selhala');
      }

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getMinStepValid = (step: number): boolean => {
    switch (step) {
      case 0: return !!selectedService;
      case 1: return !!selectedDoctor;
      case 2: return !!selectedDate && !!selectedTime;
      case 3: return !!patientData.firstName && !!patientData.lastName && !!patientData.email && !!patientData.phone;
      case 4: return isGdprValid();
      default: return true;
    }
  };

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Box sx={{ mb: 4 }}>
            <Box sx={{
              width: 80, height: 80, borderRadius: '50%', bgcolor: 'success.main',
              display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3,
            }}>
              <Typography variant="h4" color="white">✓</Typography>
            </Box>
            <Typography variant="h4" gutterBottom fontWeight={700}>Rezervace potvrzena!</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Na Váš email {patientData.email} byla odeslána potvrzovací zpráva.
            </Typography>
            <Paper sx={{ p: 3, textAlign: 'left' }}>
              <Typography variant="h6" gutterBottom>Shrnutí</Typography>
              <Typography><strong>Služba:</strong> {selectedServiceData?.name}</Typography>
              <Typography><strong>Lékař:</strong> {selectedDoctorData?.name}</Typography>
              <Typography><strong>Datum:</strong> {selectedDate}</Typography>
              <Typography><strong>Čas:</strong> {selectedTime}</Typography>
              <Typography><strong>Cena:</strong> {selectedServiceData?.price} Kč</Typography>
            </Paper>
          </Box>
        </motion.div>
      </Container>
    );
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0: // Services
        return (
          <Grid container spacing={2}>
            {mockServices.map(service => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.id}>
                <Card
                  onClick={() => setSelectedService(service.id)}
                  sx={{
                    cursor: 'pointer',
                    border: selectedService === service.id ? 2 : 1,
                    borderColor: selectedService === service.id ? 'primary.main' : 'divider',
                    '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
                    transition: 'all 0.2s',
                  }}
                >
                  <CardContent>
                    <Chip label={service.category} size="small" sx={{ mb: 1 }} />
                    <Typography variant="h6" gutterBottom>{service.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{service.description}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">{service.duration} min</Typography>
                      <Typography variant="subtitle1" color="primary" fontWeight={700}>{service.price} Kč</Typography>
                    </Box>
                    {service.requiresConsent && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Vyžaduje lékařský posudek
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        );

      case 1: // Doctors
        return (
          <Grid container spacing={2}>
            {mockDoctors.map(doctor => (
              <Grid size={{ xs: 12 }} sm={6} key={doctor.id}>
                <Card
                  onClick={() => { setSelectedDoctor(doctor.id); setSelectedDate(''); setSelectedTime(''); }}
                  sx={{
                    cursor: 'pointer',
                    border: selectedDoctor === doctor.id ? 2 : 1,
                    borderColor: selectedDoctor === doctor.id ? 'primary.main' : 'divider',
                    '&:hover': { boxShadow: 4 },
                  }}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 24 }}>
                      {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6">{doctor.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{doctor.specialization}</Typography>
                      <Typography variant="body2" color="primary">★ {doctor.rating}/5</Typography>
                      <Box sx={{ mt: 1 }}>
                        {['Po', 'Út', 'St', 'Čt', 'Pá'].map((day, i) => (
                          <Chip key={day} label={day} size="small"
                            color={doctor.availableDays.includes(i + 1) ? 'success' : 'default'}
                            variant={doctor.availableDays.includes(i + 1) ? 'filled' : 'outlined'}
                            sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        );

      case 2: // Date & Time
        return (
          <Box>
            {selectedDoctor && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {selectedDoctorData?.name} přijímá pacienty: {['Po', 'Út', 'St', 'Čt', 'Pá']
                  .filter((_, i) => selectedDoctorData?.availableDays.includes(i + 1)).join(', ')}
              </Alert>
            )}
            <Typography variant="h6" gutterBottom>Vyberte datum</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              {getAvailableDates().map(date => (
                <Button
                  key={date.toISOString()}
                  variant={selectedDate === format(date, 'yyyy-MM-dd') ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedDate(format(date, 'yyyy-MM-dd')); setSelectedTime(''); }}
                  sx={{ minWidth: 80 }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption">{format(date, 'EEE', { locale: cs })}</Typography>
                    <Typography variant="body1" fontWeight={600}>{format(date, 'd')}</Typography>
                    <Typography variant="caption">{format(date, 'MMM', { locale: cs })}</Typography>
                  </Box>
                </Button>
              ))}
            </Box>

            {selectedDate && (
              <>
                <Typography variant="h6" gutterBottom>Vyberte čas</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {timeSlots.map(slot => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? 'contained' : 'outlined'}
                      disabled={!slot.available}
                      onClick={() => setSelectedTime(slot.time)}
                      sx={{ minWidth: 80 }}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </Box>
              </>
            )}
          </Box>
        );

      case 3: // Patient data
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Jméno *" value={patientData.firstName} onChange={(e) => setPatientData({ ...patientData, firstName: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Příjmení *" value={patientData.lastName} onChange={(e) => setPatientData({ ...patientData, lastName: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth type="email" label="E-mail *" value={patientData.email} onChange={(e) => setPatientData({ ...patientData, email: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Telefon *" value={patientData.phone} onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })} required /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Rodné číslo" value={patientData.rodneCislo} onChange={(e) => setPatientData({ ...patientData, rodneCislo: e.target.value })} placeholder="RRMMDD/XXXX" /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth type="date" label="Datum narození" value={patientData.dateOfBirth} InputLabelProps={{ shrink: true }} onChange={(e) => setPatientData({ ...patientData, dateOfBirth: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Pojišťovna" value={patientData.insuranceCompany} onChange={(e) => setPatientData({ ...patientData, insuranceCompany: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Číslo pojištěnce" value={patientData.insuranceNumber} onChange={(e) => setPatientData({ ...patientData, insuranceNumber: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Adresa" value={patientData.address} onChange={(e) => setPatientData({ ...patientData, address: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="Město" value={patientData.city} onChange={(e) => setPatientData({ ...patientData, city: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth label="PSČ" value={patientData.postalCode} onChange={(e) => setPatientData({ ...patientData, postalCode: e.target.value })} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} label="Poznámky" value={patientData.notes} onChange={(e) => setPatientData({ ...patientData, notes: e.target.value })} /></Grid>
          </Grid>
        );

      case 4: // GDPR consents
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Vážíme si Vašeho soukromí. Níže uvedené souhlasy jsou nezbytné pro zajištění zdravotní péče.
              Vaše údaje zpracováváme v souladu s Nařízením (EU) 2016/679 (GDPR).
            </Alert>

            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>1. Zpracování osobních údajů *</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Souhlasím se zpracováním osobních údajů (jméno, příjmení, datum narození, kontaktní údaje, rodné číslo)
                pro účely poskytování zdravotní péče, vedení zdravotnické dokumentace a komunikace související s poskytovanou péčí.
                <br /><strong>Právní základ:</strong> GDPR čl. 6(1)(a) — souhlas subjektu údajů.
                <br /><strong>Odvolání:</strong> Souhlas lze kdykoli odvolat na recepci nebo e-mailem.
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={consents.dataProcessing} onChange={(e) => setConsents({ ...consents, dataProcessing: e.target.checked })} />}
                label="Souhlasím se zpracováním osobních údajů *"
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>2. Zpracování zdravotních údajů *</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Souhlasím se zpracováním zvláštních kategorií osobních údajů (zdravotní stav, diagnózy, výsledky vyšetření,
                léčba, alergie, léky) pro účely diagnostiky, léčby a prevence.
                <br /><strong>Právní základ:</strong> GDPR čl. 9(2)(a) — výslovný souhlas.
                <br /><strong>Doba zpracování:</strong> Po dobu poskytování zdravotní péče + 10 let (dle zákona č. 372/2011 Sb.).
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={consents.healthDataProcessing} onChange={(e) => setConsents({ ...consents, healthDataProcessing: e.target.checked })} />}
                label="Souhlasím se zpracováním zdravotních údajů *"
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>3. Uchování údajů *</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Souhlasím s uchováním mých osobních a zdravotních údajů v elektronickém i fyzickém formátu
                po dobu stanovenou zákonem (min. 10 let od posledního ošetření).
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={consents.dataRetention} onChange={(e) => setConsents({ ...consents, dataRetention: e.target.checked })} />}
                label="Souhlasím s uchováním údajů *"
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>4. Marketingové sdělení</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Souhlasím s občasným zasíláním informací o nabídkách, akcích a novinkách kliniky CGM MEDISTAR.
                Tento souhlas je dobrovolný a nemá vliv na poskytování péče.
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={consents.marketingConsent} onChange={(e) => setConsents({ ...consents, marketingConsent: e.target.checked })} />}
                label="Souhlasím se zasíláním marketingových sdělení"
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>5. Sdílení s třetími stranami</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Souhlasím se sdílením mých údajů s pojišťovnou, laboratořemi a dalšími zdravotnickými zařízeními
                v rozsahu nezbytném pro poskytování zdravotní péče.
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={consents.thirdPartySharing} onChange={(e) => setConsents({ ...consents, thirdPartySharing: e.target.checked })} />}
                label="Souhlasím se sdílením s třetími stranami"
              />
            </Paper>

            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>6. Pořizování záznamů</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Souhlasím s případným pořizováním fotografických a videozáznamů pro účely dokumentace,
                telemedicíny a vzdělávání (v anonymizované podobě).
              </Typography>
              <FormControlLabel
                control={<Checkbox checked={consents.cameraConsent} onChange={(e) => setConsents({ ...consents, cameraConsent: e.target.checked })} />}
                label="Souhlasím s pořizováním záznamů"
              />
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              * Povinné souhlasy. Bez nich nelze rezervaci dokončit.
              Podrobné informace o zpracování osobních údajů najdete v naší <strong>Zásadách ochrany soukromí</strong>.
              Kontakt: privacy@medistar.cz | +420 XXX XXX XXX
            </Typography>
          </Box>
        );

      case 5: // Confirmation
        return (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Shrnutí rezervace</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}><Typography color="text.secondary">Služba:</Typography><Typography fontWeight={600}>{selectedServiceData?.name}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography color="text.secondary">Lékař:</Typography><Typography fontWeight={600}>{selectedDoctorData?.name}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography color="text.secondary">Datum:</Typography><Typography fontWeight={600}>{selectedDate}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography color="text.secondary">Čas:</Typography><Typography fontWeight={600}>{selectedTime}</Typography></Grid>
              <Grid size={{ xs: 12 }}><Divider /></Grid>
              <Grid size={{ xs: 6 }}><Typography color="text.secondary">Pacient:</Typography><Typography fontWeight={600}>{patientData.firstName} {patientData.lastName}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography color="text.secondary">Kontakt:</Typography><Typography fontWeight={600}>{patientData.email} • {patientData.phone}</Typography></Grid>
              <Grid size={{ xs: 12 }}><Divider /></Grid>
              <Grid size={{ xs: 6 }}>
                <Typography color="text.secondary">Souhlasy (GDPR):</Typography>
                <Box sx={{ mt: 1 }}>
                  {consents.dataProcessing && <Chip label="Zpracování údajů ✓" size="small" color="success" sx={{ mr: 0.5, mb: 0.5 }} />}
                  {consents.healthDataProcessing && <Chip label="Zdravotní data ✓" size="small" color="success" sx={{ mr: 0.5, mb: 0.5 }} />}
                  {consents.dataRetention && <Chip label="Uchování dat ✓" size="small" color="success" sx={{ mr: 0.5, mb: 0.5 }} />}
                  {consents.marketingConsent && <Chip label="Marketing" size="small" color="info" sx={{ mr: 0.5, mb: 0.5 }} />}
                  {consents.thirdPartySharing && <Chip label="Sdílení" size="small" color="info" sx={{ mr: 0.5, mb: 0.5 }} />}
                  {consents.cameraConsent && <Chip label="Záznamy" size="small" color="info" sx={{ mr: 0.5, mb: 0.5 }} />}
                </Box>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography color="text.secondary">Cena:</Typography>
                <Typography variant="h5" color="primary" fontWeight={700}>{selectedServiceData?.price} Kč</Typography>
              </Grid>
            </Grid>
          </Paper>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Typography variant="h3" textAlign="center" fontWeight={700} sx={{ mb: 1 }}>
          Online rezervace
        </Typography>
        <Typography variant="body1" textAlign="center" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
          Vyberte si službu, lékaře a termín. Rezervace zabere jen pár minut.
        </Typography>
      </motion.div>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        {renderStepContent(activeStep)}
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={activeStep === 0} onClick={handleBack}>
          Zpět
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={loading || !isGdprValid()}
          >
            {loading ? <CircularProgress size={24} /> : 'Potvrdit rezervaci'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleNext} disabled={!getMinStepValid(activeStep)}>
            Další
          </Button>
        )}
      </Box>
    </Container>
  );
}
