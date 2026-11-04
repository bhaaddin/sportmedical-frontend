/*
 * "Odesílat e-maily": one switch at the top of Zprávy that stops every e-mail the clinic sends. Turning it off asks first;
 * turning it on does not. On a server without the endpoint (404) the switch is simply not shown.
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Stack, Switch } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailLayoutApi } from '../../../api/emailLayout';
import { errorText } from '../../../components/booking/errorText';
import { TARGET_SX } from '../../../ui/shelf';
import { isNotDeployed } from './messagesModel';

const KEY = ['email-sending-paused'];
export const PAUSED_TEXT = 'Odesílání e-mailů je pozastavené. Pacienti ani kluby teď nedostanou žádný e-mail; e-maily z této doby se neodešlou ani později.';

export function PauseSwitch({ onToast }: { onToast: (text: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const query = useQuery({ queryKey: KEY, queryFn: emailLayoutApi.sending, retry: false });
  const save = useMutation({
    mutationFn: emailLayoutApi.saveSending,
    onSuccess: (paused) => {
      queryClient.setQueryData(KEY, paused);
      setAsking(false);
      onToast(paused ? 'Odesílání e-mailů je pozastavené.' : 'E-maily se zase odesílají.');
    },
  });

  if (query.isPending || query.isError) {
    // Old server: stay silent. Any other failure is shown, but the page carries on.
    if (query.isError && !isNotDeployed(query.error)) return <Alert severity="warning">{errorText(query.error, t)}</Alert>;
    return null;
  }
  const paused = query.data;

  return (
    <Stack spacing={1.5}>
      {paused ? <Alert severity="warning" variant="filled">{PAUSED_TEXT}</Alert> : null}
      <FormControlLabel
        control={(
          <Switch
            checked={!paused}
            disabled={save.isPending}
            onChange={(e) => { if (e.target.checked) save.mutate(false); else setAsking(true); }}
          />
        )}
        label="Odesílat e-maily"
        sx={{ minHeight: 44, m: 0 }}
      />
      {save.error != null && !asking ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}

      <Dialog open={asking} onClose={() => setAsking(false)} aria-labelledby="pause-title">
        <DialogTitle id="pause-title">Pozastavit odesílání e-mailů?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Pacienti ani kluby nedostanou žádný e-mail. E-maily z doby pozastavení se neodešlou ani později.
          </DialogContentText>
          {save.error != null ? <Alert severity="error" sx={{ mt: 2 }}>{errorText(save.error, t)}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAsking(false)} sx={TARGET_SX}>Ponechat zapnuté</Button>
          <Button color="error" variant="contained" disabled={save.isPending} onClick={() => save.mutate(true)} sx={TARGET_SX}>Pozastavit odesílání</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
