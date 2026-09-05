import { useState } from 'react';
import { Box, Typography, Paper, Grid, Switch, FormControlLabel, TextField, Button, Alert, Card, CardContent, Slider, Select, MenuItem, FormControl, InputLabel, Divider, Chip } from '@mui/material';
import { Save, Email, Sms, Notifications, Schedule } from '@mui/icons-material';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    // Email
    emailEnabled: true,
    emailProvider: 'smtp',
    emailFrom: 'noreply@medistar.cz',
    emailReplyTo: 'recepce@medistar.cz',
    emailSignature: 'S pozdravem,\nTým CGM MEDISTAR',
    // SMS
    smsEnabled: true,
    smsProvider: 'twilio',
    smsFrom: '+420123456789',
    smsTemplate: 'Váš termín: {service} dne {date} v {time}. Zrušení: {cancelLink}',
    // Push
    pushEnabled: false,
    // Reminders
    reminder1Enabled: true,
    reminder1Hours: 48,
    reminder2Enabled: true,
    reminder2Hours: 24,
    reminder3Enabled: false,
    reminder3Hours: 2,
    reminderMethods: ['email', 'sms'],
    // Follow-up
    followUpEnabled: true,
    followUpDaysAfter: 3,
    followUpType: 'email',
    followUpTemplate: 'Děkujeme za návštěvu. Jak se cítíte? Pokud máte jakékoliv obtíže, neváhejte nás kontaktovat.',
    // Birthday
    birthdayEnabled: true,
    birthdayDaysBefore: 3,
    birthdayMessage: 'Všechno nejlepší k narozeninám! Jako dárek Vám nabízíme {discount}% slevu na vyšetření.',
    // Marketing
    marketingEnabled: false,
    marketingConsentRequired: true,
    marketingFrequency: 'monthly',
    // Quiet hours
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    quietHoursWeekend: true,
  });

  const [saved, setSaved] = useState(false);

  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Nastavení notifikací</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Email Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Email color="primary" />
          <Typography variant="h6">E-mailové notifikace</Typography>
          <FormControlLabel control={<Switch checked={settings.emailEnabled}
            onChange={(e) => update('emailEnabled', e.target.checked)} />} label="Zapnuto" />
        </Box>
        {settings.emailEnabled && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Poskytovatel</InputLabel>
                <Select label="Poskytovatel" value={settings.emailProvider}
                  onChange={(e) => update('emailProvider', e.target.value)}>
                  <MenuItem value="smtp">SMTP</MenuItem>
                  <MenuItem value="sendgrid">SendGrid</MenuItem>
                  <MenuItem value="mailgun">Mailgun</MenuItem>
                  <MenuItem value="ses">Amazon SES</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }} sm={4}>
              <TextField fullWidth size="small" label="Odesílatel" value={settings.emailFrom}
                onChange={(e) => update('emailFrom', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }} sm={4}>
              <TextField fullWidth size="small" label="Odpověď na" value={settings.emailReplyTo}
                onChange={(e) => update('emailReplyTo', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={2} size="small" label="Podpis e-mailu" value={settings.emailSignature}
                onChange={(e) => update('emailSignature', e.target.value)} />
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* SMS Settings */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Sms color="primary" />
          <Typography variant="h6">SMS notifikace</Typography>
          <FormControlLabel control={<Switch checked={settings.smsEnabled}
            onChange={(e) => update('smsEnabled', e.target.checked)} />} label="Zapnuto" />
        </Box>
        {settings.smsEnabled && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Poskytovatel</InputLabel>
                <Select label="Poskytovatel" value={settings.smsProvider}
                  onChange={(e) => update('smsProvider', e.target.value)}>
                  <MenuItem value="twilio">Twilio</MenuItem>
                  <MenuItem value="nexmo">Nexmo</MenuItem>
                  <MenuItem value="bulksms">BulkSMS</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }} sm={4}>
              <TextField fullWidth size="small" label="Číslo odesílatele" value={settings.smsFrom}
                onChange={(e) => update('smsFrom', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }} sm={4}>
              <TextField fullWidth size="small" label="Šablona SMS" value={settings.smsTemplate}
                onChange={(e) => update('smsTemplate', e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary">
                Proměnné: {'{service}'}, {'{date}'}, {'{time}'}, {'{cancelLink}'}, {'{doctor}'}
              </Typography>
            </Grid>
          </Grid>
        )}
      </Paper>

      {/* Reminders */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Schedule color="primary" />
          <Typography variant="h6">Připomínky termínů</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel control={<Switch checked={settings.reminder1Enabled}
                  onChange={(e) => update('reminder1Enabled', e.target.checked)} />} label="1. připomínka" />
                <TextField fullWidth size="small" type="number" label="Hodin před termínem"
                  value={settings.reminder1Hours} sx={{ mt: 1 }}
                  onChange={(e) => update('reminder1Hours', parseInt(e.target.value) || 0)} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel control={<Switch checked={settings.reminder2Enabled}
                  onChange={(e) => update('reminder2Enabled', e.target.checked)} />} label="2. připomínka" />
                <TextField fullWidth size="small" type="number" label="Hodin před termínem"
                  value={settings.reminder2Hours} sx={{ mt: 1 }}
                  onChange={(e) => update('reminder2Hours', parseInt(e.target.value) || 0)} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12 }} sm={4}>
            <Card variant="outlined">
              <CardContent>
                <FormControlLabel control={<Switch checked={settings.reminder3Enabled}
                  onChange={(e) => update('reminder3Enabled', e.target.checked)} />} label="3. připomínka" />
                <TextField fullWidth size="small" type="number" label="Hodin před termínem"
                  value={settings.reminder3Hours} sx={{ mt: 1 }}
                  onChange={(e) => update('reminder3Hours', parseInt(e.target.value) || 0)} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Follow-up */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Následná péče</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={4}>
            <FormControlLabel control={<Switch checked={settings.followUpEnabled}
              onChange={(e) => update('followUpEnabled', e.target.checked)} />} label="Automatická následná zpráva" />
          </Grid>
          <Grid size={{ xs: 12 }} sm={4}>
            <TextField fullWidth size="small" type="number" label="Dny po termínu"
              value={settings.followUpDaysAfter} disabled={!settings.followUpEnabled}
              onChange={(e) => update('followUpDaysAfter', parseInt(e.target.value) || 0)} />
          </Grid>
          <Grid size={{ xs: 12 }} sm={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Kanál</InputLabel>
              <Select label="Kanál" value={settings.followUpType} disabled={!settings.followUpEnabled}
                onChange={(e) => update('followUpType', e.target.value)}>
                <MenuItem value="email">E-mail</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="both">Obojí</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField fullWidth multiline rows={2} size="small" label="Text zprávy"
              value={settings.followUpTemplate} disabled={!settings.followUpEnabled}
              onChange={(e) => update('followUpTemplate', e.target.value)} />
          </Grid>
        </Grid>
      </Paper>

      {/* Quiet Hours */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Tiché hodiny</Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12 }}>
            <FormControlLabel control={<Switch checked={settings.quietHoursEnabled}
              onChange={(e) => update('quietHoursEnabled', e.target.checked)} />} label="Zapnout tiché hodiny" />
          </Grid>
          <Grid size={{ xs: 6 }} sm={3}>
            <TextField fullWidth size="small" type="time" label="Začátek" value={settings.quietHoursStart}
              InputLabelProps={{ shrink: true }} disabled={!settings.quietHoursEnabled}
              onChange={(e) => update('quietHoursStart', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 6 }} sm={3}>
            <TextField fullWidth size="small" type="time" label="Konec" value={settings.quietHoursEnd}
              InputLabelProps={{ shrink: true }} disabled={!settings.quietHoursEnabled}
              onChange={(e) => update('quietHoursEnd', e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <FormControlLabel control={<Switch checked={settings.quietHoursWeekend}
              onChange={(e) => update('quietHoursWeekend', e.target.checked)} disabled={!settings.quietHoursEnabled} />}
              label="Víkend – žádné notifikace" />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
