import { Box, MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { HEX_COLOR, SERVICE_COLORS_QUERY_KEY, serviceColorsApi } from '../../api/serviceColors';
import { CALENDAR_PALETTE } from '../../utils/calendarPalette';

/**
 * Colour picked from a fixed palette, never from a free wheel (contract 5.2), and every
 * swatch carries its name in text — colour is not allowed to be the only carrier of the
 * information (7.1).
 *
 * The palette is the clinic's own (Nastavení › Barvy, `GET /api/v1/settings/service-colors`);
 * the built-in list is only what is offered while that cannot be read. A colour already stored
 * on the record stays selectable even when the palette has since dropped it.
 */

interface ColorSelectProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}

interface Option {
  hex: string;
  /** i18n key for a built-in colour; a palette colour is named by its code. */
  labelKey?: string;
}

export function ColorSelect({ value, onChange, label }: ColorSelectProps) {
  const { t } = useTranslation();
  const palette = useQuery({
    queryKey: SERVICE_COLORS_QUERY_KEY,
    queryFn: serviceColorsApi.get,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const fromServer = (palette.data?.palette ?? []).filter((hex) => HEX_COLOR.test(hex));
  const options: Option[] = fromServer.length > 0
    ? fromServer.map((hex) => ({ hex: hex.toUpperCase() }))
    : CALENDAR_PALETTE.map((entry) => ({ hex: entry.hex, labelKey: entry.labelKey }));
  if (value !== '' && !options.some((o) => o.hex.toUpperCase() === value.toUpperCase())) {
    options.unshift({ hex: value });
  }

  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((entry) => (
        <MenuItem key={entry.hex} value={entry.hex}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              aria-hidden
              sx={{
                width: 18,
                height: 18,
                borderRadius: '4px',
                backgroundColor: entry.hex,
                border: '1px solid rgba(0,0,0,0.2)',
                flexShrink: 0,
              }}
            />
            {entry.labelKey !== undefined ? t(entry.labelKey) : entry.hex.toUpperCase()}
          </Box>
        </MenuItem>
      ))}
    </TextField>
  );
}
