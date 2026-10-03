import { Box } from '@mui/material';
import { DESIGN } from '../ui';
import { initialsOf, inkOn } from './blockLogic';

/**
 * The club's initials on its own colour (C4: stable per club, chosen by the
 * server). A club the server has not coloured yet gets the board's neutral
 * grey chip - never a colour made up here, so the avatar and the calendar block
 * can never disagree.
 */
export function ClubAvatar({ name, color, size = 40 }: { name: string; color: string | null; size?: number }) {
  return (
    <Box
      aria-hidden="true"
      data-testid="club-avatar"
      data-color={color ?? ''}
      sx={{
        flex: `0 0 ${size}px`,
        width: size,
        height: size,
        borderRadius: '10px',
        bgcolor: color ?? DESIGN.tone.grey.bg,
        color: color !== null ? inkOn(color) : DESIGN.tone.grey.fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.35),
        fontWeight: 700,
        letterSpacing: '0.02em',
      }}
    >
      {initialsOf(name)}
    </Box>
  );
}

export default ClubAvatar;
