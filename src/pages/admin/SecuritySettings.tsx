import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Chip, Slider } from '@mui/material';
import { Save, Security, Lock, Shield } from '@mui/icons-material';

export default function SecuritySettings() {
  const [settings, setSettings] = useState({
    // 2FA
    twoFactorEnabled: false,
    twoFactorMethods: ['authenticator'],
    twoFactorRequiredForRoles: ['Admin', 'SuperAdmin'],
    // Password
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: true,
    passwordExpiryDays: 90,
    passwordHistoryCount: 5,
    // Session
    sessionTimeoutMinutes: 30,
    maxConcurrentSessions: 3,
    sessionExtendOnActivity: true,
    rememberMeDays: 30,
    // IP
    ipWhitelistEnabled: false,
    ipWhitelist: ['192.168.1.0/24'],
    ipBlacklistEnabled: false,
    ipBlacklist: [],
    // Data retention
    auditLogRetentionDays: 365,
    loginLogRetentionDays: 90,
    backupRetentionDays: 30,
    patientDataRetentionYears: 10,
    autoDeleteOldBackups: true,
    // Audit
    auditLoginEnabled: true,
    auditDataChanges: true,
    auditExportEnabled: true,
    auditViewEnabled: false,
    // Encryption
    encryptionAtRest: true,
    encryptionInTransit: true,
  });

  const [newIp, setNewIp] = useState('');
  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const addIp = () => {
    if (newIp && !settings.ipWhitelist.includes(newIp)) {
      update('ipWhitelist', [...settings.ipWhitelist, newIp]);
      setNewIp('');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Bezpečnostní nastavení</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* 2FA */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Shield color="primary" />
          <Typography variant="h6">Dvoufaktorové ověření (2FA)</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}><FormControlLabel control={<Switch checked={settings.twoFactorEnabled} onChange={(e) => update('twoFactorEnabled', e.target.checked)} />} label="Vynutit 2FA pro administrátory" /></Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>Povinné pro role:</Typography>
            {['SuperAdmin', 'Admin', 'HeadPhysician', 'Doctor', 'Nurse', 'Receptionist'].map(role => (
              <Chip key={role} label={role} size="small" sx={{ mr: 1, mb: 1 }}
                color={settings.twoFactorRequiredForRoles.includes(role) ? 'primary' : 'default'}
                onClick={() => {
                  const roles = settings.twoFactorRequiredForRoles;
                  update('twoFactorRequiredForRoles', roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role]);
                }} />
            ))}
          </Grid>
        </Grid>
      </Paper>

      {/* Password Policy */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Lock color="primary" />
          <Typography variant="h6">Zásady hesel</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Min. délka" value={settings.passwordMinLength} onChange={(e) => update('passwordMinLength', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Platnost hesla (dní)" value={settings.passwordExpiryDays} onChange={(e) => update('passwordExpiryDays', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Historie hesel" value={settings.passwordHistoryCount} onChange={(e) => update('passwordHistoryCount', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel control={<Switch checked={settings.passwordRequireUppercase} onChange={(e) => update('passwordRequireUppercase', e.target.checked)} />} label="Velká písmena" />
            <FormControlLabel control={<Switch checked={settings.passwordRequireLowercase} onChange={(e) => update('passwordRequireLowercase', e.target.checked)} />} label="Malá písmena" />
            <FormControlLabel control={<Switch checked={settings.passwordRequireNumber} onChange={(e) => update('passwordRequireNumber', e.target.checked)} />} label="Číslice" />
            <FormControlLabel control={<Switch checked={settings.passwordRequireSpecial} onChange={(e) => update('passwordRequireSpecial', e.target.checked)} />} label="Speciální znaky" />
          </Grid>
        </Grid>
      </Paper>

      {/* Session */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Správa relací</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Timeout (min)" value={settings.sessionTimeoutMinutes} onChange={(e) => update('sessionTimeoutMinutes', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Max relací" value={settings.maxConcurrentSessions} onChange={(e) => update('maxConcurrentSessions', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Zapamatovat (dní)" value={settings.rememberMeDays} onChange={(e) => update('rememberMeDays', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.sessionExtendOnActivity} onChange={(e) => update('sessionExtendOnActivity', e.target.checked)} />} label="Prodloužit aktivitou" /></Grid>
        </Grid>
      </Paper>

      {/* IP Whitelist */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>IP whitelist / blacklist</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }}><FormControlLabel control={<Switch checked={settings.ipWhitelistEnabled} onChange={(e) => update('ipWhitelistEnabled', e.target.checked)} />} label="Whitelist zapnuto" /></Grid>
          <Grid size={{ xs: 6 }}><FormControlLabel control={<Switch checked={settings.ipBlacklistEnabled} onChange={(e) => update('ipBlacklistEnabled', e.target.checked)} />} label="Blacklist zapnuto" /></Grid>
          {settings.ipWhitelistEnabled && (
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField size="small" label="IP adresa / rozsah" value={newIp} onChange={(e) => setNewIp(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIp()} />
                <Button variant="outlined" onClick={addIp}>Přidat</Button>
              </Box>
              {settings.ipWhitelist.map(ip => (
                <Chip key={ip} label={ip} size="small" sx={{ mr: 1, mb: 1 }}
                  onDelete={() => update('ipWhitelist', settings.ipWhitelist.filter(i => i !== ip))} />
              ))}
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Data Retention */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Retence dat</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Audit log (dní)" value={settings.auditLogRetentionDays} onChange={(e) => update('auditLogRetentionDays', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Login log (dní)" value={settings.loginLogRetentionDays} onChange={(e) => update('loginLogRetentionDays', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Zálohy (dní)" value={settings.backupRetentionDays} onChange={(e) => update('backupRetentionDays', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Data pacientů (roky)" value={settings.patientDataRetentionYears} onChange={(e) => update('patientDataRetentionYears', parseInt(e.target.value) || 0)} /></Grid>
        </Grid>
      </Paper>

      {/* Audit */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Auditování</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.auditLoginEnabled} onChange={(e) => update('auditLoginEnabled', e.target.checked)} />} label="Logovat přihlášení" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.auditDataChanges} onChange={(e) => update('auditDataChanges', e.target.checked)} />} label="Logovat změny dat" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.auditExportEnabled} onChange={(e) => update('auditExportEnabled', e.target.checked)} />} label="Logovat exporty" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.auditViewEnabled} onChange={(e) => update('auditViewEnabled', e.target.checked)} />} label="Logovat zobrazení" /></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
