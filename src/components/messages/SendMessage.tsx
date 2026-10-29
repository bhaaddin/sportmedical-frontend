/*
 * "Poslat zprávu" on a patient's or a club's page: pick one of the clinic's own messages (Nastavení -> Zprávy), look at exactly
 * what will go out ("Náhled" = a dry run: how many people, how many without an e-mail, the rendered sample), then send.
 * Recipient addresses are never shown here; the server never returns them.
 */
import { lazy, Suspense, useState } from 'react';
import { Button, Snackbar } from '@mui/material';
import { MailOutlined } from '@mui/icons-material';
import { usePermission } from '../../auth/usePermission';
import { TARGET_SX } from '../../ui/shelf';
import type { MessageTarget } from '../../pages/settings/messages/messagesModel';

const SendMessageDialog = lazy(() => import('./SendMessageDialog'));

export function SendMessageButton({ target }: { target: MessageTarget }) {
  const mayManage = usePermission('communication.manage');
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (!mayManage) return null;

  return (
    <>
      <Button variant="outlined" startIcon={<MailOutlined />} onClick={() => setOpen(true)} sx={TARGET_SX} data-testid="send-message">
        Poslat zprávu
      </Button>
      {open ? (
        <Suspense fallback={null}>
          <SendMessageDialog
            target={target}
            onClose={() => setOpen(false)}
            onSent={(queued) => { setOpen(false); setToast(`Zařazeno k odeslání: ${queued}`); }}
          />
        </Suspense>
      ) : null}
      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
