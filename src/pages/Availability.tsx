import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Skeleton,
} from '@mui/material';
import { PersonAdd, CheckCircle, Cancel, Pause, EventBusy } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { availabilityApi, type Availability } from '../api/availability';
import toast from 'react-hot-toast';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  Available: { label: 'K dispozici', color: '#2E7D32', icon: <CheckCircle /> },
  Modified: { label: 'Omezený', color: '#ED6C02', icon: <Pause /> },
  Unavailable: { label: 'Nedostupný', color: '#D32F2F', icon: <Cancel /> },
  Suspended: { label: 'Vyloučen', color: '#9C27B0', icon: <EventBusy /> },
};

export default function Availability() {
  const [athletes, setAthletes] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patientId: '', status: 'Available', reason: '', expectedReturnDate: '' });
  const update = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  useEffect(() => {
    availabilityApi.getAll()
      .then(setAthletes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.patientId) { toast.error('Zadejte ID pacienta'); return; }
    try {
      const newAvail = await availabilityApi.create({
        patientId: form.patientId,
        status: form.status,
        reason: form.reason,
        expectedReturnDate: form.expectedReturnDate || undefined,
        updatedBy: 'System',
      });
      setAthletes(p => [newAvail, ...p]);
      setOpen(false);
      toast.success('Sportovce přidán');
      setForm({ patientId: '', status: 'Available', reason: '', expectedReturnDate: '' });
    } catch { toast.error('Chyba při přidávání'); }
  };

  const available = athletes.filter(a => a.status === 'Available').length;
  const unavailable = athletes.filter(a => a.status === 'Unavailable').length;

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={40} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonAdd color="primary" /> Dostupnost sportovců
            </Typography>
            <Typography variant="body2" color="text.secondary">Kdo může trénovat a závodit</Typography>
          </Box>
          <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2 }}>Přidat</Button>
        </Box>
      </motion.div>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#2E7D32' }}>{available}</Typography>
            <Typography variant="body2" color="text.secondary">K dispozici</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#D32F2F' }}>{unavailable}</Typography>
            <Typography variant="body2" color="text.secondary">Nedostupní</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#ED6C02' }}>{athletes.filter(a => a.status === 'Modified').length}</Typography>
            <Typography variant="body2" color="text.secondary">Omezení</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card><CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>{athletes.length}</Typography>
            <Typography variant="body2" color="text.secondary">Celkem</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {athletes.map((a, i) => {
          const cfg = statusConfig[a.status] || statusConfig.Available;
          return (
            <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{a.patientName || a.patientId.slice(0, 8)}</Typography>
                      <Chip icon={cfg.icon} label={cfg.label} size="small" sx={{ bgcolor: `${cfg.color}18`, color: cfg.color }} />
                    </Box>
                    {a.reason && <Typography variant="body2" color="text.secondary">{a.reason}</Typography>}
                    {a.expectedReturnDate && (
                      <Typography variant="caption" color="text.secondary">
                        Návrat: {new Date(a.expectedReturnDate).toLocaleDateString('cs-CZ')}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {new Date(a.date).toLocaleDateString('cs-CZ')} • {a.updatedBy}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          );
        })}
        {athletes.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ textAlign: 'center', py: 6 }}>
              <PersonAdd sx={{ fontSize: 48, color: '#ccc', mb: 1 }} />
              <Typography color="text.secondary">Žádné záznamy o dostupnosti</Typography>
            </Card>
          </Grid>
        )}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Přidat sportovce</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="ID pacienta" value={form.patientId} onChange={e => update('patientId', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth select label="Stav" value={form.status} onChange={e => update('status', e.target.value)}>
                <MenuItem value="Available">K dispozici</MenuItem>
                <MenuItem value="Modified">Omezený</MenuItem>
                <MenuItem value="Unavailable">Nedostupný</MenuItem>
                <MenuItem value="Suspended">Vyloučen</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth label="Důvod" value={form.reason} onChange={e => update('reason', e.target.value)} /></Grid>
            <Grid size={{ xs: 12 }}><TextField fullWidth type="date" label="Očekávaný návrat" value={form.expectedReturnDate} onChange={e => update('expectedReturnDate', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleAdd} sx={{ bgcolor: '#0D7377' }}>Přidat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
