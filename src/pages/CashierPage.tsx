import { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Button, Chip, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  MenuItem, IconButton, Tooltip, Skeleton, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import { Add, Cancel, Undo, Refresh, TaskAlt } from '@mui/icons-material';
import { cashierApi, PaymentMethod, type CashierTransaction } from '../services/cashierApi';
import { servicesApi } from '../api/services';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import toast from 'react-hot-toast';

/** The four the API has (`PaymentMethod`); anything else falls back to cash. */
function toPaymentMethod(value: string): PaymentMethod {
  const n = Number(value);
  return (Object.values(PaymentMethod) as number[]).includes(n)
    ? (n as PaymentMethod)
    : PaymentMethod.Cash;
}

const METHOD_LABELS: Record<number, string> = {
  [PaymentMethod.Cash]: 'Hotovost',
  [PaymentMethod.Card]: 'Karta',
  [PaymentMethod.Transfer]: 'Převod',
  [PaymentMethod.ClubBilling]: 'Na klub',
};

/**
 * The server writes the status in English; the desk reads it in Czech. It used
 * to be printed raw ("Completed", "Pending") in the middle of a Czech screen.
 */
const STATUS_LABELS: Record<string, string> = {
  Pending: 'Čeká na zaplacení',
  Completed: 'Zaplaceno',
  Cancelled: 'Zrušeno',
  Refunded: 'Vráceno',
};

const czk = (n: number) =>
  new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(n ?? 0);

export default function CashierPage() {
  const today = new Date().toISOString().split('T')[0];
  const [stats, setStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<CashierTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    serviceId: '',
    patientId: '',
    paymentMethod: PaymentMethod.Cash as PaymentMethod,
    discount: 0,
    discountReason: '',
  });
  const [saving, setSaving] = useState(false);
  /* Cancelling a completed payment is a refund and needs a reason (F-044). */
  const [reversing, setReversing] = useState<CashierTransaction | null>(null);
  const [reverseReason, setReverseReason] = useState('');

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

  const discountNeedsReason = form.discount > 0 && form.discountReason.trim() === '';

  const handleCreate = async () => {
    const svc = services.find(s => s.id === form.serviceId);
    if (!svc || !form.patientId) {
      toast.error('Vyberte službu a pacienta');
      return;
    }
    if (discountNeedsReason) {
      toast.error('Ke slevě napište důvod');
      return;
    }
    setSaving(true);
    try {
      const created = await cashierApi.createTransaction({
        serviceId: svc.id,
        patientId: form.patientId,
        originalPrice: Number(svc.priceCzk ?? svc.price ?? 0),
        paymentMethod: form.paymentMethod,
        discountAmount: Number(form.discount) || 0,
        discountReason: form.discount > 0 ? form.discountReason.trim() : undefined,
      });
      toast.success(created.status === 'Completed' ? 'Platba přijata' : 'Platba zaevidována, čeká na zaplacení');
      setDialogOpen(false);
      setForm({ serviceId: '', patientId: '', paymentMethod: PaymentMethod.Cash, discount: 0, discountReason: '' });
      setPatient(null);
      load();
    } catch {
      toast.error('Uložení selhalo');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await cashierApi.complete(id);
      toast.success('Platba přijata');
      load();
    } catch {
      toast.error('Dokončení selhalo');
    }
  };

  const handleReverse = async () => {
    if (!reversing) return;
    const reason = reverseReason.trim();
    try {
      if (reversing.status === 'Completed') {
        await cashierApi.refundTransaction(reversing.id, reason);
        toast.success('Platba vrácena');
      } else {
        await cashierApi.cancelTransaction(reversing.id, reason || 'Zrušeno na pokladně');
        toast.success('Transakce zrušena');
      }
      setReversing(null);
      setReverseReason('');
      load();
    } catch {
      toast.error(reversing.status === 'Completed' ? 'Vrácení selhalo' : 'Zrušení selhalo');
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
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            Nová platba
          </Button>
        </Box>
      </Box>

      {/* Stats: completed payments only, which is what "tržba" means. */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Dnešní tržba', value: czk(stats?.todayRevenue ?? 0) },
          { label: 'Zaplacených plateb', value: stats?.transactionsCount ?? 0 },
          { label: 'Hotovost', value: stats?.cashTransactions ?? 0 },
          { label: 'Karta', value: stats?.cardTransactions ?? 0 },
        ].map(s => (
          <Grid size={{ xs: 6, md: 3 }} key={s.label}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>{s.value}</Typography>
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
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Čas</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Částka</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Platba</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Stav</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{new Date(t.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{czk(t.finalPrice)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod} variant="outlined" />
                        {t.appointmentId ? (
                          <Tooltip title="Platba za objednaný termín">
                            <Chip size="small" label="termín" variant="outlined" sx={{ ml: 0.5 }} />
                          </Tooltip>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={STATUS_LABELS[t.status] ?? t.status}
                          color={t.status === 'Completed' ? 'success' : t.status === 'Cancelled' || t.status === 'Refunded' ? 'error' : 'warning'} />
                      </TableCell>
                      <TableCell align="right">
                        {t.status === 'Pending' && (
                          <Tooltip title="Platba přišla — dokončit">
                            <IconButton size="small" color="success" onClick={() => handleComplete(t.id)}>
                              <TaskAlt fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {(t.status === 'Pending' || t.status === 'Completed') && (
                          <Tooltip title={t.status === 'Pending' ? 'Zrušit' : 'Vrátit platbu'}>
                            <IconButton size="small" color="error" onClick={() => { setReversing(t); setReverseReason(''); }}>
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
            <PatientPicker
              value={patient}
              onChange={(next) => {
                setPatient(next);
                setForm(f => ({ ...f, patientId: next?.id ?? '' }));
              }}
            />
            {/*
              The state used to be widened to `number`, which let any integer
              through as a payment method. It is the union of the four real ones
              now, and the select's value is checked against them rather than
              cast - a select cannot produce anything else today, but nothing
              stops the next person reading this value from somewhere that can.
            */}
            <TextField select fullWidth label="Způsob platby" value={form.paymentMethod}
              helperText="Hotovost a karta se uzavřou hned; převod a platba na klub zůstanou otevřené, dokud peníze nepřijdou."
              onChange={e => setForm(f => ({ ...f, paymentMethod: toPaymentMethod(e.target.value) }))}>
              {Object.entries(METHOD_LABELS).map(([v, l]) => (
                <MenuItem key={v} value={Number(v)}>{l}</MenuItem>
              ))}
            </TextField>
            <TextField fullWidth type="number" label="Sleva (CZK)" value={form.discount}
              onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))} />
            {form.discount > 0 && (
              <TextField fullWidth label="Důvod slevy" value={form.discountReason}
                error={discountNeedsReason}
                helperText="Uloží se k platbě; bez důvodu server slevu zapíše jako „Discount“."
                onChange={e => setForm(f => ({ ...f, discountReason: e.target.value }))} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.serviceId || !form.patientId || discountNeedsReason}
            sx={{ borderRadius: 2, fontWeight: 600 }}>
            {saving ? 'Ukládání...' : 'Zaevidovat platbu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel / refund, with the reason the server asks for. */}
      <Dialog open={reversing !== null} onClose={() => setReversing(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {reversing?.status === 'Completed' ? 'Vrátit platbu' : 'Zrušit transakci'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {reversing?.status === 'Completed'
              ? 'Zaplacená platba se vrací. Napište důvod — uloží se k transakci a bez něj server vrácení odmítne.'
              : 'Otevřená transakce se zruší. Důvod je nepovinný, ale uloží se.'}
          </Typography>
          <TextField fullWidth autoFocus label="Důvod" value={reverseReason}
            onChange={e => setReverseReason(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setReversing(null)}>Zpět</Button>
          <Button variant="contained" color="error" onClick={handleReverse}
            disabled={reversing?.status === 'Completed' && reverseReason.trim() === ''}>
            {reversing?.status === 'Completed' ? 'Vrátit' : 'Zrušit transakci'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
