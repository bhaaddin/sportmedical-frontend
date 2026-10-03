/*
 * The discount breakdown: one row per discount - what kind, its label, the
 * percent and the amount - the same on the price quote of the new document and
 * on the opened row of an issued one. A tier or club row that lost to the
 * higher of the two is struck through and says why.
 */
import { Box, Typography } from '@mui/material';
import type { InvoiceDiscount } from '../../api/billing';
import { czk } from '../../pages/billing/money';
import { formatPercent } from '../../pages/billing/invoiceView';
import { DISCOUNT_KIND_LABEL, UNUSED_NOTE, discountRows } from '../../pages/billing/quoteView';

export default function DiscountRows({ discounts }: { discounts: readonly InvoiceDiscount[] }) {
  const rows = discountRows(discounts);
  if (rows.length === 0) return null;

  return (
    <Box component="ul" aria-label="Slevy" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
      {rows.map(({ discount, unused }, index) => (
        <Box
          component="li"
          key={`${discount.kind}-${index}`}
          data-kind={discount.kind}
          data-unused={unused ? 'true' : 'false'}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            color: unused ? 'text.secondary' : 'text.primary',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {unused ? <s>{discount.label}</s> : discount.label}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
              {DISCOUNT_KIND_LABEL[discount.kind]}
              {unused ? ` · ${UNUSED_NOTE}` : ''}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
          >
            {unused ? (
              <s>{`−${formatPercent(discount.percent)}`}</s>
            ) : (
              <>
                {`−${formatPercent(discount.percent)}`}
                <Box component="span" sx={{ display: 'block', fontWeight: 400 }}>
                  {`−${czk(discount.amountCzk)}`}
                </Box>
              </>
            )}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
