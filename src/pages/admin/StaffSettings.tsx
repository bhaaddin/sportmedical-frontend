import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Chip, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material';
import { Save, Add, Delete } from '@mui/icons-material';

interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface LeavePolicy {
  id: string;
  name: string;
  daysPerYear: number;
  paid: boolean;
  requiresApproval: boolean;
  maxConsecutiveDays: number;
}

export default function StaffSettings() {
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([
    { id: '1', name: 'Ranní směna', startTime: '06:00', endTime: '14:00', breakMinutes: 30 },
    { id: '2', name: 'Odpolední směna', startTime: '14:00', endTime: '22:00', breakMinutes: 30 },
    { id: '3', name: 'Plný úvazek', startTime: '08:00', endTime: '16:00', breakMinutes: 60 },
  ]);
  const [leavePolicies, setLeavePolicies] = useState<LeavePolicy[]>([
    { id: '1', name: 'Dovolená', daysPerYear: 25, paid: true, requiresApproval: true, maxConsecutiveDays: 14 },
    { id: '2', name: 'Nemocenská', daysPerYear: 0, paid: true, requiresApproval: false, maxConsecutiveDays: 0 },
    { id: '3', name: 'Osobní volno', daysPerYear: 3, paid: true, requiresApproval: true, maxConsecutiveDays: 3 },
    { id: '4', name: 'Neplacené volno', daysPerYear: 0, paid: false, requiresApproval: true, maxConsecutiveDays: 30 },
  ]);
  const [settings, setSettings] = useState({
    overtimeEnabled: true,
    overtimeMultiplier: 1.5,
    overtimeMaxHoursPerMonth: 40,
    overtimeRequiresApproval: true,
    maxHoursPerDay: 12,
    maxHoursPerWeek: 48,
    minRestHoursBetweenShifts: 11,
    autoScheduleEnabled: false,
    certificationReminderMonths: 3,
    performanceReviewFrequency: 'quarterly',
  });
  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const addShift = () => {
    setShiftTemplates(prev => [...prev, { id: Date.now().toString(), name: 'Nová směna', startTime: '08:00', endTime: '16:00', breakMinutes: 30 }]);
  };
  const addLeave = () => {
    setLeavePolicies(prev => [...prev, { id: Date.now().toString(), name: 'Nový typ', daysPerYear: 0, paid: false, requiresApproval: true, maxConsecutiveDays: 0 }]);
  };
  const updateShift = (id: string, field: string, value: any) => {
    setShiftTemplates(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  const updateLeave = (id: string, field: string, value: any) => {
    setLeavePolicies(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Nastavení zaměstnanců</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Shift Templates */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Šablony směn</Typography>
          <Button startIcon={<Add />} onClick={addShift}>Přidat směnu</Button>
        </Box>
        {shiftTemplates.map(shift => (
          <Card key={shift.id} variant="outlined" sx={{ mb: 1, p: 2 }}>
            <Grid container spacing={1} alignItems="center">
              <Grid size={{ xs: 12, sm: 3 }}><TextField size="small" fullWidth label="Název" value={shift.name} onChange={(e) => updateShift(shift.id, 'name', e.target.value)} /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><TextField size="small" fullWidth type="time" label="Začátek" value={shift.startTime} InputLabelProps={{ shrink: true }} onChange={(e) => updateShift(shift.id, 'startTime', e.target.value)} /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><TextField size="small" fullWidth type="time" label="Konec" value={shift.endTime} InputLabelProps={{ shrink: true }} onChange={(e) => updateShift(shift.id, 'endTime', e.target.value)} /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><TextField size="small" fullWidth type="number" label="Pauza (min)" value={shift.breakMinutes} onChange={(e) => updateShift(shift.id, 'breakMinutes', parseInt(e.target.value) || 0)} /></Grid>
              <Grid size={{ xs: 6, sm: 3 }}><Button color="error" startIcon={<Delete />} onClick={() => setShiftTemplates(prev => prev.filter(s => s.id !== shift.id))}>Smazat</Button></Grid>
            </Grid>
          </Card>
        ))}
      </Paper>

      {/* Leave Policies */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Typy dovolených</Typography>
          <Button startIcon={<Add />} onClick={addLeave}>Přidat typ</Button>
        </Box>
        {leavePolicies.map(leave => (
          <Card key={leave.id} variant="outlined" sx={{ mb: 1, p: 2 }}>
            <Grid container spacing={1} alignItems="center">
              <Grid size={{ xs: 12, sm: 2 }}><TextField size="small" fullWidth label="Název" value={leave.name} onChange={(e) => updateLeave(leave.id, 'name', e.target.value)} /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><TextField size="small" fullWidth type="number" label="Dní/rok" value={leave.daysPerYear} onChange={(e) => updateLeave(leave.id, 'daysPerYear', parseInt(e.target.value) || 0)} /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><TextField size="small" fullWidth type="number" label="Max po dnů" value={leave.maxConsecutiveDays} onChange={(e) => updateLeave(leave.id, 'maxConsecutiveDays', parseInt(e.target.value) || 0)} /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><FormControlLabel control={<Switch size="small" checked={leave.paid} onChange={(e) => updateLeave(leave.id, 'paid', e.target.checked)} />} label="Placená" /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><FormControlLabel control={<Switch size="small" checked={leave.requiresApproval} onChange={(e) => updateLeave(leave.id, 'requiresApproval', e.target.checked)} />} label="Schválení" /></Grid>
              <Grid size={{ xs: 6, sm: 2 }}><Button color="error" startIcon={<Delete />} onClick={() => setLeavePolicies(prev => prev.filter(l => l.id !== leave.id))}>Smazat</Button></Grid>
            </Grid>
          </Card>
        ))}
      </Paper>

      {/* Overtime & Work Limits */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Přesčasy a pracovní limity</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.overtimeEnabled} onChange={(e) => update('overtimeEnabled', e.target.checked)} />} label="Přesčasy povoleny" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Násobek přesčasů" value={settings.overtimeMultiplier} onChange={(e) => update('overtimeMultiplier', parseFloat(e.target.value) || 1)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Max přesčas/měsíc (h)" value={settings.overtimeMaxHoursPerMonth} onChange={(e) => update('overtimeMaxHoursPerMonth', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.overtimeRequiresApproval} onChange={(e) => update('overtimeRequiresApproval', e.target.checked)} />} label="Schválení přesčasů" /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Max hodin/den" value={settings.maxHoursPerDay} onChange={(e) => update('maxHoursPerDay', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Max hodin/týden" value={settings.maxHoursPerWeek} onChange={(e) => update('maxHoursPerWeek', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField fullWidth size="small" type="number" label="Min odpočinek (h)" value={settings.minRestHoursBetweenShifts} onChange={(e) => update('minRestHoursBetweenShifts', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><FormControlLabel control={<Switch checked={settings.autoScheduleEnabled} onChange={(e) => update('autoScheduleEnabled', e.target.checked)} />} label="Auto-generování směn" /></Grid>
        </Grid>
      </Paper>

      {/* Certifications */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Certifikace a hodnocení</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4 }}><TextField fullWidth size="small" type="number" label="Připomínka certifikace (měsíce)" value={settings.certificationReminderMonths} onChange={(e) => update('certificationReminderMonths', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>K hodnocení</InputLabel>
              <Select label="K hodnocení" value={settings.performanceReviewFrequency} onChange={(e) => update('performanceReviewFrequency', e.target.value)}>
                <MenuItem value="monthly">Měsíčně</MenuItem>
                <MenuItem value="quarterly">Čtvrtletně</MenuItem>
                <MenuItem value="semiannually">Pololetně</MenuItem>
                <MenuItem value="annually">Ročně</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
