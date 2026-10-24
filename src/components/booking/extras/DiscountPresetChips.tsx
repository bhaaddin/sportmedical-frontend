import { Box, ButtonBase, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { GROUP_DISCOUNTS_QUERY_KEY, readGroupDiscounts } from '../../../api/groupDiscounts';
import { activePresetId, freeNeedsReason, presetsFor, presetTyped } from './discountPresets';
import { parseCzk } from '../price/agreedPrice';

/**
 * R15c (a): the preset chips under the editable price. A chip FILLS the field (the amount is still the desk's to edit and "Vrátit ceník"
 * of the field resets it); pressing the chip that is already on puts the list price back. "Zdarma" is offered only where a reason can
 * travel with the booking (`allowFree`) and says so while the reason is missing. Loaded lazily with the dialog's price block.
 */
export function DiscountPresets({
  listPriceCzk,
  typed,
  onPick,
  reason,
  allowFree,
  disabled = false,
}: {
  listPriceCzk: number | null;
  typed: string | null;
  onPick: (typed: string | null) => void;
  reason: string;
  allowFree: boolean;
  disabled?: boolean;
}) {
  /* readable by anyone signed in; a failure just leaves the two everyday presets */
  const tiers = useQuery({ queryKey: GROUP_DISCOUNTS_QUERY_KEY, queryFn: readGroupDiscounts, staleTime: 5 * 60 * 1000, retry: false });
  if (listPriceCzk === null || listPriceCzk <= 0) return null;
  const presets = presetsFor(tiers.data?.settings.tiers, { allowFree });
  const active = activePresetId(listPriceCzk, typed, presets);
  const agreed = typed === null ? null : parseCzk(typed);
  return (
    <Box data-testid="discount-presets" sx={{ mt: 1 }}>
      <Box role="group" aria-label="Rychlá sleva" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {presets.map((p) => {
          const on = p.id === active;
          return (
            <ButtonBase
              key={p.id}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              title={p.hint}
              data-testid={`discount-${p.id}`}
              onClick={() => onPick(on ? null : presetTyped(listPriceCzk, p))}
              sx={{
                minHeight: 44,
                px: 1.5,
                borderRadius: 99,
                border: '1px solid',
                borderColor: on ? 'primary.main' : 'divider',
                bgcolor: on ? 'action.selected' : 'transparent',
                fontSize: 13,
                fontWeight: 650,
                fontFamily: 'inherit',
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              {p.label}
            </ButtonBase>
          );
        })}
      </Box>
      {freeNeedsReason(agreed, reason) ? (
        <Typography variant="caption" data-testid="discount-free-reason" sx={{ display: 'block', mt: 0.5, color: 'error.main' }}>
          Zdarma (0 Kč) vyžaduje důvod - napište ho do pole níže.
        </Typography>
      ) : null}
    </Box>
  );
}

export default DiscountPresets;
