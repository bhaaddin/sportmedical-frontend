import { Box, ButtonBase } from '@mui/material';
import { DARK } from '../../theme';

/**
 * The row of round filters next to a search box on the board: "Všichni ·
 * S termínem · Chybí dotazník · Nepřišli". One is always on.
 */
export interface FilterOption<K extends string = string> {
  key: K;
  label: React.ReactNode;
  /** A count drawn after the label, when the screen knows it. */
  count?: number;
}

export function FilterChips<K extends string>({
  options,
  value,
  onChange,
  ariaLabel = 'Filtr',
}: {
  options: FilterOption<K>[];
  value: K;
  onChange: (next: K) => void;
  ariaLabel?: string;
}) {
  return (
    <Box role="group" aria-label={ariaLabel} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <ButtonBase
            key={option.key}
            onClick={() => onChange(option.key)}
            aria-pressed={active}
            sx={(t) => ({
              borderRadius: 999,
              px: 1.75,
              minHeight: 36,
              '@media (max-width: 1279.95px)': { minHeight: 44, minWidth: 44 },
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid',
              borderColor: active ? (t.palette.mode === 'light' ? '#C9D6D3' : t.palette.primary.main) : t.palette.mode === 'light' ? 'divider' : DARK.lineLight,
              bgcolor: active ? (t.palette.mode === 'light' ? '#F4F8F7' : 'rgba(0, 230, 228, 0.14)') : t.palette.mode === 'light' ? 'background.paper' : '#021C2D',
              color: active ? (t.palette.mode === 'light' ? 'primary.main' : t.palette.primary.light) : 'text.primary',
              ...(active && t.palette.mode === 'dark' ? { boxShadow: '0 0 12px rgba(0,230,228,0.22)' } : {}),
              gap: 0.75,
              '&:hover': { bgcolor: active ? undefined : 'action.hover' },
            })}
          >
            {option.label}
            {option.count !== undefined && (
              <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {option.count}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}

export default FilterChips;
