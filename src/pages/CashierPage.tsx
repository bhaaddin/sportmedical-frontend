/*
 * Pokladna - the payments taken at the desk today.
 *
 * Built as shelves (docs/ui-shelf-system.md): the frame with "Nová platba" (pinned on a phone) and "Obnovit", the day's
 * figures from the cashier dashboard, and the day's transactions - a shelf that takes the height that is left and scrolls
 * inside. Each transaction names what was paid for (the price-list item) and who paid (a connected link to the patient's
 * card with a peek; the name is read from the patient's record, at most `NAMES_AT_MOST` of them, and only for somebody who
 * may open a patient). A failed read of the transactions says so; it never claims "no payments yet".
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Stack,
  MenuItem, InputAdornment,
} from '@mui/material';
import { useQueries } from '@tanstack/react-query';
import { Add, Refresh } from '@mui/icons-material';
import { cashierApi, PaymentMethod, type CashierTransaction, type DashboardStats } from '../services/cashierApi';
import { servicesApi } from '../api/services';
import type { ServiceItem } from '../api/services';
import { patientsApi } from '../api/patients';
import type { Patient } from '../api/patients';
import { usePermissions } from '../auth/usePermission';
import PatientPicker from '../components/patients/PatientPicker';
import toast from 'react-hot-toast';
import { StatusChip } from '../components/ui';
import type { ChipTone } from '../components/ui';
import { ResponsiveDataList, type DataColumn } from '../components/ui/ResponsiveDataList';
import { useDevice } from '../layout/useDevice';
import { EntityLink, MetricCard, PageFrame, Shelf, mayOpen } from '../ui/shelf';
import { FormDialog } from './sports/FormDialog';
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

/** How many patients' names the day's list reads (one request each, shared with the peek's cache). */
const NAMES_AT_MOST = 20;

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
  const mayOpenPatients = mayOpen('patient', usePermissions());

  /* Who paid: the names of today's patients, read from their records (the peek reads the same key). */
  const patientIds = useMemo(
    () => (mayOpenPatients ? [...new Set(transactions.map((t) => t.patientId).filter((id) => id !== ''))].slice(0, NAMES_AT_MOST) : []),
    [transactions, mayOpenPatients],
  );
  const patientQueries = useQueries({
    queries: patientIds.map((id) => ({
      queryKey: ['patient', id],
      queryFn: () => patientsApi.getById(id),
      staleTime: 5 * 60_000,
      retry: false,
    })),
  });
  const nameOf = new Map<string, string>();
  patientQueries.forEach((q, i) => {
    if (q.data) nameOf.set(patientIds[i], `${q.data.firstName} ${q.data.lastName}`.trim());
  });
  const serviceName = (t: CashierTransaction) => services.find((s) => s.id === t.serviceId)?.name ?? 'Položka ceníku';

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
      sx={{ color: 'error.main', ...touch, ...(fullWidth ? {} : { minWidth: 44 }) }}
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

  /* What was paid for, and who paid: a link to the patient's card (plain text for somebody who may not open it). */
  const whatCell = (t: CashierTransaction) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{serviceName(t)}</Typography>
      {t.patientId !== '' && mayOpenPatients && (
        <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
          <EntityLink entity={{ kind: 'patient', id: t.patientId, label: nameOf.get(t.patientId) || 'Karta pacienta' }} />
        </Typography>
      )}
    </Box>
  );

  const columns: DataColumn<CashierTransaction>[] =
    device === 'tablet'
      ? [
          /* The iPad keeps three columns: the time goes under what was paid for. */
          {
            key: 'what', header: 'Položka', tablet: true,
            cell: (t) => (
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{timeOf(t)}</Typography>
                {whatCell(t)}
              </Stack>
            ),
          },
          {
            key: 'amount', header: 'Částka', align: 'right', tablet: true,
            cell: (t) => <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{kc(t.finalPrice)}</Box>,
          },
          { key: 'status', header: 'Stav', tablet: true, cell: (t) => statusCell(t, true) },
        ]
      : [
          { key: 'time', header: 'Čas', tablet: true, cell: (t) => <Box sx={{ whiteSpace: 'nowrap' }}>{timeOf(t)}</Box> },
          { key: 'what', header: 'Položka', tablet: true, cell: whatCell },
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

  const shownStats = loading ? null : stats;

  return (
    <PageFrame
      fit
      title="Pokladna"
      purpose="Platby přijaté dnes na místě"
      primaryAction={{ label: 'Nová platba', icon: <Add />, onClick: () => setDialogOpen(true) }}
      actions={<Button variant="outlined" startIcon={<Refresh />} onClick={load} sx={touch}>Obnovit</Button>}
    >
      {/* The day's figures: a row that swipes on a phone, a grid from a tablet up. */}
      <Shelf
        id="today"
        title="Dnes"
        layout={device === 'phone' ? 'row' : 'grid'}
        minCardWidth={160}
        phoneWidth="min(56vw, 210px)"
        cardHeight={104}
        skeletons={4}
        loading={loading}
        stagger={false}
      >
        <MetricCard label="Dnešní tržba" value={shownStats ? shownStats.todayRevenue : '—'} format={kc} hint="všechny způsoby platby" />
        <MetricCard label="Transakcí" value={shownStats ? shownStats.transactionsCount : '—'} hint="dnes" />
        <MetricCard label="Hotově" value={shownStats ? shownStats.cashTransactions : '—'} hint="plateb v hotovosti" />
        <MetricCard label="Kartou" value={shownStats ? shownStats.cardTransactions : '—'} hint="plateb kartou" />
      </Shelf>

      <Shelf
        id="transactions"
        title="Dnešní transakce"
        count={loading || loadFailed ? undefined : transactions.length}
        layout="free"
        grow
        loading={loading}
        error={loadFailed ? 'Dnešní transakce se nepodařilo načíst.' : false}
        onRetry={load}
      >
        <ResponsiveDataList
          ariaLabel="Dnešní transakce"
          rows={transactions}
          rowKey={(t) => t.id}
          columns={columns}
          empty="Zatím žádné platby."
          fill
          renderCard={(t) => (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{kc(t.finalPrice)}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{timeOf(t)}</Typography>
              </Stack>
              {whatCell(t)}
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
      </Shelf>

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
    </PageFrame>
  );
}
