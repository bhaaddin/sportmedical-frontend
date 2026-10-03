import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Button, TextField, Stack,
  MenuItem, InputAdornment,
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
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { PinnedActionBar } from '../components/ui/PinnedActionBar';
import { useDevice } from '../layout/useDevice';
import { FormDialog } from './sports/FormDialog';
import { LoadError, PageSkeleton } from './sports/LoadStates';
import { kc } from './sports/format';
import { useTouchSx } from './sports/touch';

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

const statusOf = (t: CashierTransaction) => STATUS_VIEW[t.status] ?? { label: t.status, tone: 'grey' as ChipTone };
const timeOf = (t: CashierTransaction) =>
  new Date(t.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const cancellable = (t: CashierTransaction) => t.status === 'Pending' || t.status === 'Completed';
const cancelLabel = (t: CashierTransaction) => (t.status === 'Pending' ? 'Zrušit' : 'Refundovat');

export default function CashierPage() {
  const today = new Date().toISOString().split('T')[0];
  const device = useDevice();
  const touch = useTouchSx();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [transactions, setTransactions] = useState<CashierTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
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
    setLoadFailed(false);
    try {
      let transactionsFailed = false;
      const [s, t, svc] = await Promise.all([
        cashierApi.getDashboard().catch(() => null),
        cashierApi.getTransactions(today).catch(() => { transactionsFailed = true; return []; }),
        servicesApi.getAll().catch(() => []),
      ]);
      setStats(s);
      setTransactions(t);
      /* The picker used to be fed from the public-booking event types, a table
         with no rows: the payment dialog demands a service and could never list
         one. It reads the real service catalogue now. */
      setServices(svc);
      /* The day's transactions are the screen. If they could not be read it
         must not say "no payments yet" - that is a different claim. */
      setLoadFailed(transactionsFailed);
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

  const cancelButton = (t: CashierTransaction, fullWidth = false) => (
    <Button
      size="small"
      variant={fullWidth ? 'outlined' : 'text'}
      color={fullWidth ? 'error' : 'inherit'}
      fullWidth={fullWidth}
      sx={{ color: DESIGN.danger, ...touch, ...(fullWidth ? {} : { minWidth: 44 }) }}
      onClick={() => handleCancel(t.id)}
    >
      {cancelLabel(t)}
    </Button>
  );

  /* The tablet's three columns carry the action with the state, so a desk iPad
     can still refund; the desktop gets the board's five. */
  const statusCell = (t: CashierTransaction, withAction: boolean) => (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <StatusChip tone={statusOf(t).tone}>{statusOf(t).label}</StatusChip>
      {withAction && cancellable(t) && cancelButton(t)}
    </Stack>
  );

  const columns: DataColumn<CashierTransaction>[] =
    device === 'tablet'
      ? [
          { key: 'time', header: 'Čas', tablet: true, cell: (t) => <Box sx={{ whiteSpace: 'nowrap' }}>{timeOf(t)}</Box> },
          {
            key: 'amount', header: 'Částka', align: 'right', tablet: true,
            cell: (t) => <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{kc(t.finalPrice)}</Box>,
          },
          { key: 'status', header: 'Stav', tablet: true, cell: (t) => statusCell(t, true) },
        ]
      : [
          { key: 'time', header: 'Čas', tablet: true, cell: (t) => <Box sx={{ whiteSpace: 'nowrap' }}>{timeOf(t)}</Box> },
          {
            key: 'amount', header: 'Částka', align: 'right', tablet: true,
            cell: (t) => <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{kc(t.finalPrice)}</Box>,
          },
          { key: 'method', header: 'Platba', cell: (t) => METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod },
          { key: 'status', header: 'Stav', tablet: true, cell: (t) => statusCell(t, false) },
          {
            key: 'actions', header: 'Akce', align: 'right',
            cell: (t) => (cancellable(t) ? <Box sx={{ whiteSpace: 'nowrap' }}>{cancelButton(t)}</Box> : null),
          },
        ];

  const newButton = (
    <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} sx={touch}>
      Nová platba
    </Button>
  );

  const header = (
    <PageHeader
      title="Pokladna"
      subtitle="Platby přijaté dnes na místě"
      actions={
        <>
          <Button variant="outlined" startIcon={<Refresh />} onClick={load} sx={touch}>Obnovit</Button>
          {device !== 'phone' && newButton}
        </>
      }
    />
  );

  if (loading) {
    return (
      <Box>
        {header}
        <PageSkeleton kpis={4} rows={4} />
      </Box>
    );
  }

  return (
    <Box>
      {header}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Dnešní tržba" value={stats ? kc(stats.todayRevenue) : '—'} hint="všechny způsoby platby" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Transakcí" value={stats?.transactionsCount ?? '—'} hint="dnes" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Hotově" value={stats?.cashTransactions ?? '—'} hint="plateb v hotovosti" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard label="Kartou" value={stats?.cardTransactions ?? '—'} hint="plateb kartou" />
        </Grid>
      </Grid>

      {/* Transactions */}
      <SectionLabel>Dnešní transakce</SectionLabel>
      {loadFailed ? (
        <LoadError what="Dnešní transakce" onRetry={load} />
      ) : (
        <ResponsiveDataList
          ariaLabel="Dnešní transakce"
          rows={transactions}
          rowKey={(t) => t.id}
          columns={columns}
          empty="Zatím žádné platby."
          renderCard={(t) => (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{kc(t.finalPrice)}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{timeOf(t)}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <StatusChip tone={statusOf(t).tone}>{statusOf(t).label}</StatusChip>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}
                </Typography>
              </Stack>
              {cancellable(t) && cancelButton(t, true)}
            </Stack>
          )}
        />
      )}

      {device === 'phone' && <PinnedActionBar label="Nová platba">{newButton}</PinnedActionBar>}

      {/* New payment dialog */}
      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nová platba"
        actions={
          <>
            <Button variant="outlined" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button variant="contained" onClick={handleCreate} disabled={saving || !form.serviceId || !form.patientId}>
              {saving ? 'Ukládám…' : 'Zaevidovat platbu'}
            </Button>
          </>
        }
      >
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField select fullWidth label="Položka ceníku" value={form.serviceId}
            onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
            {services.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name} — {kc(Number(s.priceCzk ?? 0))}</MenuItem>
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
      </FormDialog>
    </Box>
  );
}
