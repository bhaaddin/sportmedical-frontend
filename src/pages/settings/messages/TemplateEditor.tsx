/*
 * One message, written like in Word: the subject and the text as visual boxes, the patient's or club's details as chips
 * ("Jméno", "Datum a čas") that drop in where the caret is, and the e-mail exactly as it goes out next to it, refreshed as
 * you type. HTML exists only behind "Pro pokročilé". The same dialog creates a custom message (`template === null`).
 */
import { useEffect, useRef, useState } from 'react';
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
import { singleBraceWarning } from '../emailTemplateText';
import { AUDIENCE_LABEL, placeholdersFor } from './messagesModel';
import { RichTextEditor } from './RichTextEditor';
import type { RichTextHandle } from './RichTextEditor';
import { placeholderLabel } from './richText';

interface Props {
  /** The message to edit; `null` = write a new custom message. */
  template: EmailTemplate | null;
  onClose: () => void;
  onToast: (text: string) => void;
}

const PREVIEW_DELAY_MS = 600;

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
  const [advanced, setAdvanced] = useState(false);
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const subjectRef = useRef<RichTextHandle | null>(null);
  const bodyRef = useRef<RichTextHandle | null>(null);
  const lastBox = useRef<'subject' | 'body'>('body');

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
    onSuccess: (saved) => { adopt(saved); onToast('Zpráva vrácena na původní znění.'); },
  });
  const previewMutation = useMutation({
    mutationFn: (draft: { code: string; subject: string; body: string }) => emailTemplatesApi.preview(draft.code, draft.subject, draft.body),
    onSuccess: setPreview,
  });
  const test = useMutation({
    mutationFn: () => emailTemplatesApi.testSend(current!.code),
    onSuccess: (result) => onToast(`Zkušební e-mail odeslán na ${result.sentTo}.`),
  });

  /* The e-mail as it goes out, refreshed a moment after the typing stops. */
  const code = current?.code ?? null;
  const { mutate: refreshPreview } = previewMutation;
  useEffect(() => {
    if (code === null || subject.trim() === '' || body.trim() === '') return undefined;
    const timer = window.setTimeout(() => refreshPreview({ code, subject, body }), PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [code, subject, body, refreshPreview]);

  const dirty = current === null
    ? name.trim() !== '' || subject !== '' || body !== ''
    : subject !== current.subject || body !== current.bodyHtml || (current.isCustom && name.trim() !== current.name);
  const braceWarning = singleBraceWarning(subject, body);
  const canSave = dirty && subject.trim() !== '' && body.trim() !== '' && (!isCustom || name.trim() !== '')
    && braceWarning === null && !save.isPending;

  const insert = (key: string) => {
    if (advanced && lastBox.current === 'body') { setBody((b) => `${b}{{${key}}}`); return; }
    (lastBox.current === 'subject' ? subjectRef : bodyRef).current?.insertPlaceholder(key);
  };

  const errors = [save.error, reset.error, test.error].filter((e) => e != null);

  const editorColumn = (
    <Stack spacing={2}>
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
            sx={{ minWidth: { sm: 180 } }}
          >
            {(Object.keys(AUDIENCE_LABEL) as TemplateAudience[]).map((key) => (
              <MenuItem key={key} value={key} sx={{ minHeight: 44 }}>{AUDIENCE_LABEL[key]}</MenuItem>
            ))}
          </TextField>
        </Stack>
      ) : null}

      <RichTextEditor
        ref={subjectRef}
        label="Předmět"
        value={subject}
        onChange={setSubject}
        placeholders={placeholders}
        singleLine
        onFocus={() => { lastBox.current = 'subject'; }}
      />

      {advanced ? (
        <TextField
          label="Text zprávy (HTML)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => { lastBox.current = 'body'; }}
          fullWidth
          multiline
          minRows={10}
          maxRows={18}
          slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
        />
      ) : (
        <RichTextEditor
          ref={bodyRef}
          label="Text zprávy"
          value={body}
          onChange={setBody}
          placeholders={placeholders}
          onFocus={() => { lastBox.current = 'body'; }}
        />
      )}

      {placeholders.length > 0 ? (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Vložit údaj</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            Klikněte a údaj se doplní za každého příjemce zvlášť.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {placeholders.map((placeholder) => (
              <Tooltip key={placeholder.key} title={`${placeholder.description} Např.: ${placeholder.sample}`}>
                <Chip
                  label={placeholderLabel(placeholder.key, placeholder.description)}
                  color="primary"
                  variant="outlined"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(placeholder.key)}
                  sx={{ cursor: 'pointer', minHeight: 44 }}
                />
              </Tooltip>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Box>
        <Button size="small" color="inherit" onClick={() => setAdvanced((a) => !a)} sx={{ ...TARGET_SX, color: 'text.secondary' }}>
          {advanced ? 'Zpět na běžné psaní' : 'Pro pokročilé: upravit jako HTML'}
        </Button>
      </Box>
    </Stack>
  );

  const previewColumn = (
    <Box sx={{ position: { lg: 'sticky' }, top: { lg: 0 } }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Takhle e-mail přijde</Typography>
      {isNew ? (
        <Alert severity="info">Náhled se ukáže, jakmile zprávu vytvoříte.</Alert>
      ) : preview !== null ? (
        <>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>Předmět: <b>{preview.subject}</b></Typography>
          <HtmlPreview html={preview.bodyHtml} height={phone ? 480 : 620} dark />
        </>
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Připravuji náhled…</Typography>
      )}
      {previewMutation.error != null ? <Alert severity="warning" sx={{ mt: 1 }}>{errorText(previewMutation.error, t)}</Alert> : null}
    </Box>
  );

  return (
    <Dialog open onClose={onClose} fullScreen={phone} fullWidth maxWidth="xl" aria-labelledby="message-editor-title">
      <DialogTitle id="message-editor-title">
        {current === null ? 'Nová zpráva' : current.name}
        {current !== null && !current.isCustom && current.isCustomized ? <Chip size="small" label="upraveno" sx={{ ml: 1 }} /> : null}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(0,1fr)' }, alignItems: 'start' }}>
          {editorColumn}
          {previewColumn}
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, py: 2 }}>
        {current !== null && !current.isCustom ? (
          <Button color="inherit" disabled={!current.isCustomized || reset.isPending} onClick={() => reset.mutate()} sx={TARGET_SX}>
            Vrátit původní znění
          </Button>
        ) : null}
        <Box sx={{ flexGrow: 1 }} />
        {!isNew ? (
          /* The server sends the SAVED message; with unsaved edits the test would show the old wording. */
          <Tooltip title={dirty ? 'Nejdřív uložte změny.' : ''}>
            <span>
              <Button variant="outlined" disabled={test.isPending || dirty} onClick={() => test.mutate()} sx={TARGET_SX}>Poslat zkušební sobě</Button>
            </span>
          </Tooltip>
        ) : null}
        <Button onClick={onClose} sx={TARGET_SX}>Zavřít</Button>
        <Button variant="contained" disabled={!canSave} onClick={() => save.mutate()} sx={TARGET_SX}>
          {isNew ? 'Vytvořit' : 'Uložit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
