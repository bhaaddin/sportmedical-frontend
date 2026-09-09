import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  MenuItem, IconButton, Tooltip, Skeleton, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Autocomplete,
} from '@mui/material';
import { Add, Cancel, Undo, Refresh } from '@mui/icons-material';
import { cashierApi, PaymentMethod, type CashierTransaction } from '../services/cashierApi';
import { servicesApi } from '../api/services';
import { patientsApi, type Patient } from '../api/patients';
import toast from 'react-hot-toast';

const METHOD_LABELS: Record<number, string> = {
  [PaymentMethod.Cash]: 'Hotovost',
  [PaymentMethod.Card]: 'Karta',
  [PaymentMethod.ClubBilling]: 'Na klub',
  [PaymentMethod.BankTransfer]: 'Převod',
};

const czk = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(n ?? 0);

export default function CashierPage() {
  const today = new Date().toISOString().split('T')[0];
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<CashierTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ serviceId: '', patientId: '', paymentMethod: PaymentMethod.Cash as number, discount: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t, svc] = await Promise.all([
        cashierApi.getDashboard().catch(() => null),
        cashierApi.getTransactions(today).catch(() => []),
        servicesApi.getAll().catch(() => []),
      ]);
      setStats(s);
      setTransactions(t);
      /* The picker used to be fed from the public-booking event types, a table
         with no rows: the payment dialog demands a service and could never list
         one. It reads the real service catalogue now. */
      setServices(svc);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const searchPatients = (q: string) => {
    if (q.trim().length < 2) return;
    patientsApi.search(q).then(setPatients).catch(() => {});
  };

  const handleCreate = async () => {
    const svc = services.find(s => s.id === form.serviceId);
    if (!svc || !form.patientId) {
      toast.error('Vyberte službu a pacienta');
      return;
    }
    setSaving(true);
    try {
      await cashierApi.createTransaction({
        serviceId: svc.id,
        patientId: form.patientId,
        originalPrice: Number(svc.priceCzk ?? svc.price ?? 0),
        paymentMethod: form.paymentMethod,
        discountAmount: Number(form.discount) || 0,
      });
      toast.success('Platba zaevidována');
      setDialogOpen(false);
      setForm({ serviceId: '', patientId: '', paymentMethod: PaymentMethod.Cash, discount: 0 });
      load();
    } catch {
      toast.error('Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Zrušit transakci?')) return;
    try {
      await cashierApi.cancelTransaction(id, 'Zrušeno na pokladně');
      toast.success('Transakce zrušena');
      load();
    } catch {
      toast.error('Zrušení selhalo');
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={120} sx={{ mb: 2, borderRadius: 3 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Pokladna</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={load} title="Obnovit"><Refresh /></IconButton>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
            Nová platba
          </Button>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Dnešní tržba', value: czk(stats?.todayRevenue ?? 0) },
          { label: 'Transakcí', value: stats?.transactionsCount ?? 0 },
          { label: 'Hotovost', value: stats?.cashTransactions ?? 0 },
          { label: 'Karta', value: stats?.cardTransactions ?? 0 },
        ].map(s => (
          <Grid size={{ xs: 6, md: 3 }} key={s.label}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#0D7377' }}>{s.value}</Typography>
                <Typography variant="body2" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Transactions */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Dnešní transakce</Typography>
          {transactions.length === 0 ? (
            <Alert severity="info">Zatím žádné platby.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Částka</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Platba</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{new Date(t.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{czk(t.finalPrice)}</TableCell>
                      <TableCell><Chip size="small" label={METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod} variant="outlined" /></TableCell>
                      <TableCell>
                        <Chip size="small" label={t.status}
                          color={t.status === 'Completed' ? 'success' : t.status === 'Cancelled' || t.status === 'Refunded' ? 'error' : 'warning'} />
                      </TableCell>
                      <TableCell align="right">
                        {(t.status === 'Pending' || t.status === 'Completed') && (
                          <Tooltip title="Zrušit / refundovat">
                            <IconButton size="small" color="error" onClick={() => handleCancel(t.id)}>
                              {t.status === 'Pending' ? <Cancel fontSize="small" /> : <Undo fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* New payment dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Nová platba</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField select fullWidth label="Služba" value={form.serviceId}
              onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
              {services.map(s => (
                <MenuItem key={s.id} value={s.id}>{s.name} — {czk(Number(s.priceCzk ?? 0))}</MenuItem>
              ))}
            </TextField>
            <Autocomplete
              options={patients}
              getOptionLabel={o => `${o.firstName} ${o.lastName}`}
              onInputChange={(_, v) => searchPatients(v)}
              onChange={(_, v) => setForm(f => ({ ...f, patientId: v?.id ?? '' }))}
              renderInput={params => <TextField {...params} label="Pacient (začněte psát)" />}
            />
            <TextField select fullWidth label="Způsob platby" value={form.paymentMethod}
              onChange={e => setForm(f => ({ ...f, paymentMethod: Number(e.target.value) }))}>
              {Object.entries(METHOD_LABELS).map(([v, l]) => (
                <MenuItem key={v} value={Number(v)}>{l}</MenuItem>
              ))}
            </TextField>
            <TextField fullWidth type="number" label="Sleva (CZK)" value={form.discount}
              onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.serviceId || !form.patientId}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, fontWeight: 600 }}>
            {saving ? 'Ukládání...' : 'Zaevidovat platbu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
