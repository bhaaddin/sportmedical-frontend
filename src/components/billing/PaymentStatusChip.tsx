/*
 * The state of one payment as a word the desk knows. A payment that needs a
 * person's eye ("Ke kontrole": it came late, or for another amount) gets its
 * own second chip, so the status itself stays readable.
 */
import { Box } from '@mui/material';
import type { Payment, PaymentReviewReason, PaymentStatus } from '../../api/payments';
import { StatusChip } from '../ui';
import type { ChipTone } from '../ui';

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: ChipTone }> = {
  Pending: { label: 'Čeká na platbu', tone: 'beige' },
  Paid: { label: 'Zaplaceno', tone: 'green' },
  Failed: { label: 'Selhala', tone: 'red' },
  Refunded: { label: 'Vráceno', tone: 'grey' },
  Expired: { label: 'Vypršela', tone: 'grey' },
};

export const REVIEW_REASON: Record<PaymentReviewReason, string> = {
  late_payment: 'Peníze přišly až po vypršení platby.',
  amount_mismatch: 'Přišla jiná částka, než byla čekána.',
  invoice_not_payable: 'Doklad už platbu nepřijímá.',
};

export default function PaymentStatusChip({ payment }: { payment: Pick<Payment, 'status' | 'needsReview' | 'reviewReason'> }) {
  const view = PAYMENT_STATUS[payment.status] ?? { label: payment.status, tone: 'grey' as ChipTone };
  return (
    <Box component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.5 }}>
      <StatusChip tone={view.tone} size="sm">{view.label}</StatusChip>
      {payment.needsReview && (
        <span title={payment.reviewReason ? REVIEW_REASON[payment.reviewReason] : undefined}>
          <StatusChip tone="red" size="sm">Ke kontrole</StatusChip>
        </span>
      )}
    </Box>
  );
}
