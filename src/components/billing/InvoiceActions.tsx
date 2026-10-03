/*
 * What can be done to one invoice, as buttons: take a payment (not while it
 * waits for approval - the button stays and says why), approve / reject (only
 * for somebody with `billing.approve`, only while it waits), and the PDF.
 * The same set on a phone card and in a table row.
 */
import { Box, Button } from '@mui/material';
import type { Invoice } from '../../api/billing';
import { isOpen, isPendingApproval } from '../../pages/billing/invoiceView';

export const PENDING_PAY_REASON = 'Doklad čeká na schválení — platbu zatím nelze přijmout.';

export interface InvoiceActionHandlers {
  canApprove: boolean;
  /** The invoice an approve / reject / PDF request is running for. */
  busyId: string | null;
  onPay: (invoice: Invoice) => void;
  onApprove: (invoice: Invoice) => void;
  onReject: (invoice: Invoice) => void;
  onPdf: (invoice: Invoice) => void;
}

export default function InvoiceActions({
  invoice,
  handlers,
  touch = false,
  fullWidthRow = false,
}: {
  invoice: Invoice;
  handlers: InvoiceActionHandlers;
  /** Phone and iPad: every button is at least 44 px tall. */
  touch?: boolean;
  /** On a phone card the buttons share the row. */
  fullWidthRow?: boolean;
}) {
  const pending = isPendingApproval(invoice);
  const busy = handlers.busyId === invoice.id;
  const size = touch ? 'medium' : 'small';
  const sx = { ...(touch ? { minHeight: 44 } : {}), ...(fullWidthRow ? { flex: '1 1 auto' } : {}) };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: fullWidthRow ? 'stretch' : 'flex-end' }}>
      {(isOpen(invoice) || pending) && (
        <Box component="span" title={pending ? PENDING_PAY_REASON : undefined} sx={{ display: 'inline-flex', flex: fullWidthRow ? '1 1 auto' : undefined }}>
          <Button
            size={size}
            variant="outlined"
            disabled={pending}
            onClick={() => handlers.onPay(invoice)}
            aria-label={`Přijmout platbu ${invoice.invoiceNumber}`}
            sx={{ ...sx, flex: 1 }}
          >
            Přijmout platbu
          </Button>
        </Box>
      )}
      {pending && handlers.canApprove && (
        <>
          <Button
            size={size}
            variant="contained"
            disabled={busy}
            onClick={() => handlers.onApprove(invoice)}
            aria-label={`Schválit ${invoice.invoiceNumber}`}
            sx={sx}
          >
            Schválit
          </Button>
          <Button
            size={size}
            variant="outlined"
            color="error"
            disabled={busy}
            onClick={() => handlers.onReject(invoice)}
            aria-label={`Zamítnout ${invoice.invoiceNumber}`}
            sx={sx}
          >
            Zamítnout
          </Button>
        </>
      )}
      <Button
        size={size}
        variant="outlined"
        disabled={busy}
        onClick={() => handlers.onPdf(invoice)}
        aria-label={`PDF ${invoice.invoiceNumber}`}
        sx={sx}
      >
        PDF
      </Button>
    </Box>
  );
}
