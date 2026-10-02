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
      sx={[{ color: 'text.secondary', display: 'block', mb: 1 }, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    >
      {children}
    </Typography>
  );
}

export default SectionLabel;
