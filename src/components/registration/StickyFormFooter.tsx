import { Box, Stack } from '@mui/material';

/**
 * The bar that stays at the bottom of a long form - "Zrušit · Uložit a
 * pokračovat" on the board. It bleeds to the page's edges, sits on paper
 * with one line over it, and keeps the actions in reach however far down
 * the form somebody has scrolled.
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
  return (
    <Box
      component="footer"
      sx={{
        position: 'sticky',
        bottom: 0,
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
        direction="row"
        spacing={1.5}
        sx={{ alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, mx: 'auto' }}
      >
        <Box sx={{ minWidth: 0, color: 'text.secondary', fontSize: 13 }}>{start}</Box>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {children}
        </Stack>
      </Stack>
    </Box>
  );
}

export default StickyFormFooter;
