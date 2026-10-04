import { Box, type SxProps, type Theme } from '@mui/material';
import { DESIGN } from '../../theme';

/**
 * The soft status pill from the design board: "Objednán", "Zaplaceno",
 * "Dotazník chybí", "Nepřišel 2×". Five tones, one shape, so every screen says
 * the same thing the same way.
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
  const palette =
    tone === 'primary'
      ? { bg: 'primary.main', fg: '#FFFFFF' }
      : { bg: DESIGN.tone[tone].bg, fg: DESIGN.tone[tone].fg };

  return (
    <Box
      component="span"
      data-testid={testId}
      sx={[
        {
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
          bgcolor: palette.bg,
          color: palette.fg,
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
