/* ══════════════════════════════════════════════════════════════
   NOTIFICATION SETTINGS — PLAN-01 Feature A61-A65
   - SMS provider configuration
   - Push notification setup
   - Email notification rules
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, TextField, Switch,
  FormControlLabel, Button, Alert, Snackbar, Divider, List, ListItem,
  ListItemText
} from '@mui/material';
import {
  Notifications as NotificationsIcon, Save as SaveIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    smsEnabled: false,
    smsProvider: '',
    smsApiKey: '',
    smsFromNumber: '',
    pushEnabled: false,
    pushVapidKey: '',
    emailOnNewAppointment: true,
    emailOnCancellation: true,
    emailOnPayment: true,
    emailOnReportReady: true,
    emailReminderHours: 24,
    smsReminderHours: 2,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <NotificationsIcon color="primary" /> Nastavení notifikací
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Konfigurace SMS, Push a Email notifikací
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Uložit
          </Button>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {/* SMS Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>SMS notifikace</Typography>
              <FormControlLabel control={<Switch checked={settings.smsEnabled}
                onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })} />} label="Povolit SMS" />
              {settings.smsEnabled && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="SMS Provider" value={settings.smsProvider}
                      onChange={(e) => setSettings({ ...settings, smsProvider: e.target.value })} placeholder="Twilio, Vonage, atd." />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="API Key" value={settings.smsApiKey} type="password"
                      onChange={(e) => setSettings({ ...settings, smsApiKey: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Odesílací číslo" value={settings.smsFromNumber}
                      onChange={(e) => setSettings({ ...settings, smsFromNumber: e.target.value })} />
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Push Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Push notifikace</Typography>
              <FormControlLabel control={<Switch checked={settings.pushEnabled}
                onChange={(e) => setSettings({ ...settings, pushEnabled: e.target.checked })} />} label="Povolit Push notifikace" />
              {settings.pushEnabled && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="VAPID Key" value={settings.pushVapidKey}
                      onChange={(e) => setSettings({ ...settings, pushVapidKey: e.target.value })} />
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Email Rules */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Email pravidla</Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Oznámit při novém termínu" />
                  <Switch checked={settings.emailOnNewAppointment}
                    onChange={(e) => setSettings({ ...settings, emailOnNewAppointment: e.target.checked })} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Oznámit při zrušení" />
                  <Switch checked={settings.emailOnCancellation}
                    onChange={(e) => setSettings({ ...settings, emailOnCancellation: e.target.checked })} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Oznámit při platbě" />
                  <Switch checked={settings.emailOnPayment}
                    onChange={(e) => setSettings({ ...settings, emailOnPayment: e.target.checked })} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Oznámit při připraveném reportu" />
                  <Switch checked={settings.emailOnReportReady}
                    onChange={(e) => setSettings({ ...settings, emailOnReportReady: e.target.checked })} />
                </ListItem>
              </List>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth type="number" label="Připomínka před termínem (hodiny)"
                    value={settings.emailReminderHours}
                    onChange={(e) => setSettings({ ...settings, emailReminderHours: Number(e.target.value) })} />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField fullWidth type="number" label="SMS připomínka (hodiny)"
                    value={settings.smsReminderHours}
                    onChange={(e) => setSettings({ ...settings, smsReminderHours: Number(e.target.value) })} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity="success">Nastavení uloženo!</Alert>
      </Snackbar>
    </Box>
  );
}
