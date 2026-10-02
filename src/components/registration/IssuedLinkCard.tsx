import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { SectionLabel } from '../ui/SectionLabel';

/**
 * A link the desk hands to a patient, the way the board shows one
 * (REGISTRAČNÍ ODKAZ PRO SPORTOVCE): a monospace box with the address and a
 * "Kopírovat" button next to it. One shape for the completion link after a
 * quick registration and for the portal link on the edit screen.
 */
export function IssuedLinkCard({
  label,
  link,
  note,
}: {
  label: React.ReactNode;
  link: string;
  note?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the address is on screen to copy by hand */
    }
  };

  return (
    <Box>
      <SectionLabel>{label}</SectionLabel>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'stretch' } }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 13,
            wordBreak: 'break-all',
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2.5,
            px: 1.5,
            py: 1.25,
          }}
        >
          {link}
        </Box>
        <Button
          variant="contained"
          startIcon={<ContentCopy fontSize="small" />}
          onClick={() => { void copy(); }}
          sx={{ flexShrink: 0 }}
        >
          {copied ? 'Zkopírováno' : 'Kopírovat'}
        </Button>
      </Stack>
      {note !== undefined && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}

export default IssuedLinkCard;
