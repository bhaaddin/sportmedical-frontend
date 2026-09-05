import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Alert, Card, CardContent, Select, MenuItem, FormControl, InputLabel, Avatar, Divider } from '@mui/material';
import { Save, Business, Room, LocalParking } from '@mui/icons-material';

export default function ClinicSettings() {
  const [settings, setSettings] = useState({
    // Profile
    clinicName: 'CGM MEDISTAR',
    clinicSubtitle: 'Centrum sportovní medicíny',
    phone: '+420 XXX XXX XXX',
    email: 'info@medistar.cz',
    website: 'https://medistar.cz',
    description: 'Specializované centrum pro sportovní medicínu, preventivní prohlídky a rehabilitaci.',
    // Address
    address: 'ul. Zdravotní 123',
    city: 'Praha',
    postalCode: '110 00',
    country: 'CZ',
    // Hours
    timezone: 'Europe/Prague',
    defaultOpenTime: '08:00',
    defaultCloseTime: '18:00',
    weekendEnabled: false,
    holidayEnabled: false,
    // Rooms
    rooms: [
      { id: '1', name: 'Ambulance 1', capacity: 2, equipment: ['RTG', 'EKG'] },
      { id: '2', name: 'Ambulance 2', capacity: 2, equipment: ['UZ'] },
      { id: '3', name: 'Rehabilitace', capacity: 1, equipment: ['UZ', 'Laser'] },
      { id: '4', name: 'Čekárna', capacity: 20, equipment: [] },
    ],
    // Branding
    primaryColor: '#1976D2',
    logoUrl: '',
    faviconUrl: '',
    // Access
    parkingEnabled: true,
    parkingSpaces: 20,
    wheelchairAccess: true,
    elevatorAccess: true,
    // Booking
    minBookingNoticeHours: 2,
    maxBookingDaysAhead: 30,
    allowWeekendBooking: false,
  });

  const [saved, setSaved] = useState(false);
  const update = (field: string, value: any) => setSettings(prev => ({ ...prev, [field]: value }));
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 3000); };

  const addRoom = () => {
    update('rooms', [...settings.rooms, { id: Date.now().toString(), name: 'Nová místnost', capacity: 1, equipment: [] }]);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Nastavení kliniky</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>
      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Profile */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Business color="primary" />
          <Typography variant="h6">Profil kliniky</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth size="small" label="Název kliniky" value={settings.clinicName} onChange={(e) => update('clinicName', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={6}><TextField fullWidth size="small" label="Podtitul" value={settings.clinicSubtitle} onChange={(e) => update('clinicSubtitle', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="Telefon" value={settings.phone} onChange={(e) => update('phone', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="E-mail" value={settings.email} onChange={(e) => update('email', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="Web" value={settings.website} onChange={(e) => update('website', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} size="small" label="Popis" value={settings.description} onChange={(e) => update('description', e.target.value)} /></Grid>
        </Grid>
      </Paper>

      {/* Address & Hours */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Adresa a provozní doba</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="Adresa" value={settings.address} onChange={(e) => update('address', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="Město" value={settings.city} onChange={(e) => update('city', e.target.value)} /></Grid>
          <Grid size={{ xs: 12 }} sm={4}><TextField fullWidth size="small" label="PSČ" value={settings.postalCode} onChange={(e) => update('postalCode', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="time" label="Otevírací doba" value={settings.defaultOpenTime} InputLabelProps={{ shrink: true }} onChange={(e) => update('defaultOpenTime', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="time" label="Zavírací doba" value={settings.defaultCloseTime} InputLabelProps={{ shrink: true }} onChange={(e) => update('defaultCloseTime', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.weekendEnabled} onChange={(e) => update('weekendEnabled', e.target.checked)} />} label="Víkend" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.holidayEnabled} onChange={(e) => update('holidayEnabled', e.target.checked)} />} label="Svátky" /></Grid>
        </Grid>
      </Paper>

      {/* Rooms */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Místnosti</Typography>
          <Button variant="outlined" onClick={addRoom}>Přidat místnost</Button>
        </Box>
        {settings.rooms.map(room => (
          <Card key={room.id} variant="outlined" sx={{ mb: 1, p: 2 }}>
            <Grid container spacing={1} alignItems="center">
              <Grid size={{ xs: 12 }} sm={3}><TextField size="small" fullWidth label="Název" value={room.name} onChange={(e) => {
                update('rooms', settings.rooms.map(r => r.id === room.id ? { ...r, name: e.target.value } : r));
              }} /></Grid>
              <Grid size={{ xs: 6 }} sm={2}><TextField size="small" fullWidth type="number" label="Kapacita" value={room.capacity} onChange={(e) => {
                update('rooms', settings.rooms.map(r => r.id === room.id ? { ...r, capacity: parseInt(e.target.value) || 1 } : r));
              }} /></Grid>
              <Grid size={{ xs: 6 }} sm={7}>
                <Typography variant="body2" color="text.secondary">Vybavení: {room.equipment.join(', ') || '—'}</Typography>
              </Grid>
            </Grid>
          </Card>
        ))}
      </Paper>

      {/* Access & Booking */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Přístup a rezervace</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.parkingEnabled} onChange={(e) => update('parkingEnabled', e.target.checked)} />} label="Parkoviště" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Míst" value={settings.parkingSpaces} onChange={(e) => update('parkingSpaces', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.wheelchairAccess} onChange={(e) => update('wheelchairAccess', e.target.checked)} />} label="Bezbariérový" /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.elevatorAccess} onChange={(e) => update('elevatorAccess', e.target.checked)} />} label="Výtah" /></Grid>
          <Divider sx={{ width: '100%', my: 1 }} />
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Min. před termínem (h)" value={settings.minBookingNoticeHours} onChange={(e) => update('minBookingNoticeHours', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="number" label="Max dní dopředu" value={settings.maxBookingDaysAhead} onChange={(e) => update('maxBookingDaysAhead', parseInt(e.target.value) || 0)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><FormControlLabel control={<Switch checked={settings.allowWeekendBooking} onChange={(e) => update('allowWeekendBooking', e.target.checked)} />} label="Víkendová rezervace" /></Grid>
        </Grid>
      </Paper>

      {/* Branding */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>Značka</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" type="color" label="Primární barva" value={settings.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="Logo URL" value={settings.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }} sm={3}><TextField fullWidth size="small" label="Favicon URL" value={settings.faviconUrl} onChange={(e) => update('faviconUrl', e.target.value)} /></Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
