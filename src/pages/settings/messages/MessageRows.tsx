/*
 * The two lists of Zprávy: the built-in messages (grouped Pacienti / Kluby, each with its on/off switch) and the clinic's own.
 * A row says what the message is in one line; "Upravit" opens the editor, nothing else is on the row.
 */
import { useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, Switch, Typography,
} from '@mui/material';
import { DeleteOutlined } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailTemplatesApi } from '../../../api/emailTemplates';
import type { EmailTemplate } from '../../../api/emailTemplates';
import { errorText } from '../../../components/booking/errorText';
import { TARGET_SX } from '../../../ui/shelf';
import { AUDIENCE_LABEL } from './messagesModel';

export const TEMPLATES_KEY = ['email-templates'] as const;

function Row({ title, line, chips, children }: { title: string; line: string; chips?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box
      role="listitem"
      sx={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 2, py: 1.25, minHeight: 56,
        '& + &': { borderTop: '1px solid', borderColor: 'divider' },
      }}
    >
      <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
          <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
          {chips}
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>{line}</Typography>
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', ml: 'auto' }}>{children}</Stack>
    </Box>
  );
}

export function GroupLabel({ children }: { children: string }) {
  return (
    <Typography component="h3" sx={{ px: 2, pt: 1.5, pb: 0.5, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'text.secondary' }}>
      {children}
    </Typography>
  );
}

/** Built-in messages of one group, each with its automatic-sending switch. */
export function AutoRows({ templates, onEdit, onToast }: { templates: readonly EmailTemplate[]; onEdit: (t: EmailTemplate) => void; onToast: (text: string) => void }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) => emailTemplatesApi.setAutoSend(code, enabled),
    onMutate: async ({ code, enabled }) => {
      await queryClient.cancelQueries({ queryKey: TEMPLATES_KEY });
      const before = queryClient.getQueryData<EmailTemplate[]>(TEMPLATES_KEY);
      queryClient.setQueryData<EmailTemplate[]>(TEMPLATES_KEY, (list) => list?.map((item) => (item.code === code ? { ...item, autoSend: enabled } : item)));
      return { before };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(TEMPLATES_KEY, context?.before);
      onToast('Přepínač se nepodařilo uložit.');
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }); },
  });

  return (
    <>
      {templates.map((template) => (
        <Row
          key={template.code}
          title={template.name}
          line={template.description}
          chips={template.isCustomized ? <Chip size="small" label="upraveno" variant="outlined" color="primary" /> : null}
        >
          {template.autoSend !== null ? (
            <Switch
              checked={template.autoSend}
              onChange={(_event, enabled) => toggle.mutate({ code: template.code, enabled })}
              slotProps={{ input: { 'aria-label': `Posílat automaticky: ${template.name}` } }}
              sx={{ '@media (max-width: 1279.95px)': { p: 1.5, width: 68, height: 52 } }}
            />
          ) : null}
          <Button variant="outlined" onClick={() => onEdit(template)} sx={TARGET_SX} aria-label={`Upravit: ${template.name}`}>Upravit</Button>
        </Row>
      ))}
    </>
  );
}

/** The clinic's own messages, with edit and a confirmed delete. */
export function CustomRows({ templates, onEdit, onToast }: { templates: readonly EmailTemplate[]; onEdit: (t: EmailTemplate) => void; onToast: (text: string) => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [doomed, setDoomed] = useState<EmailTemplate | null>(null);
  const remove = useMutation({
    mutationFn: (code: string) => emailTemplatesApi.remove(code),
    onSuccess: () => {
      setDoomed(null);
      onToast('Zpráva smazána.');
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY });
    },
  });

  return (
    <>
      {templates.map((template) => (
        <Row
          key={template.code}
          title={template.name}
          line={template.subject}
          chips={<Chip size="small" label={AUDIENCE_LABEL[template.audience]} />}
        >
          <Button variant="outlined" onClick={() => onEdit(template)} sx={TARGET_SX} aria-label={`Upravit: ${template.name}`}>Upravit</Button>
          <IconButton aria-label={`Smazat: ${template.name}`} onClick={() => { remove.reset(); setDoomed(template); }} sx={{ minWidth: 44, minHeight: 44 }}>
            <DeleteOutlined />
          </IconButton>
        </Row>
      ))}
      <Dialog open={doomed !== null} onClose={() => setDoomed(null)} aria-labelledby="message-delete-title">
        <DialogTitle id="message-delete-title">Smazat zprávu?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Zpráva „{doomed?.name}“ zmizí ze seznamu. Už odeslané e-maily se nemění.
          </DialogContentText>
          {remove.error ? <DialogContentText color="error" sx={{ mt: 1 }}>{errorText(remove.error, t)}</DialogContentText> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDoomed(null)} sx={TARGET_SX}>Ne</Button>
          <Button color="error" variant="contained" disabled={remove.isPending} onClick={() => doomed && remove.mutate(doomed.code)} sx={TARGET_SX}>
            Smazat
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
