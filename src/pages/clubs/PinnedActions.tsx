import { Stack } from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';

/**
 * On a phone the screen's main actions are pinned to the bottom of the screen,
 * where a thumb reaches them, instead of sitting in a header that scrolls away.
 * Elsewhere it draws nothing - the same actions are in the header.
 *
 * `bottom` follows `--sm-bottom-bar` when the shell publishes the height of its
 * bottom navigation and is 72 px otherwise (what the settings frame uses), so
 * the bar rests above the phone's bottom navigation and not under it.
 */
export function PinnedActions({ children }: { children: React.ReactNode }) {
  const phone = useIsPhone();
  if (!phone) return null;
  return (
    <Stack
      direction="row"
      spacing={1}
      data-testid="pinned-actions"
      sx={{
        position: 'sticky',
        bottom: 'var(--sm-bottom-bar, 72px)',
        zIndex: 5,
        mt: 2,
        mx: -2,
        px: 2,
        py: 1.25,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        '& > *': { flex: 1, minHeight: 44 },
      }}
    >
      {children}
    </Stack>
  );
}

export default PinnedActions;
