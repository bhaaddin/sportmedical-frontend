/*
 * "Pick one of the palette": a grid of swatches, each a 44 px button named by
 * its colour. Used in a popover on the colours screen and inline in the
 * činnost dialog of the price list. The chosen swatch carries a ring and a tick,
 * so it is not told apart by colour alone.
 */
import { Box, Button, Stack, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { normalizeHex } from './colorLogic';
import { TYPE } from '../../../components/settings/settingsStyle';

export function PaletteChoice({
  palette, value, onPick, onClear, clearLabel = 'Použít odstín služby', ariaLabel = 'Paleta barev',
}: {
  palette: readonly string[];
  /** The colour in force, or null when there is none of its own. */
  value: string | null;
  onPick: (hex: string) => void;
  /** Offered only when given: "back to the default". */
  onClear?: () => void;
  clearLabel?: string;
  ariaLabel?: string;
}) {
  const current = value === null ? null : normalizeHex(value);
  return (
    <Stack spacing={1.5}>
      <Box role="group" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {palette.map((hex) => {
          const color = normalizeHex(hex);
          const selected = current === color;
          return (
            <Box
              key={color}
              component="button"
              type="button"
              aria-label={`Barva ${color}`}
              aria-pressed={selected}
              onClick={() => onPick(color)}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: color,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: '#FFFFFF',
                border: '2px solid',
                borderColor: selected ? 'text.primary' : 'transparent',
                outlineOffset: 2,
                '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
              }}
            >
              {selected && <CheckIcon fontSize="small" sx={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,.6))' }} />}
            </Box>
          );
        })}
      </Box>
      {palette.length === 0 && <Typography sx={TYPE.caption}>Paleta je prázdná.</Typography>}
      {onClear !== undefined && (
        <Button variant="outlined" color="inherit" onClick={onClear} sx={{ minHeight: 44, alignSelf: 'flex-start', fontWeight: 600 }}>
          {clearLabel}
        </Button>
      )}
    </Stack>
  );
}

export default PaletteChoice;
