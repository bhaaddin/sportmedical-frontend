import { Paper, type PaperProps } from '@mui/material';

/**
 * A bordered white surface with no shadow - the board's card. Padding is the
 * board's 20px; pass `p` to change it. `tone="soft"` is the tinted variant used
 * for the slot summary in the booking drawer.
 */
export function SoftCard({
  tone = 'plain',
  sx,
  children,
  ...rest
}: PaperProps & { tone?: 'plain' | 'soft' | 'muted' }) {
  return (
    <Paper
      variant="outlined"
      sx={[
        {
          p: 2.5,
          borderRadius: 3,
          ...(tone === 'soft'
            ? { bgcolor: (t) => (t.palette.mode === 'light' ? '#F4F8F7' : 'rgba(13,92,82,0.12)'), borderColor: '#C9D6D3' }
            : tone === 'muted'
              ? { bgcolor: 'background.default' }
              : {}),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    >
      {children}
    </Paper>
  );
}

export default SoftCard;
