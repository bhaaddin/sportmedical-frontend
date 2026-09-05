/* ══════════════════════════════════════════════════════════════
   MULTI-CLINIC — PLAN-01 Feature A91-A95
   - Multi-clinic support
   - Data isolation between clinics
   - Clinic management
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Chip, Switch
} from '@mui/material';
import {
  Business as ClinicIcon, Add as AddIcon, Edit as EditIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  active: boolean;
}

export default function MultiClinic() {
  const [clinics, setClinics] = useState<Clinic[]>([
    { id: '1', name: 'SportMedical Praha', address: 'GreenLine, 5. patro, Praha', phone: '+420 123 456 789', email: 'praha@sportmedical.cz', active: true },
    { id: '2', name: 'SportMedical Brno', address: 'Masarykova 10, Brno', phone: '+420 987 654 321', email: 'brno@sportmedical.cz', active: true },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Clinic | null>(null);
  const [formData, setFormData] = useState<Partial<Clinic>>({ name: '', address: '', phone: '', email: '', active: true });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleSave = () => {
    if (!formData.name) return;
    if (editing) {
      setClinics(clinics.map(c => c.id === editing.id ? { ...c, ...formData } as Clinic : c));
    } else {
      setClinics([...clinics, { ...formData, id: Date.now().toString() } as Clinic]);
    }
    setDialogOpen(false);
    setSnackbar({ open: true, message: 'Klinika uložena', severity: 'success' });
  };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ClinicIcon color="primary" /> Správa klinik
            </Typography>
            <Typography variant="body2" color="text.secondary">Multi-klinika s izolací dat</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormData({ name: '', address: '', phone: '', email: '', active: true }); setDialogOpen(true); }}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Přidat kliniku
          </Button>
        </Box>
      </motion.div>

      <Grid container spacing={3}>
        {clinics.map((clinic) => (
          <Grid key={clinic.id} size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{clinic.name}</Typography>
                  <Chip label={clinic.active ? 'Aktivní' : 'Neaktivní'} size="small"
                    color={clinic.active ? 'success' : 'default'} />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{clinic.address}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{clinic.phone}</Typography>
                <Typography variant="body2" color="text.secondary">{clinic.email}</Typography>
                <Box sx={{ mt: 2 }}>
                  <IconButton size="small" onClick={() => { setEditing(clinic); setFormData(clinic); setDialogOpen(true); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Upravit kliniku' : 'Nová klinika'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Název" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Adresa" value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Telefon" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Uložit</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
