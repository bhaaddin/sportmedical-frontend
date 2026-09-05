import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Box,
  Chip,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  TextareaAutosize,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Preview as PreviewIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import {
  useEmailTemplates,
  useSmsTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useCreateSmsTemplate,
  useUpdateSmsTemplate,
  templatesApi,
  EmailTemplate,
  SmsTemplate,
} from '../services/templatesApi';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return value === index ? <Box>{children}</Box> : null;
};

export const TemplateManager: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<EmailTemplate | null>(null);
  const [editingSms, setEditingSms] = useState<SmsTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | SmsTemplate | null>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<{
    subject?: string;
    body?: string;
    bodyHtml?: string;
    smsCount?: number;
  } | null>(null);

  const { data: emailTemplates = [] } = useEmailTemplates();
  const { data: smsTemplates = [] } = useSmsTemplates();
  
  const createEmailMutation = useCreateEmailTemplate();
  const updateEmailMutation = useUpdateEmailTemplate();
  const createSmsMutation = useCreateSmsTemplate();
  const updateSmsMutation = useUpdateSmsTemplate();

  const handleEditEmail = (template: EmailTemplate) => {
    setEditingEmail({ ...template });
    setEditDialogOpen(true);
  };

  const handleEditSms = (template: SmsTemplate) => {
    setEditingSms({ ...template });
    setEditDialogOpen(true);
  };

  const handlePreviewEmail = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    const vars: Record<string, string> = {};
    template.variables.forEach(v => { vars[v] = ''; });
    setPreviewVariables(vars);
    setPreviewResult(null);
    setPreviewDialogOpen(true);
  };

  const handlePreviewSms = (template: SmsTemplate) => {
    setPreviewTemplate(template);
    const vars: Record<string, string> = {};
    template.variables.forEach(v => { vars[v] = ''; });
    setPreviewVariables(vars);
    setPreviewResult(null);
    setPreviewDialogOpen(true);
  };

  const handlePreviewSubmit = async () => {
    if (!previewTemplate) return;

    try {
      if ('subject' in previewTemplate) {
        const result = await templatesApi.renderEmail(previewTemplate.code, previewVariables);
        setPreviewResult({ subject: result.subject, bodyHtml: result.bodyHtml });
      } else {
        const result = await templatesApi.renderSms(previewTemplate.code, previewVariables);
        setPreviewResult({ body: result.body, smsCount: result.smsCount });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Chyba při generování náhledu');
    }
  };

  const handleSaveEmail = async () => {
    if (!editingEmail) return;

    try {
      if (editingEmail.id) {
        await updateEmailMutation.mutateAsync({ code: editingEmail.code, data: editingEmail });
      } else {
        await createEmailMutation.mutateAsync(editingEmail);
      }
      toast.success('Šablona uložena');
      setEditDialogOpen(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Chyba při ukládání');
    }
  };

  const handleSaveSms = async () => {
    if (!editingSms) return;

    try {
      if (editingSms.id) {
        await updateSmsMutation.mutateAsync({ code: editingSms.code, data: editingSms });
      } else {
        await createSmsMutation.mutateAsync(editingSms);
      }
      toast.success('Šablona uložena');
      setEditDialogOpen(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Chyba při ukládání');
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Šablony notifikací
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab icon={<EmailIcon />} label="Email šablony" />
          <Tab icon={<SmsIcon />} label="SMS šablony" />
        </Tabs>

        <TabPanel value={tab} index={0}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingEmail({
                  id: '',
                  code: '',
                  name: '',
                  subject: '',
                  bodyHtml: '',
                  variables: [],
                  isActive: true,
                  version: 1,
                  createdAt: '',
                });
                setEditDialogOpen(true);
              }}
            >
              Nová email šablona
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kód</TableCell>
                  <TableCell>Název</TableCell>
                  <TableCell>Předmět</TableCell>
                  <TableCell>Variably</TableCell>
                  <TableCell>Verze</TableCell>
                  <TableCell>Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {emailTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Chip label={template.code} size="small" color="primary" />
                    </TableCell>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {template.variables.map(v => (
                          <Chip key={v} label={v} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>v{template.version}</TableCell>
                    <TableCell>
                      <Tooltip title="Náhled">
                        <IconButton size="small" onClick={() => handlePreviewEmail(template)}>
                          <PreviewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Upravit">
                        <IconButton size="small" onClick={() => handleEditEmail(template)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Box display="flex" justifyContent="flex-end" mb={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingSms({
                  id: '',
                  code: '',
                  name: '',
                  body: '',
                  variables: [],
                  isActive: true,
                  version: 1,
                  createdAt: '',
                });
                setEditDialogOpen(true);
              }}
            >
              Nová SMS šablona
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Kód</TableCell>
                  <TableCell>Název</TableCell>
                  <TableCell>Obsah</TableCell>
                  <TableCell>Variably</TableCell>
                  <TableCell>Akce</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {smsTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <Chip label={template.code} size="small" color="secondary" />
                    </TableCell>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>{template.body.substring(0, 50)}...</TableCell>
                    <TableCell>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {template.variables.map(v => (
                          <Chip key={v} label={v} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Náhled">
                        <IconButton size="small" onClick={() => handlePreviewSms(template)}>
                          <PreviewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Upravit">
                        <IconButton size="small" onClick={() => handleEditSms(template)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingEmail ? 'Úprava email šablony' : editingSms ? 'Úprava SMS šablony' : ''}
          </DialogTitle>
          <DialogContent>
            {editingEmail && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Kód"
                    value={editingEmail.code}
                    onChange={(e) => setEditingEmail({ ...editingEmail, code: e.target.value })}
                    disabled={!!editingEmail.id}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    fullWidth
                    label="Název"
                    value={editingEmail.name}
                    onChange={(e) => setEditingEmail({ ...editingEmail, name: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Předmět"
                    value={editingEmail.subject}
                    onChange={(e) => setEditingEmail({ ...editingEmail, subject: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextareaAutosize
                    minRows={10}
                    placeholder="HTML obsah šablony"
                    value={editingEmail.bodyHtml}
                    onChange={(e) => setEditingEmail({ ...editingEmail, bodyHtml: e.target.value })}
                    style={{ width: '100%', padding: '12px', fontFamily: 'monospace' }}
                  />
                </Grid>
              </Grid>
            )}

            {editingSms && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    label="Kód"
                    value={editingSms.code}
                    onChange={(e) => setEditingSms({ ...editingSms, code: e.target.value })}
                    disabled={!!editingSms.id}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    fullWidth
                    label="Název"
                    value={editingSms.name}
                    onChange={(e) => setEditingSms({ ...editingSms, name: e.target.value })}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextareaAutosize
                    minRows={5}
                    maxRows={10}
                    placeholder="SMS obsah (max 160 znaků)"
                    value={editingSms.body}
                    onChange={(e) => setEditingSms({ ...editingSms, body: e.target.value })}
                    style={{ width: '100%', padding: '12px', fontFamily: 'monospace' }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {editingSms.body.length}/160 znaků
                  </Typography>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Zrušit</Button>
            <Button onClick={editingEmail ? handleSaveEmail : handleSaveSms} variant="contained">
              Uložit
            </Button>
          </DialogActions>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Náhled šablony</DialogTitle>
          <DialogContent>
            {previewTemplate && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Proměnné:
                  </Typography>
                  {previewTemplate.variables.map(v => (
                    <TextField
                      key={v}
                      fullWidth
                      size="small"
                      label={v}
                      value={previewVariables[v] || ''}
                      onChange={(e) => setPreviewVariables({
                        ...previewVariables,
                        [v]: e.target.value,
                      })}
                      sx={{ mb: 1 }}
                    />
                  ))}
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" onClick={handlePreviewSubmit}>
                    Generovat náhled
                  </Button>
                </Grid>
                {previewResult && (
                  <Grid size={{ xs: 12 }}>
                    {previewResult.subject && (
                      <Box mb={2}>
                        <Typography variant="subtitle2">Předmět:</Typography>
                        <Typography>{previewResult.subject}</Typography>
                      </Box>
                    )}
                    {previewResult.bodyHtml && (
                      <Box mb={2}>
                        <Typography variant="subtitle2">Obsah:</Typography>
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: 'grey.100',
                            borderRadius: 1,
                            maxHeight: 400,
                            overflow: 'auto',
                          }}
                          dangerouslySetInnerHTML={{ __html: previewResult.bodyHtml }}
                        />
                      </Box>
                    )}
                    {previewResult.body && (
                      <Box mb={2}>
                        <Typography variant="subtitle2">SMS obsah:</Typography>
                        <Typography>{previewResult.body}</Typography>
                        {previewResult.smsCount && (
                          <Typography variant="caption">
                            Počet SMS: {previewResult.smsCount}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewDialogOpen(false)}>Zavřít</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};