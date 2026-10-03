/*
 * "Resetovat heslo do portálu" - the clinic's answer to a patient who forgot
 * the portal password. There is no e-mail reset: the desk deletes the
 * password and sends the patient a fresh link to set a new one.
 *
 * `POST /api/v1/patients/{id}/portal-password/reset` answers 204, or 404 with
 * a message when the patient has no portal account yet - which is said in
 * plain words rather than shown as a failure.
 */
import { useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';
import toast from 'react-hot-toast';
import client from '../../api/client';

export const PORTAL_RESET_DONE = 'Heslo bylo smazáno — pošlete pacientovi nový odkaz.';
export const PORTAL_RESET_NO_ACCOUNT = 'Pacient zatím nemá účet v portálu.';

export async function resetPortalPassword(patientId: string): Promise<void> {
  await client.post(`/api/v1/patients/${patientId}/portal-password/reset`);
}

export default function PortalPasswordReset({
  patientId,
  size = 'small',
}: {
  patientId: string;
  size?: 'small' | 'medium';
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await resetPortalPassword(patientId);
      toast.success(PORTAL_RESET_DONE);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) toast.error(PORTAL_RESET_NO_ACCOUNT);
      else toast.error('Heslo se nepodařilo smazat. Zkuste to prosím znovu.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Button size={size} variant="outlined" onClick={() => setConfirming(true)}>
        Resetovat heslo do portálu
      </Button>
      <Dialog open={confirming} onClose={busy ? undefined : () => setConfirming(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Resetovat heslo do portálu?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Stávající heslo pacienta se smaže a přestane platit. Pacientovi pak pošlete nový odkaz,
            přes který si nastaví heslo nové.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setConfirming(false)} disabled={busy}>Zrušit</Button>
          <Button variant="contained" color="error" onClick={() => void run()} disabled={busy}>
            {busy ? 'Ruším…' : 'Smazat heslo'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
