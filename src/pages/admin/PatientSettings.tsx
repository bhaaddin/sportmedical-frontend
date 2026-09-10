import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Chip, Divider } from '@mui/material';
import { Save, Person, HealthAndSafety, Description } from '@mui/icons-material';

export default function PatientSettings() {
  const [settings, setSettings] = useState({
    // Registration
    allowSelfRegistration: true,
    requireEmailVerification: true,
    requirePhoneVerification: false,
    defaultPatientRole: 'Patient',
    autoCreateAccount: true,
    // Intake form
    intakeRequireAllergies: true,
    intakeRequireMedications: true,
    intakeRequireInsurance: true,
    intakeRequireEmergencyContact: true,
    intakeRequirePhotoId: false,
    intakeCustomFields: ['sport_discipline', 'training_level', 'previous_injuries'],
    // GDPR
    gdprRequired: true,
    gdprConsentVersion: '2.1',
    gdprMarketingConsent: true,
    gdprDataRetentionYears: 10,
    gdprRightToErasure: true,
    gdprPortabilityEnabled: true,
    // Documents
    maxUploadSizeMB: 10,
    allowedFileTypes: ['pdf', 'jpg', 'png', 'docx', 'dicom'],
    requireDocumentCategory: true,
    autoTagDocuments: true,
    // Communication
    patientPortalEnabled: true,
    patientCanViewRecords: true,
    patientCanBookOnline: true,
    patientCanCancelOnline: true,
    patientCanPayOnline: true,
    patientCanMessageDoctor: true,
    // Medical history
    trackAllergies: true,
    trackMedications: true,
    trackFamilyHistory: true,
    trackVaccinations: true,
    trackLabResults: true,
    // Insurance
    insuranceAutoVerify: true,
    insuranceRequiredForBooking: false,
    defaultInsuranceProvider: '',
    // Privacy
    hidePhoneFromStaff: false,
    hideEmailFromStaff: false,
    maskRodneCisloInUI: true,
    auditPatientAccess: true,
  });

  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Nastavení pacientů</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Registration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Person color="primary" />
          <Typography variant="h6">Registrace pacientů</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.allowSelfRegistration} onChange={(e) => update('allowSelfRegistration', e.target.checked)} />} label="Samo registrace" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.requireEmailVerification} onChange={(e) => update('requireEmailVerification', e.target.checked)} />} label="Ověřit e-mail" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.requirePhoneVerification} onChange={(e) => update('requirePhoneVerification', e.target.checked)} />} label="Ověřit telefon" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.autoCreateAccount} onChange={(e) => update('autoCreateAccount', e.target.checked)} />} label="Auto vytvoření účtu" /></Grid>
        </Grid>
      </Paper>

      {/* Intake Form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Description color="primary" />
          <Typography variant="h6">Vstupní formulář</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.intakeRequireAllergies} onChange={(e) => update('intakeRequireAllergies', e.target.checked)} />} label="Alergie (povinné)" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.intakeRequireMedications} onChange={(e) => update('intakeRequireMedications', e.target.checked)} />} label="Léky (povinné)" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.intakeRequireInsurance} onChange={(e) => update('intakeRequireInsurance', e.target.checked)} />} label="Pojištění (povinné)" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.intakeRequireEmergencyContact} onChange={(e) => update('intakeRequireEmergencyContact', e.target.checked)} />} label="Kontakt (povinný)" /></Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Vlastní pole vstupního formuláře:</Typography>
            {settings.intakeCustomFields.map(field => (
              <Chip key={field} label={field} size="small" sx={{ mr: 1, mb: 1 }}
                onDelete={() => update('intakeCustomFields', settings.intakeCustomFields.filter(f => f !== field))} />
            ))}
          </Grid>
        </Grid>
      </Paper>

      {/* GDPR */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>GDPR a soukromí</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.gdprRequired} onChange={(e) => update('gdprRequired', e.target.checked)} />} label="GDPR souhlas povinný" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" label="Verze GDPR" value={settings.gdprConsentVersion} onChange={(e) => update('gdprConsentVersion', e.target.value)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Retence (roky)" value={settings.gdprDataRetentionYears} onChange={(e) => update('gdprDataRetentionYears', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.gdprMarketingConsent} onChange={(e) => update('gdprMarketingConsent', e.target.checked)} />} label="Marketing souhlas" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.gdprRightToErasure} onChange={(e) => update('gdprRightToErasure', e.target.checked)} />} label="Právo na výmaz" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.gdprPortabilityEnabled} onChange={(e) => update('gdprPortabilityEnabled', e.target.checked)} />} label="Přenositelnost dat" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.maskRodneCisloInUI} onChange={(e) => update('maskRodneCisloInUI', e.target.checked)} />} label="Maskovat rodné číslo" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.auditPatientAccess} onChange={(e) => update('auditPatientAccess', e.target.checked)} />} label="Audit přístupu k datům" /></Grid>
        </Grid>
      </Paper>

      {/* Documents */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Dokumenty</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Max velikost (MB)" value={settings.maxUploadSizeMB} onChange={(e) => update('maxUploadSizeMB', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.requireDocumentCategory} onChange={(e) => update('requireDocumentCategory', e.target.checked)} />} label="Kategorie povinná" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.autoTagDocuments} onChange={(e) => update('autoTagDocuments', e.target.checked)} />} label="Auto-označení" /></Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="body2" color="text.secondary">Povolené typy: {settings.allowedFileTypes.join(', ')}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Patient Portal */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Pacientský portál</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.patientPortalEnabled} onChange={(e) => update('patientPortalEnabled', e.target.checked)} />} label="Portál zapnut" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.patientCanViewRecords} onChange={(e) => update('patientCanViewRecords', e.target.checked)} />} label="Zobrazit záznamy" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.patientCanBookOnline} onChange={(e) => update('patientCanBookOnline', e.target.checked)} />} label="Online rezervace" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.patientCanCancelOnline} onChange={(e) => update('patientCanCancelOnline', e.target.checked)} />} label="Online zrušení" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.patientCanPayOnline} onChange={(e) => update('patientCanPayOnline', e.target.checked)} />} label="Online platba" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.patientCanMessageDoctor} onChange={(e) => update('patientCanMessageDoctor', e.target.checked)} />} label="Zprávy lékaři" /></Grid>
        </Grid>
      </Paper>

      {/* Medical History */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Lékařská anamnéza</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.trackAllergies} onChange={(e) => update('trackAllergies', e.target.checked)} />} label="Alergie" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.trackMedications} onChange={(e) => update('trackMedications', e.target.checked)} />} label="Léky" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.trackFamilyHistory} onChange={(e) => update('trackFamilyHistory', e.target.checked)} />} label="Rodinná anamnéza" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.trackVaccinations} onChange={(e) => update('trackVaccinations', e.target.checked)} />} label="Očkování" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.trackLabResults} onChange={(e) => update('trackLabResults', e.target.checked)} />} label="Výsledky lab." /></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
