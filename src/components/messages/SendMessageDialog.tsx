import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, MenuItem, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailTemplatesApi } from '../../api/emailTemplates';
import type { SendResult } from '../../api/emailTemplates';
import { BookingApiError } from '../../api/apiError';
import { useIsPhone } from '../../layout/useDevice';
import { sendableTo, toSendTarget, type MessageTarget } from '../../pages/settings/messages/messagesModel';
import { TARGET_SX } from '../../ui/shelf';
import { errorText } from '../booking/errorText';
import { HtmlPreview } from './HtmlPreview';

interface Props {
  target: MessageTarget;
  onClose: () => void;
  onSent: (queued: number) => void;
}

const NOT_DEPLOYED = 'Odesílání zpráv server zatím neumí. Zkuste to po nasazení nové verze.';

export default function SendMessageDialog({ target, onClose, onSent }: Props) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  /* 'written' = typed here, sent once, nothing saved; 'saved' = one of the clinic's own messages from Nastavení - Zprávy. */
  const [mode, setMode] = useState<'written' | 'saved' | null>(null);
  const [code, setCode] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [includePlayers, setIncludePlayers] = useState(false);
  const [preview, setPreview] = useState<SendResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const list = useQuery({ queryKey: ['email-templates'], queryFn: emailTemplatesApi.list, retry: false });
  const choices = sendableTo(list.data ?? [], target.kind);
  /* Until somebody picks, a clinic with saved messages starts on them and one without starts on writing. */
  const current = mode ?? (choices.length > 0 ? 'saved' : 'written');
  const ready = current === 'written' ? subject.trim() !== '' && text.trim() !== '' : code !== '';
  const run = (dry: boolean) => (current === 'written'
    ? emailTemplatesApi.sendWritten(subject, text, toSendTarget(target, includePlayers), dry)
    : emailTemplatesApi.send(code, toSendTarget(target, includePlayers), dry));

  const dryRun = useMutation({
    mutationFn: () => run(true),
    onSuccess: setPreview,
  });
  const send = useMutation({
    mutationFn: () => run(false),
    onSuccess: (result) => onSent(result.queued),
    onSettled: () => setConfirming(false),
  });

  /* Any change of what is sent makes the earlier preview stale. */
  const forget = () => { setPreview(null); dryRun.reset(); send.reset(); };
  const failure = (error: unknown): string =>
    (error instanceof BookingApiError && error.kind === 'notFound' ? NOT_DEPLOYED : errorText(error, t));
  const error = (current === 'saved' ? list.error : null) ?? dryRun.error ?? send.error;
  const canSend = preview !== null && preview.recipients > 0 && !send.isPending;

  return (
    <Dialog open onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="send-message-title">
      <DialogTitle id="send-message-title">Poslat zprávu</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error ? <Alert severity={error instanceof BookingApiError && error.kind === 'notFound' ? 'info' : 'error'}>{failure(error)}</Alert> : null}
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={current}
            onChange={(_, next: 'written' | 'saved' | null) => { if (next !== null) { setMode(next); forget(); } }}
            aria-label="Druh zprávy"
          >
            <ToggleButton value="written" sx={TARGET_SX}>Napsat vlastní</ToggleButton>
            <ToggleButton value="saved" sx={TARGET_SX}>Uložená zpráva</ToggleButton>
          </ToggleButtonGroup>

          {current === 'written' ? (
            <>
              <TextField
                label="Předmět"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); forget(); }}
                slotProps={{ htmlInput: { maxLength: 200 } }}
                fullWidth
              />
              <TextField
                label="Text zprávy"
                value={text}
                onChange={(e) => { setText(e.target.value); forget(); }}
                placeholder={'Dobrý den,\n\n…'}
                slotProps={{ htmlInput: { maxLength: 10000 } }}
                multiline
                minRows={6}
                fullWidth
              />
            </>
          ) : (
            <>
              {list.isSuccess && choices.length === 0 ? (
                <Alert severity="info">
                  Zatím nemáte žádnou uloženou zprávu pro {target.kind === 'club' ? 'kluby' : 'pacienty'}. Napište ji tady jako vlastní, nebo si ji uložte v Nastavení - Zprávy.
                </Alert>
              ) : null}
              <TextField
                select
                label="Zpráva"
                value={code}
                onChange={(e) => { setCode(e.target.value); forget(); }}
                disabled={list.isPending || choices.length === 0}
                fullWidth
              >
                {choices.map((choice) => (
                  <MenuItem key={choice.code} value={choice.code} sx={{ minHeight: 44 }}>{choice.name}</MenuItem>
                ))}
              </TextField>
            </>
          )}
          {target.kind === 'club' ? (
            <FormControlLabel
              control={<Checkbox checked={includePlayers} onChange={(e) => { setIncludePlayers(e.target.checked); forget(); }} sx={{ p: 1.5 }} />}
              label="Včetně hráčů"
            />
          ) : null}

          {preview !== null ? (
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{preview.subject}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                Příjemců: {preview.recipients}, bez e-mailu: {preview.skippedWithoutEmail}
              </Typography>
              {preview.recipients === 0 ? <Alert severity="warning" sx={{ mb: 1 }}>Nikdo z vybraných nemá e-mail, nebylo by co odeslat.</Alert> : null}
              <HtmlPreview html={preview.bodyHtml} height={300} />
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} sx={TARGET_SX}>Zavřít</Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" disabled={!ready || dryRun.isPending} onClick={() => dryRun.mutate()} sx={TARGET_SX}>Náhled</Button>
        <Button variant="contained" disabled={!canSend} onClick={() => setConfirming(true)} sx={TARGET_SX}>Odeslat</Button>
      </DialogActions>

      <Dialog open={confirming} onClose={() => setConfirming(false)} aria-labelledby="send-confirm-title">
        <DialogTitle id="send-confirm-title">Odeslat zprávu?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zpráva odejde {preview?.recipients ?? 0} {preview?.recipients === 1 ? 'příjemci' : 'příjemcům'}. Odeslání nejde vzít zpět.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} sx={TARGET_SX}>Zpět</Button>
          <Button variant="contained" disabled={send.isPending} onClick={() => send.mutate()} sx={TARGET_SX}>Odeslat</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
