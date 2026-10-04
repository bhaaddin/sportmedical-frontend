/*
 * A club link shown short and copied with one click. The address is always built by `absoluteLink`, so the form
 * link, the registration link and a block's link all read the same way (and use the admin-set public address).
 */
import { Box, Button, Stack, Typography } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { absoluteLink, shortLink, usePublicSiteBase } from './absoluteLink';

export async function copyText(text: string, ok = 'Odkaz zkopírován'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error('Odkaz se nepodařilo zkopírovat');
  }
}

export function LinkCopyRow({ label, path, testId, big = false }: {
  label: string;
  /** The link as the server gave it (relative or absolute); '' = not available yet. */
  path: string;
  testId?: string;
  big?: boolean;
}) {
  const base = usePublicSiteBase();
  const url = absoluteLink(path, base);
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>{label}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'stretch' } }}>
        <Box
          data-testid={testId}
          data-url={url}
          title={url}
          sx={{
            flex: 1, minWidth: 0, p: big ? 1.75 : 1.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.default',
            fontFamily: 'monospace', fontSize: big ? 16 : 14, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center',
          }}
        >
          {url === '' ? 'Odkaz zatím není k dispozici.' : shortLink(url)}
        </Box>
        <Button
          variant="contained"
          startIcon={<ContentCopy />}
          disabled={url === ''}
          onClick={() => void copyText(url)}
          aria-label={`Zkopírovat: ${label}`}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          Zkopírovat
        </Button>
      </Stack>
    </Box>
  );
}
