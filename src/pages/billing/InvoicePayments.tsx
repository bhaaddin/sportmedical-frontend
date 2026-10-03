/*
 * The payments received against one invoice - what the row of Fakturace opens
 * into. Date, how it was paid, how much, and the note the desk left.
 */
import { Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import type { Invoice } from '../../api/billing';
import { PAYMENT_METHOD_LABEL } from './invoiceView';
import { czDate, czk } from './money';

export default function InvoicePayments({ invoice }: { invoice: Invoice }) {
  const payments = invoice.payments ?? [];
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
    </Box>
  );
}
