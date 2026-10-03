/*
 * Rejecting an invoice that waits for approval: the reason is required - the
 * person who asked for the discount reads it.
 */
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import type { Invoice } from '../../api/billing';
import { customerOf } from '../../pages/billing/invoiceView';
import { czk } from '../../pages/billing/money';

export default function RejectInvoiceDialog({
  invoice,
  busy,
  onCancel,
  onConfirm,
}: {
  invoice: Invoice | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (invoice !== null) setReason(''); }, [invoice]);
  const valid = reason.trim().length > 0;

  return (
    <Dialog open={invoice !== null} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Zamítnout doklad</DialogTitle>
      <DialogContent>
        {invoice !== null && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {invoice.invoiceNumber} · {customerOf(invoice)} · {czk(invoice.totalCzk)}
          </Typography>
        )}
        <TextField
          autoFocus
          required
          multiline
          rows={3}
          fullWidth
          label="Důvod zamítnutí"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>Zpět</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!valid || busy}
          onClick={() => onConfirm(reason.trim())}
        >
          {busy ? 'Zamítám…' : 'Zamítnout doklad'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
