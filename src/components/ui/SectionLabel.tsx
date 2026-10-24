import { Typography, type SxProps, type Theme } from '@mui/material';

/**
 * The small uppercase label the board puts over every group of fields:
 * OSOBNÍ ÚDAJE, PŘÍCHOD, HISTORIE. 11px, bold, letter-spaced, muted.
 */
export function SectionLabel({
  children,
  sx,
  component = 'div',
}: {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
  component?: React.ElementType;
}) {
  return (
    <Typography
      variant="overline"
      component={component}
      sx={[
        (t) => ({
          color: 'text.primary',
          opacity: 0.88,
          fontSize: 12,
          letterSpacing: '0.1em',
          display: 'block',
          mb: 1,
          /* `.agenda-section-caption`: #89afbe, 750, letter-spacing .22px. */
          ...(t.palette.mode === 'dark' ? { color: '#89AFBE', opacity: 1, fontWeight: 750, letterSpacing: '0.22px' } : {}),
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Typography>
  );
}

export default SectionLabel;
