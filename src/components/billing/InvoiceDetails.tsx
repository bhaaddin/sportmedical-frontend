/*
 * What an opened invoice shows: who it is for in full, the discount
 * breakdown (the same rows as the quote had), the approval trail and the
 * payments received.
 */
import { Box, Typography } from '@mui/material';
import type { Invoice } from '../../api/billing';
import { DESIGN, SectionLabel } from '../ui';
import InvoicePayments from '../../pages/billing/InvoicePayments';
import { PENDING_PAY_REASON } from './InvoiceActions';
import { czDate, czk } from '../../pages/billing/money';
import { isPendingApproval } from '../../pages/billing/invoiceView';
import DiscountRows from './DiscountRows';

export default function InvoiceDetails({ invoice }: { invoice: Invoice }) {
  const discounts = invoice.discounts ?? [];
  const pending = isPendingApproval(invoice);
  const rejected = invoice.status === 'Rejected';

  return (
    <Box sx={{ display: 'grid', gap: 2, py: 1.5 }}>
      {pending && (
        <Box
          role="status"
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: DESIGN.tone.beige.bg,
            border: `1px solid ${DESIGN.tone.beige.line}`,
            color: DESIGN.tone.beige.fg,
          }}
        >
          <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 600 }}>
            Čeká na schválení — ruční sleva je nad limitem. {PENDING_PAY_REASON}
          </Typography>
        </Box>
      )}
      {rejected && (
        <Box
          role="status"
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: DESIGN.tone.red.bg,
            border: `1px solid ${DESIGN.tone.red.line}`,
            color: DESIGN.tone.red.fg,
          }}
        >
          <Typography variant="body2" sx={{ color: 'inherit', fontWeight: 600 }}>
            Zamítnuto{invoice.rejectedReason ? ` — ${invoice.rejectedReason}` : ''}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: discounts.length > 0 ? '1fr 1fr' : '1fr' } }}>
        <Box>
          <SectionLabel>Slevy</SectionLabel>
          {discounts.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Bez slev.</Typography>
          ) : (
            <DiscountRows discounts={discounts} />
          )}
          {invoice.headcount ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              Počet osob: {invoice.headcount}
            </Typography>
          ) : null}
          {invoice.approvedBy ? (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Schválil {invoice.approvedBy}
              {invoice.approvedAtUtc ? ` · ${czDate(invoice.approvedAtUtc)}` : ''}
            </Typography>
          ) : null}
        </Box>
        <Box>
          <SectionLabel>Platby</SectionLabel>
          <InvoicePayments invoice={invoice} />
          {invoice.status === 'PartiallyPaid' && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
              Zbývá {czk(invoice.remainingCzk)}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
