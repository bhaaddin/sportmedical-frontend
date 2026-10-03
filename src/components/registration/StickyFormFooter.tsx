import { Box, Stack } from '@mui/material';
import { useIsPhone } from '../../layout/useDevice';

/**
 * The bar that stays at the bottom of a long form - "Zrušit · Uložit a
 * pokračovat" on the board. It bleeds to the page's edges, sits on paper
 * with one line over it, and keeps the actions in reach however far down
 * the form somebody has scrolled.
 *
 * On a phone it sits ABOVE the shell's bottom navigation (the shell publishes
 * that bar's height as `--bottom-bar-height`, 0 when there is none), the
 * status line goes over the buttons, and the actions share the row so the main
 * one is a full-height touch target. `data-pinned` says which of the two it is.
 */
export function StickyFormFooter({
  start,
  children,
}: {
  /** Something on the left - a status line, a count. */
  start?: React.ReactNode;
  /** The actions, on the right. */
  children: React.ReactNode;
}) {
  const phone = useIsPhone();

  return (
    <Box
      component="footer"
      data-pinned={phone ? 'true' : 'false'}
      sx={{
        position: 'sticky',
        bottom: 'var(--bottom-bar-height, 0px)',
        zIndex: 2,
        mt: 3,
        mx: { xs: -2, md: -3 },
        px: { xs: 2, md: 3 },
        py: 1.5,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack
        direction={phone ? 'column' : 'row'}
        spacing={phone ? 1 : 1.5}
        sx={{
          alignItems: phone ? 'stretch' : 'center',
          justifyContent: 'space-between',
          maxWidth: 1200,
          mx: 'auto',
        }}
      >
        <Box sx={{ minWidth: 0, color: 'text.secondary', fontSize: 13 }}>{start}</Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            flexShrink: 0,
            ...(phone ? { '& > *': { flex: 1, minHeight: 44 } } : {}),
          }}
        >
          {children}
        </Stack>
      </Stack>
    </Box>
  );
}

export default StickyFormFooter;
