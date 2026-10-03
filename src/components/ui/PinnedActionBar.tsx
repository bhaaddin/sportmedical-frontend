import { Box, Stack } from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';

/**
 * The main action of a phone screen, pinned at the bottom (brief, rule 3).
 *
 * On a phone the children are drawn in a bar that sticks to the bottom of the
 * screen, above the shell's bottom navigation: the shell publishes that bar's
 * height as the CSS variable `--bottom-bar-height` (0 when there is none).
 * On a tablet or desktop the children are drawn inline where the bar stands,
 * so the same JSX serves every width and a button is never rendered twice.
 */
export function PinnedActionBar({
  children,
  label = 'Hlavní akce',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  const phone = useIsPhone();
  if (!phone) {
    return (
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }} data-pinned="false">
        {children}
      </Stack>
    );
  }
  return (
    <Box
      role="region"
      aria-label={label}
      data-pinned="true"
      sx={{
        position: 'sticky',
        bottom: 'var(--bottom-bar-height, 0px)',
        zIndex: 3,
        mt: 2,
        mx: -2,
        px: 2,
        py: 1.25,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ '& > *': { flex: 1, minHeight: 44 } }}>
        {children}
      </Stack>
    </Box>
  );
}

export default PinnedActionBar;
