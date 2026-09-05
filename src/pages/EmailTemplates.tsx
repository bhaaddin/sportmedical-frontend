/* ══════════════════════════════════════════════════════════════
   EMAIL TEMPLATES — PLAN-01 Feature A21-A30
   - CRUD for email templates
   - Variable preview
   - Category filtering
   - Active/inactive toggle
   ══════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Chip, Switch, FormControlLabel, Snackbar, Alert, Skeleton
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon,
  Email as EmailIcon, Visibility as PreviewIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import client from '../api/client';

/* ── Types ── */
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  isActive: boolean;
  category: 'appointment' | 'followup' | 'marketing' | 'system';
}

/* ── Config ── */
const CATEGORY_LABELS: Record<string, string> = {
  appointment: 'Termíny',
  followup: 'Následné kontroly',
  marketing: 'Marketing',
  system: 'Systémové',
};

const CATEGORY_COLORS: Record<string, string> = {
  appointment: '#0D7377',
  followup: '#2E7D32',
  marketing: '#ED6C02',
  system: '#0288D1',
};

/* ══════════════════════════════════════════════════════════════ */
export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState<Partial<EmailTemplate>>({
    name: '', subject: '', body: '', variables: [], isActive: true, category: 'appointment',
  });

  /* ── Load templates ── */
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/email/templates');
      const data = res.data?.value ?? res.data;
      setTemplates(Array.isArray(data) ? data : data?.items ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  /* ── Save template ── */
  const handleSave = async () => {
    try {
      const url = editingTemplate ? `/api/email/templates/${editingTemplate.id}` : '/api/email/templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      await client[method.toLowerCase()](url, formData);
      setSnackbar({ open: true, message: 'Šablona uložena', severity: 'success' });
      setOpenDialog(false);
      loadTemplates();
    } catch {
      setSnackbar({ open: true, message: 'Chyba při ukládání', severity: 'error' });
    }
  };

  /* ── Delete template ── */
  const handleDelete = async (id: string) => {
    if (!window.confirm('Opravdu chcete smazat tuto šablonu?')) return;
    try {
      await client.delete(`/api/email/templates/${id}`);
      setSnackbar({ open: true, message: 'Šablona smazána', severity: 'success' });
      loadTemplates();
    } catch {
      setSnackbar({ open: true, message: 'Chyba při mazání', severity: 'error' });
    }
  };

  /* ── Preview template ── */
  const handlePreview = (template: EmailTemplate) => {
    let preview = template.body;
    preview = preview.replace(/\{\{patientName\}\}/g, 'Jan Novák');
    preview = preview.replace(/\{\{appointmentDate\}\}/g, '15.03.2026');
    preview = preview.replace(/\{\{appointmentTime\}\}/g, '14:30');
    preview = preview.replace(/\{\{clinicName\}\}/g, 'SportMedical');
    setPreviewContent(preview);
    setPreviewOpen(true);
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={3}>
          {[1, 2, 3].map(i => (
            <Grid key={i} size={{ xs: 12, md: 6 }}>
              <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmailIcon color="primary" /> Email šablony
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Správa šablon pro automatické emaily
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            setEditingTemplate(null);
            setFormData({ name: '', subject: '', body: '', variables: [], isActive: true, category: 'appointment' });
            setOpenDialog(true);
          }} sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>
            Nová šablona
          </Button>
        </Box>
      </motion.div>

      {/* Templates Grid */}
      <Grid container spacing={3}>
        {templates.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <EmailIcon sx={{ fontSize: 48, color: '#ddd', mb: 1 }} />
                <Typography color="text.secondary">Žádné šablony</Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          templates.map((template, i) => (
            <Grid key={template.id} size={{ xs: 12, md: 6 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3) }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{template.name}</Typography>
                      <Chip label={CATEGORY_LABELS[template.category]} size="small"
                        sx={{ bgcolor: CATEGORY_COLORS[template.category] + '18', color: CATEGORY_COLORS[template.category], fontWeight: 500 }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Předmět: {template.subject}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {template.variables.map((v) => (
                        <Chip key={v} label={`{{${v}}}`} size="small" variant="outlined" />
                      ))}
                    </Box>
                    <FormControlLabel control={<Switch checked={template.isActive} size="small" />} label="Aktivní" />
                  </CardContent>
                  <CardActions>
                    <IconButton size="small" onClick={() => handlePreview(template)}><PreviewIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => {
                      setEditingTemplate(template);
                      setFormData(template);
                      setOpenDialog(true);
                    }}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => handleDelete(template.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </CardActions>
                </Card>
              </motion.div>
            </Grid>
          ))
        )}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingTemplate ? 'Upravit šablonu' : 'Nová šablona'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Název šablony" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Předmět emailu" value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline rows={10} label="Obsah emailu" value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                helperText="Použijte {{variableName}} pro vložení proměnných" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel control={<Switch checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />} label="Aktivní šablona" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button onClick={handleSave} variant="contained"
            disabled={!formData.name || !formData.subject}
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3, fontWeight: 600 }}>Uložit</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Náhled emailu</DialogTitle>
        <DialogContent>
          <Card sx={{ p: 3, whiteSpace: 'pre-wrap' }}>{previewContent}</Card>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPreviewOpen(false)} sx={{ borderRadius: 2 }}>Zavřít</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
