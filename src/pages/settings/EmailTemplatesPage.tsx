/* ══════════════════════════════════════════════════════════════
   E-MAILOVÉ ŠABLONY

   Every e-mail the system sends, editable: subject and body with
   {{zástupné.symboly}}, the list of symbols this e-mail knows with one
   sentence each, a preview with sample values as a patient would see it, a
   way back to the shipped wording, and a test send to the signed-in
   employee's own address that says plainly when SMTP is not set up.

   The old editor saved into the browser and rendered nothing; this one saves
   through PUT /api/email-templates/{code} and the outbox renders from it.
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Stack, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import MailOutlineIcon from '@mui/icons-material/EmailOutlined';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AsyncSection } from '../../components/booking/AsyncSection';
import {
  emailTemplatesApi, templateRefusal, unknownPlaceholders, type EmailTemplate, type RenderedEmail,
} from '../../api/emailTemplates';

const CATEGORY_LABELS: Record<string, string> = {
  registrace: 'Registrace pacienta',
  rezervace: 'Termíny',
};

export default function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const [notice, setNotice] = useState<{ severity: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const templatesQuery = useQuery({ queryKey: ['email-templates'], queryFn: emailTemplatesApi.list });
  const templates = templatesQuery.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['email-templates'] });

  const save = useMutation({
    mutationFn: ({ code, input }: { code: string; input: { subject: string; bodyHtml: string } }) =>
      emailTemplatesApi.save(code, input),
    onSuccess: async () => {
      await invalidate();
      setNotice({ severity: 'success', text: 'Šablona uložena. Od teď se e-maily posílají v tomto znění.' });
      setEditing(null);
    },
  });

  const reset = useMutation({
    mutationFn: (code: string) => emailTemplatesApi.reset(code),
    onSuccess: async () => {
      await invalidate();
      setNotice({ severity: 'success', text: 'Šablona vrácena na původní znění.' });
      setEditing(null);
    },
  });

  const sendTest = useMutation({
    mutationFn: (code: string) => emailTemplatesApi.sendTest(code),
    onSuccess: (result) => setNotice({ severity: 'success', text: `Testovací e-mail odešel na ${result.sentTo}.` }),
    onError: (error) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setNotice({ severity: status === 409 ? 'warning' : 'error', text: templateRefusal(error) });
    },
  });

  const previewMutation = useMutation({
    mutationFn: ({ code, draft }: { code: string; draft: { subject: string; bodyHtml: string } }) =>
      emailTemplatesApi.preview(code, draft),
    onSuccess: (rendered) => setPreview(rendered),
  });

  const openEdit = (template: EmailTemplate) => {
    setEditing(template);
    setSubject(template.subject);
    setBodyHtml(template.bodyHtml);
    setPreview(null);
    save.reset();
    previewMutation.reset();
  };

  const unknown = editing ? unknownPlaceholders(editing, subject, bodyHtml) : [];
  const changed = editing !== null && (subject !== editing.subject || bodyHtml !== editing.bodyHtml);
  const canSave = editing !== null && changed && subject.trim() !== '' && bodyHtml.trim() !== '' && unknown.length === 0 && !save.isPending;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>E-mailové šablony</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Znění každého e-mailu, který systém posílá pacientům. Do textu vkládáte zástupné symboly
          ve tvaru {'{{symbol}}'}; každý e-mail má svůj seznam a systém do nich doplní skutečné údaje.
          Název, e-mail a telefon ordinace se berou z Nastavení → Veřejný web a kontakty.
        </Typography>
      </Box>

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>
      )}

      <AsyncSection
        isLoading={templatesQuery.isLoading}
        isSettled={templatesQuery.isSuccess || templatesQuery.isError}
        error={templatesQuery.error}
        isEmpty={templates.length === 0}
        emptyText="Server nevrátil žádné šablony."
        onRetry={() => void templatesQuery.refetch()}
        skeletonRows={5}
      >
        <Stack spacing={1.5}>
          {templates.map((template) => (
            <Card key={template.code} sx={{ borderRadius: 3 }}>
              <CardContent sx={{ py: 2 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap', rowGap: 1 }}>
                  <MailOutlineIcon sx={{ color: '#0D7377', mt: 0.5 }} />
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700 }}>{template.name}</Typography>
                      <Chip size="small" label={CATEGORY_LABELS[template.category] ?? template.category} />
                      {template.isCustomized
                        ? <Chip size="small" color="primary" label="Upraveno" />
                        : <Chip size="small" variant="outlined" label="Původní znění" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{template.description}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Předmět: <strong>{template.subject}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      kód: {template.code}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Poslat mi testovací e-mail">
                      <span>
                        <Button size="small" onClick={() => sendTest.mutate(template.code)} disabled={sendTest.isPending}>
                          Poslat testovací e-mail
                        </Button>
                      </span>
                    </Tooltip>
                    <Button size="small" variant="outlined" startIcon={<EditIcon fontSize="small" />}
                      aria-label={`Upravit šablonu ${template.name}`} onClick={() => openEdit(template)}>
                      Upravit
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </AsyncSection>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 700 }}>{editing?.name}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">{editing.description}</Typography>

              {save.error ? <Alert severity="error">{templateRefusal(save.error)}</Alert> : null}

              <TextField
                label="Předmět"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                fullWidth
                helperText="Předmět e-mailu; symboly fungují i tady. Nejvýše 200 znaků."
                error={subject.trim() === ''}
              />
              <TextField
                label="Text e-mailu (HTML)"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                fullWidth
                multiline
                minRows={10}
                slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
                helperText="Odstavce pište jako <p>…</p>. Prázdný odstavec (například prázdný důvod) se v e-mailu vynechá."
                error={bodyHtml.trim() === ''}
              />

              {unknown.length > 0 && (
                <Alert severity="error">
                  Tento e-mail nezná symbol {unknown.map((k) => `{{${k}}}`).join(', ')}. Použijte jen symboly ze seznamu níže.
                </Alert>
              )}

              <Box>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Symboly, které tento e-mail zná</Typography>
                <Table size="small">
                  <TableBody>
                    {editing.placeholders.map((p) => (
                      <TableRow key={p.key}>
                        <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                          {'{{'}{p.key}{'}}'}
                        </TableCell>
                        <TableCell>
                          {p.description}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Ukázka: {p.isHtml ? 'hotový odkaz' : p.sample}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              <Divider />

              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Button variant="outlined" disabled={previewMutation.isPending || unknown.length > 0}
                  onClick={() => previewMutation.mutate({ code: editing.code, draft: { subject, bodyHtml } })}>
                  Zobrazit náhled
                </Button>
                <Typography variant="body2" color="text.secondary">
                  Náhled používá ukázkové údaje (Jan Novák, čt 24. 9. 2026 09:00) a vaše nastavení ordinace.
                </Typography>
              </Stack>
              {previewMutation.error ? <Alert severity="error">{templateRefusal(previewMutation.error)}</Alert> : null}
              {preview && (
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Předmět: <strong data-testid="preview-subject">{preview.subject}</strong>
                  </Typography>
                  <Box
                    data-testid="preview-body"
                    sx={{ '& p': { my: 0.5 } }}
                    /* The server rendered it: placeholders are escaped there and the
                       only markup is the template's own, which the owner wrote. */
                    dangerouslySetInnerHTML={{ __html: preview.bodyHtml }}
                  />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          {editing?.isCustomized && (
            <Button color="warning" onClick={() => reset.mutate(editing.code)} disabled={reset.isPending} sx={{ mr: 'auto' }}>
              Vrátit původní znění
            </Button>
          )}
          <Button onClick={() => setEditing(null)}>Zrušit</Button>
          <Button variant="contained" disabled={!canSave}
            onClick={() => { if (editing) save.mutate({ code: editing.code, input: { subject, bodyHtml } }); }}>
            Uložit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
