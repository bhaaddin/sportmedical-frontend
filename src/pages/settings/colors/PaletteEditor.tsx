/*
 * The palette editor: one row per colour - a colour input, the #RRGGBB text,
 * "Odebrat" - and "Přidat barvu". One field per row on a phone, two rows of
 * swatches side by side on a tablet and up. The error of a row sits under it.
 */
import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { Add as AddIcon, DeleteOutlined as DeleteIcon } from '@mui/icons-material';
import { MIN_PALETTE_SIZE } from '../../../api/serviceColors';
import { TYPE, settingsLine } from '../../../components/settings/settingsStyle';
import { useIsPhone } from '../../../layout/useDevice';
import { isHex, nextColorKey, normalizeHex, type PaletteErrors, type PaletteRow } from './colorLogic';

export function PaletteEditor({
  rows, errors, onChange,
}: { rows: PaletteRow[]; errors: PaletteErrors; onChange: (rows: PaletteRow[]) => void }) {
  const phone = useIsPhone();
  const edit = (key: string, hex: string) => onChange(rows.map((r) => (r.key === key ? { ...r, hex } : r)));
  const canRemove = rows.length > MIN_PALETTE_SIZE;

  return (
    <Stack spacing={1.5}>
      <Box
        component="ul"
        aria-label="Barvy palety"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5, gridTemplateColumns: phone ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}
      >
        {rows.map((row, index) => {
          const valid = isHex(normalizeHex(row.hex));
          const hex = normalizeHex(row.hex);
          return (
            <Box component="li" key={row.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                component="label"
                sx={{
                  position: 'relative',
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: settingsLine,
                  bgcolor: valid ? hex : 'transparent',
                  backgroundImage: valid ? 'none' : 'repeating-linear-gradient(135deg, transparent 0 5px, rgba(0,0,0,.12) 5px 6px)',
                  cursor: 'pointer',
                  '&:focus-within': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                <input
                  type="color"
                  aria-label={`Vybrat barvu ${index + 1}`}
                  value={valid ? hex.toLowerCase() : '#000000'}
                  onChange={(e) => edit(row.key, e.target.value.toUpperCase())}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                />
              </Box>
              <TextField
                size="small"
                value={row.hex}
                onChange={(e) => edit(row.key, e.target.value)}
                onBlur={() => edit(row.key, normalizeHex(row.hex))}
                error={errors.rows[row.key] !== undefined}
                helperText={errors.rows[row.key]}
                placeholder="#RRGGBB"
                fullWidth
                slotProps={{ htmlInput: { 'aria-label': `Barva ${index + 1} jako text`, spellCheck: false, autoCapitalize: 'characters', maxLength: 7, style: { fontVariantNumeric: 'tabular-nums', minHeight: 28 } } }}
              />
              <IconButton
                aria-label={`Odebrat barvu ${index + 1}`}
                disabled={!canRemove}
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                sx={{ width: 44, height: 44, color: '#9B3B1B' }}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          );
        })}
      </Box>

      {errors.general !== null && <Typography role="alert" sx={[TYPE.caption, { color: 'error.main' }]}>{errors.general}</Typography>}
      {errors.general === null && !canRemove && (
        <Typography sx={TYPE.caption}>Paleta má nejméně {MIN_PALETTE_SIZE} barev — odebrat jde až po přidání další.</Typography>
      )}

      <Button
        variant="outlined"
        color="inherit"
        startIcon={<AddIcon />}
        onClick={() => onChange([...rows, { key: nextColorKey(), hex: '' }])}
        sx={{ minHeight: 44, alignSelf: 'flex-start', borderStyle: 'dashed', color: 'primary.main', fontWeight: 600 }}
      >
        Přidat barvu
      </Button>
    </Stack>
  );
}

export default PaletteEditor;
