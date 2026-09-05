import { useState } from 'react';
import { Box, Typography, Paper, Grid, TextField, Button, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel, Card, CardContent, Divider, Alert, Chip } from '@mui/material';
import { Save, Add, Delete } from '@mui/icons-material';

interface ServiceCategory {
  id: string;
  name: string;
  color: string;
}

interface ServiceConfig {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  bufferBefore: number;
  bufferAfter: number;
  maxPerDay: number;
  requiresConsent: boolean;
  isActive: boolean;
}

const defaultCategories: ServiceCategory[] = [
  { id: '1', name: 'Preventivní prohlídka', color: '#4CAF50' },
  { id: '2', name: 'Diagnostika', color: '#2196F3' },
  { id: '3', name: 'Rehabilitace', color: '#FF9800' },
  { id: '4', name: 'Sportovní lékařství', color: '#9C27B0' },
];

const defaultServices: ServiceConfig[] = [
  { id: '1', name: 'Vstupní preventivní prohlídka', category: '1', duration: 30, price: 500, bufferBefore: 5, bufferAfter: 10, maxPerDay: 8, requiresConsent: true, isActive: true },
  { id: '2', name: 'Kontrolní prohlídka', category: '1', duration: 15, price: 250, bufferBefore: 5, bufferAfter: 5, maxPerDay: 16, requiresConsent: false, isActive: true },
  { id: '3', name: 'Sportovní prohlídka', category: '4', duration: 45, price: 800, bufferBefore: 10, bufferAfter: 10, maxPerDay: 6, requiresConsent: true, isActive: true },
  { id: '4', name: 'RTG vyšetření', category: '2', duration: 20, price: 400, bufferBefore: 5, bufferAfter: 10, maxPerDay: 12, requiresConsent: true, isActive: true },
  { id: '5', name: 'Rehabilitace – 1. návštěva', category: '3', duration: 60, price: 1200, bufferBefore: 10, bufferAfter: 15, maxPerDay: 5, requiresConsent: true, isActive: true },
  { id: '6', name: 'Rehabilitace – kontrola', category: '3', duration: 30, price: 600, bufferBefore: 5, bufferAfter: 10, maxPerDay: 10, requiresConsent: false, isActive: true },
];

export default function ServiceSettings() {
  const [categories, setCategories] = useState<ServiceCategory[]>(defaultCategories);
  const [services, setServices] = useState<ServiceConfig[]>(defaultServices);
  const [globalBuffer, setGlobalBuffer] = useState({ before: 5, after: 10 });
  const [cancellationPolicy, setCancellationPolicy] = useState({
    freeCancellationHours: 24,
    lateCancelFeePercent: 50,
    noShowFeePercent: 100,
    allowOnlineCancel: true,
    requireReason: false,
  });
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateService = (id: string, field: string, value: any) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addCategory = () => {
    setCategories(prev => [...prev, { id: Date.now().toString(), name: 'Nová kategorie', color: '#607D8B' }]);
  };

  const addService = () => {
    setServices(prev => [...prev, {
      id: Date.now().toString(), name: 'Nová služba', category: categories[0]?.id || '',
      duration: 30, price: 0, bufferBefore: globalBuffer.before, bufferAfter: globalBuffer.after,
      maxPerDay: 10, requiresConsent: false, isActive: true,
    }]);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Nastavení služeb</Typography>
        <Button variant="contained" startIcon={<Save />} onClick={handleSave}>Uložit</Button>
      </Box>

      {saved && <Alert severity="success" sx={{ mb: 3 }}>Nastavení uloženo</Alert>}

      {/* Categories */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Kategorie služeb</Typography>
        <Grid container spacing={2}>
          {categories.map(cat => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={cat.id}>
              <Card variant="outlined">
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: cat.color }} />
                  <TextField
                    size="small" fullWidth value={cat.name}
                    onChange={(e) => setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: e.target.value } : c))}
                  />
                  <Chip label={services.filter(s => s.category === cat.id).length + ' služeb'} size="small" />
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button variant="outlined" startIcon={<Add />} onClick={addCategory} fullWidth sx={{ height: '100%' }}>
              Přidat kategorii
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Global buffer */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Globální mezeru mezi termíny</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 6 }} sm={3}>
            <TextField fullWidth type="number" label="Před termínem (min)" value={globalBuffer.before}
              onChange={(e) => setGlobalBuffer(prev => ({ ...prev, before: parseInt(e.target.value) || 0 }))} />
          </Grid>
          <Grid size={{ xs: 6 }} sm={3}>
            <TextField fullWidth type="number" label="Po termínu (min)" value={globalBuffer.after}
              onChange={(e) => setGlobalBuffer(prev => ({ ...prev, after: parseInt(e.target.value) || 0 }))} />
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <FormControlLabel control={<Switch checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />}
              label="Automaticky potvrdit termíny" />
          </Grid>
        </Grid>
      </Paper>

      {/* Services table */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Služby ({services.length})</Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={addService}>Přidat službu</Button>
        </Box>
        {services.map(service => (
          <Card key={service.id} variant="outlined" sx={{ mb: 2, p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12 }} sm={3}>
                <TextField size="small" fullWidth label="Název" value={service.name}
                  onChange={(e) => updateService(service.id, 'name', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 6 }} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Kategorie</InputLabel>
                  <Select label="Kategorie" value={service.category}
                    onChange={(e) => updateService(service.id, 'category', e.target.value)}>
                    {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <TextField size="small" fullWidth type="number" label="Min" value={service.duration}
                  onChange={(e) => updateService(service.id, 'duration', parseInt(e.target.value) || 0)} />
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <TextField size="small" fullWidth type="number" label="Cena (Kč)" value={service.price}
                  onChange={(e) => updateService(service.id, 'price', parseInt(e.target.value) || 0)} />
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <TextField size="small" fullWidth type="number" label="Před (min)" value={service.bufferBefore}
                  onChange={(e) => updateService(service.id, 'bufferBefore', parseInt(e.target.value) || 0)} />
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <TextField size="small" fullWidth type="number" label="Po (min)" value={service.bufferAfter}
                  onChange={(e) => updateService(service.id, 'bufferAfter', parseInt(e.target.value) || 0)} />
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <TextField size="small" fullWidth type="number" label="Max/den" value={service.maxPerDay}
                  onChange={(e) => updateService(service.id, 'maxPerDay', parseInt(e.target.value) || 0)} />
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <FormControlLabel control={<Switch size="small" checked={service.isActive}
                  onChange={(e) => updateService(service.id, 'isActive', e.target.checked)} />} label="" />
              </Grid>
              <Grid size={{ xs: 6 }} sm={1}>
                <Button size="small" color="error" startIcon={<Delete />}
                  onClick={() => setServices(prev => prev.filter(s => s.id !== service.id))} />
              </Grid>
            </Grid>
          </Card>
        ))}
      </Paper>

      {/* Cancellation policy */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Storno podmínky</Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={3}>
            <TextField fullWidth type="number" label="Bezplatné zrušení (hod)" value={cancellationPolicy.freeCancellationHours}
              onChange={(e) => setCancellationPolicy(prev => ({ ...prev, freeCancellationHours: parseInt(e.target.value) || 0 }))} />
          </Grid>
          <Grid size={{ xs: 12 }} sm={3}>
            <TextField fullWidth type="number" label="Poplatek pozdní zrušení (%)" value={cancellationPolicy.lateCancelFeePercent}
              onChange={(e) => setCancellationPolicy(prev => ({ ...prev, lateCancelFeePercent: parseInt(e.target.value) || 0 }))} />
          </Grid>
          <Grid size={{ xs: 12 }} sm={3}>
            <TextField fullWidth type="number" label="Poplatek nedostavení (%)" value={cancellationPolicy.noShowFeePercent}
              onChange={(e) => setCancellationPolicy(prev => ({ ...prev, noShowFeePercent: parseInt(e.target.value) || 0 }))} />
          </Grid>
          <Grid size={{ xs: 12 }} sm={3}>
            <FormControlLabel control={<Switch checked={cancellationPolicy.allowOnlineCancel}
              onChange={(e) => setCancellationPolicy(prev => ({ ...prev, allowOnlineCancel: e.target.checked }))} />}
              label="Online zrušení" />
            <FormControlLabel control={<Switch checked={cancellationPolicy.requireReason}
              onChange={(e) => setCancellationPolicy(prev => ({ ...prev, requireReason: e.target.checked }))} />}
              label="Vyžadovat důvod" />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
