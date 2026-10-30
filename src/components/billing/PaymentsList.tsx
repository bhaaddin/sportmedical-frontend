/*
 * "Platby": the payment ledger as one calm list - when, which invoice, how,
 * how much, and its state. Money that has not arrived yet (a transfer) waits
 * here until the desk presses "Potvrdit přijetí"; a payment that came late or
 * for another amount is marked "Ke kontrole" and is confirmed or refused by a
 * person. A refund needs a reason (and `billing.refund`).
 *
 * The list arrives from `usePayments`; the page decides whether to draw this
 * at all (no endpoint yet = no tab), so nothing here has to handle "not live".
 */
import { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PAYMENTS_KEY, paymentsApi, usePayments, usePaymentsPaged, usePaymentsReconciliation } from '../../api/payments';
import type { Payment, PaymentFilter } from '../../api/payments';
import type { Invoice, InvoicePaymentMethod } from '../../api/billing';
import { toBookingError } from '../../api/apiError';
import { FilterChips } from '../ui';
import type { FilterOption } from '../ui';
import { FIT_FILL_SX, STICKY_HEAD_SX } from '../ui/fit';
import { Shelf } from '../../ui/shelf';
import { czDate, czk } from '../../pages/billing/money';
import { PAYMENT_METHOD_LABEL } from '../../pages/billing/invoiceView';
import PaymentStatusChip, { REVIEW_REASON } from './PaymentStatusChip';

type View = 'all' | 'pending' | 'paid' | 'review';

const messageOf = (error: unknown, fallback: string): string => toBookingError(error).serverMessage ?? fallback;

const methodLabel = (p: Payment): string =>
  p.method === 'Online' ? 'Online' : PAYMENT_METHOD_LABEL[p.method as InvoicePaymentMethod] ?? p.method;

/** The chip becomes a server-side filter, so older rows are never cut off by a page. */
const filterOf = (view: View): PaymentFilter =>
  view === 'pending' ? { status: 'Pending' }
    : view === 'paid' ? { status: 'Paid' }
      : view === 'review' ? { needsReview: true }
        : {};

/** "Vrátit": the amount (everything by default) and the reason, which is required. */
function RefundDialog({
  payment, busy, phone, onCancel, onConfirm,
}: {
  payment: Payment | null;
  busy: boolean;
  phone: boolean;
  onCancel: () => void;
  onConfirm: (amountCzk: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [seen, setSeen] = useState<string | null>(null);
  if (payment !== null && seen !== payment.id) {
    setSeen(payment.id);
    setAmount(String(payment.netPaidCzk));
    setReason('');
  }
  const value = Number(amount.replace(/[\s ]/g, '').replace(',', '.'));
  const max = payment?.netPaidCzk ?? 0;
  const amountOk = Number.isFinite(value) && value > 0 && value <= max;
  const valid = amountOk && reason.trim().length > 0;
  return (
    <Dialog open={payment !== null} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth fullScreen={phone}
      sx={phone ? { '& .MuiInputBase-root': { minHeight: 44 }, '& .MuiButton-root': { minHeight: 44 } } : undefined}>
      <DialogTitle>Vrátit platbu</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {payment !== null && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {methodLabel(payment)} · zaplaceno {czk(payment.netPaidCzk)}
            </Typography>
          )}
          <TextField
            label="Částka k vrácení"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amount !== '' && !amountOk}
            helperText={amount !== '' && !amountOk ? `Zadejte částku do ${czk(max)}.` : undefined}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }}
            fullWidth
          />
          <TextField
            required
            multiline
            rows={2}
            label="Důvod vrácení"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 300 } }}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>Zpět</Button>
        <Button variant="contained" color="error" disabled={!valid || busy} onClick={() => onConfirm(value, reason.trim())}>
          {busy ? 'Vracím…' : 'Vrátit platbu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function PaymentsList({
  invoices,
  phone,
  touch,
  canManage,
  canRefund,
  onChanged,
  onOpenInvoice,
}: {
  invoices: Invoice[];
  phone: boolean;
  /** Phone and iPad: every button is at least 44 px tall. */
  touch: boolean;
  canManage: boolean;
  canRefund: boolean;
  /** Something changed on the server: the invoices must be read again. */
  onChanged: () => void;
  onOpenInvoice: (invoiceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('all');
  const payments = usePaymentsPaged(filterOf(view));
  /* The chip counts come from their own one-row reads (the total), not from the loaded page. */
  const pendingTotal = usePayments({ status: 'Pending', pageSize: 1 }).data?.total ?? 0;
  const reviewTotal = usePayments({ needsReview: true, pageSize: 1 }).data?.total ?? 0;
  const reconciliation = usePaymentsReconciliation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<Payment | null>(null);

  const shown = useMemo(
    () => (payments.data?.pages ?? []).flatMap((pg) => pg?.items ?? [])
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc)),
    [payments.data],
  );
  const total = payments.data?.pages[0]?.total ?? shown.length;
  const numberOf = useMemo(() => new Map(invoices.map((i) => [i.id, i.invoiceNumber])), [invoices]);
  const reviewCount = reviewTotal;
  const pendingCount = pendingTotal;
  const drift = reconciliation.data?.drift.length ?? 0;

  const options: FilterOption<View>[] = [
    { key: 'all', label: 'Vše' },
    { key: 'pending', label: 'Čekají', ...(pendingCount > 0 ? { count: pendingCount } : {}) },
    { key: 'paid', label: 'Zaplacené' },
    { key: 'review', label: 'Ke kontrole', ...(reviewCount > 0 ? { count: reviewCount } : {}) },
  ];

  const after = async () => {
    await queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
    onChanged();
  };
  const run = async (p: Payment, work: () => Promise<unknown>, ok: string, fail: string): Promise<boolean> => {
    setBusyId(p.id);
    try {
      await work();
      toast.success(ok);
      await after();
      return true;
    } catch (error) {
      toast.error(messageOf(error, fail));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const size = touch ? 'medium' : 'small';
  const btn = touch ? { minHeight: 44 } : {};
  const actions = (p: Payment) => {
    const busy = busyId === p.id;
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: phone ? 'stretch' : 'flex-end' }}>
        {canManage && (p.status === 'Pending' || p.needsReview) && (
          <Button size={size} variant="contained" disabled={busy} sx={{ ...btn, flex: phone ? '1 1 auto' : undefined }}
            aria-label={`Potvrdit přijetí ${czk(p.amountCzk)}`}
            onClick={() => void run(p, () => paymentsApi.confirm(p.id), 'Platba potvrzena', 'Platbu se nepodařilo potvrdit')}>
            Potvrdit přijetí
          </Button>
        )}
        {canManage && p.status === 'Pending' && (
          <Button size={size} variant="outlined" disabled={busy} sx={{ ...btn, flex: phone ? '1 1 auto' : undefined }}
            aria-label={`Zrušit platbu ${czk(p.amountCzk)}`}
            onClick={() => void run(p, () => paymentsApi.cancel(p.id), 'Platba zrušena', 'Platbu se nepodařilo zrušit')}>
            Zrušit
          </Button>
        )}
        {canRefund && p.status === 'Paid' && p.netPaidCzk > 0 && (
          <Button size={size} variant="outlined" color="error" disabled={busy} sx={{ ...btn, flex: phone ? '1 1 auto' : undefined }}
            aria-label={`Vrátit platbu ${czk(p.amountCzk)}`} onClick={() => setRefunding(p)}>
            Vrátit
          </Button>
        )}
      </Box>
    );
  };

  const invoiceCell = (p: Payment) => {
    const number = p.invoiceId ? numberOf.get(p.invoiceId) : undefined;
    if (!p.invoiceId) return p.appointmentId ? 'Návštěva' : '—';
    return number ? (
      <Button size="small" variant="text" sx={{ px: 0.5, minWidth: 0, ...(touch ? { minHeight: 44 } : {}) }}
        onClick={() => onOpenInvoice(p.invoiceId as string)}>
        {number}
      </Button>
    ) : 'Doklad';
  };

  const note = (p: Payment) => (p.needsReview && p.reviewReason ? REVIEW_REASON[p.reviewReason] : null);
  const when = (p: Payment) => czDate(p.paidAtUtc ?? p.createdAtUtc);
  const empty = view === 'all' ? 'Zatím žádné platby.' : 'V tomto výběru nejsou žádné platby.';

  const moreRow = payments.hasNextPage ? (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.5, flexShrink: 0 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zobrazeno {shown.length} z {total}</Typography>
      <Button variant="outlined" size={size} sx={btn} disabled={payments.isFetchingNextPage} onClick={() => void payments.fetchNextPage()}>
        {payments.isFetchingNextPage ? 'Načítám…' : 'Zobrazit další'}
      </Button>
    </Box>
  ) : null;
  const failed = payments.isError && shown.length === 0 ? (
    <Typography role="status" variant="body2" sx={{ color: 'warning.main', mb: 1.5 }}>Platby se nepodařilo načíst. Zkuste to za chvíli.</Typography>
  ) : null;

  return (
    <Shelf
      id="payments"
      title="Platby"
      count={payments.isSuccess ? total : undefined}
      layout="free"
      grow
      loading={payments.isLoading}
      controls={<FilterChips options={options} value={view} onChange={setView} ariaLabel="Filtr plateb" />}
    >
      {drift > 0 && (
        <Typography role="status" variant="body2" sx={{ color: 'warning.main', mb: 1.5, flexShrink: 0 }}>
          U {drift} {drift === 1 ? 'dokladu' : 'dokladů'} se součet plateb liší od dokladu. Zkontrolujte je.
        </Typography>
      )}
      {failed}
      {phone ? (
        <Stack spacing={1.5}>
          {shown.length === 0 && <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>{empty}</Typography>}
          {shown.map((p) => (
            <Paper key={p.id} variant="outlined" sx={{ p: 2, display: 'grid', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline' }}>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{czk(p.amountCzk)}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{when(p)}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {methodLabel(p)}{p.variableSymbol ? ` · VS ${p.variableSymbol}` : ''}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <PaymentStatusChip payment={p} />
                {invoiceCell(p)}
              </Box>
              {note(p) && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{note(p)}</Typography>}
              {actions(p)}
            </Paper>
          ))}
          {moreRow}
        </Stack>
      ) : (
        <Paper variant="outlined" sx={{ overflow: 'hidden', ...FIT_FILL_SX, display: 'flex', flexDirection: 'column' }}>
          <Box sx={[{ overflow: 'auto', overscrollBehavior: 'contain', ...FIT_FILL_SX }, STICKY_HEAD_SX]}>
            <Table size="small" aria-label="Platby">
              <TableHead>
                <TableRow>
                  <TableCell>Datum</TableCell>
                  <TableCell>Doklad</TableCell>
                  <TableCell>Způsob</TableCell>
                  <TableCell align="right">Částka</TableCell>
                  <TableCell>Stav</TableCell>
                  <TableCell align="right"><Box component="span" sx={{ position: 'absolute', left: -9999 }}>Akce</Box></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>{empty}</TableCell>
                  </TableRow>
                )}
                {shown.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{when(p)}</TableCell>
                    <TableCell>{invoiceCell(p)}</TableCell>
                    <TableCell>
                      {methodLabel(p)}
                      {p.variableSymbol && (
                        <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.75 }}>VS {p.variableSymbol}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {czk(p.amountCzk)}
                      {p.refundedAmountCzk > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>vráceno {czk(p.refundedAmountCzk)}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusChip payment={p} />
                      {note(p) && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.25 }}>{note(p)}</Typography>}
                    </TableCell>
                    <TableCell align="right">{actions(p)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          {moreRow}
        </Paper>
      )}

      <RefundDialog
        payment={refunding}
        phone={phone}
        busy={busyId !== null && busyId === refunding?.id}
        onCancel={() => setRefunding(null)}
        onConfirm={(amountCzk, reason) => {
          const target = refunding;
          if (target === null) return;
          void run(target, () => paymentsApi.refund(target.id, { amountCzk, reason }), 'Platba vrácena', 'Platbu se nepodařilo vrátit')
            .then((done) => { if (done) setRefunding(null); });
        }}
      />
    </Shelf>
  );
}
