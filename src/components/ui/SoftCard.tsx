import { Paper, type PaperProps } from '@mui/material';
import { DARK } from '../../theme';

/**
 * A bordered white surface with no shadow - the board's card. Padding is the
 * board's 20px; pass `p` to change it. `tone="soft"` is the tinted variant used
 * for the slot summary in the booking drawer. In the dark theme the card is the
 * planner prototype's glass panel (teal edge, soft glow).
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
        (t) => {
          const dark = t.palette.mode === 'dark';
          return {
            p: 2.5,
            borderRadius: 3,
            ...(dark && tone === 'plain' ? { backgroundImage: DARK.panel } : {}),
            ...(tone === 'soft'
              ? { bgcolor: dark ? 'rgba(0,230,228,0.07)' : '#F4F8F7', borderColor: dark ? 'rgba(0,230,228,0.32)' : '#C9D6D3' }
              : tone === 'muted'
                ? { bgcolor: 'background.default' }
                : {}),
          };
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
