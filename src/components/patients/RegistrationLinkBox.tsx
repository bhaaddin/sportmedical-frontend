import { useState } from 'react';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import { SITE_ADDRESS_MISSING, shareableLink } from '../../api/preRegistration';
import type { IssuedRegistrationLink } from '../../api/preRegistration';
import { formatPragueDateTime } from '../../utils/time';

const TEXT = {
  title: 'Odkaz vygenerován — zkopírovat',
  help:
    'Odkaz je osobní a jednorázový; ukazuje se jen teď, server ho neuchovává. ' +
    'Pošlete ho pacientovi třeba přes WhatsApp, pokud e-mail nepřijde.',
  copy: 'Zkopírovat',
  copied: 'Zkopírováno',
  validUntil: (when: string) => `Platí do ${when}.`,
  willSend: (to: string) => `E-mail s odkazem odešleme na ${to}.`,
  queuedOnly: (to: string) =>
    `E-mail pro ${to} čeká ve frontě, ale odesílání e-mailů není nastaveno — pošlete odkaz pacientovi sami.`,
  notQueued: 'E-mail se nepodařilo zařadit do fronty — pošlete odkaz pacientovi sami.',
  siteAddressMissing:
    'E-mail se neposlal: v Nastavení → Odkaz k dokončení registrace není vyplněná adresa webu, ' +
    'takže by odkaz v e-mailu nešel otevřít. Pošlete odkaz pacientovi sami.',
};

/**
 * The link shown once, with a copy button. The server keeps only a hash, so
 * this box is the only place the plain link ever appears; closing it means
 * generating a new one.
 */
export function RegistrationLinkBox({ link }: { link: IssuedRegistrationLink }) {
  const [copied, setCopied] = useState(false);
  const url = shareableLink(link, window.location.origin);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* No clipboard (older browser, http without permission): the box below is selectable. */
      setCopied(false);
    }
  };

  return (
    <Box sx={{ border: '1px solid', borderColor: 'success.light', borderRadius: 2, p: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {TEXT.title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        {TEXT.help}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
        <TextField
          fullWidth
          size="small"
          value={url}
          label="Odkaz pro pacienta"
          slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }}
          onFocus={(event) => event.target.select()}
        />
        <Button variant="contained" size="small" startIcon={<ContentCopy />} onClick={() => void copy()}>
          {copied ? TEXT.copied : TEXT.copy}
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ mt: 1 }}>
        {TEXT.validUntil(formatPragueDateTime(link.expiresAtUtc))}
      </Typography>
      <Alert severity={link.emailWillSend ? 'success' : 'warning'} sx={{ mt: 1 }}>
        {link.emailWillSend
          ? TEXT.willSend(link.sentTo)
          : link.emailQueued
            ? TEXT.queuedOnly(link.sentTo)
            : link.emailNotQueuedReason === SITE_ADDRESS_MISSING
              ? TEXT.siteAddressMissing
              : TEXT.notQueued}
      </Alert>
    </Box>
  );
}
