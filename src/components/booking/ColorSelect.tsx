import { Box, MenuItem, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CALENDAR_PALETTE } from '../../utils/calendarPalette';

/**
 * Colour picked from a fixed palette, never from a free wheel (contract 5.2),
 * and every swatch carries its name in text — colour is not allowed to be the
 * only carrier of the information (7.1).
 */

interface ColorSelectProps {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}

export function ColorSelect({ value, onChange, label }: ColorSelectProps) {
  const { t } = useTranslation();

  return (
    <TextField
      select
      fullWidth
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {CALENDAR_PALETTE.map((entry) => (
        <MenuItem key={entry.id} value={entry.hex}>
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
            {t(entry.labelKey)}
          </Box>
        </MenuItem>
      ))}
    </TextField>
  );
}
