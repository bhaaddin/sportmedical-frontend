import { Box, Stack, Typography } from '@mui/material';

/**
 * The top of every staff screen on the board: a title, one line under it
 * saying what the screen holds ("Kartotéka kliniky · 1 284 záznamů"), and the
 * screen's actions on the right. Nothing else goes up there.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
  mb = 2.5,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Something before the title - a back button, an avatar. */
  leading?: React.ReactNode;
  mb?: number;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
        {leading}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 22, md: 24 } }}>
            {title}
          </Typography>
          {subtitle !== undefined && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions !== undefined && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export default PageHeader;
