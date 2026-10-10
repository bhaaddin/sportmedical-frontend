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
}: {
  value: PriceState;
  onChange: (typed: string | null) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  testId?: string;
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
    </Box>
  );
}

export default AgreedPriceField;
