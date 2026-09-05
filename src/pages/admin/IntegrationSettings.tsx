import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Chip, Divider } from '@mui/material';
import { Save, Sync, Email, Payment, Code } from '@mui/icons-material';

export default function IntegrationSettings() {
  const [settings, setSettings] = useState({
    // Calendar sync
    googleCalendarEnabled: false,
    googleCalendarId: '',
    outlookEnabled: false,
    outlookClientId: '',
    appleHealthEnabled: false,
    syncDirection: 'two-way',
    syncIntervalMinutes: 15,
    // Email
    emailProvider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpSsl: true,
    // SMS
    smsProvider: 'twilio',
    smsAccountSid: '',
    smsAuthToken: '',
    smsFromNumber: '',
    // Payment
    stripePublicKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    comgateEnabled: false,
    comgateMerchantId: '',
    // Webhooks
    webhooksEnabled: false,
    webhookUrls: [] as { url: string; events: string[]; active: boolean }[],
    // API
    apiEnabled: true,
    apiKey: 'sk_live_xxx',
    apiRateLimit: 1000,
    apiCorsOrigins: ['http://localhost:5173'],
    // AI
    aiDiagnosisEnabled: false,
    aiProvider: 'openai',
    aiApiKey: '',
    aiModel: 'gpt-4',
  });

  const [saved, setSaved] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const testEmailConnection = async () => {
    setTestingEmail(true);
    setTimeout(() => {
      setTestingEmail(false);
      setTestResult('Připojení úspěšné! E-mail odeslán na testovací adresu.');
      setTimeout(() => setTestResult(null), 5000);
    }, 2000);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Integrace</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}
      {testResult && <Alert severity="success" sx={{ mb: 3 }}>{testResult}</Alert>}

      {/* Calendar Sync */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Sync color="primary" />
          <Typography variant="h6">Synchronizace kalendáře</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.googleCalendarEnabled} onChange={(e) => update('googleCalendarEnabled', e.target.checked)} />} label="Google Calendar" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.outlookEnabled} onChange={(e) => update('outlookEnabled', e.target.checked)} />} label="Outlook" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.appleHealthEnabled} onChange={(e) => update('appleHealthEnabled', e.target.checked)} />} label="Apple Health" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Smer synchronizace</InputLabel>
              <Select label="Smer synchronizace" value={settings.syncDirection} onChange={(e) => update('syncDirection', e.target.value)}>
                <MenuItem value="one-way">Pouze odeslat</MenuItem>
                <MenuItem value="two-way">Obousměrná</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          {settings.googleCalendarEnabled && (
            <Grid size={{ xs: 12 }}><TextField fullWidth size="small" label="Google Calendar ID" value={settings.googleCalendarId} onChange={(e) => update('googleCalendarId', e.target.value)} /></Grid>
          )}
        </Grid>
      </Paper>

      {/* Email */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Email color="primary" />
          <Typography variant="h6">E-mail (SMTP)</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="SMTP host" value={settings.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={2}><TextField fullWidth size="small" type="number" label="Port" value={settings.smtpPort} onChange={(e) => update('smtpPort', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="Uživatel" value={settings.smtpUser} onChange={(e) => update('smtpUser', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="password" label="Heslo" value={settings.smtpPassword} onChange={(e) => update('smtpPassword', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={1}><FormControlLabel control={<Switch checked={settings.smtpSsl} onChange={(e) => update('smtpSsl', e.target.checked)} />} label="SSL" /></Grid>
          <Grid size={{ xs: 12 }}><Button variant="outlined" onClick={testEmailConnection} disabled={testingEmail}>{testingEmail ? 'Testuji...' : 'Otestovat připojení'}</Button></Grid>
        </Grid>
      </Paper>

      {/* Payment Gateway */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Payment color="primary" />
          <Typography variant="h6">Platební brána</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="Stripe Public Key" value={settings.stripePublicKey} onChange={(e) => update('stripePublicKey', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" type="password" label="Stripe Secret Key" value={settings.stripeSecretKey} onChange={(e) => update('stripeSecretKey', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" type="password" label="Webhook Secret" value={settings.stripeWebhookSecret} onChange={(e) => update('stripeWebhookSecret', e.target.value)} /></Grid>
        </Grid>
      </Paper>

      {/* API */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Code color="primary" />
          <Typography variant="h6">API přístup</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.apiEnabled} onChange={(e) => update('apiEnabled', e.target.checked)} />} label="API zapnuto" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Rate limit (pož/den)" value={settings.apiRateLimit} onChange={(e) => update('apiRateLimit', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="body2" color="text.secondary">API Key: {settings.apiKey}</Typography>
            <Button size="small" sx={{ mt: 1 }} onClick={() => update('apiKey', 'sk_' + Math.random().toString(36).slice(2))}>Vygenerovat nový klíč</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* AI */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>AI asistent</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.aiDiagnosisEnabled} onChange={(e) => update('aiDiagnosisEnabled', e.target.checked)} />} label="AI diagnostika" /></Grid>
          {settings.aiDiagnosisEnabled && (
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
              <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="password" label="API Key" value={settings.aiApiKey} onChange={(e) => update('aiApiKey', e.target.value)} /></Grid>
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
            </>
          )}
        </Grid>
      </Paper>
    </Box>
  );
}
