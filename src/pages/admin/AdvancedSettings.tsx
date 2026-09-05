import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Save, SmartToy, VideoCall, Analytics } from '@mui/icons-material';

export default function AdvancedSettings() {
  const [settings, setSettings] = useState({
    // AI
    aiEnabled: false,
    aiProvider: 'openai',
    aiModel: 'gpt-4',
    aiApiKey: '',
    aiAutoSuggestDiagnosis: false,
    aiAutoSuggestTreatment: false,
    aiRiskAssessment: false,
    // Telemedicine
    telemedicineEnabled: false,
    telemedicineProvider: 'twilio',
    telemedicineMaxDuration: 30,
    telemedicineAutoRecord: false,
    telemedicineRequireConsent: true,
    // Analytics
    analyticsEnabled: true,
    analyticsProvider: 'plausible',
    analyticsAnonymize: true,
    analyticsTrackAppointments: true,
    analyticsTrackRevenue: true,
    analyticsTrackSatisfaction: true,
    // Widget
    bookingWidgetEnabled: true,
    widgetPosition: 'bottom-right',
    widgetColor: '#1976D2',
    widgetText: 'Rezervovat termín',
    widgetGreeting: 'Dobrý den! Chcete si rezervovat termín?',
    // SEO
    metaTitle: 'CGM MEDISTAR — Centrum sportovní medicíny',
    metaDescription: 'Specializované centrum pro sportovní medicínu, preventivní prohlídky a rehabilitaci.',
    ogImage: '',
    // Cache
    cacheEnabled: true,
    cacheTtlMinutes: 5,
  });

  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Pokročilá nastavení</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* AI */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SmartToy color="primary" />
          <Typography variant="h6">AI asistent</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}><FormControlLabel control={<Switch checked={settings.aiEnabled} onChange={(e) => update('aiEnabled', e.target.checked)} />} label="AI zapnuto" /></Grid>
          {settings.aiEnabled && (
            <>
              <Grid size={{ xs: 6 }} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Poskytovatel</InputLabel>
                  <Select label="Poskytovatel" value={settings.aiProvider} onChange={(e) => update('aiProvider', e.target.value)}>
                    <MenuItem value="openai">OpenAI</MenuItem>
                    <MenuItem value="anthropic">Anthropic</MenuItem>
                    <MenuItem value="azure">Azure AI</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Model</InputLabel>
                  <Select label="Model" value={settings.aiModel} onChange={(e) => update('aiModel', e.target.value)}>
                    <MenuItem value="gpt-4">GPT-4</MenuItem>
                    <MenuItem value="gpt-4o">GPT-4o</MenuItem>
                    <MenuItem value="claude-3">Claude 3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth size="small" type="password" label="API Key" value={settings.aiApiKey} onChange={(e) => update('aiApiKey', e.target.value)} /></Grid>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel control={<Switch checked={settings.aiAutoSuggestDiagnosis} onChange={(e) => update('aiAutoSuggestDiagnosis', e.target.checked)} />} label="Auto návrh diagnózy" />
                <FormControlLabel control={<Switch checked={settings.aiAutoSuggestTreatment} onChange={(e) => update('aiAutoSuggestTreatment', e.target.checked)} />} label="Auto návrh léčby" />
                <FormControlLabel control={<Switch checked={settings.aiRiskAssessment} onChange={(e) => update('aiRiskAssessment', e.target.checked)} />} label="Hodnocení rizik" />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Telemedicine */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <VideoCall color="primary" />
          <Typography variant="h6">Telemedicína</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}><FormControlLabel control={<Switch checked={settings.telemedicineEnabled} onChange={(e) => update('telemedicineEnabled', e.target.checked)} />} label="Telemedicína zapnuta" /></Grid>
          {settings.telemedicineEnabled && (
            <>
              <Grid size={{ xs: 6 }} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Poskytovatel</InputLabel>
                  <Select label="Poskytovatel" value={settings.telemedicineProvider} onChange={(e) => update('telemedicineProvider', e.target.value)}>
                    <MenuItem value="twilio">Twilio</MenuItem>
                    <MenuItem value="zoom">Zoom</MenuItem>
                    <MenuItem value="jitsi">Jitsi</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Max délka (min)" value={settings.telemedicineMaxDuration} onChange={(e) => update('telemedicineMaxDuration', parseInt(e.target.value) || 0)} /></Grid>
              <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.telemedicineAutoRecord} onChange={(e) => update('telemedicineAutoRecord', e.target.checked)} />} label="Auto nahrávání" /></Grid>
              <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.telemedicineRequireConsent} onChange={(e) => update('telemedicineRequireConsent', e.target.checked)} />} label="Vyžadovat souhlas" /></Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Analytics */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Analytics color="primary" />
          <Typography variant="h6">Analytika</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.analyticsEnabled} onChange={(e) => update('analyticsEnabled', e.target.checked)} />} label="Analytika zapnuta" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.analyticsAnonymize} onChange={(e) => update('analyticsAnonymize', e.target.checked)} />} label="Anonymizovat" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.analyticsTrackAppointments} onChange={(e) => update('analyticsTrackAppointments', e.target.checked)} />} label="Sledovat termíny" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.analyticsTrackRevenue} onChange={(e) => update('analyticsTrackRevenue', e.target.checked)} />} label="Sledovat tržby" /></Grid>
        </Grid>
      </Paper>

      {/* Widget & SEO */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Widget a SEO</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.bookingWidgetEnabled} onChange={(e) => update('bookingWidgetEnabled', e.target.checked)} />} label="Booking widget" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Pozice</InputLabel>
              <Select label="Pozice" value={settings.widgetPosition} onChange={(e) => update('widgetPosition', e.target.value)}>
                <MenuItem value="bottom-right">Dole vpravo</MenuItem>
                <MenuItem value="bottom-left">Dole vlevo</MenuItem>
                <MenuItem value="top-right">Nahoře vpravo</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth size="small" label="Text tlačítka" value={settings.widgetText} onChange={(e) => update('widgetText', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth size="small" label="Meta titulek" value={settings.metaTitle} onChange={(e) => update('metaTitle', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth size="small" label="Meta popis" value={settings.metaDescription} onChange={(e) => update('metaDescription', e.target.value)} /></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
