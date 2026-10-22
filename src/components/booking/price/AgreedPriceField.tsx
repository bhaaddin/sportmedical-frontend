import type { ReactNode } from 'react';
import { Box, InputAdornment, Link, Stack, TextField, Typography } from '@mui/material';
import { SectionLabel } from '../../ui';
import { amountText, priceView, PRICE_TEXT, type PriceState } from './agreedPrice';

/**
 * "CENA" - the one field that lets the desk correct what a visit costs. It is
 * prefilled with the price list's figure and says so ("podle ceníku"); once the
 * amount differs the caption names the list price and offers "Vrátit ceník".
 * No percentage anywhere: the desk types the amount it agreed.
 *
 * The field is controlled by its owner: `typed` is `null` until the desk types
 * (the list price is only shown), and the owner sends `priceView(...).agreedPriceCzk`.
 */
export function AgreedPriceField({
  value,
  onChange,
  disabled = false,
  fullWidth = false,
  testId = 'agreed-price',
  reason,
  onReasonChange,
  extras,
}: {
  value: PriceState;
  onChange: (typed: string | null) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  testId?: string;
  /** R15a: why the amount differs from the list (optional). Shown only while it differs and the owner can carry it. */
  reason?: string;
  onReasonChange?: (reason: string) => void;
  /** R15c (a): what sits under the caption - the discount presets (they only fill `value`; "Vrátit ceník" resets them). */
  extras?: ReactNode;
}) {
  const view = priceView(value);
  const shown = value.typed ?? amountText(value.listPriceCzk);

  return (
    <Box data-testid={testId} sx={{ minWidth: 0, width: fullWidth ? '100%' : { xs: '100%', sm: 220 } }}>
      <SectionLabel component="label" sx={{ mb: 0.5 }}>
        {PRICE_TEXT.label}
      </SectionLabel>
      <TextField
        fullWidth
        size="small"
        disabled={disabled}
        value={shown}
        onChange={(e) => onChange(e.target.value)}
        error={view.invalid}
        placeholder="0"
        slotProps={{
          input: {
            sx: { minHeight: 44, fontVariantNumeric: 'tabular-nums' },
            endAdornment: <InputAdornment position="end">Kč</InputAdornment>,
          },
          htmlInput: { 'aria-label': PRICE_TEXT.label, inputMode: 'decimal' },
        }}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography
          variant="caption"
          data-testid={`${testId}-caption`}
          sx={{ color: view.invalid ? 'error.main' : view.adjusted ? 'warning.dark' : 'text.secondary' }}
        >
          {view.caption}
        </Typography>
        {value.typed !== null && (view.adjusted || view.invalid) ? (
          <Link
            component="button"
            type="button"
            underline="hover"
            disabled={disabled}
            onClick={() => onChange(null)}
            sx={{ fontSize: 12, fontWeight: 600, minHeight: 24 }}
          >
            {PRICE_TEXT.restore}
          </Link>
        ) : null}
      </Stack>
      {extras}
      {onReasonChange && view.adjusted && !view.invalid ? (
        <TextField
          fullWidth
          size="small"
          disabled={disabled}
          value={reason ?? ''}
          onChange={(e) => onReasonChange(e.target.value)}
          label={PRICE_TEXT.reason}
          placeholder={PRICE_TEXT.reasonHint}
          slotProps={{ input: { sx: { minHeight: 44 } }, htmlInput: { maxLength: 200, 'data-testid': `${testId}-reason` } }}
          sx={{ mt: 1 }}
        />
      ) : null}
    </Box>
  );
}

/** The note that carries the reason to the booking: the desk's own note, then "Důvod úpravy ceny: …" - only when the price was changed and a reason typed. */
export function noteWithPriceReason(note: string | null, adjusted: boolean, reason: string): string | null {
  const why = reason.trim();
  if (!adjusted || why === '') return note;
  const line = `${PRICE_TEXT.reasonNote}: ${why}`;
  return note === null || note.trim() === '' ? line : `${note}
${line}`;
}

export default AgreedPriceField;
