import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Skeleton, Stack,
} from '@mui/material';
import { PersonAdd } from '@mui/icons-material';
import { availabilityApi, type Availability } from '../api/availability';
import { KpiCard, PageHeader, SoftCard, StatusChip, type ChipTone } from '../components/ui';
import toast from 'react-hot-toast';

const statusConfig: Record<string, { label: string; tone: ChipTone }> = {
  Available: { label: 'K dispozici', tone: 'green' },
  Modified: { label: 'Omezený', tone: 'beige' },
  Unavailable: { label: 'Nedostupný', tone: 'red' },
  Suspended: { label: 'Vyloučen', tone: 'grey' },
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
      toast.success('Sportovec přidán');
      setForm({ patientId: '', status: 'Available', reason: '', expectedReturnDate: '' });
    } catch { toast.error('Chyba při přidávání'); }
  };

  const available = athletes.filter(a => a.status === 'Available').length;
  const unavailable = athletes.filter(a => a.status === 'Unavailable').length;
  const modified = athletes.filter(a => a.status === 'Modified').length;

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
      <PageHeader
        title="Dostupnost sportovců"
        subtitle="Kdo může trénovat a závodit"
        actions={
          <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setOpen(true)}>
            Přidat
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="K dispozici" value={available} tone="green" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Nedostupní" value={unavailable} tone={unavailable > 0 ? 'red' : 'ink'} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Omezení" value={modified} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <KpiCard label="Celkem" value={athletes.length} hint="záznamů o dostupnosti" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {athletes.map((a) => {
          const cfg = statusConfig[a.status] || statusConfig.Available;
          return (
            <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <SoftCard sx={{ height: '100%' }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.patientName || a.patientId.slice(0, 8)}
                  </Typography>
                  <StatusChip tone={cfg.tone}>{cfg.label}</StatusChip>
                </Stack>
                {a.reason && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{a.reason}</Typography>}
                {a.expectedReturnDate && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Návrat: <Box component="strong">{new Date(a.expectedReturnDate).toLocaleDateString('cs-CZ')}</Box>
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                  {new Date(a.date).toLocaleDateString('cs-CZ')} · {a.updatedBy}
                </Typography>
              </SoftCard>
            </Grid>
          );
        })}
        {athletes.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <SoftCard sx={{ textAlign: 'center', py: 6 }}>
              <Typography sx={{ fontWeight: 600 }}>Žádné záznamy o dostupnosti</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Přidejte prvního sportovce tlačítkem vpravo nahoře.</Typography>
            </SoftCard>
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
            <Grid size={{ xs: 12 }}><TextField fullWidth type="date" label="Očekávaný návrat" value={form.expectedReturnDate} onChange={e => update('expectedReturnDate', e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleAdd}>Přidat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
