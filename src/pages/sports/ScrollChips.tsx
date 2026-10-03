import { Box } from '@mui/material';
import { useDevice } from '../../layout/useDevice';

/**
 * Filter chips that stay in one row and scroll sideways on a phone, instead of
 * wrapping into a tall block above the list. Touch devices get 44 px chips.
 * Wrap a `FilterChips` in it; the chips themselves are untouched.
 */
export function ScrollChips({ children }: { children: React.ReactNode }) {
  const device = useDevice();
  const touch = device !== 'desktop';
  return (
    <Box
      data-scroll={device === 'phone' ? 'x' : undefined}
      sx={{
        ...(device === 'phone' && {
          overflowX: 'auto',
          mx: -2,
          px: 2,
          pb: 0.5,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '& > [role="group"]': { flexWrap: 'nowrap', width: 'max-content' },
        }),
        ...(touch && { '& [role="group"] > button': { minHeight: 44, flexShrink: 0 } }),
      }}
    >
      {children}
    </Box>
  );
}
