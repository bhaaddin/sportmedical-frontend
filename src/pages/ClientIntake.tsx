/* ══════════════════════════════════════════════════════════════
   CLIENT INTAKE — Registration flow
   1. Service selection
   2. Pre-appointment questionnaire
   3. Required documents (medical history, GDPR, guardian)
   4. Confirmation
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Paper, Button, Grid, TextField, Stepper, Step, StepLabel,
  Checkbox, FormControlLabel, Alert, Card, CardContent, Chip, Radio, RadioGroup,
  Divider, LinearProgress, Avatar,
} from '@mui/material';
import {
  MedicalServices, Assignment, Gavel, CheckCircle, ArrowForward, ArrowBack,
  HealthAndSafety, Person, Description, Send,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const steps = [
  { label: 'Výběr služby', icon: <MedicalServices /> },
  { label: 'Dotazník', icon: <Assignment /> },
  { label: 'Dokumenty', icon: <Description /> },
  { label: 'Potvrzení', icon: <CheckCircle /> },
];

const servicePackages = [
  { id: 'basic', name: 'Základní prohlídka', price: 1500, duration: '60 min', description: 'Základní vyšetření a měření' },
  { id: 'complex', name: 'Komplexní prohlídka', price: 3500, duration: '120 min', description: 'Komplexní diagnostika s AI analýzou' },
  { id: 'sport', name: 'Sportovní diagnostika', price: 5000, duration: '150 min', description: 'VO2max, InBody, spiroergometrie' },
  { id: 'concussion', name: 'Kontrola otřesu mozku', price: 2000, duration: '90 min', description: 'SCAT6 protokol a kontrola' },
  { id: 'followup', name: 'Kontrolní návštěva', price: 800, duration: '30 min', description: 'Kontrola po léčbě' },
];

export default function ClientIntake() {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedService, setSelectedService] = useState('');
  const [questionnaire, setQuestionnaire] = useState({
    reason: '',
    symptoms: [] as string[],
    currentMedications: '',
    allergies: '',
    previousInjuries: '',
    exerciseFrequency: '',
    sportType: '',
    painLevel: 0,
    hasChronicConditions: false,
    chronicDetails: '',
    isUnder18: false,
    guardianName: '',
    guardianPhone: '',
  });
  const [documents, setDocuments] = useState({
    medicalHistory: false,
    preQuestionnaire: false,
    gdprConsent: false,
    guardianConsent: false,
  });

  const updateQuestionnaire = (field: string, value: any) =>
    setQuestionnaire(prev => ({ ...prev, [field]: value }));

  const toggleSymptom = (symptom: string) =>
    setQuestionnaire(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom],
    }));

  const canNext = () => {
    if (activeStep === 0) return !!selectedService;
    if (activeStep === 1) return questionnaire.reason.length > 0;
    if (activeStep === 2) {
      return documents.medicalHistory && documents.preQuestionnaire && documents.gdprConsent &&
        (!questionnaire.isUnder18 || documents.guardianConsent);
    }
    return true;
  };

  const handleSubmit = () => {
    toast.success('Registrace dokončena! Očekávejte potvrzovací email.');
    setActiveStep(0);
    setSelectedService('');
  };

  const isUnder18 = questionnaire.isUnder18;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <HealthAndSafety color="primary" /> Registrace klienta
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Krok {activeStep + 1} z {steps.length}
        </Typography>
      </motion.div>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map(step => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <LinearProgress variant="determinate" value={((activeStep + 1) / steps.length) * 100}
          sx={{ mt: 2, borderRadius: 1, height: 4, bgcolor: '#f0f0f0', '& .MuiLinearProgress-bar': { bgcolor: '#0D7377' } }} />
      </Paper>

      <motion.div key={activeStep} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>

        {/* Step 0: Service Selection */}
        {activeStep === 0 && (
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Vyberte služební balík</Typography>
            <Grid container spacing={2}>
              {servicePackages.map(pkg => (
                <Grid key={pkg.id} size={{ xs: 12, sm: 6 }}>
                  <Card variant="outlined" onClick={() => setSelectedService(pkg.id)}
                    sx={{
                      cursor: 'pointer', borderRadius: 2,
                      border: selectedService === pkg.id ? '2px solid #0D7377' : '1px solid #e0e0e0',
                      bgcolor: selectedService === pkg.id ? '#E0F2F1' : 'transparent',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: '#0D7377', boxShadow: '0 2px 12px rgba(13,115,119,0.15)' },
                    }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>{pkg.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{pkg.description}</Typography>
                          <Chip label={pkg.duration} size="small" sx={{ mt: 1 }} />
                        </Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0D7377' }}>
                          {pkg.price.toLocaleString('cs-CZ')} Kč
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* Step 1: Questionnaire */}
        {activeStep === 1 && (
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Před-prohlídkový dotazník</Typography>

            <TextField fullWidth required label="Důvod návštěvy" multiline rows={2} value={questionnaire.reason}
              onChange={e => updateQuestionnaire('reason', e.target.value)} sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Příznaky</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {['Bolest hlavy', 'Závratě', 'Nevolnost', 'Bolest kloubů', 'Svalová bolest', 'Dušnost', 'Únava', 'Problémy se spánkem', 'Ztráta chuti k jídlu'].map(s => (
                <Chip key={s} label={s} onClick={() => toggleSymptom(s)}
                  color={questionnaire.symptoms.includes(s) ? 'primary' : 'default'}
                  variant={questionnaire.symptoms.includes(s) ? 'filled' : 'outlined'} />
              ))}
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Aktuální léky" value={questionnaire.currentMedications}
                  onChange={e => updateQuestionnaire('currentMedications', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Alergie" value={questionnaire.allergies}
                  onChange={e => updateQuestionnaire('allergies', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Typ sportu / aktivity" value={questionnaire.sportType}
                  onChange={e => updateQuestionnaire('sportType', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Frekvence cvičení (týdně)" value={questionnaire.exerciseFrequency}
                  onChange={e => updateQuestionnaire('exerciseFrequency', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
              </Grid>
            </Grid>

            <FormControlLabel control={<Checkbox checked={questionnaire.isUnder18}
              onChange={e => updateQuestionnaire('isUnder18', e.target.checked)} />}
              label="Je mi méně než 18 let" sx={{ mt: 2 }} />
          </Paper>
        )}

        {/* Step 2: Documents */}
        {activeStep === 2 && (
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Povinné dokumenty</Typography>

            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, border: documents.medicalHistory ? '2px solid #2E7D32' : '1px solid #e0e0e0' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Checkbox checked={documents.medicalHistory}
                  onChange={e => setDocuments(prev => ({ ...prev, medicalHistory: e.target.checked }))} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>Výpis ze zdravotní dokumentace</Typography>
                  <Typography variant="body2" color="text.secondary">Povinné — pouze první návštěva</Typography>
                </Box>
                {documents.medicalHistory && <CheckCircle color="success" />}
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, border: documents.preQuestionnaire ? '2px solid #2E7D32' : '1px solid #e0e0e0' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Checkbox checked={documents.preQuestionnaire}
                  onChange={e => setDocuments(prev => ({ ...prev, preQuestionnaire: e.target.checked }))} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>Dotazník před prohlídkou</Typography>
                  <Typography variant="body2" color="text.secondary">Povinné — vyplněno v kroku 2</Typography>
                </Box>
                {documents.preQuestionnaire && <CheckCircle color="success" />}
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, border: documents.gdprConsent ? '2px solid #2E7D32' : '1px solid #e0e0e0' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Checkbox checked={documents.gdprConsent}
                  onChange={e => setDocuments(prev => ({ ...prev, gdprConsent: e.target.checked }))} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>GDPR souhlas</Typography>
                  <Typography variant="body2" color="text.secondary">Povinné — první návštěva, ochrana osobních údajů</Typography>
                </Box>
                {documents.gdprConsent && <CheckCircle color="success" />}
              </CardContent>
            </Card>

            {isUnder18 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#D32F2F' }}>
                  Zákonný zástupce (vyžaduje se pro osoby mladší 18 let)
                </Typography>
                <Card variant="outlined" sx={{ mb: 2, borderRadius: 2, border: documents.guardianConsent ? '2px solid #2E7D32' : '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Checkbox checked={documents.guardianConsent}
                        onChange={e => setDocuments(prev => ({ ...prev, guardianConsent: e.target.checked }))} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }}>Souhlas zákonného zástupce</Typography>
                        <Typography variant="body2" color="text.secondary">Povinné pro osoby mladší 18 let</Typography>
                      </Box>
                      {documents.guardianConsent && <CheckCircle color="success" />}
                    </Box>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth size="small" label="Jméno zástupce" value={questionnaire.guardianName}
                          onChange={e => updateQuestionnaire('guardianName', e.target.value)} />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField fullWidth size="small" label="Telefon zástupce" value={questionnaire.guardianPhone}
                          onChange={e => updateQuestionnaire('guardianPhone', e.target.value)} />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </>
            )}
          </Paper>
        )}

        {/* Step 3: Confirmation */}
        {activeStep === 3 && (
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Potvrzení registrace</Typography>

            <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
              Všechny údaje byly úspěšně vyplněny. Zkontrolujte a odešlete.
            </Alert>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Služba</Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {servicePackages.find(p => p.id === selectedService)?.name || '—'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Důvod návštěvy</Typography>
                    <Typography sx={{ fontWeight: 600 }}>{questionnaire.reason || '—'}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Příznaky</Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {questionnaire.symptoms.length > 0 ? questionnaire.symptoms.join(', ') : 'Žádné'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">Dokumenty</Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {[documents.medicalHistory, documents.preQuestionnaire, documents.gdprConsent]
                        .filter(Boolean).length} / 3 potvrzeno
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        )}
      </motion.div>

      {/* Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button startIcon={<ArrowBack />} disabled={activeStep === 0}
          onClick={() => setActiveStep(s => s - 1)} sx={{ borderRadius: 2, px: 3 }}>
          Zpět
        </Button>
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" endIcon={<ArrowForward />} disabled={!canNext()}
            onClick={() => setActiveStep(s => s + 1)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}>
            Další
          </Button>
        ) : (
          <Button variant="contained" startIcon={<Send />} onClick={handleSubmit}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 4, fontWeight: 600 }}>
            Odeslat registraci
          </Button>
        )}
      </Box>
    </Box>
  );
}
