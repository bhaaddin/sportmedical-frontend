/*
 * The e-mails the clinic sends, editable at last.
 *
 * `EmailTemplatesController` (communication.manage) has always offered the whole
 * of this — list, save with placeholder validation, reset, preview with sample
 * values, and a real test-send — but no screen reached it, so the wording of
 * every confirmation, reschedule and cancellation e-mail could only change with
 * a deploy. This is that screen: pick a template on the left, edit subject and
 * body on the right, drop in the placeholders it allows, preview it as a patient
 * would see it, and send yourself a test before saving.
 */
import { useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, Snackbar, Stack,
  TextField, Tooltip, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { emailTemplatesApi } from '../../api/emailTemplates';
import type { EmailPlaceholder, EmailTemplate, RenderedEmail } from '../../api/emailTemplates';
import { AsyncSection } from '../../components/booking/AsyncSection';
import { errorText } from '../../components/booking/errorText';

/** The delimiter the body already uses, so an inserted placeholder matches it. */
function wrap(key: string, body: string): string {
  if (body.includes('{{')) return `{{${key}}}`;
  if (/\{[a-zA-Z]/.test(body)) return `{${key}}`;
  return `{{${key}}}`;
}

export default function EmailTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const listQuery = useQuery({
    queryKey: ['email-templates'],
    queryFn: emailTemplatesApi.list,
  });
  const templates = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const selected = templates.find((template) => template.code === selectedCode) ?? null;

  const select = (template: EmailTemplate) => {
    setSelectedCode(template.code);
    setSubject(template.subject);
    setBody(template.bodyHtml);
    setPreview(null);
    save.reset();
    reset.reset();
    test.reset();
  };

  const adopt = (template: EmailTemplate) => {
    // Keep the editor in step with what the server now holds after a write.
    setSubject(template.subject);
    setBody(template.bodyHtml);
    void queryClient.invalidateQueries({ queryKey: ['email-templates'] });
  };

  const save = useMutation({
    mutationFn: () => emailTemplatesApi.save(selected!.code, subject, body),
    onSuccess: (updated) => { adopt(updated); setToast('Šablona uložena.'); },
  });
  const reset = useMutation({
    mutationFn: () => emailTemplatesApi.reset(selected!.code),
    onSuccess: (updated) => { adopt(updated); setToast('Šablona vrácena na původní znění.'); },
  });
  const previewMutation = useMutation({
    mutationFn: () => emailTemplatesApi.preview(selected!.code, subject, body),
    onSuccess: (rendered) => setPreview(rendered),
  });
  const test = useMutation({
    mutationFn: () => emailTemplatesApi.testSend(selected!.code),
    onSuccess: (result) => setToast(`Testovací e-mail odeslán na ${result.sentTo}.`),
  });

  const dirty = selected !== null && (subject !== selected.subject || body !== selected.bodyHtml);
  const canSave = dirty && subject.trim() !== '' && body.trim() !== '' && !save.isPending;

  const insertPlaceholder = (placeholder: EmailPlaceholder) => {
    const token = wrap(placeholder.key, body);
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + token); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    // Put the caret just after what we inserted, once React has re-rendered.
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Šablony e-mailů</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Co se posílá pacientům a personálu — předmět a text každého e-mailu. Vložte
          povolené zástupné údaje, podívejte se na náhled se vzorovými hodnotami a
          pošlete si testovací e-mail, než uložíte.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left: the templates */}
        <Box sx={{ flex: '1 1 280px', minWidth: 260, maxWidth: 380 }}>
          <AsyncSection
            isLoading={listQuery.isLoading}
            error={listQuery.error}
            isEmpty={templates.length === 0}
            isSettled={!listQuery.isLoading}
            emptyText="Zatím tu nejsou žádné šablony e-mailů."
            onRetry={() => listQuery.refetch()}
          >
            <Stack spacing={1}>
              {templates.map((template) => (
                <Card
                  key={template.code}
                  variant="outlined"
                  sx={{
                    borderColor: template.code === selectedCode ? 'primary.main' : 'divider',
                    borderWidth: template.code === selectedCode ? 2 : 1,
                  }}
                >
                  <CardActionArea onClick={() => select(template)}>
                    <CardContent sx={{ py: 1.5 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700 }}>{template.name}</Typography>
                        {template.isCustomized ? (
                          <Chip size="small" label="upraveno" color="primary" variant="outlined" />
                        ) : null}
                      </Stack>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {template.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Stack>
          </AsyncSection>
        </Box>

        {/* Right: the editor */}
        <Box sx={{ flex: '2 1 420px', minWidth: 300 }}>
          {selected === null ? (
            <Card variant="outlined">
              <CardContent>
                <Typography sx={{ color: 'text.secondary' }}>
                  Vyberte vlevo šablonu, kterou chcete upravit.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  {save.error ? <Alert severity="error">{errorText(save.error, t)}</Alert> : null}
                  {reset.error ? <Alert severity="error">{errorText(reset.error, t)}</Alert> : null}
                  {test.error ? <Alert severity="error">{errorText(test.error, t)}</Alert> : null}
                  {previewMutation.error ? <Alert severity="error">{errorText(previewMutation.error, t)}</Alert> : null}

                  <TextField
                    label="Předmět"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    fullWidth
                  />

                  <TextField
                    label="Text e-mailu (HTML)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    inputRef={bodyRef}
                    fullWidth
                    multiline
                    minRows={10}
                    slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
                  />

                  {selected.placeholders.length > 0 ? (
                    <Box>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        Zástupné údaje — kliknutím vložíte na místo kurzoru:
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {selected.placeholders.map((placeholder) => (
                          <Tooltip
                            key={placeholder.key}
                            title={`${placeholder.description} — např. „${placeholder.sample}“`}
                          >
                            <Chip
                              label={placeholder.key}
                              size="small"
                              onClick={() => insertPlaceholder(placeholder)}
                              sx={{ cursor: 'pointer' }}
                            />
                          </Tooltip>
                        ))}
                      </Stack>
                    </Box>
                  ) : null}

                  <Divider />

                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      disabled={!canSave}
                      onClick={() => save.mutate()}
                    >
                      Uložit
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<VisibilityIcon />}
                      disabled={previewMutation.isPending}
                      onClick={() => previewMutation.mutate()}
                    >
                      Náhled
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SendIcon />}
                      disabled={test.isPending}
                      onClick={() => test.mutate()}
                    >
                      Poslat test sobě
                    </Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <Tooltip title={selected.isCustomized ? '' : 'Šablona je v původním znění.'}>
                      <span>
                        <Button
                          color="inherit"
                          startIcon={<RestartAltIcon />}
                          disabled={!selected.isCustomized || reset.isPending}
                          onClick={() => reset.mutate()}
                        >
                          Vrátit původní znění
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Náhled — {preview?.subject}</DialogTitle>
        <DialogContent dividers>
          {/* Clinic-authored template with sample values, rendered sandboxed. */}
          <Box
            component="iframe"
            title="Náhled e-mailu"
            srcDoc={preview?.bodyHtml ?? ''}
            sandbox=""
            sx={{ width: '100%', minHeight: 320, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(null)}>Zavřít</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
