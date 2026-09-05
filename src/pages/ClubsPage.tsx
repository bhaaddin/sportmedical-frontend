import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Grid, IconButton, Tooltip, Skeleton, Alert,
} from '@mui/material';
import { Add, Delete, Groups } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { clubsApi } from '../services/clubsApi';

export default function ClubsPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', ico: '', contactPerson: '', contactEmail: '', contactPhone: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const list = await clubsApi.getAll(false);
      setClubs(Array.isArray(list) ? list : []);
    } catch {
      setClubs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name.trim() || !/^\d{8}$/.test(form.ico)) {
      toast.error('Název a platné IČO (8 číslic) jsou povinné');
      return;
    }
    setSaving(true);
    try {
      await clubsApi.create(form);
      toast.success('Klub vytvořen');
      setOpen(false);
      setForm({ name: '', ico: '', contactPerson: '', contactEmail: '', contactPhone: '' });
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Deaktivovat klub ${name}?`)) return;
    try {
      await clubsApi.deactivate(id);
      toast.success('Klub deaktivován');
      load();
    } catch {
      toast.error('Akce selhala');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={60} sx={{ mb: 2, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Groups color="primary" /> Kluby
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}
          sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
          Nový klub
        </Button>
      </Box>

      {clubs.length === 0 ? (
        <Alert severity="info">Žádné kluby. Přidejte první sportovní klub.</Alert>
      ) : (
        <Card sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>IČO</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Kontakt</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clubs.map(c => (
                  <TableRow key={c.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                    <TableCell>{c.ico}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.contactPerson || '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.contactEmail || ''}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={c.isActive ? 'Aktivní' : 'Neaktivní'}
                        color={c.isActive ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="right">
                      {c.isActive && (
                        <Tooltip title="Deaktivovat">
                          <IconButton size="small" color="error" onClick={() => remove(c.id, c.name)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Nový klub</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Název klubu" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="IČO (8 číslic)" value={form.ico}
                onChange={e => setForm(f => ({ ...f, ico: e.target.value.replace(/[^0-9]/g, '').slice(0, 8) }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Kontaktní osoba" value={form.contactPerson}
                onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Email" value={form.contactEmail}
                onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Telefon" value={form.contactPhone}
                onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={save} disabled={saving}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
            Vytvořit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
