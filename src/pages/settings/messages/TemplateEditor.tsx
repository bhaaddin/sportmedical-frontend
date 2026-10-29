/*
 * One message, edited: subject and body, the placeholders as chips, a preview of the real HTML, reset (built-in) and a
 * test-send to yourself. The same dialog creates a custom message (`template === null`): name, who it is for, subject, body.
 * After "Vytvořit" the dialog stays open on the new message, so the preview and the test are one click away.
 */
import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailTemplatesApi } from '../../../api/emailTemplates';
import type { EmailPlaceholder, EmailTemplate, RenderedEmail, TemplateAudience } from '../../../api/emailTemplates';
import { errorText } from '../../../components/booking/errorText';
import { HtmlPreview } from '../../../components/messages/HtmlPreview';
import { useIsPhone } from '../../../layout/useDevice';
import { TARGET_SX } from '../../../ui/shelf';
import { placeholderToken, singleBraceWarning } from '../emailTemplateText';
import { AUDIENCE_LABEL, placeholdersFor } from './messagesModel';

interface Props {
  /** The message to edit; `null` = write a new custom message. */
  template: EmailTemplate | null;
  onClose: () => void;
  onToast: (text: string) => void;
}

export function TemplateEditor({ template, onClose, onToast }: Props) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  const queryClient = useQueryClient();
  /* After "Vytvořit" the editor carries on with the message the server made. */
  const [current, setCurrent] = useState<EmailTemplate | null>(template);
  const [name, setName] = useState(template?.name ?? '');
  const [audience, setAudience] = useState<TemplateAudience>(template?.audience ?? 'patient');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.bodyHtml ?? '');
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const isNew = current === null;
  const isCustom = current === null || current.isCustom;
  const placeholders: readonly EmailPlaceholder[] = current === null ? placeholdersFor(audience) : current.placeholders;

  const adopt = (saved: EmailTemplate) => {
    setCurrent(saved);
    setName(saved.name);
    setSubject(saved.subject);
    setBody(saved.bodyHtml);
    void queryClient.invalidateQueries({ queryKey: ['email-templates'] });
  };

  const save = useMutation({
    mutationFn: () => (current === null
      ? emailTemplatesApi.create({ name: name.trim(), subject, bodyHtml: body, audience })
      : emailTemplatesApi.save(current.code, subject, body, current.isCustom ? name.trim() : undefined)),
    onSuccess: (saved) => { adopt(saved); onToast(isNew ? 'Zpráva vytvořena.' : 'Zpráva uložena.'); },
  });
  const reset = useMutation({
    mutationFn: () => emailTemplatesApi.reset(current!.code),
    onSuccess: (saved) => { adopt(saved); setPreview(null); onToast('Zpráva vrácena na původní znění.'); },
  });
  const previewMutation = useMutation({
    mutationFn: () => emailTemplatesApi.preview(current!.code, subject, body),
    onSuccess: setPreview,
  });
  const test = useMutation({
    mutationFn: () => emailTemplatesApi.testSend(current!.code),
    onSuccess: (result) => onToast(`Zkušební e-mail odeslán na ${result.sentTo}.`),
  });

  const dirty = current === null
    ? name.trim() !== '' || subject !== '' || body !== ''
    : subject !== current.subject || body !== current.bodyHtml || (current.isCustom && name.trim() !== current.name);
  const braceWarning = singleBraceWarning(subject, body);
  const canSave = dirty && subject.trim() !== '' && body.trim() !== '' && (!isCustom || name.trim() !== '')
    && braceWarning === null && !save.isPending;

  const insert = (placeholder: EmailPlaceholder) => {
    const token = placeholderToken(placeholder.key);
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const errors = [save.error, reset.error, test.error, previewMutation.error].filter((e) => e != null);

  return (
    <Dialog open onClose={onClose} fullScreen={phone} fullWidth maxWidth="md" aria-labelledby="message-editor-title">
      <DialogTitle id="message-editor-title">
        {current === null ? 'Nová zpráva' : current.name}
        {current !== null && !current.isCustom && current.isCustomized ? <Chip size="small" label="upraveno" sx={{ ml: 1 }} /> : null}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {current !== null && current.description !== '' ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{current.description}</Typography>
          ) : null}
          {errors.map((error, i) => <Alert key={i} severity="error">{errorText(error, t)}</Alert>)}
          {braceWarning !== null ? <Alert severity="warning">{braceWarning}</Alert> : null}

          {isCustom ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Název zprávy" value={name} onChange={(e) => setName(e.target.value)} fullWidth required />
              <TextField
                select
                label="Pro koho"
                value={audience}
                onChange={(e) => setAudience(e.target.value as TemplateAudience)}
                disabled={!isNew}
                helperText={isNew ? undefined : 'Po vytvoření už se nemění.'}
                sx={{ minWidth: { sm: 200 } }}
              >
                {(Object.keys(AUDIENCE_LABEL) as TemplateAudience[]).map((key) => (
                  <MenuItem key={key} value={key} sx={{ minHeight: 44 }}>{AUDIENCE_LABEL[key]}</MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : null}

          <TextField label="Předmět" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth />
          <TextField
            label="Text zprávy (HTML)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            inputRef={bodyRef}
            fullWidth
            multiline
            minRows={8}
            maxRows={16}
            slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
          />

          {placeholders.length > 0 ? (
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                Zástupné údaje - klepnutím vložíte na místo kurzoru:
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {placeholders.map((placeholder) => (
                  <Tooltip key={placeholder.key} title={`${placeholder.description} - např. „${placeholder.sample}“`}>
                    <Chip label={placeholder.key} onClick={() => insert(placeholder)} sx={{ cursor: 'pointer', minHeight: { xs: 44, lg: 32 } }} />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          ) : null}

          {preview !== null ? (
            <Box>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Náhled: {preview.subject}</Typography>
              <HtmlPreview html={preview.bodyHtml} />
            </Box>
          ) : null}
          {isNew ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Náhled a zkušební e-mail budou k dispozici po vytvoření zprávy.</Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
        {current !== null && !current.isCustom ? (
          <Button color="inherit" disabled={!current.isCustomized || reset.isPending} onClick={() => reset.mutate()} sx={TARGET_SX}>
            Vrátit původní znění
          </Button>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        {!isNew ? (
          <>
            <Button variant="outlined" disabled={previewMutation.isPending} onClick={() => previewMutation.mutate()} sx={TARGET_SX}>Náhled</Button>
            {/* The server sends the SAVED message; with unsaved edits the test would show the old wording. */}
            <Tooltip title={dirty ? 'Zkušební e-mail se posílá z uložené zprávy. Nejdřív uložte změny.' : ''}>
              <span>
                <Button variant="outlined" disabled={test.isPending || dirty} onClick={() => test.mutate()} sx={TARGET_SX}>Poslat zkušební sobě</Button>
              </span>
            </Tooltip>
          </>
        ) : null}
        <Button onClick={onClose} sx={TARGET_SX}>Zavřít</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => save.mutate()} sx={TARGET_SX}>
          {isNew ? 'Vytvořit' : 'Uložit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
