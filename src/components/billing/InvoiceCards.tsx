/*
 * The invoices on a phone: one card each - number and state on top, who it is
 * for, what was billed, the date and the amount, and the actions in a row of
 * buttons at least 44 px tall. The detail opens inside the card.
 */
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import type { Invoice } from '../../api/billing';
import { SoftCard, StatusChip } from '../ui';
import { czDate, czk } from '../../pages/billing/money';
import { itemsWithDiscount, statusOf } from '../../pages/billing/invoiceView';
import InvoiceActions, { PENDING_PAY_REASON } from './InvoiceActions';
import type { InvoiceActionHandlers } from './InvoiceActions';
import InvoiceCustomer from './InvoiceCustomer';
import InvoiceDetails from './InvoiceDetails';

export default function InvoiceCards({
  invoices,
  now,
  openId,
  onToggle,
  handlers,
  empty,
}: {
  invoices: Invoice[];
  now: Date;
  openId: string | null;
  onToggle: (id: string) => void;
  handlers: InvoiceActionHandlers;
  empty: string;
}) {
  if (invoices.length === 0) {
    return (
      <SoftCard sx={{ py: 5, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>{empty}</Typography>
      </SoftCard>
    );
  }

  return (
    <Stack component="ul" spacing={1.5} aria-label="Doklady" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {invoices.map((inv) => {
        const st = statusOf(inv, now);
        const open = openId === inv.id;
        return (
          <SoftCard key={inv.id} component="li" id={`invoice-${inv.id}`} sx={{ p: 2, display: 'grid', gap: 1.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{inv.invoiceNumber}</Typography>
              <StatusChip tone={st.tone}>{st.label}</StatusChip>
            </Box>
            <InvoiceCustomer invoice={inv} wrap />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{itemsWithDiscount(inv)}</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{czDate(inv.issueDateUtc)}</Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {czk(inv.totalCzk)}
              </Typography>
            </Box>
            {inv.status === 'PartiallyPaid' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>zbývá {czk(inv.remainingCzk)}</Typography>
            )}
            {inv.status === 'PendingApproval' && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{PENDING_PAY_REASON}</Typography>
            )}
            <InvoiceActions invoice={inv} handlers={handlers} touch fullWidthRow />
            <Button
              variant="text"
              onClick={() => onToggle(inv.id)}
              aria-expanded={open}
              aria-label={`Platby dokladu ${inv.invoiceNumber}`}
              endIcon={open ? <ExpandLess /> : <ExpandMore />}
              sx={{ minHeight: 44, justifyContent: 'space-between' }}
            >
              Detail a platby
            </Button>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <InvoiceDetails invoice={inv} />
            </Collapse>
          </SoftCard>
        );
      })}
    </Stack>
  );
}
