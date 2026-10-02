import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Button, TextField, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  MenuItem, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
} from '@mui/material';
import { Add, Refresh } from '@mui/icons-material';
import { cashierApi, PaymentMethod, type CashierTransaction, type DashboardStats } from '../services/cashierApi';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';
import type { Patient } from '../api/patients';
import PatientPicker from '../components/patients/PatientPicker';
import toast from 'react-hot-toast';
import { PageHeader, KpiCard, StatusChip, SectionLabel, DESIGN } from '../components/ui';
import type { ChipTone } from '../components/ui';
import { czk } from './billing/money';

/** The four the API has (4.x `PaymentMethod`); anything else falls back to cash. */
function toPaymentMethod(value: string): PaymentMethod {
  const n = Number(value);
  return (Object.values(PaymentMethod) as number[]).includes(n)
    ? (n as PaymentMethod)
    : PaymentMethod.Cash;
}

const METHOD_LABELS: Record<number, string> = {
  [PaymentMethod.Cash]: 'Hotovost',
  [PaymentMethod.Card]: 'Karta',
  [PaymentMethod.ClubBilling]: 'Na klub',
  [PaymentMethod.BankTransfer]: 'Převod',
};

/* The server's transaction states, in the desk's words. An unknown one is
   shown as it came, so nothing is hidden. */
const STATUS_VIEW: Record<string, { label: string; tone: ChipTone }> = {
  Completed: { label: 'Zaplaceno', tone: 'green' },
  Pending: { label: 'Čeká', tone: 'beige' },
  Cancelled: { label: 'Zrušeno', tone: 'grey' },
  Refunded: { label: 'Vráceno', tone: 'red' },
};

export default function CashierPage() {
  const today = new Date().toISOString().split('T')[0];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<CashierTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    serviceId: '',
    patientId: '',
    paymentMethod: PaymentMethod.Cash as PaymentMethod,
    discount: 0,
  });
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

  const handleCreate = async () => {
    const svc = services.find(s => s.id === form.serviceId);
    if (!svc || !form.patientId) {
      toast.error('Vyberte položku ceníku a pacienta');
      return;
    }
    setSaving(true);
    try {
      await cashierApi.createTransaction({
        serviceId: svc.id,
        patientId: form.patientId,
        originalPrice: Number(svc.priceCzk ?? 0),
        paymentMethod: form.paymentMethod,
        discountAmount: Number(form.discount) || 0,
      });
      toast.success('Platba zaevidována');
      setDialogOpen(false);
      setForm({ serviceId: '', patientId: '', paymentMethod: PaymentMethod.Cash, discount: 0 });
      setPatient(null);
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

  const header = (
    <PageHeader
      title="Pokladna"
      subtitle="Platby přijaté dnes na místě"
      actions={
        <>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load}>Obnovit</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>
            Nová platba
          </Button>
        </>
      }
    />
  );

  if (loading) {
    return (
      <Box>
        {header}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rounded" height={96} /></Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  return (
    <Box>
      {header}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Dnešní tržba" value={czk(stats?.todayRevenue ?? 0)} hint="všechny způsoby platby" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Transakcí" value={stats?.transactionsCount ?? 0} hint="dnes" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Hotově" value={stats?.cashTransactions ?? 0} hint="plateb v hotovosti" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard label="Kartou" value={stats?.cardTransactions ?? 0} hint="plateb kartou" />
        </Grid>
      </Grid>

      {/* Transactions */}
      <SectionLabel>Dnešní transakce</SectionLabel>
      <TableContainer component={Paper} sx={{ overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Čas</TableCell>
              <TableCell align="right">Částka</TableCell>
              <TableCell>Platba</TableCell>
              <TableCell>Stav</TableCell>
              <TableCell align="right">Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map(t => {
              const st = STATUS_VIEW[t.status] ?? { label: t.status, tone: 'grey' as ChipTone };
              return (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(t.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {czk(t.finalPrice)}
                  </TableCell>
                  <TableCell>{METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}</TableCell>
                  <TableCell><StatusChip tone={st.tone}>{st.label}</StatusChip></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {(t.status === 'Pending' || t.status === 'Completed') && (
                      <Button size="small" variant="text" sx={{ color: DESIGN.danger }} onClick={() => handleCancel(t.id)}>
                        {t.status === 'Pending' ? 'Zrušit' : 'Refundovat'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary' }}>Zatím žádné platby.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New payment dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nová platba</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField select fullWidth label="Položka ceníku" value={form.serviceId}
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
              onChange={e => setForm(f => ({ ...f, paymentMethod: toPaymentMethod(e.target.value) }))}>
              {Object.entries(METHOD_LABELS).map(([v, l]) => (
                <MenuItem key={v} value={Number(v)}>{l}</MenuItem>
              ))}
            </TextField>
            <TextField fullWidth type="number" label="Sleva" value={form.discount}
              onChange={e => setForm(f => ({ ...f, discount: Number(e.target.value) }))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving || !form.serviceId || !form.patientId}>
            {saving ? 'Ukládám…' : 'Zaevidovat platbu'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
