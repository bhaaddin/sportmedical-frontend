/*
 * The payments received against one invoice - what the row of Fakturace opens
 * into. Date, how it was paid, how much, and the note the desk left.
 */
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Invoice } from '../../api/billing';
import { useInvoicePayments } from '../../api/payments';
import PaymentStatusChip from '../../components/billing/PaymentStatusChip';
import { PAYMENT_METHOD_LABEL } from './invoiceView';
import { czDate, czk } from './money';

export default function InvoicePayments({ invoice }: { invoice: Invoice }) {
  const payments = invoice.payments ?? [];
  /* The ledger's payments that are not money in hand yet (a transfer that waits, a late one): empty when the server has no ledger. */
  const ledger = useInvoicePayments(invoice.id, true);
  const waiting = (ledger.data ?? []).filter((p) => p.status !== 'Paid' && p.status !== 'Refunded');
  return (
    <Box sx={{ py: 1, px: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
      {payments.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Zatím žádné platby.
        </Typography>
      ) : (
        <Table size="small" aria-label={`Platby dokladu ${invoice.invoiceNumber}`}>
          <TableHead>
            <TableRow>
              <TableCell>Datum</TableCell>
              <TableCell>Způsob</TableCell>
              <TableCell align="right">Částka</TableCell>
              <TableCell>Poznámka</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{czDate(p.paidAtUtc)}</TableCell>
                <TableCell>{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {czk(p.amountCzk)}
                </TableCell>
                <TableCell>{p.note && p.note.trim() !== '' ? p.note : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {waiting.length > 0 && (
        <Box sx={{ mt: payments.length === 0 ? 1 : 1.5, display: 'grid', gap: 0.75 }} aria-label={`Čekající platby dokladu ${invoice.invoiceNumber}`}>
          {waiting.map((p) => (
            <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <PaymentStatusChip payment={p} />
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {czk(p.amountCzk)}{p.variableSymbol ? ` · VS ${p.variableSymbol}` : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
