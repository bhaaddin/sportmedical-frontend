import { Box, type SxProps, type Theme } from '@mui/material';
import { toneColors } from '../../theme';

/**
 * The soft status pill from the design board: "Objednán", "Zaplaceno",
 * "Dotazník chybí", "Nepřišel 2×". Five tones, one shape, so every screen says
 * the same thing the same way. In the dark theme the pill is tinted glass with
 * a line in its own colour (the planner prototype's pills), in light the
 * board's pastels exactly as before.
 */
export type ChipTone = 'green' | 'beige' | 'red' | 'grey' | 'blue' | 'primary';

export function StatusChip({
  tone = 'grey',
  children,
  size = 'md',
  dot = false,
  sx,
  testId,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  /** A small leading dot, as on the appointment detail's "Objednán". */
  dot?: boolean;
  sx?: SxProps<Theme>;
  testId?: string;
}) {
  return (
    <Box
      component="span"
      data-testid={testId}
      sx={[
        (t: Theme) => {
          const colors = tone === 'primary' ? null : toneColors(t, tone);
          return {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            borderRadius: 999,
            px: size === 'sm' ? 1 : 1.25,
            py: size === 'sm' ? 0.125 : 0.375,
            fontSize: size === 'sm' ? 11 : 12,
            fontWeight: 600,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            bgcolor: colors === null ? 'primary.main' : colors.bg,
            color: colors === null ? 'primary.contrastText' : colors.fg,
            ...(t.palette.mode === 'dark' && colors !== null ? { boxShadow: `inset 0 0 0 1px ${colors.line}` } : {}),
          };
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {dot && (
        <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' }} />
      )}
      {children}
    </Box>
  );
}

export default StatusChip;
