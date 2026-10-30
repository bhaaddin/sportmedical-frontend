/*
 * "Přijmout platbu": the amount (what is left by default), how it was paid
 * (Hotově / Kartou / Převodem / Na klub) and a note. Money taken at the desk is
 * recorded at once. For a transfer the desk can also show the QR Platba of the
 * invoice (when the server offers it) - the money then arrives later and is
 * confirmed in Platby.
 *
 * One Idempotency-Key per opened dialog: a double click or a retry after a
 * dropped answer never records the same money twice.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem,
  Stack, TextField, Typography,
} from '@mui/material';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import type { Invoice, InvoicePaymentMethod } from '../../api/billing';
import { paymentsApi } from '../../api/payments';
import type { PaymentQr } from '../../api/payments';
import { toBookingError } from '../../api/apiError';
import { czk } from '../../pages/billing/money';
import { PAYMENT_METHOD_LABEL, customerOf, isClub } from '../../pages/billing/invoiceView';
import PaymentQrPanel from './PaymentQrPanel';

const PAYMENT_METHODS: { value: InvoicePaymentMethod; label: string }[] = (
  Object.keys(PAYMENT_METHOD_LABEL) as InvoicePaymentMethod[]
).map((value) => ({ value, label: PAYMENT_METHOD_LABEL[value] }));

const messageOf = (error: unknown, fallback: string): string => toBookingError(error).serverMessage ?? fallback;

const newKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `pay-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function PayDialog({
  invoice,
  phone,
  qrAvailable,
  onClose,
  onRecorded,
}: {
  invoice: Invoice | null;
  phone: boolean;
  /** The server has the payment ledger: a transfer can show its QR. */
  qrAvailable: boolean;
  onClose: () => void;
  /** The money was recorded (or a pending transfer was made): the caller reloads. */
  onRecorded: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({ amount: '', method: 'Cash' as InvoicePaymentMethod, note: '' });
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<PaymentQr | null>(null);
  const [qrState, setQrState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [qrError, setQrError] = useState('');
  const key = useRef(newKey());
  /* The body the key was last sent with: the same key only for a retry of the identical body. */
  const sent = useRef('');

  useEffect(() => {
    if (invoice === null) return;
    key.current = newKey();
    sent.current = '';
    setForm({ amount: String(invoice.remainingCzk), method: isClub(invoice) ? 'Transfer' : 'Cash', note: '' });
    setQr(null);
    setQrState('idle');
    setQrError('');
  }, [invoice]);

  const amount = Number(form.amount.replace(/[\s ]/g, '').replace(',', '.'));
  const valid = Number.isFinite(amount) && amount > 0;

  const save = async () => {
    if (invoice === null || !valid) return;
    setSaving(true);
    try {
      const note = form.note.trim();
      const signature = JSON.stringify([amount, form.method, note]);
      if (sent.current !== '' && sent.current !== signature) key.current = newKey();
      sent.current = signature;
      await billingApi.recordPayment(
        invoice.id,
        { amountCzk: amount, method: form.method, ...(note !== '' ? { note } : {}) },
        key.current,
      );
      toast.success('Platba zaevidována');
      onClose();
      await onRecorded();
    } catch (error) {
      toast.error(messageOf(error, 'Platbu se nepodařilo zaevidovat'));
    } finally {
      setSaving(false);
    }
  };

  const showQr = async () => {
    if (invoice === null) return;
    setQrState('loading');
    setQrError('');
    try {
      setQr(await paymentsApi.invoiceQr(invoice.id));
      setQrState('idle');
      await onRecorded();
    } catch (error) {
      setQrState('failed');
      setQrError(messageOf(error, 'QR platbu se nepodařilo připravit.'));
    }
  };

  const transfer = form.method === 'Transfer';

  return (
    <Dialog
      open={invoice !== null}
      onClose={saving ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      fullScreen={phone}
      sx={phone ? { '& .MuiInputBase-root': { minHeight: 44 }, '& .MuiButton-root': { minHeight: 44 } } : undefined}
    >
      <DialogTitle>Přijmout platbu</DialogTitle>
      <DialogContent>
        {invoice !== null && (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {invoice.invoiceNumber} · {customerOf(invoice)} · zbývá {czk(invoice.remainingCzk)}
            </Typography>
            <TextField
              label="Částka"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              error={form.amount !== '' && !valid}
              helperText={form.amount !== '' && !valid ? 'Zadejte částku v Kč.' : undefined}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">Kč</InputAdornment> } }}
              fullWidth
            />
            <TextField
              select
              label="Způsob platby"
              value={form.method}
              onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as InvoicePaymentMethod }))}
              fullWidth
            >
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Poznámka"
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              slotProps={{ htmlInput: { maxLength: 200 } }}
              fullWidth
            />
            {transfer && qrAvailable && (
              <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
                {qr === null ? (
                  <Stack spacing={1}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Peníze ještě nepřišly? Ukažte pacientovi QR Platbu, přijetí potvrdíte později v Platbách.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => void showQr()}
                      disabled={qrState === 'loading'}
                      startIcon={qrState === 'loading' ? <CircularProgress size={16} /> : undefined}
                    >
                      Zobrazit QR platbu
                    </Button>
                    {qrState === 'failed' && (
                      <Typography role="alert" variant="body2" sx={{ color: 'error.main' }}>{qrError}</Typography>
                    )}
                  </Stack>
                ) : (
                  <PaymentQrPanel qr={qr} />
                )}
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={phone ? { px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' } : undefined}>
        <Button variant="outlined" onClick={onClose} disabled={saving}>{qr !== null ? 'Zavřít' : 'Zrušit'}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={saving || !valid}>
          {saving ? 'Ukládám…' : 'Zaevidovat platbu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
