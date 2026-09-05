/* ══════════════════════════════════════════════════════════════
   CUSTOM FIELDS — PLAN-01 Feature A76-A80
   - Define custom patient/appointment fields
   - Field types: text, number, date, select, checkbox
   - Drag to reorder
   ══════════════════════════════════════════════════════════════ */
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Grid, TextField,
  FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, Chip
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, DragIndicator as DragIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  entity: 'patient' | 'appointment' | 'invoice';
  options?: string[];
  required: boolean;
  active: boolean;
}

export default function CustomFields() {
  const [fields, setFields] = useState<CustomField[]>([
    { id: '1', name: 'Sport', type: 'select', entity: 'patient', options: ['Fotbal', 'Hokej', 'Tenis', 'Atletika'], required: false, active: true },
    { id: '2', name: 'Pozice', type: 'text', entity: 'patient', required: false, active: true },
    { id: '3', name: 'Klub', type: 'text', entity: 'patient', required: false, active: true },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState<Partial<CustomField>>({ name: '', type: 'text', entity: 'patient', required: false, active: true });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const handleSave = () => {
    if (!formData.name) return;
    if (editing) {
      setFields(fields.map(f => f.id === editing.id ? { ...f, ...formData } as CustomField : f));
    } else {
      setFields([...fields, { ...formData, id: Date.now().toString() } as CustomField]);
    }
    setDialogOpen(false);
    setSnackbar({ open: true, message: 'Pole uloženo', severity: 'success' });
  };

  const handleDelete = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    setSnackbar({ open: true, message: 'Pole smazáno', severity: 'success' });
  };

  const ENTITY_LABELS: Record<string, string> = { patient: 'Pacient', appointment: 'Termín', invoice: 'Faktura' };
  const TYPE_LABELS: Record<string, string> = { text: 'Text', number: 'Číslo', date: 'Datum', select: 'Výběr', checkbox: 'Přepínač' };

  return (
    <Box>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>Vlastní pole</Typography>
            <Typography variant="body2" color="text.secondary">Definice vlastních polí pro pacienty a termíny</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditing(null); setFormData({ name: '', type: 'text', entity: 'patient', required: false, active: true }); setDialogOpen(true); }}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>
            Přidat pole
          </Button>
        </Box>
      </motion.div>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8f9fa' }}>
              <TableCell sx={{ fontWeight: 700 }}>Název</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Typ</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Entita</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Povinné</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Aktivní</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Akce</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map((field) => (
              <TableRow key={field.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{field.name}</TableCell>
                <TableCell><Chip label={TYPE_LABELS[field.type]} size="small" /></TableCell>
                <TableCell>{ENTITY_LABELS[field.entity]}</TableCell>
                <TableCell>{field.required ? 'Ano' : 'Ne'}</TableCell>
                <TableCell><Switch checked={field.active} size="small" /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => { setEditing(field); setFormData(field); setDialogOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => handleDelete(field.id)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Upravit pole' : 'Nové pole'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Název pole" value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Typ</InputLabel>
                <Select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as any })} label="Typ">
                  <MenuItem value="text">Text</MenuItem>
                  <MenuItem value="number">Číslo</MenuItem>
                  <MenuItem value="date">Datum</MenuItem>
                  <MenuItem value="select">Výběr</MenuItem>
                  <MenuItem value="checkbox">Přepínač</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Entita</InputLabel>
                <Select value={formData.entity} onChange={(e) => setFormData({ ...formData, entity: e.target.value as any })} label="Entita">
                  <MenuItem value="patient">Pacient</MenuItem>
                  <MenuItem value="appointment">Termín</MenuItem>
                  <MenuItem value="invoice">Faktura</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel control={<Switch checked={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })} />} label="Povinné pole" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>Zrušit</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}
            sx={{ bgcolor: '#0D7377', '&:hover': { bgcolor: '#095456' } }}>Uložit</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
